/**
 * api/welcome-email.js — Vercel Serverless Function
 * POST /api/welcome-email
 * Body: { email, displayName, preferredLang }
 * Auth: Authorization: Bearer <supabase-jwt>
 *
 * RESEND_API_KEY varsa direkt gönder,
 * yoksa mail_queue tablosuna stub insert yap.
 */

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const BASE_URL    = 'https://kalkaninfo.com';
const PROFILE_URL = `${BASE_URL}/profil.html`;
const KVKK_URL    = `${BASE_URL}/kvkk.html`;

// ---------------------------------------------------------------------------
// Dil şablonları
// ---------------------------------------------------------------------------
const TEMPLATES = {
  tr: {
    subject: "Kalkan Info'ya Hoş Geldiniz!",
    html: (name) => `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"/><title>Kalkan Info'ya Hoş Geldiniz</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Kalkan · Kaş · Patara</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">Hoş Geldiniz, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">Kalkan Info ailesine katıldığınız için teşekkür ederiz. Yerel rehberimizden tam yararlanabilir, yorum yazabilir ve işletme profilinizi yönetebilirsiniz.</p>
          <a href="${PROFILE_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">Profilime Git</a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;"><a href="${KVKK_URL}" style="color:#1a5e93;">KVKK Aydınlatma Metni</a> &nbsp;·&nbsp; info@kalkaninfo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name) => `Hoş Geldiniz, ${name}!\n\nKalkan Info ailesine katıldığınız için teşekkürler.\nProfilinize gitmek için: ${PROFILE_URL}\n\nSorularınız için: info@kalkaninfo.com`,
  },

  en: {
    subject: 'Welcome to Kalkan Info!',
    html: (name) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Welcome to Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">Welcome, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">Thank you for joining Kalkan Info — your local guide to Kalkan, Kaş and Patara.</p>
          <a href="${PROFILE_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">Go to My Profile</a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;"><a href="${KVKK_URL}" style="color:#1a5e93;">Privacy Policy</a> &nbsp;·&nbsp; info@kalkaninfo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name) => `Welcome, ${name}!\n\nThank you for joining Kalkan Info.\nVisit your profile: ${PROFILE_URL}\n\nContact: info@kalkaninfo.com`,
  },

  ru: {
    subject: 'Добро пожаловать в Kalkan Info!',
    html: (name) => `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"/><title>Добро пожаловать в Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">Добро пожаловать, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">Спасибо за регистрацию в Kalkan Info — вашем местном путеводителе по Калкану, Кашу и Патаре.</p>
          <a href="${PROFILE_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">Перейти в профиль</a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;"><a href="${KVKK_URL}" style="color:#1a5e93;">Политика конфиденциальности</a> &nbsp;·&nbsp; info@kalkaninfo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name) => `Добро пожаловать, ${name}!\n\nСпасибо за регистрацию.\nПрофиль: ${PROFILE_URL}\n\nКонтакт: info@kalkaninfo.com`,
  },

  ja: {
    subject: 'Kalkan Info へようこそ！',
    html: (name) => `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"/><title>Kalkan Info へようこそ</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">${name} さん、ようこそ！</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">Kalkan Info にご登録いただき、ありがとうございます。</p>
          <a href="${PROFILE_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">プロフィールへ</a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;"><a href="${KVKK_URL}" style="color:#1a5e93;">プライバシーポリシー</a> &nbsp;·&nbsp; info@kalkaninfo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name) => `${name} さん、ようこそ！\n\nKalkan Info にご登録いただき、ありがとうございます。\nプロフィール: ${PROFILE_URL}`,
  },

  ar: {
    subject: 'مرحباً بك في Kalkan Info!',
    html: (name) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>مرحباً بك في Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;"><span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span></p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">مرحباً بك، ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">شكراً لانضمامك إلى Kalkan Info — دليلك المحلي إلى كالكان وكاش وباتارا.</p>
          <a href="${PROFILE_URL}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">الذهاب إلى ملفي الشخصي</a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;"><a href="${KVKK_URL}" style="color:#1a5e93;">سياسة الخصوصية</a> &nbsp;·&nbsp; info@kalkaninfo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name) => `مرحباً بك، ${name}!\n\nشكراً لانضمامك إلى Kalkan Info.\nملفك الشخصي: ${PROFILE_URL}`,
  },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { email, displayName, preferredLang } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email gerekli' });
  }

  // JWT doğrulama
  const authHeader = req.headers.authorization || '';
  const jwt        = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!jwt) {
    return res.status(401).json({ error: 'Authorization header eksik' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[welcome-email] STUB: Supabase env eksik');
    return res.status(200).json({ stub: true, queued: false });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang        = (preferredLang || 'tr').toLowerCase();
  const tpl         = TEMPLATES[lang] || TEMPLATES['tr'];
  const rawName     = displayName || email.split('@')[0];
  const name        = escapeHtml(rawName).slice(0, 80);
  const fromAddress = process.env.EMAIL_FROM || 'Kalkan Info <noreply@kalkaninfo.com>';

  // RESEND_API_KEY yoksa mail_queue'ya ekle
  if (!process.env.RESEND_API_KEY) {
    console.log('[welcome-email] STUB: RESEND_API_KEY yok, mail_queue insert ediliyor');
    const { error: queueError } = await supabase.from('mail_queue').insert({
      to_email:    email,
      subject:     tpl.subject,
      body_html:   tpl.html(name),
      body_text:   tpl.text(name),
      status:      'queued',
      template:    'welcome',
      metadata:    { displayName: name, userId: user.id, lang },
    });

    if (queueError) {
      console.error('[welcome-email] mail_queue insert hatası:', queueError.message);
      return res.status(500).json({ error: 'Kuyruk hatası' });
    }

    return res.status(200).json({ queued: true });
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
        from:    fromAddress,
        to:      [email],
        reply_to: process.env.EMAIL_REPLY_TO || 'info@kalkaninfo.com',
        subject: tpl.subject,
        html:    tpl.html(name),
        text:    tpl.text(name),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[welcome-email] Resend API hatası:', response.status, errBody);
      return res.status(502).json({ error: 'Mail gönderilemedi' });
    }

    const result = await response.json();
    return res.status(200).json({ sent: true, id: result.id });
  } catch (err) {
    console.error('[welcome-email] Fetch hatası:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
