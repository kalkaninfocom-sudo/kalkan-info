/**
 * functions/whatsappWebhook.js
 * HTTPS Cloud Function — Meta WhatsApp Business webhook
 *
 * GET  /whatsappWebhook  → webhook verification (hub.mode / hub.verify_token / hub.challenge)
 * POST /whatsappWebhook  → inbound message → newsItems doc + Pub/Sub trigger
 *
 * Secrets (Cloud Secret Manager):
 *   META_VERIFY_TOKEN — token you set in Meta Business console
 *
 * Allowlist: automations/whatsapp-allowlist  { phones: ['+905xxxxxxxxx', ...] }
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger }      = require('firebase-functions');
const admin           = require('firebase-admin');
const { PubSub }      = require('@google-cloud/pubsub');

const META_VERIFY_TOKEN = defineSecret('META_VERIFY_TOKEN');

const pubsub = new PubSub();
const VERIFY_NEWS_TOPIC = 'verify-news';

// Ensure admin is initialised (shared across functions in same process)
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function traceId(messageId) {
  return `wa_${messageId || Date.now()}`;
}

/** Parse text, image-caption, and location from a WhatsApp message object */
function extractContent(msg) {
  let rawText  = '';
  let mediaUrl = null;
  let location = null;

  if (msg.type === 'text') {
    rawText = msg.text?.body || '';
  } else if (msg.type === 'image') {
    rawText  = msg.image?.caption || '';
    mediaUrl = msg.image?.id    || null; // Media ID — resolve via Graph API if needed
  } else if (msg.type === 'location') {
    const loc = msg.location || {};
    rawText  = loc.name ? `${loc.name} — ${loc.address || ''}` : `Konum: ${loc.latitude}, ${loc.longitude}`;
    location = { lat: loc.latitude, lng: loc.longitude, name: loc.name, address: loc.address };
  }

  return { rawText, mediaUrl, location };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

exports.whatsappWebhook = onRequest(
  {
    region:  'europe-west3',
    secrets: [META_VERIFY_TOKEN],
    // TODO: set invoker to 'public' in firebase.json if not already
  },
  async (req, res) => {
    // ------------------------------------------------------------------
    // GET — webhook verification handshake
    // ------------------------------------------------------------------
    if (req.method === 'GET') {
      const mode      = req.query['hub.mode'];
      const token     = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === META_VERIFY_TOKEN.value()) {
        logger.info('[whatsappWebhook] Webhook verified');
        return res.status(200).send(challenge);
      }

      logger.warn('[whatsappWebhook] Verification failed', { mode, tokenMatch: false });
      return res.sendStatus(403);
    }

    // ------------------------------------------------------------------
    // POST — inbound message
    // ------------------------------------------------------------------
    if (req.method !== 'POST') {
      return res.sendStatus(405);
    }

    const body = req.body;

    // Validate WhatsApp payload shape
    if (body?.object !== 'whatsapp_business_account') {
      return res.sendStatus(400);
    }

    try {
      const entries = body.entry || [];
      const processed = [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value    = change.value || {};
          const messages = value.messages || [];

          for (const msg of messages) {
            const messageId = msg.id;
            const sender    = msg.from; // e164 format e.g. '905xxxxxxxx'
            const tid       = traceId(messageId);

            logger.info('[whatsappWebhook] Incoming message', {
              traceId: tid,
              messageId,
              sender,
              type:   msg.type,
              bodyLen: msg.text?.body?.length || 0,
            });

            // Check allowlist
            const allowlistDoc = await db.doc('automations/whatsapp-allowlist').get();
            const phones = allowlistDoc.exists ? (allowlistDoc.data().phones || []) : [];
            const normalised = '+' + sender.replace(/^\+/, '');

            if (!phones.includes(normalised)) {
              logger.warn('[whatsappWebhook] Sender not in allowlist — ignoring', { traceId: tid, sender });
              continue;
            }

            const { rawText, mediaUrl, location } = extractContent(msg);

            if (!rawText && !location) {
              logger.info('[whatsappWebhook] Empty message, skipping', { traceId: tid });
              continue;
            }

            // Create newsItem doc
            const newsRef  = db.collection('newsItems').doc();
            const newsId   = newsRef.id;
            const now      = admin.firestore.FieldValue.serverTimestamp();

            const docData = {
              source:    'whatsapp',
              sourceRef: messageId,
              senderPhone: sender,
              rawText,
              mediaId:   mediaUrl,
              location:  location || null,
              status:    'verifying',
              category:  'genel',         // Claude will correct
              createdAt: now,
              updatedAt: now,
              traceId:   tid,
            };

            await newsRef.set(docData);
            logger.info('[whatsappWebhook] newsItem created', { traceId: tid, newsId });

            // Trigger verify-news Pub/Sub
            const pubsubMessage = { newsId, traceId: tid };
            await pubsub
              .topic(VERIFY_NEWS_TOPIC)
              .publishMessage({ json: pubsubMessage });

            logger.info('[whatsappWebhook] Pub/Sub triggered', { traceId: tid, topic: VERIFY_NEWS_TOPIC });
            processed.push(newsId);
          }
        }
      }

      logger.info('[whatsappWebhook] Done', { processed });
      return res.sendStatus(200);

    } catch (err) {
      logger.error('[whatsappWebhook] Unhandled error', { error: err.message, stack: err.stack });
      return res.sendStatus(500);
    }
  }
);
