/**
 * Kalkan Info — Welcome Email Cloud Function
 *
 * Trigger: Firestore onCreate users/{uid}
 * Yöntem : Firebase Trigger Email Extension
 *          (mail/ koleksiyonuna doküman yazar, extension gönderir)
 *
 * Kurulum:
 *   1. Firebase Console → Extensions → "Trigger Email" kur
 *   2. MAIL_COLLECTION = "mail" olarak ayarla
 *   3. SMTP sağlayıcısı: SendGrid veya Mailgun
 *   4. "from" adresi: noreply@kalkaninfo.com
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');

// initializeApp yalnızca bir kez çağrılmalı — index.js'de yapılıyorsa buraya gerek yok
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Dil şablonları (5 dil)
// ---------------------------------------------------------------------------
const TEMPLATES = {
  tr: {
    subject: 'Kalkan Info\'ya Hoş Geldiniz!',
    html: (name, profileUrl, kvkkUrl) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Kalkan Info'ya Hoş Geldiniz</title>
</head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">
            <span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span>
          </p>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Kalkan · Kaş · Patara</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-family:'Montserrat',Arial,sans-serif;font-size:22px;font-weight:700;color:#0a2e4c;">
            Hoş Geldiniz, ${name}!
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">
            Kalkan Info ailesine katıldığınız için teşekkür ederiz. Artık yerel rehberimizden tam yararlanabilir, yorum yazabilir ve işletme profilinizi yönetebilirsiniz.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#134c79;">
            Profilinizi tamamlamak ve dil tercihinizi belirlemek için aşağıdaki butona tıklayın.
          </p>
          <a href="${profileUrl}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-family:'Montserrat',Arial,sans-serif;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
            Profilime Git
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0 0 8px;font-size:12px;color:#5d97c4;line-height:1.6;">
            Bu e-postayı beklemiyor musunuz? Hesabınızı siz oluşturmadıysanız bu e-postayı yoksayabilirsiniz.
          </p>
          <p style="margin:0;font-size:12px;color:#5d97c4;">
            <a href="${kvkkUrl}" style="color:#1a5e93;">KVKK Aydınlatma Metni</a> &nbsp;·&nbsp; info@kalkaninfo.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name, profileUrl) =>
      `Hoş Geldiniz, ${name}!\n\nKalkan Info ailesine katıldığınız için teşekkürler.\nProfilinize gitmek için: ${profileUrl}\n\nSorularınız için: info@kalkaninfo.com`,
  },

  en: {
    subject: 'Welcome to Kalkan Info!',
    html: (name, profileUrl, kvkkUrl) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Welcome to Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">
            <span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span>
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">Welcome, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">
            Thank you for joining Kalkan Info — your local guide to Kalkan, Kaş and Patara.
          </p>
          <a href="${profileUrl}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
            Go to My Profile
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;">
            <a href="${kvkkUrl}" style="color:#1a5e93;">Privacy Policy</a> &nbsp;·&nbsp; info@kalkaninfo.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name, profileUrl) =>
      `Welcome, ${name}!\n\nThank you for joining Kalkan Info.\nVisit your profile: ${profileUrl}\n\nContact: info@kalkaninfo.com`,
  },

  ru: {
    subject: 'Добро пожаловать в Kalkan Info!',
    html: (name, profileUrl, kvkkUrl) => `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"/><title>Добро пожаловать в Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">
            <span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span>
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">Добро пожаловать, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">
            Спасибо за регистрацию в Kalkan Info — вашем местном путеводителе по Калкану, Кашу и Патаре.
          </p>
          <a href="${profileUrl}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
            Перейти в профиль
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;">
            <a href="${kvkkUrl}" style="color:#1a5e93;">Политика конфиденциальности</a> &nbsp;·&nbsp; info@kalkaninfo.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name, profileUrl) =>
      `Добро пожаловать, ${name}!\n\nСпасибо за регистрацию в Kalkan Info.\nПерейти в профиль: ${profileUrl}\n\nКонтакт: info@kalkaninfo.com`,
  },

  ja: {
    subject: 'Kalkan Info へようこそ！',
    html: (name, profileUrl, kvkkUrl) => `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"/><title>Kalkan Info へようこそ</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">
            <span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span>
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">${name} さん、ようこそ！</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">
            Kalkan Info にご登録いただき、ありがとうございます。カルカン、カシュ、パタラの地元ガイドをお楽しみください。
          </p>
          <a href="${profileUrl}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
            プロフィールへ
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;">
            <a href="${kvkkUrl}" style="color:#1a5e93;">プライバシーポリシー</a> &nbsp;·&nbsp; info@kalkaninfo.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name, profileUrl) =>
      `${name} さん、ようこそ！\n\nKalkan Info にご登録いただき、ありがとうございます。\nプロフィール: ${profileUrl}\n\nお問い合わせ: info@kalkaninfo.com`,
  },

  ar: {
    subject: 'مرحباً بك في Kalkan Info!',
    html: (name, profileUrl, kvkkUrl) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>مرحباً بك في Kalkan Info</title></head>
<body style="margin:0;padding:0;background:#dce6ef;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#dce6ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,33,54,0.12);">
        <tr><td style="background:linear-gradient(180deg,#0c3858,#0a2e4c);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">
            <span style="color:#e89812;">◆</span> KALKAN <span style="color:#e89812;">INFO</span>
          </p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a2e4c;">مرحباً بك، ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#134c79;">
            شكراً لانضمامك إلى Kalkan Info — دليلك المحلي إلى كالكان وكاش وباتارا.
          </p>
          <a href="${profileUrl}" style="display:inline-block;padding:13px 28px;background:#1a5e93;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
            الذهاب إلى ملفي الشخصي
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #cfdfee;">
          <p style="margin:0;font-size:12px;color:#5d97c4;">
            <a href="${kvkkUrl}" style="color:#1a5e93;">سياسة الخصوصية</a> &nbsp;·&nbsp; info@kalkaninfo.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: (name, profileUrl) =>
      `مرحباً بك، ${name}!\n\nشكراً لانضمامك إلى Kalkan Info.\nملفك الشخصي: ${profileUrl}\n\nللتواصل: info@kalkaninfo.com`,
  },
};

// ---------------------------------------------------------------------------
// Cloud Function: users/{uid} onCreate → hoş geldiniz e-postası gönder
// ---------------------------------------------------------------------------
exports.sendWelcomeEmail = functions
  .region('europe-west3')   // KVKK — AB bölgesi
  .firestore
  .document('users/{uid}')
  .onCreate(async (snap, context) => {
    const uid  = context.params.uid;
    const data = snap.data();

    if (!data.email) {
      functions.logger.warn('sendWelcomeEmail: e-posta adresi yok, atlanıyor.', { uid });
      return null;
    }

    // Dil seçimi (varsayılan: tr)
    const lang = (data.preferredLang || 'tr').toLowerCase();
    const tpl  = TEMPLATES[lang] || TEMPLATES['tr'];

    const displayName = data.displayName || data.email.split('@')[0];
    const baseUrl     = 'https://kalkaninfo.com';
    const profileUrl  = `${baseUrl}/profil.html`;
    const kvkkUrl     = `${baseUrl}/kvkk.html`;

    const mailDoc = {
      to:      [data.email],
      message: {
        subject:  tpl.subject,
        html:     tpl.html(displayName, profileUrl, kvkkUrl),
        text:     tpl.text(displayName, profileUrl),
      },
    };

    try {
      await db.collection('mail').add(mailDoc);
      functions.logger.info('sendWelcomeEmail: mail kuyruğa eklendi.', { uid, lang });
    } catch (err) {
      functions.logger.error('sendWelcomeEmail: mail eklenirken hata.', { uid, err });
    }

    return null;
  });
