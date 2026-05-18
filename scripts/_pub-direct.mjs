// Direct IG REELS publish — argv[2] page access token doğrudan kullanılır

const PAGE_TOKEN = process.argv[2];
const IG_USER = '17841464755523227';
const videoUrl = 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara/patara-drone-cinematic.mp4';

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Then step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

Footage: Pexels (Samir Smier, Nirjhar Basak, Kenan Turguç)

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #mediterraneantravel #hiddengems #wanderlust #turkishhistory #likya`;

console.log('📤 REELS container...');
const c1 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!c1.id) { console.error('container fail:', c1); process.exit(1); }
console.log(`  ${c1.id}`);

console.log('⏳ Polling...');
for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await fetch(`https://graph.facebook.com/v21.0/${c1.id}?fields=status_code&access_token=${PAGE_TOKEN}`).then(r => r.json());
  process.stdout.write(`  [${i*3}s] ${st.status_code}\n`);
  if (st.status_code === 'FINISHED') break;
  if (st.status_code === 'ERROR') { console.error('process error:', st); process.exit(1); }
}

console.log('🚀 Publishing...');
const pub = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: c1.id, access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!pub.id) { console.error('publish fail:', pub); process.exit(1); }
console.log(`\n🎬 DRONE REELS YAYINLANDI! IG: ${pub.id}`);
console.log(`https://www.instagram.com/kalkan.info/reels/`);
