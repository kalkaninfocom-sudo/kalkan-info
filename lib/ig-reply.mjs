// lib/ig-reply.mjs
// Kalkan Info — Instagram yorum/DM otomatik akıllı cevap üretici.
//
// Gelen bir yorum/DM metnini alır, kalkaninfo bilgi tabanından (config,
// concierge, restoranlar, etkinlik takvimi) yararlanarak Claude (Haiku) ile
// kısa, samimi, marka-uyumlu bir cevap üretir. Cevabı gelen mesajın diline
// (TR/EN) göre yazar. Spam / küfür / alakasız mesajlarda "yanıtlama" döner.
//
// Bağımlılık yok — lib/anthropic.js (fetch tabanlı) tekrar kullanılır.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cheapJSON } from './cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function readJson(name) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
  } catch {
    return null;
  }
}

// ── Bilgi tabanı: data/*.json dosyalarından kompakt bir özet metni üretir.
// Token tasarrufu için sadece sistem promptuna girecek kadarını çıkarır.
let _kbCache = null;
export function loadKnowledgeBase() {
  if (_kbCache) return _kbCache;

  const config = readJson('config.json') || {};
  const concierge = readJson('concierge.json') || {};
  const restoranlar = readJson('restoranlar.json') || {};
  const etkinlik = readJson('etkinlik-takvimi.json') || {};

  const contact = config.contact || {};
  const lines = [];

  // İletişim / yönlendirme bilgisi
  lines.push('İLETİŞİM:');
  if (contact.whatsapp) lines.push(`- WhatsApp: ${contact.whatsapp}`);
  if (contact.email) lines.push(`- E-posta: ${contact.email}`);
  lines.push('- Web: https://kalkaninfo.com');

  // Concierge ekibi (kime yönlendireceğini bilsin)
  const agents = (concierge.agents || []).filter(a => a.available);
  if (agents.length) {
    lines.push('\nCONCIERGE EKİBİ (rezervasyon/transfer/villa için yönlendir):');
    for (const a of agents) {
      lines.push(`- ${a.name} (${a.role}) — WhatsApp ${a.whatsapp}`);
    }
  }

  // Öne çıkan restoranlar (featured veya en yüksek puanlı, max 15)
  const items = Array.isArray(restoranlar.items) ? restoranlar.items : [];
  const top = items
    .map(r => ({
      name: r.name,
      cuisine: r.cuisine || r.category || '',
      rating: typeof r.rating === 'number' ? r.rating : null,
      featured: !!r.featured,
    }))
    .sort((a, b) => (b.featured - a.featured) || ((b.rating || 0) - (a.rating || 0)))
    .slice(0, 15);
  if (top.length) {
    lines.push('\nÖNE ÇIKAN RESTORAN & BAR (örnek; tam liste sitede):');
    for (const r of top) {
      const rt = r.rating ? ` ⭐${r.rating}` : '';
      lines.push(`- ${r.name}${r.cuisine ? ` (${r.cuisine})` : ''}${rt}`);
    }
  }

  // Tekrarlayan etkinlikler (gece hayatı / canlı müzik) — kompakt
  const recurring = Array.isArray(etkinlik.recurring) ? etkinlik.recurring : [];
  const verified = recurring.filter(e => e.verified).slice(0, 12);
  if (verified.length) {
    lines.push('\nHAFTALIK ETKİNLİKLER (canlı müzik/DJ):');
    for (const e of verified) {
      lines.push(`- ${e.day} ${e.time || ''} ${e.venueName || ''}: ${e.title || e.type || ''}`.trim());
    }
  }

  _kbCache = lines.join('\n');
  return _kbCache;
}

// ── Basit dil tespiti: Türkçe'ye özgü karakter/kelime varsa "tr", yoksa "en".
export function detectLang(text) {
  const t = (text || '').toLowerCase();
  if (/[çğıöşü]/.test(t)) return 'tr';
  const trWords = ['merhaba', 'selam', 'nasıl', 'nerede', 'fiyat', 'var mı', 'teşekkür', 'güzel', 'rezervasyon', 'iyi', 'için'];
  if (trWords.some(w => t.includes(w))) return 'tr';
  return 'en';
}

function systemPrompt(kb) {
  return [
    'Sen "Kalkan Info" (kalkaninfo) Instagram hesabının resmi yapay zekâ asistanısın.',
    'Kalkan, Kaş, Patara ve çevresi için tarafsız, güvenilir bir turizm rehberisin.',
    'Görevin: hesabımıza gelen yorum ve DM\'lere kısa, samimi, marka-uyumlu ve YARDIMCI cevaplar üretmek.',
    '',
    'KURALLAR:',
    '- Cevabı, gelen mesajın DİLİNDE yaz (Türkçe geldiyse Türkçe, İngilizce geldiyse İngilizce).',
    '- Kısa tut: en fazla 2-3 cümle. Instagram yorumu gibi sıcak ve doğal olsun.',
    '- Aşırı resmi olma; 1-2 uygun emoji kullanabilirsin ama abartma.',
    '- Rezervasyon, villa, transfer veya kişiye özel plan isteniyorsa WhatsApp\'a yönlendir.',
    '- Sadece bilgi tabanındaki ve Kalkan turizmiyle ilgili genel doğru bilgileri ver. Emin değilsen uydurma; "DM/WhatsApp\'tan detay verelim" de.',
    '- Fiyat sorulursa kesin rakam uydurma; mekâna/sezona göre değişir de ve yönlendir.',
    '- ASLA başka şehir/marka önerme, rakip tanıtma, siyaset yapma.',
    '',
    'YANITLAMA (skip) durumları — bunlarda action="skip" dön:',
    '- Spam, reklam, bağlantı yemleme (takipçi/like satışı vb.)',
    '- Küfür, hakaret, taciz, nefret söylemi',
    '- Tamamen alakasız / anlamsız içerik',
    '- Sadece emoji veya "👍", "🔥" gibi içerik gerektirmeyen tepkiler (bunlara cevap gerekmez)',
    '',
    'BİLGİ TABANI:',
    kb,
    '',
    'ÇIKTI FORMATI — SADECE şu JSON yapısını döndür, başka metin yok:',
    '{"action":"reply"|"skip","reason":"kısa gerekçe","reply":"cevap metni (skip ise boş)"}',
  ].join('\n');
}

/**
 * Bir yorum/DM metni için cevap üretir.
 * @param {{ text: string, username?: string, kb?: string }} input
 * @returns {Promise<{ reply: string|null, skip: boolean, reason: string, lang: string, cost: number }>}
 */
export async function generateReply({ text, username = '', kb }) {
  const clean = (text || '').trim();
  const lang = detectLang(clean);

  if (!clean) {
    return { reply: null, skip: true, reason: 'boş mesaj', lang, cost: 0 };
  }

  const knowledge = kb || loadKnowledgeBase();
  const userMsg = [
    username ? `Gönderen: @${username}` : '',
    `Mesaj: """${clean}"""`,
    '',
    'Bu mesaja yukarıdaki kurallara göre yanıt üret. Sadece JSON döndür.',
  ].filter(Boolean).join('\n');

  let parsed, cost = 0;
  try {
    const { data, provider } = await cheapJSON(userMsg, { system: systemPrompt(knowledge), maxTokens: 400 });
    console.log(`  [cheap-llm] ig-reply ✓ ${provider}`);
    parsed = data;
  } catch (e) {
    return { reply: null, skip: true, reason: `LLM hata: ${e.message}`, lang, cost: 0 };
  }

  if (!parsed || typeof parsed !== 'object' || parsed._parse_error) {
    return { reply: null, skip: true, reason: 'cevap parse edilemedi', lang, cost };
  }

  const action = String(parsed.action || '').toLowerCase();
  const reason = String(parsed.reason || '');
  const replyText = String(parsed.reply || '').trim();

  if (action === 'skip' || !replyText) {
    return { reply: null, skip: true, reason: reason || 'asistan yanıtlamadı', lang, cost };
  }

  // Instagram yorum cevap limiti güvenliği
  return { reply: replyText.slice(0, 1000), skip: false, reason, lang, cost };
}

export default { generateReply, loadKnowledgeBase, detectLang };
