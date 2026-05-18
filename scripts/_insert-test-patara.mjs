import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  let v = l.slice(k.length + 1).replace(/^"|"$/g, '');
  v = v.replace(/\\n$/, '').replace(/\s+$/, '').trim();
  return v;
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const TG_TOKEN = '8653140541:AAF7C7Y8NHkbzmCuQuvtxuWclu8C0uBl570';
const CHAT_ID = 6299176220;

const sb = 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara';
const post = {
  content_pack_id: 'patara',
  content_type: 'reels',
  language: 'en',
  voiceover_text: 'Welcome to Patara. The birthplace of Saint Nicholas. Capital of the Lycian League. Home to the worlds first democratic parliament — over two thousand years old.',
  caption: '🏛️ Patara — Where democracy was born.\n\nBirthplace of Saint Nicholas. UNESCO World Heritage. 15 minutes from Kalkan. One ticket gets you the ruins AND Turkey\'s longest untouched beach.\n\nSave this for your Kalkan trip 📌\n\n📍 kalkaninfo.com → Antik Kentler',
  hashtags: ['#kalkan','#patara','#lycia','#unescoworldheritage','#turkeytravel','#ancientcities','#mediterranean','#santaclaus','#turkishriviera','#archaeology','#mediterraneantravel','#hiddengems','#wanderlust','#turkishhistory','#likya'],
  music_mood: 'epic-cinematic-rise',
  local_assets: [`${sb}/slide-1.jpg`, `${sb}/slide-2.jpg`, `${sb}/slide-3.jpg`],
  duration_s: 28,
  status: 'pending_approval',
  scheduled_at: new Date(Date.now() + 7200_000).toISOString(),
  telegram_chat_id: CHAT_ID,
};

const r = await fetch(`${SUPA_URL}/rest/v1/social_posts?select=id`, {
  method: 'POST',
  headers: {
    apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json', Prefer: 'return=representation'
  },
  body: JSON.stringify(post),
});

if (!r.ok) {
  console.error('insert fail:', r.status, await r.text());
  process.exit(1);
}
const [created] = await r.json();
const postId = created.id;
console.log('✅ Insert OK · id:', postId);

const escMd = s => String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
const sched = new Date(post.scheduled_at).toLocaleString('tr-TR', {
  timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
});

const text = `🎬 *İLK GERÇEK REELS ONAYI*

*Konu:* Patara Antik Kenti
*Tarih/Saat:* ${escMd(sched)}
*Süre:* 28s · 9:16 carousel

━━━━━━━━━━
*Voice\\-over önizleme:*
_${escMd(post.voiceover_text.slice(0, 200))}\\.\\.\\._

*Caption:*
${escMd(post.caption.slice(0, 180))}\\.\\.\\.

*Hashtag:* ${post.hashtags.slice(0,5).map(escMd).join(' ')} \\+10 daha

*Görseller \\(3\\):*
[slide\\-1](${post.local_assets[0]}) · [slide\\-2](${post.local_assets[1]}) · [slide\\-3](${post.local_assets[2]})
━━━━━━━━━━

⚠️ Bu mesajdaki butonlar artık *gerçek IG yayını* tetikler\\. "Yayınla Şimdi" → IG'de carousel olarak görünür\\.`;

const tg = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT_ID, text, parse_mode: 'MarkdownV2', disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [
      [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
       { text: '⏰ Önerilen Saatte', callback_data: `pub:${postId}:scheduled` }],
      [{ text: '✏️ Değiştir', callback_data: `pub:${postId}:edit` },
       { text: '❌ Reddet', callback_data: `pub:${postId}:reject` }]
    ]}
  })
});
const tgBody = await tg.json();
if (tgBody.ok) {
  console.log('✅ Telegram approval mesajı gönderildi · message_id:', tgBody.result.message_id);
  await fetch(`${SUPA_URL}/rest/v1/social_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_message_id: tgBody.result.message_id })
  });
} else {
  console.error('telegram fail:', tgBody);
}
