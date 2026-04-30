/**
 * functions/publishToSocial.js
 * Pub/Sub trigger — 'publish-news' topic
 *
 * Ön koşullar (her ikisi de true olmalı):
 *   newsItem.status      === 'verified'
 *   newsItem.adminApproved === true
 *
 * 5 platforma yayın (lib/social.js adapter):
 *   youtube, instagram, facebook, twitter, tiktok
 *
 * Sonuç:
 *   >= 1 başarı  → status 'published', publishedAt set
 *   0 başarı     → status 'failed'
 *   publishedTo  map'i her durumda güncellenir
 *
 * SOCIAL_PROVIDER env var:  'mock' (default) | 'buffer' | 'publer'
 * Secrets: BUFFER_API_KEY veya PUBLER_API_KEY (hangisi kullanılıyorsa)
 */

const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { logger }              = require('firebase-functions');
const admin                   = require('firebase-admin');
const { publishToAll }        = require('./lib/social');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.publishToSocial = onMessagePublished(
  {
    topic:   'publish-news',
    region:  'europe-west3',
    timeoutSeconds: 120,
    // TODO: add BUFFER_API_KEY / PUBLER_API_KEY secrets here when switching from mock
    // secrets: [require('firebase-functions/params').defineSecret('BUFFER_API_KEY')],
  },
  async (event) => {
    const message = event.data.message;
    const payload = message.json || JSON.parse(
      Buffer.from(message.data || '', 'base64').toString()
    );

    const { newsId, traceId = 'no-trace' } = payload;

    if (!newsId) {
      logger.error('[publishToSocial] Missing newsId', { traceId });
      return;
    }

    logger.info('[publishToSocial] Start', { traceId, newsId });

    const newsRef = db.collection('newsItems').doc(newsId);
    const snap    = await newsRef.get();

    if (!snap.exists) {
      logger.error('[publishToSocial] newsItem not found', { traceId, newsId });
      return;
    }

    const data = snap.data();

    // Guard: status and admin approval
    if (data.status !== 'verified') {
      logger.warn('[publishToSocial] status is not verified — aborting', { traceId, newsId, status: data.status });
      return;
    }

    if (data.adminApproved !== true) {
      logger.warn('[publishToSocial] adminApproved is not true — aborting', { traceId, newsId });
      return;
    }

    // Build content payload
    const content = {
      text:       data.verifiedSummary || data.rawText || '',
      summaryML:  data.summaryML       || null,
      image:      data.coverImageUrl   || null,
      link:       `https://kalkaninfo.com/haberler/${newsId}`,
    };

    // Publish to all 5 platforms
    let publishResults;
    try {
      publishResults = await publishToAll(content, traceId);
    } catch (err) {
      logger.error('[publishToSocial] publishToAll threw', { traceId, newsId, error: err.message });
      await newsRef.update({
        status:    'failed',
        publishError: err.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // TODO: send admin notification email on failure
      return;
    }

    const { results, successCount } = publishResults;

    // Flatten to simple Firestore map: platform → { success, postId, url, error }
    const publishedTo = {};
    for (const [platform, res] of Object.entries(results)) {
      publishedTo[platform] = {
        success: res.success,
        postId:  res.postId  || null,
        url:     res.url     || null,
        error:   res.error   || null,
      };
    }

    const newStatus = successCount > 0 ? 'published' : 'failed';

    const updatePayload = {
      status:      newStatus,
      publishedTo,
      publishedAt: successCount > 0 ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    };

    await newsRef.update(updatePayload);

    logger.info('[publishToSocial] Done', {
      traceId,
      newsId,
      status: newStatus,
      successCount,
      provider: process.env.SOCIAL_PROVIDER || 'mock',
    });

    // TODO: send admin notification email on complete/partial failure
    // if (successCount < 5) notifyAdmin({ newsId, publishedTo, traceId });
  }
);
