/**
 * api/job-decision.js — Vercel Serverless Function
 * POST /api/job-decision
 * Body: { job_id, action: 'approve'|'reject', reason? }
 * Auth: Authorization: Bearer <supabase-service-role-jwt OR admin-user-jwt>
 *
 * 1. JWT doğrulama (getUser ile)
 * 2. jobs tablosunda status güncelle (service_role üzerinden)
 * 3. Employer'a Resend ile email gönder (yoksa mail_queue'ya ekle)
 */

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const BASE_URL  = 'https://kalkaninfo.com';
const JOBS_URL  = `${BASE_URL}/ilanlar.html`;
const APPLY_URL = `${BASE_URL}/ilan-ver.html`;

// ---------------------------------------------------------------------------
// Email şablonları
// ---------------------------------------------------------------------------
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HEADER_HTML = `
  <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:28px 40px;text-align:center;">
    <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">Kalkan · Kaş · Patara</p>
  </td></tr>`;

const FOOTER_HTML = `
  <tr><td style="padding:18px 40px 28px;border-top:1px solid #cfdfee;">
    <p style="margin:0;font-size:12px;color:#5d97c4;">
      <a href="${BASE_URL}/kvkk.html" style="color:#1a5e93;">KVKK Aydınlatma Metni</a>
      &nbsp;·&nbsp; info@kalkaninfo.com
    </p>
  </td></tr>`;

function approveEmailHtml(title, slug) {
  const safeTitle = escapeHtml(title);
  const ilanUrl   = `${JOBS_URL}?id=${encodeURIComponent(slug)}`;
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"/><title>İlanınız Yayında</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        ${HEADER_HTML}
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0a2e4c;">İlanınız Yayında! 🎉</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#134c79;">
            <strong>${safeTitle}</strong> başlıklı iş ilanınız incelendi ve yayına alındı.
          </p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#2f547a;">
            İlanınız artık Kalkan Info iş ilanları sayfasında görüntüleniyor. Başvurular doğrudan belirttiğiniz iletişim adresinize ulaşacaktır.
          </p>
          <a href="${ilanUrl}" style="display:inline-block;padding:13px 28px;background:#10b981;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">İlanı Görüntüle</a>
        </td></tr>
        ${FOOTER_HTML}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function approveEmailText(title) {
  return `İlanınız Yayında!\n\n"${title}" başlıklı iş ilanınız onaylandı ve yayına alındı.\n\nİlanlar sayfası: ${JOBS_URL}\n\nSorularınız için: info@kalkaninfo.com`;
}

function rejectEmailHtml(title, reason) {
  const safeTitle  = escapeHtml(title);
  const safeReason = reason ? escapeHtml(reason) : 'Belirtilmedi.';
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"/><title>İlan Başvurusu Hakkında</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        ${HEADER_HTML}
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0a2e4c;">İlan Başvurusu Hakkında</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#134c79;">
            <strong>${safeTitle}</strong> başlıklı iş ilanınız şu an için yayınlanamadı.
          </p>
          <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#7f1d1d;">Gerekçe:</p>
            <p style="margin:6px 0 0;font-size:14px;color:#991b1b;">${safeReason}</p>
          </div>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#2f547a;">
            Gerekli düzenlemeleri yaparak tekrar başvurabilirsiniz.
          </p>
          <a href="${APPLY_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">Tekrar Başvur</a>
        </td></tr>
        ${FOOTER_HTML}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function rejectEmailText(title, reason) {
  const r = reason || 'Belirtilmedi.';
  return `İlan Başvurusu Hakkında\n\n"${title}" başlıklı iş ilanınız şu an için yayınlanamadı.\n\nGerekçe: ${r}\n\nTekrar başvurmak için: ${APPLY_URL}\n\nSorularınız için: info@kalkaninfo.com`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { job_id, action, reason } = req.body || {};

  if (!job_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'job_id ve action (approve|reject) zorunlu' });
  }

  // JWT doğrulama
  const authHeader = req.headers.authorization || '';
  const jwt        = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return res.status(401).json({ error: 'Authorization header eksik' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[job-decision] STUB: Supabase env eksik');
    return res.status(200).json({ stub: true });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // Token doğrulama
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }

  // İlanı çek
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('id, slug, title, contact_email, status')
    .eq('id', job_id)
    .single();

  if (fetchError || !job) {
    return res.status(404).json({ error: 'İlan bulunamadı' });
  }

  if (job.status !== 'pending') {
    return res.status(409).json({ error: `İlan zaten "${job.status}" durumunda` });
  }

  // Status güncelle
  const newStatus  = action === 'approve' ? 'active' : 'closed';
  const updateData = action === 'approve'
    ? { status: newStatus, published_at: new Date().toISOString() }
    : { status: newStatus };

  const { error: updateError } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', job_id);

  if (updateError) {
    console.error('[job-decision] DB güncelleme hatası:', updateError.message);
    return res.status(500).json({ error: 'Veritabanı güncellenemedi' });
  }

  // Email hazırla
  const fromAddress = process.env.EMAIL_FROM || 'Kalkan Info <noreply@kalkaninfo.com>';
  const subject     = action === 'approve'
    ? 'İlanınız Kalkan Info\'da Yayında!'
    : 'Kalkan Info — İlan Başvurusu Hakkında';
  const html        = action === 'approve'
    ? approveEmailHtml(job.title, job.slug)
    : rejectEmailHtml(job.title, reason);
  const text        = action === 'approve'
    ? approveEmailText(job.title)
    : rejectEmailText(job.title, reason);

  // Resend yoksa mail_queue'ya ekle
  if (!process.env.RESEND_API_KEY) {
    console.log('[job-decision] RESEND_API_KEY yok, mail_queue insert ediliyor');
    await supabase.from('mail_queue').insert({
      to_email:  job.contact_email,
      subject,
      body_html: html,
      body_text: text,
      status:    'queued',
      template:  `job_${action}`,
      metadata:  { job_id: job.id, action, reason: reason || null, actor_id: user.id },
    });
    return res.status(200).json({ queued: true, action, job_id });
  }

  // Resend ile gönder
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:      fromAddress,
        to:        [job.contact_email],
        reply_to:  process.env.EMAIL_REPLY_TO || 'info@kalkaninfo.com',
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[job-decision] Resend API hatası:', response.status, errBody);
      // Mail başarısız olsa da DB değişikliği geri alınmaz — mail_queue'ya düş
      await supabase.from('mail_queue').insert({
        to_email:  job.contact_email,
        subject,
        body_html: html,
        body_text: text,
        status:    'queued',
        template:  `job_${action}`,
        metadata:  { job_id: job.id, action, reason: reason || null, actor_id: user.id, resend_failed: true },
      });
      return res.status(200).json({ sent: false, queued: true, action, job_id });
    }

    const result = await response.json();
    return res.status(200).json({ sent: true, id: result.id, action, job_id });
  } catch (err) {
    console.error('[job-decision] Fetch hatası:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
