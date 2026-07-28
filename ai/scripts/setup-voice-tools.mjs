#!/usr/bin/env node
/**
 * ai/scripts/setup-voice-tools.mjs
 * Lyra sesli konsiyerj (ElevenLabs) ajanına CANLI BİLGİ araçlarını (server/webhook tool) bağlar.
 *
 * İki sıfır-argümanlı araç (topic URL'de gömülü → model için en basit):
 *   nobetci_eczane    → lyra-live?topic=eczane    (Kaş/Kalkan bugünkü nöbetçi eczane)
 *   bugun_etkinlikler → lyra-live?topic=etkinlik  (bugünün etkinlikleri)
 *
 * Idempotent: aynı isimli araç varsa yeniden oluşturmaz, mevcut id'yi kullanır.
 * Araçları ajanın conversation_config.agent.prompt.tool_ids listesine ekler (ses/KB/prompt korunur).
 *
 * Env: ELEVENLABS_API_KEY (.env.local)
 * Kullanım: node ai/scripts/setup-voice-tools.mjs [--dry]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');

const AGENT_ID = process.env.LYRA_AGENT_ID || 'agent_0401kxt9cheme869ydvcq0akw342';
const EDGE_BASE = 'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-live';
// Doğrulanmış public anon JWT (edge fn JWT gate'ini geçer; anon key zaten publictir)
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWNoZmVhbHpkcGZoZGdyeXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTU4MTcsImV4cCI6MjA5NDIzMTgxN30.iu4IunNFuy5TEfiQ6bwmWlf7YH5cOCZOG1tY-tDxjQc';
const DRY = process.argv.includes('--dry');
const API = 'https://api.elevenlabs.io';

const TOOLS = [
  {
    name: 'nobetci_eczane',
    description: "Kaş ve Kalkan bölgesi için BUGÜNÜN nöbetçi (açık) eczanesini döndürür: eczane adı, adresi ve telefonu. Kullanıcı 'nöbetçi eczane', 'açık eczane', 'gece eczane' gibi sorunca çağır. Yanıttaki eczane.summary alanını doğal cümleye çevirerek söyle.",
    topic: 'eczane',
  },
  {
    name: 'bugun_etkinlikler',
    description: "Kalkan/Kaş için BUGÜNÜN etkinliklerini (canlı müzik, DJ, parti, yoga, sinema gecesi vb.) saatiyle döndürür. Kullanıcı 'bugün ne var', 'bu akşam ne yapabilirim', 'etkinlik var mı' gibi sorunca çağır. Yanıttaki etkinlik.summary alanını doğal cümleyle aktar.",
    topic: 'etkinlik',
  },
];

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = readFileSync(join(REPO, '.env.local'), 'utf8');
  const m = env.match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!m) throw new Error('ELEVENLABS_API_KEY yok.');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function j(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } }

async function listTools(key) {
  const res = await fetch(`${API}/v1/convai/tools`, { headers: { 'xi-api-key': key } });
  if (!res.ok) throw new Error(`list tools ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.tools || d || [];
}

function toolId(t) { return t.id || t.tool_id || t.tool_config?.id; }
function toolName(t) { return t.name || t.tool_config?.name; }

async function createTool(key, def) {
  const body = {
    tool_config: {
      type: 'webhook',
      name: def.name,
      description: def.description,
      response_timeout_secs: 20,
      api_schema: {
        url: `${EDGE_BASE}?topic=${def.topic}`,
        method: 'GET',
        request_headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
      },
    },
  };
  const res = await fetch(`${API}/v1/convai/tools`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await j(res);
  if (!res.ok) throw new Error(`create ${def.name} ${res.status}: ${JSON.stringify(d).slice(0, 300)}`);
  return toolId(d);
}

async function main() {
  const key = loadKey();
  const existing = await listTools(key);
  const byName = new Map(existing.map((t) => [toolName(t), toolId(t)]));

  const ids = [];
  for (const def of TOOLS) {
    if (byName.has(def.name)) {
      console.log(`= mevcut: ${def.name} → ${byName.get(def.name)}`);
      ids.push(byName.get(def.name));
    } else if (DRY) {
      console.log(`+ [dry] oluşturulacak: ${def.name} (${EDGE_BASE}?topic=${def.topic})`);
    } else {
      const id = await createTool(key, def);
      console.log(`+ oluşturuldu: ${def.name} → ${id}`);
      ids.push(id);
    }
  }

  // Ajana bağla (tool_ids)
  const agent = await (await fetch(`${API}/v1/convai/agents/${AGENT_ID}`, { headers: { 'xi-api-key': key } })).json();
  const cc = agent.conversation_config || {};
  cc.agent = cc.agent || {}; cc.agent.prompt = cc.agent.prompt || {};
  const before = cc.agent.prompt.tool_ids || [];
  const merged = [...new Set([...before, ...ids])];
  console.log('\ntool_ids ÖNCE:', JSON.stringify(before), '→ SONRA:', JSON.stringify(merged));

  if (DRY) { console.log('[--dry] patch yok.'); return; }

  cc.agent.prompt.tool_ids = merged;
  const patch = await fetch(`${API}/v1/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_config: cc }),
  });
  if (!patch.ok) throw new Error(`agent patch ${patch.status}: ${(await patch.text()).slice(0, 300)}`);

  const verify = await (await fetch(`${API}/v1/convai/agents/${AGENT_ID}`, { headers: { 'xi-api-key': key } })).json();
  console.log('\n✅ Ajana bağlı tool_ids:', JSON.stringify(verify.conversation_config?.agent?.prompt?.tool_ids || []));
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
