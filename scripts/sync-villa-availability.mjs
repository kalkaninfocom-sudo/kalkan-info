// Villa doluluk senkronu — villacim.com.tr takviminden GERÇEK dolu günleri okur.
// Kaynak: render edilen react-date-range takvimi (doluGiris/doluGunler/doluCikis = DOLU).
// Çıktı: data/villa-availability.json  -> { [slug]: { villaId, booked:[YYYY-MM-DD...], ranges:[{start,end}], updatedAt } }
// Çalıştır: node scripts/sync-villa-availability.mjs   (puppeteer gerekir; screenshot.mjs zaten kullanıyor)
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const VILLAS = [
  { slug: 'villa-ship-ahoy', id: 722 },
  { slug: 'villa-seascape',  id: 724 },
  { slug: 'villa-poyraz',    id: 725 },
];
const MONTH_PAIRS = 5; // 2 ay görünür + "sonraki" ile ~10 ay ufka bak
const TR_MONTHS = { 'oca':0,'şub':1,'sub':1,'mar':2,'nis':3,'may':4,'haz':5,'tem':6,'ağu':7,'agu':7,'eyl':8,'eki':9,'kas':10,'ara':11 };

const iso = (y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

async function scrapeVilla(page, v){
  await page.goto('https://www.villacim.com.tr/'+v.slug, { waitUntil:'networkidle2', timeout:60000 });
  // Müsaitlik takvimi sekmesini aç
  await page.evaluate(()=>{
    const el=[...document.querySelectorAll('a,button,div,span,li')].find(e=>/M[üu]saitlik/i.test(e.textContent||'')&&(e.textContent||'').length<40);
    if(el){ el.scrollIntoView(); el.click(); }
  });
  // react-date-range + dolu overlay headless'ta ~3s'de oturuyor
  await new Promise(r=>setTimeout(r,3500));
  try{ await page.waitForSelector('.rdrMonthName',{timeout:8000}); }catch(e){}

  const bookedSet = new Set();
  for(let p=0;p<MONTH_PAIRS;p++){
    const days = await page.evaluate(()=>{
      const out=[];
      document.querySelectorAll('.rdrMonth').forEach(mo=>{
        const label=(mo.querySelector('.rdrMonthName')||{}).textContent||'';
        out.push({ label:label.trim(), booked:[], all:[] });
        const cur=out[out.length-1];
        mo.querySelectorAll('button.rdrDay').forEach(b=>{
          const c=b.className.toString();
          if(/rdrDayPassive/.test(c)) return; // diğer ayın günü
          const span=b.querySelector('.rdrDayNumber span')||b.querySelector('span');
          const n=span?parseInt(span.textContent.trim(),10):NaN;
          if(!n) return;
          const isDolu = !!b.querySelector('[class*="dolu"],[class*="Dolu"]');
          cur.all.push(n);
          if(isDolu) cur.booked.push(n);
        });
      });
      return out;
    });
    for(const mo of days){
      const parts=mo.label.toLowerCase().split(/\s+/);
      const mk=Object.keys(TR_MONTHS).find(k=>parts[0]&&parts[0].startsWith(k));
      const year=parseInt((mo.label.match(/\d{4}/)||[])[0],10);
      if(mk==null||!year) continue;
      const m=TR_MONTHS[mk];
      for(const d of mo.booked) bookedSet.add(iso(year,m,d));
    }
    // sonraki ay çiftine geç
    const moved = await page.evaluate(()=>{
      const nx=document.querySelector('.rdrNextButton')||[...document.querySelectorAll('button')].find(b=>/next|sonraki|›|>/i.test(b.getAttribute('aria-label')||b.textContent||''));
      if(nx&&!nx.disabled){ nx.click(); return true; } return false;
    });
    if(!moved) break;
    await new Promise(r=>setTimeout(r,1400));
  }

  const booked=[...bookedSet].sort();
  // ardışık günleri aralığa dönüştür
  const ranges=[]; let s=null,prev=null;
  for(const d of booked){
    if(s===null){ s=d; prev=d; continue; }
    const pd=new Date(prev), cd=new Date(d);
    if((cd-pd)===86400000){ prev=d; } else { ranges.push({start:s,end:prev}); s=d; prev=d; }
  }
  if(s) ranges.push({start:s,end:prev});
  return { villaId:v.id, booked, ranges };
}

(async()=>{
  const browser=await puppeteer.launch({ headless:'new', args:['--no-sandbox'] });
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:1400});
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36');
  const result={};
  const stamp=new Date().toISOString();
  for(const v of VILLAS){
    try{
      const r=await scrapeVilla(page,v);
      result[v.slug]={ ...r, updatedAt:stamp };
      console.log(`${v.slug} (id ${v.id}): ${r.booked.length} dolu gün, ${r.ranges.length} aralık`);
      if(r.ranges.length) console.log('   ', r.ranges.map(x=>x.start+'→'+x.end).join('  '));
    }catch(e){
      console.error(v.slug,'HATA:',e.message);
      result[v.slug]={ villaId:v.id, booked:[], ranges:[], error:e.message, updatedAt:stamp };
    }
  }
  await browser.close();
  const outPath=process.argv[2]||'data/villa-availability.json';
  writeFileSync(outPath, JSON.stringify(result,null,2));
  console.log('\nYAZILDI:', outPath);
})();
