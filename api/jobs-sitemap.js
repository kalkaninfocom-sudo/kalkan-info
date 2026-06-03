/**
 * api/jobs-sitemap.js — XML sitemap of active jobs
 *
 * URL: /sitemap-jobs.xml (Vercel rewrite)
 *
 * Google Jobs indexing için tüm aktif ilanların URL'lerini listele.
 * sitemap.xml içine bu sitemap'in linki eklenmelidir (sitemap index).
 */

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const BASE_URL = 'https://kalkaninfo.com';

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('slug, published_at, updated_at, content_lang')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(5000);

    if (error) throw error;

    const urls = (jobs || []).map(j => {
      const lastmod = new Date(j.updated_at || j.published_at || Date.now()).toISOString();
      return `  <url>
    <loc>${xmlEscape(`${BASE_URL}/ilan/${j.slug}`)}</loc>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/ilanlar</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${urls}
</urlset>`;

    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    console.error('[jobs-sitemap] error:', err.message);
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
}
