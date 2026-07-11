// lib/image-permission-guard.mjs
// -----------------------------------------------------------------------------
// Görsel İzni Bekçisi (Düzeltme A)
// -----------------------------------------------------------------------------
// Amaç: Instagram kaynaklı bir görselin (fotoğraf) yayınlanmadan önce telif/izin
// açısından kullanılabilir olup olmadığını belirlemek. İzin bilgisi
// `data/ig-watch-accounts.json` içindeki her hesabın `image_permission` alanından
// okunur.
//
// image_permission değerleri:
//   "partner" | "yazili" -> yazılı onay (hem dijital hem basılı gazete için serbest)
//   "sozlu"              -> sözlü onay (SADECE dijital + etiket; basın için yazılı ŞART)
//   "yok" | tanımsız     -> görsel KULLANILMAZ (sadece kendi kartımız)
//
// Olgu/haber metni her zaman serbesttir; bu bekçi YALNIZCA görsel kullanımını
// denetler.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WATCH_FILE = join(ROOT, 'data', 'ig-watch-accounts.json');

// İzleme hesaplarını (ve izinlerini) tembel yükle + basit önbellek.
let _accountsCache = null;
function loadAccounts() {
  if (_accountsCache) return _accountsCache;
  try {
    const raw = readFileSync(WATCH_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed.accounts || []);
    // username -> hesap kaydı eşlemesi (küçük harfe normalize, @ ve boşluk temizlenir)
    const map = new Map();
    for (const acc of list) {
      if (!acc || !acc.username) continue;
      map.set(normalizeUsername(acc.username), acc);
    }
    _accountsCache = map;
  } catch (e) {
    // Dosya okunamazsa boş harita ile devam et (ihtiyatlı: her şey izinsiz sayılır).
    console.warn(`[görsel-izni] İzleme listesi okunamadı: ${e.message}`);
    _accountsCache = new Map();
  }
  return _accountsCache;
}

// Kullanıcı adını normalize et: baştaki @, boşluklar ve büyük/küçük harf farkını temizle.
function normalizeUsername(u) {
  return String(u || '').trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Bir Instagram kullanıcısının görselinin kullanılıp kullanılamayacağını denetler.
 *
 * @param {string} username - Instagram kullanıcı adı (@ ile veya olmadan).
 * @param {string} [context='dijital'] - Yayın bağlamı: 'dijital' veya 'basin'.
 * @returns {{ allowed: boolean, creditLine: (string|null), reason: string }}
 *   allowed    -> görsel kullanılabilir mi?
 *   creditLine -> kullanılabiliyorsa eklenmesi gereken kredi satırı, aksi halde null.
 *   reason     -> kararın kısa Türkçe açıklaması (loglama için).
 */
export function checkImagePermission(username, context = 'dijital') {
  const norm = normalizeUsername(username);
  const isPrint = String(context || '').toLowerCase().startsWith('bas'); // 'basin'/'basım'

  if (!norm) {
    return {
      allowed: false,
      creditLine: null,
      reason: 'Kullanıcı adı verilmedi — görsel atlandı',
    };
  }

  const accounts = loadAccounts();
  const acc = accounts.get(norm);

  if (!acc) {
    // İzleme listesinde yoksa ihtiyatlı davran: görsel kullanma.
    return {
      allowed: false,
      creditLine: null,
      reason: `Hesap izleme listesinde yok (@${norm}) — ihtiyatlı olarak görsel atlandı`,
    };
  }

  const perm = String(acc.image_permission || '').trim().toLowerCase();
  const creditLine = `Fotoğraf: @${norm}`;

  // "yazili" veya "partner": tam izin (dijital + basın).
  if (perm === 'yazili' || perm === 'yazılı' || perm === 'partner') {
    return {
      allowed: true,
      creditLine,
      reason: `Yazılı/partner izni — ${isPrint ? 'basın' : 'dijital'} için görsel serbest`,
    };
  }

  // "sozlu": sadece dijital serbest; basın için yazılı izin şart.
  if (perm === 'sozlu' || perm === 'sözlü') {
    if (isPrint) {
      return {
        allowed: false,
        creditLine: null,
        reason: 'Sözlü izin var ama BASIN için yazılı izin şart — görsel atlandı',
      };
    }
    return {
      allowed: true,
      creditLine,
      reason: 'Sözlü izin — sadece dijital + etiket için görsel serbest',
    };
  }

  // "yok" / tanımsız / bilinmeyen: görsel kullanma.
  return {
    allowed: false,
    creditLine: null,
    reason: 'İzin yok — görsel atlandı',
  };
}

// -----------------------------------------------------------------------------
// CLI birim testi:  node lib/image-permission-guard.mjs
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const ornekler = [
    ['kalamarbeachclub', 'dijital'], // sozlu -> dijitalde serbest
    ['kalamarbeachclub', 'basin'],   // sozlu -> basında yasak
    ['kas.hakkinda', 'dijital'],     // yok -> yasak
    ['bilinmeyenhesap', 'dijital'],  // listede yok -> yasak
    ['', 'dijital'],                 // boş -> yasak
  ];
  console.log('[görsel-izni] Birim test başlıyor...\n');
  for (const [u, ctx] of ornekler) {
    const r = checkImagePermission(u, ctx);
    console.log(`@${u || '(boş)'} [${ctx}] ->`, JSON.stringify(r, null, 0));
  }
  console.log('\n[görsel-izni] Birim test bitti.');
}
