/**
 * lib/storage.js — Supabase Storage helper (Faz 2B)
 * Carousel asset upload için: uploadAsset(localPath, remotePath)
 * Public URL döndürür, upsert ile idempotent.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local fallback (scripts doğrudan çalıştırıldığında)
try {
  const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.+?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n/g, '').trim();
  }
} catch {}

const SUPABASE_URL         = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET               = 'social-media';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('storage.js: SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Yerel dosyayı Supabase Storage'a yükle.
 * @param {string} localPath  — mutlak veya göreceli dosya yolu
 * @param {string} remotePath — bucket içindeki yol, örn. "patara/slide-1.jpg"
 * @returns {Promise<string>} — public HTTPS URL
 */
export async function uploadAsset(localPath, remotePath) {
  const buffer = readFileSync(localPath);
  const ext    = localPath.split('.').pop().toLowerCase();
  const mime   = ext === 'mp4' ? 'video/mp4'
               : ext === 'png' ? 'image/png'
               : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
               : 'image/webp';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, buffer, {
      contentType: mime,
      upsert: true        // idempotent
    });

  if (error) throw new Error(`Storage upload hata: ${error.message} (${remotePath})`);

  return publicUrl(remotePath);
}

/**
 * Remote path için public URL döndür (upload yapmadan).
 * @param {string} remotePath
 * @returns {string}
 */
export function publicUrl(remotePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${remotePath}`;
}

export { BUCKET, supabase };
