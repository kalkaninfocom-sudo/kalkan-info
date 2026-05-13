/**
 * functions/instagramHarvester.js
 *
 * Kalkan bölgesi Instagram haber profillerini saatlik tarayan scheduled function.
 * Yeni post bulunca → Claude ile TR haber özeti üretir → newsItems collection'a
 * status='pending' olarak yazar.
 *
 * Sonraki adım (mevcut pipeline):
 *   - Admin paneli admin/news-moderation.html üzerinden onaylar (status='verified', adminApproved=true)
 *   - verifyNewsItem onUpdate trigger'i 'publish-news' topic'ine push eder
 *   - publishToSocial 5 platforma (IG, FB, Twitter, YouTube, TikTok) yayınlar
 *
 * BERKAY KURACAK (Firebase config secrets):
 *   firebase functions:secrets:set IG_ACCESS_TOKEN      # Instagram Graph API long-lived token
 *   firebase functions:secrets:set ANTHROPIC_API_KEY    # Claude API key (var olabilir)
 *
 * Takip edilen profil listesi → Firestore: config/instagram_profiles
 *   { profiles: [{ username, userId, enabled }] }
 *   Yoksa aşağıdaki DEFAULT_PROFILES kullanılır (Berkay sonra ekleyecek).
 *
 * NOT: Instagram Graph API kullanılır — Facebook Business hesabı gerekli.
 *      Alternatif olarak, Berkay isterse RapidAPI / Apify scraper'a geçilebilir.
 */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger }     = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin          = require('firebase-admin');
const Anthropic      = require('@anthropic-ai/sdk');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const IG_ACCESS_TOKEN   = defineSecret('IG_ACCESS_TOKEN');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Berkay buraya kendi takip edeceği yerel haber profillerini ekleyecek.
// Firestore config/instagram_profiles dokümanı varsa o öncelikli.
const DEFAULT_PROFILES = [
  // { username: 'kalkanbelediyesi',  userId: 'IG_USER_ID',   enabled: true },
  // { username: 'kalkanlife',        userId: 'IG_USER_ID',   enabled: true },
  // { username: 'kalkanguncel',      userId: 'IG_USER_ID',   enabled: true },
  // { username: 'kashaberajansi',    userId: 'IG_USER_ID',   enabled: true },
  // { username: 'antalya_haberleri', userId: 'IG_USER_ID',   enabled: true },
];

const HARVEST_LIMIT_PER_PROFILE = 5;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

exports.instagramHarvester = onSchedule(
  {
    schedule:        'every 60 minutes',
    timeZone:        'Europe/Istanbul',
    region:          'europe-west3',
    timeoutSeconds:  540,
    memory:          '512MiB',
    secrets:         [IG_ACCESS_TOKEN, ANTHROPIC_API_KEY],
  },
  async (event) => {
    const traceId = event.scheduleTime || Date.now().toString();

    if (!IG_ACCESS_TOKEN.value() || !ANTHROPIC_API_KEY.value()) {
      logger.warn('[ig-harvester] API anahtarları eksik — atlanıyor', { traceId });
      return;
    }

    // 1. Profil listesi: Firestore > Default
    let profiles = DEFAULT_PROFILES;
    try {
      const cfg = await db.collection('config').doc('instagram_profiles').get();
      if (cfg.exists && Array.isArray(cfg.data().profiles)) {
        profiles = cfg.data().profiles.filter(p => p.enabled !== false && p.userId);
      }
    } catch (err) {
      logger.warn('[ig-harvester] Firestore config okunamadı, default kullanılıyor', { err: err.message });
    }

    if (!profiles.length) {
      logger.info('[ig-harvester] Takip edilecek profil yok — Berkay config/instagram_profiles dokümanına ekleyecek');
      return;
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    let totalNew = 0;

    for (const profile of profiles) {
      try {
        const newPosts = await harvestProfile(profile, IG_ACCESS_TOKEN.value());
        for (const post of newPosts) {
          // Daha önce çekildi mi?
          const existing = await db.collection('newsItems')
            .where('source.id', '==', post.id)
            .where('source.type', '==', 'instagram')
            .limit(1)
            .get();
          if (!existing.empty) continue;

          // Claude ile özet üret
          const ai = await summarizeWithClaude(anthropic, post, profile);
          if (!ai) continue;

          // newsItems collection'a draft olarak yaz (mevcut admin moderation pipeline'ı görür)
          await db.collection('newsItems').add({
            // Standart alanlar
            title:           ai.title,
            rawText:         ai.summary,
            verifiedSummary: ai.summary,
            summaryML:       ai.summaryML || { tr: ai.summary },
            category:        ai.category   || 'Haber',
            isBreaking:      ai.isBreaking || false,
            coverImageUrl:   post.media_url || null,

            // Kaynak izi
            source: {
              type:           'instagram',
              id:             post.id,
              url:            post.permalink,
              author:         profile.username,
              originalText:   post.caption || '',
              postedAt:       post.timestamp,
            },

            // Moderation pipeline
            status:        'pending',     // 'pending' | 'verified' | 'rejected' | 'published' | 'failed'
            adminApproved: false,
            createdAt:     admin.firestore.FieldValue.serverTimestamp(),

            // Telemetri
            harvestedBy:   'instagramHarvester',
            traceId,
          });
          totalNew++;
        }
      } catch (err) {
        logger.error(`[ig-harvester] ${profile.username} hatası`, { err: err.message, traceId });
      }
    }

    logger.info('[ig-harvester] Tamamlandı', { traceId, profileCount: profiles.length, newDrafts: totalNew });
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function harvestProfile(profile, accessToken) {
  // Instagram Graph API — Business Discovery
  // https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/
  const url = `https://graph.instagram.com/${profile.userId}/media` +
              `?fields=id,caption,media_url,permalink,timestamp,media_type` +
              `&access_token=${accessToken}` +
              `&limit=${HARVEST_LIMIT_PER_PROFILE}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IG API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data || [];
}

async function summarizeWithClaude(anthropic, post, profile) {
  const caption = (post.caption || '').slice(0, 1500);
  if (!caption.trim()) return null;

  try {
    const msg = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 800,
      system:     'Sen bir yerel haber editörüsün. Kalkan, Kaş, Patara ve Antalya bölgesi için ' +
                  'objektif, kısa, açık Türkçe haber özetleri yazarsın. Reklam ve sponsorlu içerik tespit edersen reddedersin.',
      messages: [{
        role: 'user',
        content:
          `Bu, "${profile.username}" Instagram hesabından bir gönderi. Caption:\n\n` +
          `"""${caption}"""\n\n` +
          `Kalkan bölgesini ilgilendiren bir HABER mi? Eğer evetse, aşağıdaki JSON formatında dön:\n` +
          `{ "isNews": true, "title": "<60 karakter haber başlığı>", "summary": "<2-3 cümle, 250 karakter>",\n` +
          `  "category": "Etkinlik|Haber|Duyuru|Hava|Trafik|Kültür|Spor", "isBreaking": <true|false> }\n\n` +
          `Reklam, alışveriş, kişisel paylaşım veya bölgeyle alakasızsa:\n` +
          `{ "isNews": false }\n\n` +
          `SADECE JSON dön, başka açıklama yazma.`
      }]
    });

    const text = msg.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.isNews) return null;
    return parsed;
  } catch (err) {
    logger.warn('[ig-harvester] Claude özet hatası', { err: err.message, postId: post.id });
    return null;
  }
}
