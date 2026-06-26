// lib/agent-logger.js
// Agent çalıştırmalarını agent_runs tablosuna kaydet.
// Kullanım:
//   import { runAgent } from './agent-logger.js';
//   const result = await runAgent('social-writer', { trigger: 'cron-weekly', input: 'haber-id-123' },
//     async () => { /* gerçek agent işi */ return { caption: '...', cost: 0.04 }; });

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

function brief(v, max = 240) {
  if (v == null) return null;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export async function runAgent(agentName, ctx, fn) {
  if (!SUPA_URL || !SUPA_KEY) {
    return fn();
  }
  const startRes = await supa('/agent_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      agent_name: agentName,
      status: 'running',
      trigger: ctx?.trigger || null,
      input_brief: brief(ctx?.input),
      meta: ctx?.meta || {},
    }),
  });
  const [row] = startRes.ok ? await startRes.json() : [null];
  const runId = row?.id;
  const t0 = Date.now();

  try {
    const result = await fn();
    const cost = typeof result?.cost === 'number' ? result.cost
               : typeof ctx?.cost === 'number' ? ctx.cost : 0;
    if (runId) {
      await supa(`/agent_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'success',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          cost_usd: cost,
          output_brief: brief(result?.outputBrief ?? result),
        }),
      });
    }
    return result;
  } catch (e) {
    if (runId) {
      await supa(`/agent_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          error_msg: brief(String(e?.message || e), 500),
        }),
      });
    }
    throw e;
  }
}

export async function fetchAgentStatus(limit = 50) {
  if (!SUPA_URL || !SUPA_KEY) return [];
  const r = await supa(`/agent_runs?select=agent_name,status,cost_usd,duration_ms,started_at,error_msg&order=started_at.desc&limit=${limit}`);
  return r.ok ? r.json() : [];
}

export function summarizeByAgent(rows) {
  const byAgent = new Map();
  for (const r of rows) {
    if (!byAgent.has(r.agent_name)) {
      byAgent.set(r.agent_name, {
        agent: r.agent_name,
        last_at: r.started_at,
        last_status: r.status,
        last_error: r.error_msg,
        runs: 0,
        cost: 0,
        failures: 0,
      });
    }
    const a = byAgent.get(r.agent_name);
    a.runs += 1;
    a.cost += Number(r.cost_usd || 0);
    if (r.status === 'failed') a.failures += 1;
  }
  return Array.from(byAgent.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
}
