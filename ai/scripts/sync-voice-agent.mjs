#!/usr/bin/env node
/**
 * ai/scripts/sync-voice-agent.mjs
 * Lyra sesli konsiyerj (ElevenLabs Conversational AI) ajanını repo kaynağıyla senkronlar.
 *
 * KAYNAK (repo = doğruluk kaynağı):
 *   - ai/prompts/lyra-voice.md   → sistem promptu (persona)
 *   - Aşağıdaki NAME / FIRST_MESSAGE sabitleri
 *
 * Ses (voice_id) ve knowledge base'e DOKUNMAZ — sadece name + first_message + prompt patch'ler.
 * Böylece "iyi görüşme" veren ses/KB korunur, kimlik Lyra'ya döner.
 *
 * Kullanım:
 *   node ai/scripts/sync-voice-agent.mjs           # patch uygula
 *   node ai/scripts/sync-voice-agent.mjs --dry     # sadece göster, patch etme
 *
 * Env: ELEVENLABS_API_KEY (.env.local)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');

const AGENT_ID = process.env.LYRA_AGENT_ID || 'agent_0401kxt9cheme869ydvcq0akw342';
const NAME = 'Kalkan Info — Lyra (Sesli Konsiyerj)';
const FIRST_MESSAGE = 'Merhaba, ben Lyra — Kalkan dijital konsiyerjiniz. Restoran, plaj, tekne turu ya da bugün ne yapılır, ne merak ediyorsanız sorun.';
const DRY = process.argv.includes('--dry');

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    const env = readFileSync(join(REPO, '.env.local'), 'utf8');
    const m = env.match(/^ELEVENLABS_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* ignore */ }
  throw new Error('ELEVENLABS_API_KEY bulunamadı (.env.local ya da env).');
}

async function main() {
  const key = loadKey();
  const prompt = readFileSync(join(REPO, 'ai', 'prompts', 'lyra-voice.md'), 'utf8').trim();

  // 1) Mevcut config'i çek (voice/KB korunacak — sadece 3 alan değişir)
  const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    headers: { 'xi-api-key': key },
  });
  if (!getRes.ok) throw new Error(`GET agent ${getRes.status}: ${(await getRes.text()).slice(0, 200)}`);
  const agent = await getRes.json();

  const cc = agent.conversation_config || {};
  cc.agent = cc.agent || {};
  cc.agent.prompt = cc.agent.prompt || {};
  const before = {
    name: agent.name,
    first_message: cc.agent.first_message,
    voice_id: (cc.tts || {}).voice_id,
    kb: (cc.agent.prompt.knowledge_base || []).map((k) => k.name),
    tools: (cc.agent.prompt.tools || []).map((t) => t.name || t.type),
  };

  // 2) Sadece kimlik alanlarını değiştir
  cc.agent.first_message = FIRST_MESSAGE;
  cc.agent.prompt.prompt = prompt;

  console.log('ÖNCE :', JSON.stringify(before, null, 1));
  console.log('SONRA: name=%o first_message=%o promptLen=%d (voice/KB korunuyor)', NAME, FIRST_MESSAGE, prompt.length);

  if (DRY) { console.log('\n[--dry] patch uygulanmadı.'); return; }

  // 3) PATCH — name + conversation_config
  const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NAME, conversation_config: cc }),
  });
  if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 300)}`);

  // 4) Doğrula
  const verify = await (await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    headers: { 'xi-api-key': key },
  })).json();
  const vcc = verify.conversation_config || {};
  console.log('\n✅ PATCH OK. Doğrulama:');
  console.log('  name        :', verify.name);
  console.log('  first_message:', (vcc.agent || {}).first_message);
  console.log('  prompt[0..60]:', ((vcc.agent || {}).prompt || {}).prompt?.slice(0, 60));
  console.log('  voice_id    :', (vcc.tts || {}).voice_id, '(korundu)');
  console.log('  KB          :', ((vcc.agent || {}).prompt || {}).knowledge_base?.map((k) => k.name).join(', ') || '—');
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
