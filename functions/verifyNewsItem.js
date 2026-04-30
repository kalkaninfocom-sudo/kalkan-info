/**
 * functions/verifyNewsItem.js
 * Pub/Sub trigger — 'verify-news' topic
 *
 * 1. newsId'yi Pub/Sub mesajından al
 * 2. Firestore'dan rawText'i oku
 * 3. Claude API ile teyit et (tool_use: verify_news)
 * 4. Sonuca göre status güncelle:
 *    confidence >= 0.8 && is_valid && suggested_publish → 'verified'
 *    confidence < 0.5  || !is_valid                    → 'rejected'
 *    arası                                             → 'verifying' + manualReview flag
 *
 * Secrets (Cloud Secret Manager):
 *   ANTHROPIC_API_KEY — via lib/claude.js
 */

const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { logger }              = require('firebase-functions');
const admin                   = require('firebase-admin');
const { runWithTool, ANTHROPIC_API_KEY } = require('./lib/claude');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
const VERIFY_NEWS_TOOL = {
  name: 'verify_news',
  description: 'Kalkan/Kaş bölgesi haberi teyit et ve yayın kararı ver.',
  input_schema: {
    type: 'object',
    properties: {
      is_valid: {
        type: 'boolean',
        description: 'Metin gerçek, paylaşılabilir bir haber mi?',
      },
      confidence: {
        type: 'number',
        description: 'Teyit güven skoru 0.0-1.0',
      },
      category: {
        type: 'string',
        enum: ['acil', 'etkinlik', 'genel', 'eczane', 'hava'],
        description: 'Haber kategorisi',
      },
      summary: {
        type: 'string',
        description: 'Türkçe düzeltilmiş özet (max 280 karakter)',
      },
      summaryML: {
        type: 'object',
        description: '5 dilde özet',
        properties: {
          tr: { type: 'string' },
          en: { type: 'string' },
          ru: { type: 'string' },
          ja: { type: 'string' },
          ar: { type: 'string' },
        },
        required: ['tr', 'en', 'ru', 'ja', 'ar'],
      },
      suggested_publish: {
        type: 'boolean',
        description: 'Otomatik yayınlanmaya uygun mu?',
      },
      reason: {
        type: 'string',
        description: 'Karar gerekçesi (admin için)',
      },
    },
    required: ['is_valid', 'confidence', 'category', 'summary', 'summaryML', 'suggested_publish', 'reason'],
  },
};

const SYSTEM_PROMPT = `Sen yerel haber teyit uzmanısın.
Verilen ham metin Kalkan/Kaş bölgesi için doğru, güncel, paylaşılabilir bir haber mi değerlendir.

Değerlendirme kriterleri:
- Coğrafi bağlantı: Kalkan, Kaş, Patara, Saklıkent veya yakın çevre
- Güncellik: Spesifik tarih/saat/yer içeriyor mu?
- Güvenilirlik: Tutarlı, makul bilgi mi? Saçma sapan, spam veya reklam mı?
- Kategori: acil (sel, yangın, trafik kazası), etkinlik, genel, eczane (nöbetçi), hava
- Paylaşılabilirlik: Herkese yararlı mı? Kişisel mesaj veya gürültü mü?

Özeti 5 dilde (tr, en, ru, ja, ar) yaz — her biri max 280 karakter.`;

// ---------------------------------------------------------------------------
// Pub/Sub handler
// ---------------------------------------------------------------------------
exports.verifyNewsItem = onMessagePublished(
  {
    topic:   'verify-news',
    region:  'europe-west3',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
  },
  async (event) => {
    const message = event.data.message;
    const payload = message.json || JSON.parse(
      Buffer.from(message.data || '', 'base64').toString()
    );

    const { newsId, traceId = 'no-trace' } = payload;

    if (!newsId) {
      logger.error('[verifyNewsItem] Missing newsId in payload', { traceId });
      return;
    }

    logger.info('[verifyNewsItem] Start', { traceId, newsId });

    // Read newsItem
    const newsRef = db.collection('newsItems').doc(newsId);
    const snap    = await newsRef.get();

    if (!snap.exists) {
      logger.error('[verifyNewsItem] newsItem not found', { traceId, newsId });
      return;
    }

    const data = snap.data();

    if (data.status !== 'verifying') {
      logger.info('[verifyNewsItem] Already processed, skipping', { traceId, newsId, status: data.status });
      return;
    }

    const rawText = data.rawText || '';

    if (!rawText.trim()) {
      await newsRef.update({ status: 'rejected', claudeReason: 'rawText boş', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    }

    let claudeResult;
    try {
      claudeResult = await runWithTool(
        SYSTEM_PROMPT,
        `Ham WhatsApp mesajı:\n\n${rawText}`,
        VERIFY_NEWS_TOOL,
        { traceId }
      );
    } catch (err) {
      logger.error('[verifyNewsItem] Claude API error', { traceId, newsId, error: err.message });
      // Don't throw — leave status as 'verifying' for manual review
      await newsRef.update({
        manualReview: true,
        claudeReason: `API hatası: ${err.message}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const {
      is_valid, confidence, category, summary,
      summaryML, suggested_publish, reason,
    } = claudeResult.result;

    // Determine status
    let status;
    let manualReview = false;

    if (confidence >= 0.8 && is_valid && suggested_publish) {
      status = 'verified';
    } else if (confidence < 0.5 || !is_valid) {
      status = 'rejected';
    } else {
      status = 'verifying';
      manualReview = true;
    }

    const updatePayload = {
      status,
      manualReview,
      verifiedSummary:  summary,
      summaryML,
      claudeConfidence: confidence,
      category,
      claudeReason:     reason,
      claudeRequestId:  claudeResult.requestId,
      claudeCostUsd:    claudeResult.costUsd,
      adminApproved:    false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await newsRef.update(updatePayload);

    logger.info('[verifyNewsItem] Done', {
      traceId,
      newsId,
      status,
      manualReview,
      confidence,
      costUsd: claudeResult.costUsd,
    });
  }
);
