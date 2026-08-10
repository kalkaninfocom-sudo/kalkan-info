#!/usr/bin/env node
/**
 * ig-discover-generic.mjs — Takip edilen (DB'de OLMAYAN) işletmelerden TASLAK envanter üret.
 * Kaynak: data/ig-following-20260810.json (kategorize). business_discovery + foto + LLM özet.
 * GÜVENLİ: canlı DB'ye DOKUNMAZ → çıktı data/<key>-draft.json (needsReview:true, Berkay inceler).
 * VİLLA HARİÇ (yasal). Kişisel hesaplar atlanır.
 *
 * node scripts/ig-discover-generic.mjs --cat wellness [--limit N] [--photos N]
 * Kategoriler: tekne wellness kafe bar sanat tur etkinlik otel market guzellik emlak hizmet
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { const p = join(ROOT, '.env.local'); if (existsSync(p)) for (const line of readFileSync(p,'utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,''); } } catch {}

const GRAPH='https://graph.facebook.com/v21.0', IG_ID=process.env.IG_BUSINESS_ID, TOKEN=process.env.IG_LONG_LIVED_TOKEN;
const ARGS=process.argv.slice(2);
const catArg=ARGS[ARGS.indexOf('--cat')+1];
const LIMIT=ARGS.includes('--limit')?Number(ARGS[ARGS.indexOf('--limit')+1])||Infinity:Infinity;
const MAX_PHOTOS=ARGS.includes('--photos')?Number(ARGS[ARGS.indexOf('--photos')+1])||3:3;

// kategori → {jsonCat (ig-following), key (draft/foto), label}
const CATS={
  tekne:{jsonCat:'Tekne/Su Sporları',key:'su-sporlari',label:'Tekne / Su Sporları'},
  wellness:{jsonCat:'Wellness/Spor',key:'wellness',label:'Wellness / Spor'},
  kafe:{jsonCat:'Kafe/Tatlı',key:'kafe',label:'Kafe / Tatlı'},
  bar:{jsonCat:'Bar/Gece',key:'bar',label:'Bar / Gece'},
  sanat:{jsonCat:'Sanat/Atölye',key:'sanat',label:'Sanat / Atölye'},
  tur:{jsonCat:'Tur/Seyahat/Concierge',key:'tur-seyahat',label:'Tur / Seyahat'},
  etkinlik:{jsonCat:'Etkinlik/Organizasyon',key:'etkinlik-org',label:'Etkinlik / Organizasyon'},
  otel:{jsonCat:'Otel/Pansiyon',key:'otel-yeni',label:'Otel / Pansiyon'},
  market:{jsonCat:'Market/Gıda Tedarik',key:'market',label:'Market / Gıda'},
  guzellik:{jsonCat:'Güzellik/Bakım',key:'guzellik',label:'Güzellik / Bakım'},
  emlak:{jsonCat:'Emlak/Yatırım',key:'emlak',label:'Emlak / Yatırım'},
  hizmet:{jsonCat:'Hizmet/B2B',key:'hizmet-b2b',label:'Hizmet / B2B'},
};
const cfg=CATS[catArg];
if(!cfg){console.error('Kategori: '+Object.keys(CATS).join(' '));process.exit(2);}
if(!IG_ID||!TOKEN){console.error('IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN yok');process.exit(1);}

const DRAFT_PATH=join(ROOT,'data',`${cfg.key}-draft.json`);
const PHOTO_REL=`assets/img/ig-${cfg.key}`;
const slugify=u=>u.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// DB'de zaten bağlı IG'ler (tekrar çekme)
const dbIg=new Set();
for(const f of ['restoranlar','oteller','turlar','plajlar','hizmetler','aktiviteler','hizmet-saglayicilari']){
  try{const d=JSON.parse(readFileSync(join(ROOT,'data',f+'.json'),'utf8'));(function w(o){if(Array.isArray(o))o.forEach(w);else if(o&&typeof o==='object'){for(const[k,v]of Object.entries(o)){if(k==='instagram'&&typeof v==='string'&&v)dbIg.add(v.toLowerCase().replace(/^@/,'').replace(/\/$/,''));else w(v);}}})(d);}catch{}
}

const follow=JSON.parse(readFileSync(join(ROOT,'data','ig-following-20260810.json'),'utf8'));
const candidates=(follow.categories[cfg.jsonCat]||[]).filter(h=>!dbIg.has(h.toLowerCase())).slice(0,LIMIT);

function photoName(u,p){let h=0;const s=String(p||u);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return `${u.replace(/[^a-z0-9]/gi,'').slice(0,24)}-${Math.abs(h).toString(36)}.jpg`;}
async function downloadPhoto(url,u,p,mt){if(!url||!/image|carousel/i.test(String(mt||'')))return null;const rel=`${PHOTO_REL}/${photoName(u,p)}`,abs=join(ROOT,rel);try{if(existsSync(abs))return `/${rel}`;const res=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!res.ok||!/image\//.test(res.headers.get('content-type')||''))return null;const buf=Buffer.from(await res.arrayBuffer());if(buf.length<1200)return null;await mkdir(join(ROOT,PHOTO_REL),{recursive:true});await writeFile(abs,buf);return `/${rel}`;}catch{return null;}}
async function discover(u){const fields=`business_discovery.username(${u}){name,biography,website,followers_count,media_count,profile_picture_url,media.limit(6){caption,media_url,permalink,media_type}}`;try{const res=await fetch(`${GRAPH}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`,{signal:AbortSignal.timeout(20000)});const d=await res.json();if(!res.ok||d.error)return{ok:false,reason:(d?.error?.message||`HTTP ${res.status}`).slice(0,100)};if(!d.business_discovery)return{ok:false,reason:'bd boş'};return{ok:true,bd:d.business_discovery};}catch(e){return{ok:false,reason:String(e.message||e).slice(0,100)};}}

const SYSTEM=`Sen turizm veri çıkarım asistanısın. Kalkan bölgesinde "${cfg.label}" kategorisinde bir Instagram işletmesinin ad/bio/caption'ı verilir. SADECE metinde açıkça geçeni çıkar, uydurma yok, emin değilsen null. SADECE JSON: {"altTip":"kısa tür etiketi|null","konum":"...|null","telefon":"...|null","ozet":"tek cümle olgusal Türkçe max 22 kelime, reklamsız"}`;

async function main(){
  console.log(`\n════ ${cfg.label} DISCOVERY — ${candidates.length} aday ════`);
  let cheapLLM=null;try{({cheapLLM}=await import(pathToFileURL(join(ROOT,'lib','cheap-llm.mjs')).href));}catch{}
  let existing={items:[],skipped:[]};try{existing=JSON.parse(await readFile(DRAFT_PATH,'utf8'));}catch{}
  const byIg=new Map((existing.items||[]).map(i=>[i.instagram,i]));
  const skipped=[];let i=0;
  for(const u of candidates){
    i++;process.stdout.write(`  [${i}/${candidates.length}] @${u} ... `);
    const r=await discover(u);
    if(!r.ok){skipped.push({username:u,reason:r.reason});console.log(`⊘ ${r.reason}`);await sleep(400);continue;}
    const bd=r.bd,gallery=[];
    for(const m of (bd.media?.data||[])){if(gallery.length>=MAX_PHOTOS)break;const img=await downloadPhoto(m.media_url,u,m.permalink,m.media_type);if(img)gallery.push(img);}
    let attrs=null;
    if(cheapLLM){try{const bio=(bd.biography||'').replace(/\s+/g,' ').slice(0,400);const caps=(bd.media?.data||[]).map(m=>(m.caption||'').replace(/\s+/g,' ')).filter(Boolean).slice(0,3).join(' ||| ').slice(0,700);const{text}=await cheapLLM(`Hesap:@${u}\nAd:${bd.name||''}\nBio:${bio}\nCaption:${caps}`,{system:SYSTEM,json:true,maxTokens:200,temperature:0.2,order:['ollama','groq','cerebras','nvidia']});attrs=JSON.parse(String(text).replace(/```json|```/g,'').trim());}catch{}}
    byIg.set(u,{id:`${cfg.key}-${slugify(u)}`,name:bd.name||u,instagram:u,category:cfg.label,type:attrs?.altTip||null,location:attrs?.konum||'Kalkan',phone:attrs?.telefon||null,image:gallery[0]||null,gallery,summary:attrs?.ozet||'',website:bd.website||null,biography:(bd.biography||'').replace(/\s+/g,' ').slice(0,300),followers:bd.followers_count??null,permalink:bd.media?.data?.[0]?.permalink||`https://instagram.com/${u}`,source:'ig-business_discovery',needsReview:true,fetchedAt:new Date().toISOString()});
    console.log(`✓ ${bd.name||u} | ${gallery.length} foto | ${bd.followers_count??'?'} tk`);
    await sleep(600);
  }
  const items=[...byIg.values()];
  await writeFile(DRAFT_PATH,JSON.stringify({_meta:{title:`${cfg.label} Taslakları (IG discovery)`,note:'needsReview:true — canlıya promote etmeden önce Berkay inceler.',generatedAt:new Date().toISOString(),total:items.length,atlanan:skipped.length},skipped,items},null,2));
  console.log(`\n✓ ${items.length} taslak · ${skipped.length} atlandı → data/${cfg.key}-draft.json`);
}
main().catch(e=>{console.error(e);process.exit(1);});
