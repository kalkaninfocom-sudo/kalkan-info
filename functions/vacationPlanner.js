/**
 * functions/vacationPlanner.js
 * Kalkan Info — Tatil Asistanı Cloud Function
 *
 * Tetikleyici : callable (Firebase Functions v2)
 * Bölge       : europe-west3
 * Timeout     : 540s
 * Memory      : 1GiB
 *
 * Akış:
 *   1. İstek doğrulama (tarih, grup, bütçe)
 *   2. Katalog özeti hazırla (villalar + turlar + hizmetler)
 *   3. Claude API — tool_use: create_plan — JSON tatil planı üret
 *   4. Yanıtı döndür; kullanıcı giriş yapmışsa vacations/{planId} kaydet
 *
 * Secrets: ANTHROPIC_API_KEY (Cloud Secret Manager)
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger }              = require('firebase-functions');
const admin                   = require('firebase-admin');
const https                   = require('https');
const { runWithTool, ANTHROPIC_API_KEY } = require('./lib/claude');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Tool definition — structured output for Claude
// ---------------------------------------------------------------------------
const CREATE_PLAN_TOOL = {
  name: 'create_plan',
  description: 'Kalkan/Kaş/Patara bölgesi için kişiselleştirilmiş gezi öneri taslağı oluştur. JSON formatında gün gün öneri üret.',
  input_schema: {
    type: 'object',
    required: ['days', 'rationale'],
    properties: {
      days: {
        type: 'array',
        description: 'Her gün için bileşenler dizisi',
        items: {
          type: 'object',
          required: ['date', 'dayLabel', 'items'],
          properties: {
            date:     { type: 'string', description: 'YYYY-MM-DD' },
            dayLabel: { type: 'string', description: 'Örn: Varış Günü, Tekne Turu' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type', 'title'],
                properties: {
                  type:        { type: 'string', enum: ['flight', 'transfer', 'accommodation', 'meal', 'activity', 'beach'] },
                  title:       { type: 'string' },
                  description: { type: 'string' },
                  time:        { type: 'string', description: 'Örn: 09:30' },
                  refId:       { type: 'string', description: 'Katalog ID (villa-mira, gunluk-tekne vb.)' },
                  price:       { type: 'number', description: 'Tahmini fiyat göstergesi — işletmece belirlenir, bağlayıcı değildir' },
                  priceNote:   { type: 'string', description: 'Fiyat notu (kişi başı, gecelik vb.)' },
                },
              },
            },
          },
        },
      },
      rationale: {
        type: 'string',
        description: 'Öneri hakkında kısa açıklama — neden bu villa, bu aktiviteler önerildi',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
function validateInput(data) {
  const { dateStart, dateEnd, adults, children, budget } = data;

  if (!dateStart || !dateEnd) throw new HttpsError('invalid-argument', 'dateStart ve dateEnd zorunludur.');

  const start = new Date(dateStart);
  const end   = new Date(dateEnd);
  const now   = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    throw new HttpsError('invalid-argument', 'Tarihler geçerli değil.');

  if (start <= now)
    throw new HttpsError('invalid-argument', 'Giriş tarihi gelecekte olmalıdır.');

  if (end <= start)
    throw new HttpsError('invalid-argument', 'Çıkış tarihi giriş tarihinden sonra olmalıdır.');

  const nights = Math.round((end - start) / 86400000);
  if (nights > 30)
    throw new HttpsError('invalid-argument', 'Tatil süresi en fazla 30 gece olabilir.');

  const totalPeople = (Number(adults) || 0) + (Number(children) || 0);
  if (totalPeople < 1 || totalPeople > 12)
    throw new HttpsError('invalid-argument', 'Toplam kişi sayısı 1–12 arasında olmalıdır.');

  if (!budget || Number(budget) <= 0)
    throw new HttpsError('invalid-argument', 'Bütçe pozitif bir sayı olmalıdır.');

  return { start, end, nights, totalPeople };
}

// ---------------------------------------------------------------------------
// Katalog özeti — tüm JSON yerine filtrelenmiş özet prompta eklenir
// ---------------------------------------------------------------------------
function buildCatalogSummary(formData) {
  // Villa filtresi
  const villaFilters = [];
  if (formData.seaView)     villaFilters.push('seaView:true');
  if (formData.pool)        villaFilters.push('pool:true');
  if (formData.petFriendly) villaFilters.push('petFriendly:true');
  const minCapacity = (Number(formData.adults) || 2) + (Number(formData.children) || 0);

  const villas = CATALOG_VILLAS
    .filter(v => {
      const cap = parseInt(v.capacity) || 0;
      if (cap < minCapacity) return false;
      if (formData.seaView && !v.seaView) return false;
      if (formData.pool && !v.pool) return false;
      return true;
    })
    .slice(0, 4)
    .map(v => `  - [${v.id}] ${v.name} (${v.category}, ${v.capacity}, ${v.location}) — ${v.price}`)
    .join('\n');

  // Tur filtresi
  const wantsBoat    = (formData.activities || []).includes('boat_tour');
  const wantsSafari  = (formData.activities || []).includes('hiking');
  const wantsHorse   = false;
  const wantsKano    = false;

  const tours = CATALOG_TOURS
    .filter(t => {
      if (wantsBoat   && t.category === 'Tekne Turu') return true;
      if (wantsSafari && t.category === 'Safari')     return true;
      if (wantsHorse  && t.category === 'At Turu')    return true;
      if (wantsKano   && t.category === 'Kano Turu')  return true;
      return t.featured;
    })
    .slice(0, 5)
    .map(t => `  - [${t.id}] ${t.name} — ${t.price} (${t.duration})`)
    .join('\n');

  // Transfer
  const transferLine = '  - [transfer-havalimani] Havalimanı Transferi — Dalaman: ₺2.500/Sedan, ₺4.500/VIP minibüs (7/24)';

  // Catering
  const cateringLine = (formData.food || []).includes('chef')
    ? '  - [catering] Evde Aşçı / Catering — özel menü (randevulu)'
    : '';

  return `
MEVCUT KATALOĞDAN ÖNERİLEN SEÇENEKLER:

Villalar (filtre: min ${minCapacity} kişi${villaFilters.length ? ', ' + villaFilters.join(', ') : ''}):
${villas || '  (filteye uyan villa bulunamadı, kapasitesi yeterli herhangi bir villa öner)'}

Turlar:
${tours || '  (öne çıkan turlar)'}

Transfer:
${transferLine}
${cateringLine ? '\nCatering:\n' + cateringLine : ''}
`.trim();
}

// ---------------------------------------------------------------------------
// Sistem ve kullanıcı promptu
// ---------------------------------------------------------------------------
function buildSystemPrompt() {
  return `Sen Kalkan, Kaş ve Patara bölgesinde uzman bir gezi öneri asistanısın.
Görevin: kullanıcının form verilerini analiz edip create_plan tool'unu kullanarak kişiselleştirilmiş gezi önerileri sunmak.
ÖNEMLİ: kalkaninfo.com bir seyahat acentası DEĞİLDİR. Sen rezervasyon yapmıyor, paket satmıyor, ödeme almıyorsun.
Sadece tavsiye ve öneri sunuyorsun; rezervasyon ve ödeme kullanıcı ile işletme arasında doğrudan gerçekleşir.

ZORUNLU KURALLAR:
1. create_plan tool'unu MUTLAKA kullan — düz metin yanıt KABUL EDİLMEZ.
2. Her günün items dizisine uçuş, transfer, konaklama, yemek, aktivite uygun şekilde dağıt.
3. Varış günü: uçuş + transfer + konaklama check-in.
4. Ayrılış günü: sadece check-out + transfer + uçuş.
5. Ara günler: 2-3 aktivite + yemek önerisi.
6. Fiyatları katalog verilerinden al; katalogda yoksa gerçekçi piyasa tahmini yap. Fiyatlar tahmini göstergedir, işletmece belirlenir.
7. totalPrice alanını KULLANMA — toplam/paket fiyatı verme. Sadece bireysel item fiyatları ver.
8. refId alanına MUTLAKA katalog ID'sini yaz (varsa).
9. Tüm metinler Türkçe.
10. Çocuk varsa çocuk dostu aktiviteler ekle.
11. rationale metninde "sizin için ayarlıyorum/organize ediyorum/planlıyorum" ifadelerini KULLANMA. Bunun yerine "öneri sunuyorum, rezervasyonu işletmeyle kendiniz yaparsınız" tonunu kullan.`;
}

function buildUserPrompt(formData, { nights, totalPeople }, catalogSummary) {
  const currency = formData.currency || 'TRY';
  const symbol   = { TRY: '₺', EUR: '€', USD: '$' }[currency] || currency;

  return `TATIL BİLGİLERİ:
- Tarihler: ${formData.dateStart} → ${formData.dateEnd} (${nights} gece)
- Grup: ${formData.adults} yetişkin, ${formData.children || 0} çocuk (toplam ${totalPeople} kişi)
- Bütçe: ${symbol}${Number(formData.budget).toLocaleString('tr-TR')} (toplam, ${currency})
- Kalkış: ${formData.departureAirport || 'İstanbul'} → Dalaman (DLM) veya Antalya (AYT)
- Tercih edilen havayolu: ${(formData.airlines || ['any']).join(', ')}
- Konaklama: ${formData.accommodationType || 'villa'}, ${formData.rooms || 2} oda
- Deniz manzarası: ${formData.seaView ? 'İsteniyor' : 'Fark etmez'}
- Havuz: ${formData.pool ? 'İsteniyor' : 'Fark etmez'}
- Evcil hayvan: ${formData.petFriendly ? 'Evet' : 'Hayır'}
- Yemek: ${(formData.food || []).join(', ') || 'belirtilmedi'}
${formData.cuisine && formData.cuisine.length ? `- Mutfak tercihi: ${formData.cuisine.join(', ')}` : ''}
- Aktiviteler: ${(formData.activities || []).join(', ') || 'genel'}
${formData.specialRequests ? `- Özel istekler: ${formData.specialRequests}` : ''}

${catalogSummary}

Lütfen create_plan tool'unu kullanarak ${formData.dateStart} – ${formData.dateEnd} tarihleri için gün gün tatil planı oluştur.`;
}

// ---------------------------------------------------------------------------
// Katalog sabitleri — Hosting üzerinden fetch yerine doğrudan gömülü özet
// (Data/*.json tam verisi yerine token verimliliği için sadece anahtar alanlar)
// ---------------------------------------------------------------------------
const CATALOG_VILLAS = [
  { id: 'villa-mira',    name: 'Villa Mira',    category: '4+1', capacity: 8,  location: 'Kalamar',         seaView: true,  pool: true,  price: '₺18.000/gece' },
  { id: 'villa-likya',   name: 'Villa Likya',   category: '5+1', capacity: 10, location: 'Üzümlü Mevkii',   seaView: true,  pool: true,  price: '₺24.000/gece' },
  { id: 'villa-kalamar', name: 'Villa Kalamar', category: '3+1', capacity: 6,  location: 'Kalamar',         seaView: true,  pool: true,  price: '₺14.500/gece' },
  { id: 'villa-patara',  name: 'Villa Patara',  category: '4+1', capacity: 8,  location: 'Patara yolu',     seaView: false, pool: true,  price: '₺16.000/gece' },
  { id: 'villa-akdeniz', name: 'Villa Akdeniz', category: '6+1', capacity: 12, location: 'Üzümlü Mevkii',  seaView: true,  pool: true,  price: '₺32.000/gece' },
  { id: 'villa-yedi',    name: 'Villa Yedi',    category: '3+1', capacity: 6,  location: 'Kalkan tepe',     seaView: true,  pool: true,  price: '₺13.000/gece' },
  { id: 'villa-yakamoz', name: 'Villa Yakamoz', category: '4+1', capacity: 8,  location: 'Kalamar',         seaView: true,  pool: true,  price: '₺17.500/gece' },
  { id: 'villa-aksam',   name: 'Villa Akşam',   category: '2+1', capacity: 4,  location: 'Kalkan merkez',   seaView: true,  pool: true,  price: '₺9.500/gece'  },
  { id: 'villa-mavi',    name: 'Villa Mavi',    category: '5+1', capacity: 10, location: 'Üzümlü Mevkii',  seaView: true,  pool: true,  price: '₺26.000/gece' },
  { id: 'villa-aslan',   name: 'Villa Aslan',   category: '3+1', capacity: 6,  location: 'Kalkan içi',     seaView: false, pool: true,  price: '₺11.500/gece' },
  { id: 'villa-zeytin',  name: 'Villa Zeytin',  category: '4+1', capacity: 8,  location: 'Kalamar',         seaView: true,  pool: true,  price: '₺19.000/gece' },
  { id: 'villa-ruya',    name: 'Villa Rüya',    category: '5+1', capacity: 10, location: 'Üzümlü Mevkii',  seaView: true,  pool: true,  price: '₺23.000/gece' },
];

const CATALOG_TOURS = [
  { id: 'gunluk-tekne',  name: 'Günlük Tekne Turu (12 Koy)',  category: 'Tekne Turu', price: '₺850/kişi',  duration: '08:30–18:00', featured: true  },
  { id: 'kekova-tekne',  name: 'Kekova Tekne Turu',           category: 'Tekne Turu', price: '₺1.450/kişi',duration: '08:00–19:00', featured: true  },
  { id: 'sunset-cruise', name: 'Sunset Cruise',               category: 'Tekne Turu', price: '₺750/kişi',  duration: '18:00–21:30', featured: true  },
  { id: 'patara-tekne',  name: 'Patara Plajı Tekne Turu',     category: 'Tekne Turu', price: '₺950/kişi',  duration: '09:00–17:00', featured: false },
  { id: 'jeep-safari',   name: 'Jeep Safari (Saklıkent)',     category: 'Safari',     price: '₺1.150/kişi',duration: '09:30–17:30', featured: true  },
  { id: 'quad-safari',   name: 'Quad ATV Safari',             category: 'Safari',     price: '₺1.350/quad',duration: '15:00–18:00', featured: false },
  { id: 'patara-at',     name: 'Patara Plajı At Turu',        category: 'At Turu',    price: '₺1.250/kişi',duration: '08:00–11:00', featured: true  },
  { id: 'koy-at',        name: 'Yöre Köyleri At Turu',        category: 'At Turu',    price: '₺950/kişi',  duration: '15:30–18:00', featured: false },
  { id: 'xanthos-kano',  name: 'Xanthos Nehri Kano',          category: 'Kano Turu',  price: '₺1.050/kişi',duration: '09:00–14:00', featured: true  },
  { id: 'saklikent-kano',name: 'Saklıkent Kanyon Kano',       category: 'Kano Turu',  price: '₺1.150/kişi',duration: '10:00–15:00', featured: false },
];

// ---------------------------------------------------------------------------
// Rate limit — server side (IP + UID, Firestore counter)
// Anonim: 1 plan/gün/IP; Auth: 5 plan/gün/UID
// ---------------------------------------------------------------------------
async function checkServerRateLimit(uid, ip) {
  const dayKey  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const limitId = uid ? `uid_${uid}` : `ip_${(ip || 'unknown').replace(/[.:]/g, '_')}`;
  const docRef  = db.collection('_rate_limits').doc(`plan_${dayKey}_${limitId}`);

  const snap = await docRef.get();
  const count = snap.exists ? (snap.data().count || 0) : 0;
  const limit = uid ? 5 : 1;

  if (count >= limit) {
    throw new HttpsError('resource-exhausted',
      uid
        ? 'Günlük plan limitinize ulaştınız (5 plan/gün). Yarın tekrar deneyin.'
        : 'Günlük anonim plan limitine ulaşıldı. Giriş yaparak daha fazla plan oluşturabilirsiniz.'
    );
  }

  // Atomic increment
  const { FieldValue } = admin.firestore;
  await docRef.set({
    count:     FieldValue.increment(1),
    limitId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ---------------------------------------------------------------------------
// Cloud Function export
// ---------------------------------------------------------------------------
exports.vacationPlanner = onCall(
  {
    region:    'europe-west3',
    timeoutSeconds: 540,
    memory:    '1GiB',
    secrets:   [ANTHROPIC_API_KEY],
    cors:      ['https://kalkaninfo.com', 'https://www.kalkaninfo.com', 'http://localhost:3000'],
  },
  async (request) => {
    const startMs = Date.now();
    const uid     = request.auth?.uid || null;
    const ip      = request.rawRequest?.ip || 'unknown';
    const traceId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    logger.info('[vacationPlanner] start', { traceId, uid, ip });

    // 1. Validate
    const formData = request.data;
    const { nights, totalPeople } = validateInput(formData);

    // 2. Rate limit
    await checkServerRateLimit(uid, ip);

    // 3. Build prompts
    const catalogSummary = buildCatalogSummary(formData);
    const systemPrompt   = buildSystemPrompt();
    const userMessage    = buildUserPrompt(formData, { nights, totalPeople }, catalogSummary);

    logger.info('[vacationPlanner] calling Claude', { traceId, nights, totalPeople, promptLen: userMessage.length });

    // 4. Claude call
    let claudeResult;
    try {
      claudeResult = await runWithTool(systemPrompt, userMessage, CREATE_PLAN_TOOL, {
        model:   'claude-sonnet-4-6',
        traceId,
        maxTokens: 4096,
      });
    } catch (err) {
      logger.error('[vacationPlanner] Claude error', { traceId, err: err.message });
      throw new HttpsError('internal', 'Plan oluşturulurken hata oluştu. Lütfen tekrar deneyin.');
    }

    const plan = claudeResult.result;
    const latencyMs = Date.now() - startMs;

    logger.info('[vacationPlanner] success', {
      traceId,
      requestId:    claudeResult.requestId,
      inputTokens:  claudeResult.usage.input_tokens,
      outputTokens: claudeResult.usage.output_tokens,
      costUsd:      claudeResult.costUsd,
      latencyMs,
      days:         plan.days?.length,
    });

    // 5. Firestore kayıt (sadece auth kullanıcı için)
    let planId = null;
    if (uid) {
      try {
        const { FieldValue } = admin.firestore;
        const docRef = await db.collection('vacations').add({
          ownerUid:        uid,
          dateRange:       { start: formData.dateStart, end: formData.dateEnd },
          groupSize:       { adults: formData.adults, children: formData.children || 0 },
          budget:          { amount: formData.budget, currency: formData.currency || 'TRY' },
          items:           (plan.days || []).flatMap(d => d.items || []).map(item => ({
            type:       item.type,
            refId:      item.refId || null,
            title:      item.title,
            price:      item.price || 0,
            status:     'draft',
            bookingRef: null,
          })),
          status:          'draft',
          claudeRequestId: claudeResult.requestId,
          createdAt:       FieldValue.serverTimestamp(),
        });
        planId = docRef.id;
        logger.info('[vacationPlanner] saved to Firestore', { traceId, planId });
      } catch (saveErr) {
        // Non-fatal — log and continue
        logger.warn('[vacationPlanner] Firestore save failed (non-fatal)', { traceId, err: saveErr.message });
      }
    }

    // 6. Return plan to client
    return {
      ...plan,
      requestId: claudeResult.requestId,
      planId,
      meta: {
        traceId,
        latencyMs,
        nights,
        totalPeople,
      },
    };
  }
);
