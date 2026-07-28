// scripts/deniz-ops-report.mjs
// Günün ops raporunu üretir → sesli-özet'e çevirir (cheap-llm) → "Deniz Ops" ElevenLabs
// ajanının bilgi tabanına yazar. Berkay ajanı aradığında/mesaj attığında güncel raporu konuşur.
//
// Çalıştırma:
//   node scripts/deniz-ops-report.mjs           → üret + ajana yükle
//   node scripts/deniz-ops-report.mjs --dry-run → sadece özeti ekrana bas
//
// Env: ELEVENLABS_API_KEY (.env.local). cheap-llm için NVIDIA/Ollama (varsa; yoksa ham metin).
// Zamanla: her sabah PC cron / GitHub Action ile çalıştır → giden aramada güncel rapor hazır.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const OPS_AGENT_ID = 'agent_1501kxtbs1xdfpb9pbgphvpf0m6e';

function env(k) {
  try {
    const s = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    return (s.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim() || '';
  } catch { return ''; }
}

// 1) Ham raporu üret (git log + PROJE_DURUMU) → HTML süsünü temizle
function rawReport() {
  try {
    const out = execFileSync('node', ['scripts/daily-status-report.mjs', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
    return out.replace(/<[^>]*>/g, '').trim();
  } catch (e) {
    return `Rapor üretilemedi: ${e.message}`;
  }
}

// 2) Sesli-özet (cheap-llm: ollama→nvidia→...; yoksa ham metin kısaltılır)
async function voiceSummary(raw) {
  const prompt = `Aşağıdaki günlük ops raporunu, Berkay'a TELEFONDA sesli okunacak şekilde kısa ve net özetle.
Kurallar: en fazla 6-8 cümle; otomatik/dedup commit'leri say ama tek cümlede topla; önce tek cümle genel özet (kaç iş bitti, kaç blokaj), sonra süren/bekleyen önemli işler ve blokajlar, en sonda sıradaki net adım. Madde işareti/emoji kullanma, akıcı konuşma dili. Sadece özet metnini döndür.

RAPOR:
${raw}`;
  try {
    const { cheapLLM } = await import(pathToFileURL(path.join(ROOT, 'lib/cheap-llm.mjs')).href);
    const res = await cheapLLM(prompt, { system: 'Sen kısa, net Türkçe sesli özet üreten bir asistansın.', maxTokens: 500 });
    if (res?.text?.trim()) { console.error(`[cheap-llm: ${res.provider}/${res.model}]`); return res.text.trim(); }
  } catch (e) { console.error('[cheap-llm yok, ham metin kullanılıyor]', e.message); }
  return raw.slice(0, 1500);
}

// 3) ElevenLabs: KB text doc oluştur + ops ajanına bağla (öncekini değiştir)
async function pushToAgent(text) {
  const key = env('ELEVENLABS_API_KEY');
  if (!key) throw new Error('ELEVENLABS_API_KEY yok');
  const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
  const date = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' }).format(new Date());

  let r = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: `Günün Ops Raporu — ${date}`, text: `# Günün Ops Raporu (${date})\n\n${text}` }),
  });
  const j = await r.json();
  if (!j.id) throw new Error('KB doc oluşmadı: ' + JSON.stringify(j).slice(0, 160));

  r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${OPS_AGENT_ID}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ conversation_config: { agent: { prompt: {
      knowledge_base: [{ type: 'text', name: `Günün Ops Raporu — ${date}`, id: j.id, usage_mode: 'prompt' }],
    } } } }),
  });
  if (!r.ok) throw new Error('Ajan güncellenemedi: ' + (await r.text()).slice(0, 160));
  return j.id;
}

(async () => {
  const raw = rawReport();
  const summary = await voiceSummary(raw);
  console.log('\n===== DENİZ OPS — SESLİ RAPOR ÖZETİ =====\n');
  console.log(summary);
  console.log('\n=========================================\n');
  if (DRY) { console.log('(--dry-run: ajana yüklenmedi)'); return; }
  const docId = await pushToAgent(summary);
  console.log(`✅ Ops ajanına yüklendi (KB doc ${docId}). Deniz Ops artık güncel raporu konuşabilir.`);
})();
