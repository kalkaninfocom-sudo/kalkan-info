#!/usr/bin/env node
/**
 * seed-30day-social.mjs
 *
 * Upserts content/social-media-plan-30day.json into Supabase social_posts table.
 * Idempotent: deletes any existing rows with the same content_pack_id before insert,
 * so running again replaces the plan.
 *
 * Usage:
 *   node scripts/seed-30day-social.mjs
 *   node scripts/seed-30day-social.mjs --dry-run
 *
 * Env (any of .env, .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY)
 *
 * Hashtag/footage/local_assets fields are JSONB arrays in DB. We pass arrays directly.
 * Status set to 'pending_approval' so the Telegram approval bot picks them up.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');
const PLAN_FILE  = resolve(ROOT, 'content/social-media-plan-30day.json');

const DRY = process.argv.includes('--dry-run');

// ---- Minimal .env loader (avoids extra dep) ----
function loadDotenv(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadDotenv(resolve(ROOT, '.env'));
loadDotenv(resolve(ROOT, '.env.local'));

// ---- Resolve env ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in env');
  process.exit(1);
}

// ---- Load plan ----
const plan = JSON.parse(await readFile(PLAN_FILE, 'utf8'));
const posts = plan.posts || [];
if (!posts.length) {
  console.error(`No posts in ${PLAN_FILE}`);
  process.exit(1);
}

// ---- Map plan post -> social_posts row ----
function toRow(p) {
  return {
    content_pack_id: p.content_pack_id,
    content_type:    p.content_type,
    language:        p.language ?? 'en',
    voiceover_text:  null,
    caption:         p.caption,
    hashtags:        p.hashtags ?? [],
    music_mood:      p.music_mood ?? null,
    footage_queries: p.footage_queries ?? [],
    local_assets:    p.local_assets ?? [],
    duration_s:      p.duration_s ?? null,
    target_audience: p.target_audience ?? [],
    status:          plan.meta?.default_status ?? 'pending_approval',
    scheduled_at:    p.scheduled_at,
  };
}

const rows = posts.map(toRow);
const packIds = rows.map(r => r.content_pack_id);

console.log(`Plan: ${plan.meta?.campaign ?? '(unnamed)'}`);
console.log(`Posts: ${rows.length}`);
console.log(`Window: ${plan.meta?.campaign_window?.starts_on} → ${plan.meta?.campaign_window?.ends_on}`);
console.log(`Status: ${rows[0].status}`);
console.log(`Mode:   ${DRY ? 'DRY-RUN (no writes)' : 'LIVE'}`);
console.log('');

if (DRY) {
  console.table(rows.map(r => ({
    pack:     r.content_pack_id,
    type:     r.content_type,
    when:     r.scheduled_at,
    tags:     (r.hashtags || []).slice(0, 3).join(' '),
    caption:  (r.caption || '').slice(0, 60) + '…',
  })));
  process.exit(0);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Replace-mode: delete then insert (idempotent re-seed) ----
console.log('Deleting any prior rows with same content_pack_id …');
{
  const { error, count } = await sb
    .from('social_posts')
    .delete({ count: 'exact' })
    .in('content_pack_id', packIds);
  if (error) {
    console.error('delete failed:', error.message);
    process.exit(1);
  }
  console.log(`Deleted: ${count ?? 0}`);
}

console.log('Inserting 30 rows …');
{
  const { data, error } = await sb
    .from('social_posts')
    .insert(rows)
    .select('id, content_pack_id, status, scheduled_at');
  if (error) {
    console.error('insert failed:', error.message);
    process.exit(1);
  }
  console.log(`Inserted: ${data.length}`);
  console.log('First 3:', data.slice(0, 3));
}

console.log('\nDONE. Telegram approval bot will pick them up.');
console.log(`Open Supabase: select * from public.social_posts where content_pack_id like 'kalkan-2026w%-d%' order by scheduled_at;`);
