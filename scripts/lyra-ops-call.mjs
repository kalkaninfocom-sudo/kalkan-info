// scripts/lyra-ops-call.mjs
// Lyra Ops → Berkay'ı arar ve günün raporunu okur (giden/outbound, Twilio üzerinden).
// Önce raporu tazeler (lyra-ops-report.mjs), sonra ElevenLabs outbound-call API'siyle arar.
//
// Çalıştırma:
//   node scripts/lyra-ops-call.mjs                 → BERKAY_PHONE env'ine arar
//   node scripts/lyra-ops-call.mjs +905XXXXXXXXX   → verilen numaraya arar
//   node scripts/lyra-ops-call.mjs --no-refresh     → raporu tazelemeden ara
//
// Zamanla (her sabah 09:00): PC cron / GitHub Action → bu scripti çalıştır.
// Env: ELEVENLABS_API_KEY, BERKAY_PHONE (+90...). (.env.local)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const g = (k) => { try { return (readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim() || ''; } catch { return ''; } };

const OPS_AGENT_ID = 'agent_1501kxtbs1xdfpb9pbgphvpf0m6e';
const PHONE_NUMBER_ID = 'phnum_6301kxtcd0pve31v20h5cdgb4k6z'; // +18578473105
const argNum = process.argv.find((a) => /^\+\d{8,}$/.test(a));
const to = argNum || g('BERKAY_PHONE');
const noRefresh = process.argv.includes('--no-refresh');

(async () => {
  if (!to) { console.error('❌ Hedef numara yok. BERKAY_PHONE=+90... ekle ya da argüman ver.'); process.exit(1); }

  if (!noRefresh) {
    try { execFileSync('node', ['scripts/lyra-ops-report.mjs'], { cwd: ROOT, stdio: 'inherit' }); }
    catch (e) { console.error('rapor tazeleme atlandı:', e.message); }
  }

  const key = g('ELEVENLABS_API_KEY');
  const r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: OPS_AGENT_ID, agent_phone_number_id: PHONE_NUMBER_ID, to_number: to }),
  });
  const t = await r.text();
  console.log('outbound-call:', r.status, t.slice(0, 300));
  if (!r.ok) process.exit(1);
})();
