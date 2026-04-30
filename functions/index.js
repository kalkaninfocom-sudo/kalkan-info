/**
 * functions/index.js
 * Kalkan Info — Cloud Functions merkezi export noktası
 *
 * Tüm fonksiyonlar buradan re-export edilir.
 * firebase deploy --only functions bu dosyayı entry point olarak kullanır.
 *
 * Yeni fonksiyon eklerken:
 *   1. functions/<isim>.js dosyasını yaz (mevcut pattern'i izle)
 *   2. Aşağıya exports.<isim> = require('./<isim>').<isim> ekle
 *   3. firebase deploy --only functions:<isim>
 */

'use strict';

// --- Tatil Asistanı ---
const { vacationPlanner } = require('./vacationPlanner');
exports.vacationPlanner = vacationPlanner;

// --- Haber Teyit ---
const { verifyNewsItem } = require('./verifyNewsItem');
exports.verifyNewsItem = verifyNewsItem;

// --- Sosyal Medya Yayın ---
const { publishToSocial } = require('./publishToSocial');
exports.publishToSocial = publishToSocial;

// --- WhatsApp Webhook ---
const { whatsappWebhook } = require('./whatsappWebhook');
exports.whatsappWebhook = whatsappWebhook;

// --- Welcome Email (users/{uid} onCreate) ---
const { sendWelcomeEmail } = require('./src/sendWelcomeEmail');
exports.sendWelcomeEmail = sendWelcomeEmail;

// TODO: diğer fonksiyonlar buraya eklenir
// const { onUserDelete }      = require('./onUserDelete');      exports.onUserDelete = onUserDelete;
// const { exportUserData }    = require('./exportUserData');    exports.exportUserData = exportUserData;
// const { setAdminClaim }     = require('./setAdminClaim');     exports.setAdminClaim = setAdminClaim;
// const { dailyBackup }       = require('./dailyBackup');       exports.dailyBackup = dailyBackup;
// const { thumbnailGenerator} = require('./thumbnailGenerator');exports.thumbnailGenerator = thumbnailGenerator;
// const { sendVacationPlanByEmail } = require('./sendVacationPlanByEmail'); exports.sendVacationPlanByEmail = sendVacationPlanByEmail;
