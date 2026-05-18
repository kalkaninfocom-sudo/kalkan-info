// scripts/_publish-patara-now.mjs — Patara carousel'i direkt IG'ye yayınla

const USER_TOKEN = process.argv[2];
if (!USER_TOKEN) { console.error('Usage: ... <user_token>'); process.exit(1); }

const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const page = acc.data?.[0];
const PAGE_TOKEN = page.access_token;
const IG_USER = '17841464755523227';

const sb = 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara';
const slides = [`${sb}/slide-1.jpg`, `${sb}/slide-2.jpg`, `${sb}/slide-3.jpg`];
const caption = `🏛️ Patara — Where democracy was born.

Birthplace of Saint Nicholas. UNESCO World Heritage. 15 minutes from Kalkan. One ticket gets you the ruins AND Turkey's longest untouched beach.

Save this for your Kalkan trip 📌

📍 kalkaninfo.com → Antik Kentler

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #mediterraneantravel #hiddengems #wanderlust #turkishhistory #likya`;

// Step 1: create each image container
console.log('1) Creating 3 image containers...');
const ids = [];
for (let i = 0; i < slides.length; i++) {
  const f = new URLSearchParams({ image_url: slides[i], is_carousel_item: 'true', access_token: PAGE_TOKEN });
  const r = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, { method: 'POST', body: f });
  const j = await r.json();
  if (!r.ok || !j.id) { console.error(`slide ${i+1} fail:`, j); process.exit(1); }
  console.log(`  slide ${i+1}: ${j.id}`);
  ids.push(j.id);
}

// Step 2: carousel container
console.log('2) Creating carousel container...');
const cF = new URLSearchParams({
  media_type: 'CAROUSEL',
  children: ids.join(','),
  caption: caption,
  access_token: PAGE_TOKEN,
});
const carRes = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, { method: 'POST', body: cF });
const carJson = await carRes.json();
if (!carRes.ok || !carJson.id) { console.error('carousel fail:', carJson); process.exit(1); }
console.log(`  carousel: ${carJson.id}`);

// Step 3: publish
console.log('3) Publishing...');
const pF = new URLSearchParams({ creation_id: carJson.id, access_token: PAGE_TOKEN });
const pubRes = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, { method: 'POST', body: pF });
const pubJson = await pubRes.json();
if (!pubRes.ok || !pubJson.id) { console.error('publish fail:', pubJson); process.exit(1); }
console.log(`\n🎉 YAYINLANDI! IG Media ID: ${pubJson.id}`);
console.log(`   https://www.instagram.com/p/${pubJson.id}/  (link IG tarafından üretilen kısa-link)`);
console.log(`   Profilden gör: https://www.instagram.com/kalkan.info/`);
