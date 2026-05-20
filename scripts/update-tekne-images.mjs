import { promises as fs } from 'node:fs';

const file = 'C:/Users/socie/kalkan-info/data/hizmet-saglayicilari.json';
// pair (current image filename) -> (new image filename); restricted to known boat slugs
const replacements = [
  ['/assets/img/9aae5688bcff.webp', '/assets/img/tekne-kalamaki.webp', 'tekne-kalamaki-boats'],
  ['/assets/img/c81f592fdd67.webp', '/assets/img/tekne-yildiz.webp', 'tekne-yildiz-tourism'],
  ['/assets/img/36a7f5f45d38.webp', '/assets/img/tekne-serenity.webp', 'tekne-serenity-yachting'],
  ['/assets/img/cb51be91ff4b.webp', '/assets/img/tekne-ates.webp', 'tekne-ates-boat'],
  ['/assets/img/343fdd505a81.webp', '/assets/img/tekne-atlas.webp', 'tekne-atlas-boat'],
  ['/assets/img/b006c27149e7.webp', '/assets/img/tekne-ali-korsan.webp', 'tekne-korsan-boat'],
  ['/assets/img/78147c0c504b.webp', '/assets/img/tekne-nirvana.webp', 'tekne-nirvana-boat'],
];

let txt = await fs.readFile(file, 'utf8');
for (const [oldImg, newImg, id] of replacements) {
  // anchor on "id": "<id>" block, replace its image line
  const re = new RegExp(`("id": "${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"[\\s\\S]{0,400}?"image": ")[^"]+(")`);
  const before = txt;
  txt = txt.replace(re, `$1${newImg}$2`);
  if (before === txt) console.error(`SKIP ${id}: pattern did not match`);
  else console.log(`OK ${id} -> ${newImg}`);
}
await fs.writeFile(file, txt);
console.log('Saved.');
