/**
 * functions/scheduledNobetciEczaneSync.js
 *
 * Her gün 06:00 Europe/Istanbul'da çalışır.
 * Firestore'daki config/eczane_today dokümanını okur:
 *   - today.date dünden önceyse → tomorrow'u today'e promote eder
 *   - tomorrow'u temizler (boş bırakır, Berkay admin'den günceller)
 *
 * Berkay'ın yapacakları:
 *   - Firestore'da config/eczane_today dokümanını oluştur (data/eczane.json formatında)
 *   - Admin panelinden günlük today/tomorrow alanlarını güncelle
 *   - firebase deploy --only functions:scheduledNobetciEczaneSync
 *
 * NOT: Antalya Eczacı Odası API mevcut değil, manuel güncelleme gerekli.
 */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger }     = require('firebase-functions');
const admin          = require('firebase-admin');

// firebase-admin tek seferlik init (index.js'de zaten initializeApp varsa atlar)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = () => admin.firestore();

// Firestore doküman yolu: config/eczane_today
const DOC_PATH = 'config/eczane_today';

/**
 * YYYY-MM-DD string döndürür (Europe/Istanbul).
 */
function isoTurkiye(offsetGun = 0) {
  const d = new Date(Date.now() + offsetGun * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

exports.scheduledNobetciEczaneSync = onSchedule(
  {
    schedule: '0 6 * * *',       // her gün 06:00
    timeZone: 'Europe/Istanbul',
    region:   'europe-west1',
    timeoutSeconds: 60,
  },
  async () => {
    const bugun = isoTurkiye(0);
    const dun   = isoTurkiye(-1);

    logger.info('[EczaneSync] Çalışıyor', { bugun });

    try {
      const ref  = db().doc(DOC_PATH);
      const snap = await ref.get();

      if (!snap.exists) {
        logger.warn('[EczaneSync] config/eczane_today dokümanı bulunamadı. Berkay oluşturmalı.');
        return;
      }

      const data = snap.data();
      const todayDate = data?.today?.date || '';

      // today.date bugünle eşleşiyorsa — güncelleme gerekmez
      if (todayDate === bugun) {
        logger.info('[EczaneSync] Veri güncel, işlem yok.', { todayDate });
        return;
      }

      // today.date dünden önceyse → tomorrow'u today'e promote et
      if (todayDate <= dun) {
        const tomorrow = data?.tomorrow || null;

        if (tomorrow && tomorrow.name) {
          logger.info('[EczaneSync] Promote: tomorrow → today', { tomorrow });
          await ref.update({
            'today':              { ...tomorrow, date: bugun },
            'tomorrow':           {},   // Berkay yeni yarını ekler
            '_meta.lastUpdated':  new Date().toISOString(),
          });
          logger.info('[EczaneSync] Promote tamamlandı.');
        } else {
          // tomorrow boş — sadece tarihi güncelle, uyar
          logger.warn('[EczaneSync] today eskimiş ama tomorrow boş. Berkay manuel güncellemeli.', { todayDate });
          await ref.update({
            'today.date':         bugun,
            '_meta.lastUpdated':  new Date().toISOString(),
          });
        }
      } else {
        // today gelecek bir tarih — beklenmedik durum, logla
        logger.warn('[EczaneSync] today.date gelecekte?', { todayDate, bugun });
      }
    } catch (err) {
      logger.error('[EczaneSync] Hata:', err);
      throw err;
    }
  }
);
