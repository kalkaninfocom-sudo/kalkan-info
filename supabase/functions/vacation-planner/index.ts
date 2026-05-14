/**
 * supabase/functions/vacation-planner/index.ts
 * Kalkan Info — Tatil Asistanı Edge Function (Deno)
 *
 * Firebase Cloud Function → Supabase Edge Function port
 * Stub mode: ANTHROPIC_API_KEY yoksa örnek plan döner
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com',
  'https://www.kalkaninfo.com',
  'http://localhost:3000',
  'http://localhost:3010',
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
const CREATE_PLAN_TOOL = {
  name: 'create_plan',
  description: 'Kalkan/Kaş/Patara bölgesi için kişiselleştirilmiş tatil planı oluştur. JSON formatında gün gün plan üret.',
  input_schema: {
    type: 'object',
    required: ['days', 'totalPrice', 'rationale'],
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
                  time:        { type: 'string' },
                  refId:       { type: 'string' },
                  price:       { type: 'number' },
                  priceNote:   { type: 'string' },
                },
              },
            },
          },
        },
      },
      totalPrice: { type: 'number' },
      rationale:  { type: 'string' },
    },
  },
};

// ---------------------------------------------------------------------------
// Katalog sabitleri
// ---------------------------------------------------------------------------
const CATALOG_VILLAS = [
  { id: 'villa-mira',    name: 'Villa Mira',    category: '4+1', capacity: 8,  location: 'Kalamar',        seaView: true,  pool: true,  price: '₺18.000/gece' },
  { id: 'villa-likya',   name: 'Villa Likya',   category: '5+1', capacity: 10, location: 'Üzümlü Mevkii',  seaView: true,  pool: true,  price: '₺24.000/gece' },
  { id: 'villa-kalamar', name: 'Villa Kalamar', category: '3+1', capacity: 6,  location: 'Kalamar',        seaView: true,  pool: true,  price: '₺14.500/gece' },
  { id: 'villa-patara',  name: 'Villa Patara',  category: '4+1', capacity: 8,  location: 'Patara yolu',    seaView: false, pool: true,  price: '₺16.000/gece' },
  { id: 'villa-akdeniz', name: 'Villa Akdeniz', category: '6+1', capacity: 12, location: 'Üzümlü Mevkii', seaView: true,  pool: true,  price: '₺32.000/gece' },
  { id: 'villa-yedi',    name: 'Villa Yedi',    category: '3+1', capacity: 6,  location: 'Kalkan tepe',    seaView: true,  pool: true,  price: '₺13.000/gece' },
  { id: 'villa-yakamoz', name: 'Villa Yakamoz', category: '4+1', capacity: 8,  location: 'Kalamar',        seaView: true,  pool: true,  price: '₺17.500/gece' },
  { id: 'villa-aksam',   name: 'Villa Akşam',   category: '2+1', capacity: 4,  location: 'Kalkan merkez',  seaView: true,  pool: true,  price: '₺9.500/gece'  },
  { id: 'villa-mavi',    name: 'Villa Mavi',    category: '5+1', capacity: 10, location: 'Üzümlü Mevkii', seaView: true,  pool: true,  price: '₺26.000/gece' },
  { id: 'villa-aslan',   name: 'Villa Aslan',   category: '3+1', capacity: 6,  location: 'Kalkan içi',     seaView: false, pool: true,  price: '₺11.500/gece' },
  { id: 'villa-zeytin',  name: 'Villa Zeytin',  category: '4+1', capacity: 8,  location: 'Kalamar',        seaView: true,  pool: true,  price: '₺19.000/gece' },
  { id: 'villa-ruya',    name: 'Villa Rüya',    category: '5+1', capacity: 10, location: 'Üzümlü Mevkii', seaView: true,  pool: true,  price: '₺23.000/gece' },
];

const CATALOG_TOURS = [
  { id: 'gunluk-tekne',   name: 'Günlük Tekne Turu (12 Koy)', category: 'Tekne Turu', price: '₺850/kişi',   duration: '08:30–18:00', featured: true  },
  { id: 'kekova-tekne',   name: 'Kekova Tekne Turu',          category: 'Tekne Turu', price: '₺1.450/kişi', duration: '08:00–19:00', featured: true  },
  { id: 'sunset-cruise',  name: 'Sunset Cruise',              category: 'Tekne Turu', price: '₺750/kişi',   duration: '18:00–21:30', featured: true  },
  { id: 'patara-tekne',   name: 'Patara Plajı Tekne Turu',    category: 'Tekne Turu', price: '₺950/kişi',   duration: '09:00–17:00', featured: false },
  { id: 'jeep-safari',    name: 'Jeep Safari (Saklıkent)',    category: 'Safari',     price: '₺1.150/kişi', duration: '09:30–17:30', featured: true  },
  { id: 'quad-safari',    name: 'Quad ATV Safari',            category: 'Safari',     price: '₺1.350/quad', duration: '15:00–18:00', featured: false },
  { id: 'patara-at',      name: 'Patara Plajı At Turu',       category: 'At Turu',    price: '₺1.250/kişi', duration: '08:00–11:00', featured: true  },
  { id: 'koy-at',         name: 'Yöre Köyleri At Turu',       category: 'At Turu',    price: '₺950/kişi',   duration: '15:30–18:00', featured: false },
  { id: 'xanthos-kano',   name: 'Xanthos Nehri Kano',         category: 'Kano Turu',  price: '₺1.050/kişi', duration: '09:00–14:00', featured: true  },
  { id: 'saklikent-kano', name: 'Saklıkent Kanyon Kano',      category: 'Kano Turu',  price: '₺1.150/kişi', duration: '10:00–15:00', featured: false },
];

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
function validateInput(data: Record<string, unknown>) {
  const dateStart = data.dateStart as string;
  const dateEnd   = data.dateEnd as string;
  const adults    = Number(data.adults ?? 2);
  const children  = Number(data.children ?? 0);
  const budget    = Number(data.budget ?? 0);

  if (!dateStart || !dateEnd) throw new Error('dateStart ve dateEnd zorunludur.');

  const start = new Date(dateStart);
  const end   = new Date(dateEnd);
  const now   = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Tarihler geçerli değil.');
  if (start <= now)   throw new Error('Giriş tarihi gelecekte olmalıdır.');
  if (end   <= start) throw new Error('Çıkış tarihi giriş tarihinden sonra olmalıdır.');

  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (nights > 30)   throw new Error('Tatil süresi en fazla 30 gece olabilir.');

  const totalPeople = adults + children;
  if (totalPeople < 1 || totalPeople > 12) throw new Error('Toplam kişi sayısı 1–12 arasında olmalıdır.');
  if (budget <= 0) throw new Error('Bütçe pozitif bir sayı olmalıdır.');

  return { start, end, nights, totalPeople };
}

// ---------------------------------------------------------------------------
// Katalog özeti
// ---------------------------------------------------------------------------
function buildCatalogSummary(f: Record<string, unknown>) {
  const minCapacity = (Number(f.adults) || 2) + (Number(f.children) || 0);
  const activities  = (f.activities as string[]) || [];

  const villas = CATALOG_VILLAS
    .filter(v => {
      if (v.capacity < minCapacity) return false;
      if (f.seaView && !v.seaView) return false;
      if (f.pool    && !v.pool)    return false;
      return true;
    })
    .slice(0, 4)
    .map(v => `  - [${v.id}] ${v.name} (${v.category}, ${v.capacity} kişi, ${v.location}) — ${v.price}`)
    .join('\n');

  const tours = CATALOG_TOURS
    .filter(t => {
      if (activities.includes('boat_tour') && t.category === 'Tekne Turu') return true;
      if (activities.includes('hiking')    && t.category === 'Safari')     return true;
      return t.featured;
    })
    .slice(0, 5)
    .map(t => `  - [${t.id}] ${t.name} — ${t.price} (${t.duration})`)
    .join('\n');

  const transferLine = '  - [transfer-havalimani] Havalimanı Transferi — Dalaman: ₺2.500/Sedan, ₺4.500/VIP minibüs (7/24)';
  const cateringLine = (f.food as string[] || []).includes('chef')
    ? '\nCatering:\n  - [catering] Evde Aşçı / Catering — özel menü (randevulu)'
    : '';

  return `MEVCUT KATALOĞDAN ÖNERİLEN SEÇENEKLER:

Villalar (filtre: min ${minCapacity} kişi):
${villas || '  (filteye uyan villa bulunamadı, kapasitesi yeterli herhangi bir villa öner)'}

Turlar:
${tours || '  (öne çıkan turlar)'}

Transfer:
${transferLine}${cateringLine}`.trim();
}

// ---------------------------------------------------------------------------
// Promptlar
// ---------------------------------------------------------------------------
function buildSystemPrompt() {
  return `Sen Kalkan, Kaş ve Patara bölgesinde uzman bir tatil planlayıcısısın.
Görevin: kullanıcının form verilerini analiz edip create_plan tool'unu kullanarak kapsamlı bir tatil planı oluşturmak.

ZORUNLU KURALLAR:
1. create_plan tool'unu MUTLAKA kullan — düz metin yanıt KABUL EDİLMEZ.
2. Her günün items dizisine uçuş, transfer, konaklama, yemek, aktivite uygun şekilde dağıt.
3. Varış günü: uçuş + transfer + konaklama check-in.
4. Ayrılış günü: sadece check-out + transfer + uçuş.
5. Ara günler: 2-3 aktivite + yemek önerisi.
6. Fiyatları katalog verilerinden al; katalogda yoksa gerçekçi piyasa tahmini yap.
7. Toplam fiyat bütçeyi aşmamalı; aşarsa öncelikleri azalt ve gerekçede belirt.
8. refId alanına MUTLAKA katalog ID'sini yaz (varsa).
9. Tüm metinler Türkçe.
10. Çocuk varsa çocuk dostu aktiviteler ekle.`;
}

function buildUserPrompt(f: Record<string, unknown>, meta: { nights: number; totalPeople: number }, catalog: string) {
  const currency = (f.currency as string) || 'TRY';
  const symbol   = ({ TRY: '₺', EUR: '€', USD: '$' } as Record<string, string>)[currency] || currency;

  return `TATIL BİLGİLERİ:
- Tarihler: ${f.dateStart} → ${f.dateEnd} (${meta.nights} gece)
- Grup: ${f.adults} yetişkin, ${f.children || 0} çocuk (toplam ${meta.totalPeople} kişi)
- Bütçe: ${symbol}${Number(f.budget).toLocaleString('tr-TR')} (toplam, ${currency})
- Kalkış: ${f.departureAirport || 'İstanbul'} → Dalaman (DLM) veya Antalya (AYT)
- Tercih edilen havayolu: ${((f.airlines as string[]) || ['any']).join(', ')}
- Konaklama: ${f.accommodationType || 'villa'}, ${f.rooms || 2} oda
- Deniz manzarası: ${f.seaView ? 'İsteniyor' : 'Fark etmez'}
- Havuz: ${f.pool ? 'İsteniyor' : 'Fark etmez'}
- Evcil hayvan: ${f.petFriendly ? 'Evet' : 'Hayır'}
- Yemek: ${((f.food as string[]) || []).join(', ') || 'belirtilmedi'}
${f.cuisine && (f.cuisine as string[]).length ? `- Mutfak tercihi: ${(f.cuisine as string[]).join(', ')}` : ''}
- Aktiviteler: ${((f.activities as string[]) || []).join(', ') || 'genel'}
${f.specialRequests ? `- Özel istekler: ${f.specialRequests}` : ''}

${catalog}

Lütfen create_plan tool'unu kullanarak ${f.dateStart} – ${f.dateEnd} tarihleri için gün gün tatil planı oluştur.`;
}

// ---------------------------------------------------------------------------
// Stub response — Anthropic key olmadan
// ---------------------------------------------------------------------------
function buildStubPlan(f: Record<string, unknown>, meta: { nights: number; totalPeople: number }) {
  const start = new Date(f.dateStart as string);
  const days = [];

  for (let i = 0; i <= meta.nights; i++) {
    const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (i === 0) {
      days.push({
        date,
        dayLabel: 'Varış Günü',
        items: [
          { type: 'flight',        title: `Uçuş: ${f.departureAirport || 'İstanbul'} → Dalaman (DLM)`, time: '09:00', price: 3500, priceNote: '/kişi' },
          { type: 'transfer',      title: 'Havalimanı → Kalkan Transferi', description: '~1.5 saat', price: 2500, time: '13:00', refId: 'transfer-havalimani' },
          { type: 'accommodation', title: 'Villa Mira — Check-in', description: 'Kalamar, deniz manzaralı, özel havuzlu', price: 18000, priceNote: '/gece', refId: 'villa-mira' },
        ],
      });
    } else if (i === meta.nights) {
      days.push({
        date,
        dayLabel: 'Çıkış Günü',
        items: [
          { type: 'accommodation', title: 'Check-out', description: 'Sabah erken çıkış' },
          { type: 'transfer',      title: 'Kalkan → Havalimanı Transferi', price: 2500, refId: 'transfer-havalimani' },
          { type: 'flight',        title: `Uçuş: Dalaman (DLM) → ${f.departureAirport || 'İstanbul'}`, time: '18:00', price: 3500, priceNote: '/kişi' },
        ],
      });
    } else {
      days.push({
        date,
        dayLabel: i === 1 ? 'Tekne Turu' : i === 2 ? 'Plaj & Antik Kent' : 'Serbest Gün',
        items: [
          { type: 'accommodation', title: 'Villa Mira — Konaklama', price: 18000, priceNote: '/gece', refId: 'villa-mira' },
          ...(i === 1 ? [{ type: 'activity', title: 'Günlük Tekne Turu (12 Koy)', description: '08:30–18:00, öğle dahil', price: 850, priceNote: '/kişi', refId: 'gunluk-tekne' }] : []),
          ...(i === 2 ? [{ type: 'activity', title: 'Patara Antik Kenti & Plajı', description: 'Likya tarihi ve 18 km kumsal', price: 200 }] : []),
          { type: 'meal', title: 'Akşam Yemeği — Yat Limanı Restoranı', description: 'Deniz ürünleri', price: 600, priceNote: '/kişi' },
        ],
      });
    }
  }

  return {
    days,
    totalPrice: 18000 * meta.nights + 7000 * meta.totalPeople + 5000,
    rationale: `STUB MODE — Anthropic key henüz ayarlanmamış. Bu örnek bir 7-günlük Kalkan planıdır. Gerçek API key set edildiğinde kişiselleştirilmiş plan üretilecek.`,
    _stub: true,
  };
}

// ---------------------------------------------------------------------------
// Anthropic API çağrısı
// ---------------------------------------------------------------------------
async function callAnthropic(systemPrompt: string, userMessage: string, apiKey: string, model: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            apiKey,
      'anthropic-version':    '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [CREATE_PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'create_plan' },
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const json = await res.json();
  const toolBlock = json.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolBlock) throw new Error('Claude create_plan tool kullanmadı.');

  return {
    result:    toolBlock.input,
    requestId: json.id,
    usage:     json.usage,
  };
}

// ---------------------------------------------------------------------------
// Rate limit — vacation_requests tablosundan son 24h kayıt sayısı
// ---------------------------------------------------------------------------
async function checkRateLimit(supabase: ReturnType<typeof createClient>, userId: string | null) {
  const limitAnon = parseInt(Deno.env.get('AGENT_DAILY_USER_LIMIT_ANON') ?? '1');
  const limitAuth = parseInt(Deno.env.get('AGENT_DAILY_USER_LIMIT_AUTH') ?? '5');
  const limit = userId ? limitAuth : limitAnon;

  const since = new Date(Date.now() - 86400000).toISOString();

  let query = supabase
    .from('vacation_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);

  if (userId) {
    query = query.eq('owner_id', userId);
  } else {
    query = query.is('owner_id', null);
  }

  const { count, error } = await query;
  if (error) {
    console.warn('[vacation-planner] rate limit check failed (non-fatal):', error.message);
    return;
  }

  if ((count ?? 0) >= limit) {
    throw new Error(
      userId
        ? `Günlük plan limitinize ulaştınız (${limit} plan/gün). Yarın tekrar deneyin.`
        : `Günlük anonim plan limitine ulaşıldı. Giriş yaparak daha fazla plan oluşturabilirsiniz.`
    );
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const startMs = Date.now();

  try {
    const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const model            = Deno.env.get('AGENT_TATIL_PLANNER_MODEL') ?? 'claude-sonnet-4-6';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(jwt);
      userId = user?.id ?? null;
    }

    // Parse body
    const formData = await req.json() as Record<string, unknown>;

    // Validate
    const meta = validateInput(formData);

    // Rate limit
    await checkRateLimit(supabase, userId);

    // Stub mode
    const isStub = !anthropicApiKey;
    let plan: Record<string, unknown>;
    let requestId = `stub_${Date.now()}`;
    let inputTokens  = 0;
    let outputTokens = 0;

    if (isStub) {
      plan = buildStubPlan(formData, meta);
    } else {
      const catalog      = buildCatalogSummary(formData);
      const systemPrompt = buildSystemPrompt();
      const userMessage  = buildUserPrompt(formData, meta, catalog);

      const claudeResult = await callAnthropic(systemPrompt, userMessage, anthropicApiKey, model);
      plan         = claudeResult.result as Record<string, unknown>;
      requestId    = claudeResult.requestId as string;
      inputTokens  = claudeResult.usage?.input_tokens  ?? 0;
      outputTokens = claudeResult.usage?.output_tokens ?? 0;
    }

    const latencyMs = Date.now() - startMs;

    // DB kayıt — vacation_requests
    const { data: saved, error: saveError } = await supabase
      .from('vacation_requests')
      .insert({
        owner_id:          userId,
        date_start:        formData.dateStart as string,
        date_end:          formData.dateEnd as string,
        adults:            Number(formData.adults ?? 2),
        children:          Number(formData.children ?? 0),
        budget:            Number(formData.budget),
        currency:          (formData.currency as string) || 'TRY',
        departure_airport: (formData.departureAirport as string) || null,
        accommodation_type:(formData.accommodationType as string) || null,
        rooms:             Number(formData.rooms ?? 2),
        preferences: {
          airlines:        formData.airlines,
          food:            formData.food,
          cuisine:         formData.cuisine,
          activities:      formData.activities,
          seaView:         formData.seaView,
          pool:            formData.pool,
          petFriendly:     formData.petFriendly,
          specialRequests: formData.specialRequests,
        },
        ai_plan:           plan,
        claude_request_id: requestId,
        total_price:       (plan.totalPrice as number) ?? null,
        status:            'draft',
      })
      .select('id')
      .single();

    if (saveError) {
      console.warn('[vacation-planner] DB save failed (non-fatal):', saveError.message);
    }

    return new Response(
      JSON.stringify({
        ok:        true,
        plan,
        requestId,
        requestDbId: saved?.id ?? null,
        stub:      isStub || undefined,
        meta: {
          latencyMs,
          nights:      meta.nights,
          totalPeople: meta.totalPeople,
          inputTokens,
          outputTokens,
          model: isStub ? 'stub' : model,
        },
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUserError = [
      'zorunludur', 'geçerli değil', 'gelecekte', 'sonra olmalı',
      'en fazla', 'arasında', 'pozitif', 'limitine', 'limitinize',
    ].some(k => msg.includes(k));

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      {
        status: isUserError ? 400 : 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    );
  }
});
