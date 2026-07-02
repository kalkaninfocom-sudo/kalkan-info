/**
 * supabase/functions/agency/index.ts
 * Kalkan Info — Ajans (agent şirketi) CANLI backend (Deno Edge Function)
 *
 * Cockpit (/oyun/) canlı sitede de çalışsın diye serve.mjs'teki /agency/* motorunu
 * buraya taşır. LLM sağlayıcı: NVIDIA NIM (OpenAI-uyumlu, cheap-llm ile aynı).
 * State: agency_jobs / agency_content / agency_state (service_role, RLS kilitli).
 *
 * Uçlar (path son segmenti):
 *   GET  /functions/v1/agency/status                 → { ok, state, jobs, content, readiness }
 *   POST /functions/v1/agency/enqueue  {agent, task} → agent'ı NVIDIA ile GERÇEKTEN çalıştır (senkron)
 *   POST /functions/v1/agency/run      {target}      → pipeline: director çalışır + içerik taslağı üretir
 *   POST /functions/v1/agency/approve  {contentId, decision}
 *   POST /functions/v1/agency/publish  {contentId}   → v1: gerçek IG yayını Telegram akışında (dürüst not)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY') ?? '';
const NVIDIA_MODEL   = Deno.env.get('NVIDIA_MODEL') ?? 'meta/llama-3.3-70b-instruct';
const AGENTS_URL     = Deno.env.get('AGENTS_URL') ?? 'https://kalkaninfo.com/data/agency/agents.json';

const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com', 'https://www.kalkaninfo.com',
  'http://localhost:3000', 'http://localhost:3007', 'http://localhost:3010',
];

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
  };
}
function json(payload: unknown, status: number, c: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers: { ...c, 'Content-Type': 'application/json' } });
}
const db = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const now = () => new Date().toISOString();
const short = (s: string, n = 200) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const rid = (p: string) => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// ---- agent tanımları (deploy edilmiş statik agents.json'dan, cold-start cache) ----
let AGENTS_CACHE: Record<string, any> | null = null;
async function getAgents(): Promise<Record<string, any>> {
  if (AGENTS_CACHE && Object.keys(AGENTS_CACHE).length) return AGENTS_CACHE;
  try {
    const r = await fetch(AGENTS_URL, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
    const d = await r.json();
    const agents = d.agents || d || {};
    if (agents && Object.keys(agents).length) AGENTS_CACHE = agents; // sadece başarıda cache'le (boş-cache zehirlemesin)
    return agents;
  } catch { return {}; }
}

// ---- NVIDIA NIM (OpenAI-uyumlu) — cheap-llm ile aynı ----
async function runLLM(system: string, task: string): Promise<{ text: string; provider: string }> {
  if (!NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY yok (secret set edilmeli)');
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: task }],
      temperature: 0.4, max_tokens: 700,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`nvidia ${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  const text = d.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('nvidia boş yanıt');
  return { text, provider: 'nvidia' };
}

// ---- state upsert ----
async function patchState(agent: string, patch: Record<string, unknown>) {
  await db().from('agency_state').upsert({ agent, updated_at: now(), ...patch }, { onConflict: 'agent' });
}

// ---- bir agent'ı gerçekten çalıştır ----
async function runAgent(agentId: string, task: string) {
  const agents = await getAgents();
  const a = agents[agentId];
  if (!a) throw new Error(`Bilinmeyen agent: ${agentId}`);
  await patchState(agentId, { status: 'work' });
  try {
    const { text, provider } = await runLLM(a.system || '', task);
    await patchState(agentId, {
      status: a.schedule?.type === 'cron' ? 'cron' : 'idle',
      last_run: now(), last_output: short(text), last_provider: provider,
    });
    return { text, provider, name: a.name || agentId };
  } catch (e) {
    await patchState(agentId, { status: 'alert', last_run: now(), last_output: 'HATA: ' + short(String((e as Error).message), 120) });
    throw e;
  }
}

// ---- basit global throttle (NVIDIA kotasını koru) ----
async function overLimit(): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db().from('agency_jobs').select('*', { count: 'exact', head: true }).gte('created_at', since);
  return (count ?? 0) >= 40;
}

// ---- route: status ----
async function handleStatus(c: Record<string, string>) {
  const client = db();
  const [{ data: jobs }, { data: content }, { data: st }] = await Promise.all([
    client.from('agency_jobs').select('*').order('created_at', { ascending: false }).limit(40),
    client.from('agency_content').select('*').order('created_at', { ascending: false }).limit(40),
    client.from('agency_state').select('*'),
  ]);
  const agents: Record<string, unknown> = {};
  for (const s of (st ?? [])) {
    agents[s.agent] = { status: s.status, lastOutput: s.last_output, lastProvider: s.last_provider, lastRun: s.last_run };
  }
  const jobsOut = (jobs ?? []).map((j) => ({
    id: j.id, agent: j.agent, task: j.task, status: j.status,
    result: j.result, provider: j.provider, error: j.error,
    createdAt: j.created_at, finishedAt: j.finished_at,
  }));
  const contentOut = (content ?? []).map((x) => ({
    id: x.id, agent: x.agent, caption: x.caption, image: x.image,
    status: x.status, createdAt: x.created_at, decidedAt: x.decided_at,
  }));
  return json({ ok: true, state: { agents, generatedAt: now() }, jobs: jobsOut, content: contentOut, readiness: {} }, 200, c);
}

// ---- route: enqueue (senkron çalıştır) ----
async function handleEnqueue(body: any, c: Record<string, string>) {
  const agent = String(body.agent ?? '').trim();
  const task  = String(body.task ?? '').trim().slice(0, 2000);
  if (!agent || !task) return json({ ok: false, error: 'agent ve task gerekli' }, 400, c);
  if (await overLimit()) return json({ ok: false, error: 'rate_limited', hint: 'Çok fazla iş — biraz bekleyin' }, 429, c);

  const agents = await getAgents();
  if (!agents[agent]) return json({ ok: false, error: `bilinmeyen agent: ${agent}` }, 400, c);

  const id = rid('j_');
  const client = db();
  await client.from('agency_jobs').insert({ id, agent, task, status: 'running', created_at: now() });
  try {
    const r = await runAgent(agent, task);
    await client.from('agency_jobs').update({ status: 'done', result: r.text, provider: r.provider, finished_at: now() }).eq('id', id);
    return json({ ok: true, jobId: id, status: 'done' }, 200, c);
  } catch (e) {
    await client.from('agency_jobs').update({ status: 'error', error: String((e as Error).message), finished_at: now() }).eq('id', id);
    return json({ ok: true, jobId: id, status: 'error', error: String((e as Error).message) }, 200, c);
  }
}

// ---- route: run (pipeline v1 → director üretir, içerik taslağı düşer) ----
async function handleRun(body: any, c: Record<string, string>) {
  const target = String(body.target ?? '');
  if (target !== 'pipeline') return json({ ok: false, error: 'bilinmeyen target' }, 400, c);
  const hint = String(body.hint ?? '').slice(0, 500);
  const id = rid('j_');
  const client = db();
  const task = `Bugün Kalkan Info sosyal medyası için TEK en iyi post fikrini üret. ${hint ? 'İpucu: ' + hint : ''}`.trim();
  await client.from('agency_jobs').insert({ id, agent: 'director', task, status: 'running', created_at: now() });
  try {
    const r = await runAgent('director', task);
    await client.from('agency_jobs').update({ status: 'done', result: r.text, provider: r.provider, finished_at: now() }).eq('id', id);
    // içerik onay kuyruğuna taslak düş
    await client.from('agency_content').insert({
      id: rid('c_'), agent: 'director', caption: short(r.text, 1500), status: 'pending_approval', created_at: now(),
    });
    return json({ ok: true, started: 'pipeline', jobId: id }, 200, c);
  } catch (e) {
    await client.from('agency_jobs').update({ status: 'error', error: String((e as Error).message), finished_at: now() }).eq('id', id);
    return json({ ok: false, error: String((e as Error).message) }, 200, c);
  }
}

// ---- route: approve ----
async function handleApprove(body: any, c: Record<string, string>) {
  const contentId = String(body.contentId ?? '');
  const decision  = String(body.decision ?? '');
  if (!contentId) return json({ ok: false, error: 'contentId gerekli' }, 400, c);
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const { data, error } = await db().from('agency_content')
    .update({ status, decided_at: now() }).eq('id', contentId).select('id').maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500, c);
  if (!data)  return json({ ok: false, error: 'içerik bulunamadı' }, 404, c);
  return json({ ok: true, status }, 200, c);
}

// ---- route: publish (v1 dürüst not) ----
async function handlePublish(body: any, c: Record<string, string>) {
  const contentId = String(body.contentId ?? '');
  if (contentId) await db().from('agency_content').update({ status: 'approved', decided_at: now() }).eq('id', contentId);
  return json({
    ok: false,
    note: 'Gerçek IG/FB yayını şu an Telegram onay akışından yapılıyor. İçerik onaylandı olarak işaretlendi.',
  }, 200, c);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const c = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });

  const url = new URL(req.url);
  const action = url.pathname.replace(/\/$/, '').split('/').pop();

  try {
    if (req.method === 'GET' && action === 'status') return await handleStatus(c);
    let body: any = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }
    if (req.method === 'POST' && action === 'enqueue') return await handleEnqueue(body, c);
    if (req.method === 'POST' && action === 'run')     return await handleRun(body, c);
    if (req.method === 'POST' && action === 'approve') return await handleApprove(body, c);
    if (req.method === 'POST' && action === 'publish') return await handlePublish(body, c);
    return json({ ok: false, error: 'bilinmeyen agency endpoint: ' + action }, 404, c);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500, c);
  }
});
