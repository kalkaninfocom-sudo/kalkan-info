/**
 * vacation-planner.js
 * Kalkan Info — Tatil Asistanı istemci mantığı
 *
 * 2 mod:
 *  1. Cloud (Firebase Functions + Firestore) — production'da Claude AI ile gerçek plan
 *  2. Local fallback — Firebase yoksa veya Function başarısızsa, client-side
 *     taslak plan + WhatsApp Concierge yönlendirmesi. Site her durumda çalışır.
 */

let auth = null, db = null, fns = null;
let cloudReady = false;

try {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js');
  const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');

  const firebaseConfig = window.__FIREBASE_CONFIG__ || null;
  if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PLACEHOLDER')) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db   = getFirestore(app);
    fns  = getFunctions(app, 'europe-west3');
    cloudReady = true;

    // Auth state — track current user for save feature
    onAuthStateChanged(auth, (user) => {
      window._currentUser = user;
      const btn = document.getElementById('btn-save');
      if (btn) btn.textContent = user ? '💾 Planı Kaydet' : '🔐 Kaydetmek için giriş yap';
    });

    // Expose helpers
    window.__cloudHelpers = { httpsCallable, collection, addDoc, serverTimestamp };
  } else {
    console.info('[vacation-planner] Firebase config yok — local fallback mod aktif.');
  }
} catch (err) {
  console.warn('[vacation-planner] Firebase init başarısız, local fallback mod:', err.message);
}

// ---------------------------------------------------------------------------
// Rate limit — client-side guard (1 plan / day / browser)
// Server enforces stricter limits.
// ---------------------------------------------------------------------------
const RATE_KEY   = 'kalkan_plan_last';
const RATE_LIMIT = 24 * 60 * 60 * 1000; // 24h in ms

function checkClientRateLimit() {
  const last = localStorage.getItem(RATE_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > RATE_LIMIT;
}

function recordClientRequest() {
  localStorage.setItem(RATE_KEY, String(Date.now()));
}

// ---------------------------------------------------------------------------
// Form data collection
// ---------------------------------------------------------------------------
function collectFormData() {
  const form = document.getElementById('planner-form');
  const fd   = new FormData(form);

  // Multi-value fields
  const airlines   = fd.getAll('airlines');
  const foodOpts   = fd.getAll('food');
  const cuisines   = fd.getAll('cuisine');
  const activities = fd.getAll('activities');

  return {
    dateStart:           fd.get('dateStart'),
    dateEnd:             fd.get('dateEnd'),
    adults:              Number(fd.get('adults') || 2),
    children:            Number(fd.get('children') || 0),
    budget:              Number(document.getElementById('budget-slider').value),
    currency:            fd.get('currency') || 'TRY',
    departureAirport:    fd.get('departureAirport') || '',
    airlines:            airlines.length ? airlines : ['any'],
    accommodationType:   fd.get('accommodationType') || 'villa',
    rooms:               Number(fd.get('rooms') || 2),
    seaView:             fd.get('seaView') === 'yes',
    pool:                fd.get('pool') === 'yes',
    petFriendly:         fd.get('petFriendly') === 'yes',
    food:                foodOpts,
    cuisine:             cuisines,
    activities:          activities,
    specialRequests:     fd.get('specialRequests') || '',
  };
}

// ---------------------------------------------------------------------------
// Submit handler — called from inline onclick in HTML
// ---------------------------------------------------------------------------
let lastFormData = null; // kept for retry / regenerate

window.submitPlan = async function submitPlan() {
  if (!checkClientRateLimit()) {
    showError('Günlük plan limitinize ulaştınız. 24 saat sonra tekrar deneyin.');
    return;
  }

  lastFormData = collectFormData();
  await executePlanRequest(lastFormData);
};

window.retryPlan = async function retryPlan() {
  if (lastFormData) await executePlanRequest(lastFormData);
};

window.regeneratePlan = async function regeneratePlan() {
  if (lastFormData) await executePlanRequest(lastFormData);
};

async function executePlanRequest(formData) {
  showLoading();

  // Cloud mode — Firebase Function aktifse onu çağır
  if (cloudReady && fns && window.__cloudHelpers) {
    try {
      const callFn = window.__cloudHelpers.httpsCallable(fns, 'vacationPlanner', { timeout: 545000 });
      const result = await callFn(formData);
      recordClientRequest();
      renderResult(result.data, formData);
      return;
    } catch (err) {
      console.warn('[vacation-planner] Cloud Function başarısız, local fallback:', err.message);
      // fall through to local fallback
    }
  }

  // Local fallback — taslak plan üret + Concierge yönlendirmesi
  try {
    const draft = generateLocalPlan(formData);
    recordClientRequest();
    renderResult(draft, formData);
  } catch (err) {
    console.error('[vacation-planner] Local fallback hatası:', err);
    showError('Plan oluşturulurken sorun yaşandı. Lütfen Concierge ile WhatsApp üzerinden iletişime geçin.');
  }
}

// ---------------------------------------------------------------------------
// Local fallback plan generator — Cloud Function olmadığında basit bir taslak
// ---------------------------------------------------------------------------
function generateLocalPlan(f) {
  const start = new Date(f.dateStart);
  const end   = new Date(f.dateEnd);
  const nights = Math.max(1, Math.round((end - start) / 86400000));
  const totalGuests = f.adults + f.children;

  // Basit bütçe dağılımı (kişi başı yaklaşık)
  const flightPerPerson = f.departureAirport ? Math.round(f.budget * 0.30 / Math.max(totalGuests, 1)) : 0;
  const transferTotal   = Math.round(f.budget * 0.05);
  const accomTotal      = Math.round(f.budget * 0.45);
  const activityTotal   = Math.round(f.budget * 0.15);
  const mealTotal       = Math.round(f.budget * 0.05);
  const total = (flightPerPerson * totalGuests) + transferTotal + accomTotal + activityTotal + mealTotal;

  // Activity havuzu
  const ACTIVITY_POOL = {
    boat_tour:      { title: '12 Koy Tekne Turu', desc: 'Kalkan limanından kalkış, Sarı Limon ve Beyaz Ada koyları, öğle yemeği dahil.' },
    ancient_cities: { title: 'Patara Antik Kenti & Plajı', desc: 'Likya tarihiyle iç içe, 18 km kumsal.' },
    beach:          { title: 'Kaputaş Plajı', desc: 'Türkiye\'nin en güzel koylarından biri, 187 basamaklı iniş.' },
    diving:         { title: 'Kaş Dalış Merkezi', desc: 'Kalkan\'a 30 dk; sertifikalı eğitmen, ekipman dahil.' },
    hiking:         { title: 'Likya Yolu — Patara → Kalkan etabı', desc: '12 km, sahil rotası, rehber önerilir.' },
    spa:            { title: 'Türk Hamamı + Masaj', desc: 'Geleneksel hamam deneyimi.' },
    kids:           { title: 'Aqua park & çocuk aktiviteleri', desc: 'Bölgenin aile dostu seçenekleri.' },
    nightlife:      { title: 'Yat Limanı akşamı', desc: 'Sahil restoranları, canlı müzik.' },
  };
  const selectedActs = (f.activities || []).map(a => ACTIVITY_POOL[a]).filter(Boolean);

  // Konaklama tipi metni
  const accomLabels = { villa: 'Özel havuzlu villa', otel: '4-5 yıldız otel', bb: 'Butik B&B' };
  const accomTitle = accomLabels[f.accommodationType] || 'Konaklama';

  // Yemek
  const FOOD_POOL = {
    chef:       { title: 'Evde özel aşçı', desc: 'Villanıza gelen şef, günlük menü hazırlar.' },
    restaurant: { title: 'Restoran rezervasyonu', desc: 'Bölgenin seçili restoranlarında masa.' },
    self:       { title: 'Market alışverişi', desc: 'Kalkan Migros, yerel bakkal ve manav önerileri.' },
  };
  const foodPicks = (f.food || []).map(x => FOOD_POOL[x]).filter(Boolean);

  // Gün gün plan
  const days = [];
  for (let i = 0; i < nights + 1; i++) {
    const date = new Date(start.getTime() + i * 86400000);
    const items = [];
    if (i === 0) {
      if (f.departureAirport) {
        items.push({ type:'flight', title: `Uçuş: ${f.departureAirport} → Dalaman (DLM)`, description: 'Tahmini bilet fiyatı kişi başı.', price: flightPerPerson, time: 'Sabah/öğlen' });
      }
      items.push({ type:'transfer', title: 'Havalimanı → Kalkan transferi', description: '~1.5 saat (Dalaman) / ~3 saat (Antalya). VIP araç.', price: transferTotal, time: '14:00' });
      items.push({ type:'accommodation', title: `${accomTitle} — Check-in`, description: `${f.rooms} oda${f.seaView?', deniz manzaralı':''}${f.pool?', özel havuzlu':''}.`, price: Math.round(accomTotal / Math.max(nights,1)), priceNote: '/ gece' });
    } else if (i === nights) {
      items.push({ type:'accommodation', title: 'Check-out', description: 'Sabah erken çıkış.' });
      items.push({ type:'transfer', title: 'Kalkan → Havalimanı transferi', description: 'Uçuş saatine göre planlanır.', price: 0 });
    } else {
      items.push({ type:'accommodation', title: `${accomTitle} — gecelik`, description: 'Konaklama devam.', price: Math.round(accomTotal / Math.max(nights,1)), priceNote: '/ gece' });
      // Activity (varsa rotate)
      if (selectedActs.length) {
        const act = selectedActs[(i-1) % selectedActs.length];
        items.push({ type:'activity', title: act.title, description: act.desc, price: Math.round(activityTotal / Math.max(nights,1)) });
      }
      // Meal (varsa rotate)
      if (foodPicks.length) {
        const meal = foodPicks[(i-1) % foodPicks.length];
        items.push({ type:'meal', title: meal.title, description: meal.desc, price: Math.round(mealTotal / Math.max(nights,1)) });
      }
    }
    days.push({ date: date.toISOString().slice(0,10), dayLabel: i === 0 ? 'Varış günü' : (i === nights ? 'Çıkış günü' : ''), items });
  }

  const conciergeMsg = encodeURIComponent(
    `Merhaba Kalkan Info, tatil planımı oluşturdum:\n` +
    `📅 ${f.dateStart} – ${f.dateEnd} (${nights} gece)\n` +
    `👥 ${f.adults} yetişkin, ${f.children} çocuk\n` +
    `🏡 ${accomTitle} (${f.rooms} oda)\n` +
    `✈️ Kalkış: ${f.departureAirport || 'belirtilmedi'}\n` +
    `💰 Bütçe: ${currencySymbol(f.currency)} ${f.budget.toLocaleString('tr-TR')}\n` +
    `🗺️ Aktiviteler: ${(f.activities||[]).join(', ') || '—'}\n` +
    `🍽️ Yemek: ${(f.food||[]).join(', ') || '—'}\n\n` +
    `Detaylı plan ve rezervasyon için yardım rica ediyorum.`
  );

  return {
    days,
    totalPrice: total,
    rationale: `Bu, formdaki tercihlerinizden üretilen bir taslak plandır. Fiyatlar yaklaşık tahmindir. ` +
               `Detaylı, gerçek zamanlı uygunluk ve rezervasyon için Concierge ekibimize WhatsApp üzerinden ulaşabilirsiniz: ` +
               `https://wa.me/905306650794?text=${conciergeMsg}`,
    isLocalDraft: true,
    conciergeUrl: `https://wa.me/905306650794?text=${conciergeMsg}`,
  };
}

// ---------------------------------------------------------------------------
// UI state transitions
// ---------------------------------------------------------------------------
function showLoading() {
  document.getElementById('planner-form-container').classList.add('hidden');
  document.getElementById('loading-container').classList.remove('hidden');
  document.getElementById('result-container').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
}

function showError(msg) {
  document.getElementById('loading-container').classList.add('hidden');
  document.getElementById('result-container').classList.add('hidden');
  document.getElementById('error-container').classList.remove('hidden');
  document.getElementById('error-message').textContent = msg;
}

window.startOver = function startOver() {
  document.getElementById('planner-form-container').classList.remove('hidden');
  document.getElementById('loading-container').classList.add('hidden');
  document.getElementById('result-container').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  // Reset step
  window.currentStep = 1;
  if (typeof window.showStep === 'function') window.showStep(1);
};

function friendlyError(err) {
  if (err.code === 'functions/deadline-exceeded') return 'Plan oluşturma zaman aşımına uğradı. Lütfen tekrar deneyin.';
  if (err.code === 'functions/resource-exhausted') return 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyin.';
  if (err.code === 'functions/invalid-argument') return 'Form verilerinde sorun var: ' + (err.message || '');
  if (err.code === 'functions/unauthenticated') return 'Bu işlem için giriş yapmanız gerekiyor.';
  return 'Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.';
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------
const TYPE_META = {
  flight:       { icon: '✈️',  bg: '#e8f4fd', label: 'Uçuş' },
  transfer:     { icon: '🚐', bg: '#edf8f0', label: 'Transfer' },
  accommodation:{ icon: '🏡', bg: '#fff8ed', label: 'Konaklama' },
  meal:         { icon: '🍽️', bg: '#fdf3f3', label: 'Yemek' },
  activity:     { icon: '🗺️', bg: '#f3f0fd', label: 'Aktivite' },
  beach:        { icon: '🏖️', bg: '#e8f6fd', label: 'Plaj' },
  default:      { icon: '📌', bg: '#f5f5f5', label: '' },
};

function renderResult(data, formData) {
  document.getElementById('loading-container').classList.add('hidden');
  document.getElementById('result-container').classList.remove('hidden');

  // Title
  const nights = Math.round((new Date(formData.dateEnd) - new Date(formData.dateStart)) / 86400000);
  document.getElementById('result-title').textContent = `Kalkan Tatili — ${nights} Gece`;
  document.getElementById('result-subtitle').textContent =
    `${formData.adults} yetişkin${formData.children ? ', ' + formData.children + ' çocuk' : ''} · ${formatDate(formData.dateStart)} – ${formatDate(formData.dateEnd)}`;

  // Total
  const total = data.totalPrice || data.total_price;
  const currency = formData.currency;
  document.getElementById('result-total').textContent = total
    ? `${currencySymbol(currency)} ${Number(total).toLocaleString('tr-TR')}`
    : '—';

  // Timeline
  const timelineEl = document.getElementById('timeline-content');
  timelineEl.innerHTML = '';

  const days = data.days || data.timeline || [];
  days.forEach((day, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-day';

    const header = document.createElement('div');
    header.className = 'font-display font-bold text-sea-700 mb-3 -ml-[23px] flex items-center gap-2';
    const dayNum = idx + 1;
    header.innerHTML = `<span class="w-7 h-7 rounded-full bg-sea-700 text-white text-xs flex items-center justify-center font-bold">${dayNum}</span>
      <span>${day.date ? formatDate(day.date) : 'Gün ' + dayNum}</span>
      <span class="text-xs font-normal text-sea-400">${day.dayLabel || ''}</span>`;
    wrapper.appendChild(header);

    const items = day.items || [];
    items.forEach(item => {
      const meta = TYPE_META[item.type] || TYPE_META.default;
      const itemEl = document.createElement('div');
      itemEl.className = 'timeline-item';
      itemEl.innerHTML = `
        <div class="timeline-icon" style="background:${meta.bg}">${meta.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-sea-800">${item.title || ''}</div>
          <div class="text-xs text-sea-400 mt-0.5">${item.description || ''}</div>
          ${item.time ? `<div class="text-xs text-sea-300 mt-0.5">🕐 ${item.time}</div>` : ''}
          ${item.refId ? `<div class="text-xs text-sea-300 mt-0.5">Katalog: ${item.refId}</div>` : ''}
        </div>
        <div class="text-right flex-shrink-0 ml-3">
          ${item.price ? `<div class="font-bold text-sm text-sea-800">${currencySymbol(currency)} ${Number(item.price).toLocaleString('tr-TR')}</div>` : ''}
          ${item.priceNote ? `<div class="text-xs text-sea-300">${item.priceNote}</div>` : ''}
        </div>`;
      wrapper.appendChild(itemEl);
    });

    timelineEl.appendChild(wrapper);
  });

  // Rationale
  const rationaleEl = document.getElementById('result-rationale');
  rationaleEl.textContent = data.rationale || data.reasoning || '';

  // Local draft uyarısı + Concierge yönlendirmesi
  if (data.isLocalDraft && data.conciergeUrl) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-top:14px;padding:14px 18px;background:#fff8ed;border:1.5px solid #f4b53d;border-radius:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
    banner.innerHTML = `
      <div style="flex:1;min-width:200px;">
        <div style="font-family:'Montserrat',sans-serif;font-weight:700;color:#0a2e4c;font-size:14px;">📋 Bu bir taslak plandır</div>
        <div style="font-size:12px;color:#5d97c4;margin-top:2px;">Gerçek uygunluk, kesin fiyat ve rezervasyon için Concierge ekibimiz size yardımcı olur.</div>
      </div>
      <a href="${data.conciergeUrl}" target="_blank" rel="noopener"
         style="background:#25D366;color:white;padding:10px 18px;border-radius:10px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
        💬 Concierge'e Götür
      </a>`;
    rationaleEl.parentElement.appendChild(banner);
  }

  // Store plan data for PDF/save
  window._currentPlan = { data, formData };
}

// ---------------------------------------------------------------------------
// Save to Firestore
// ---------------------------------------------------------------------------
window.savePlan = async function savePlan() {
  if (!cloudReady || !db) {
    alert('Plan kaydetme yakında aktive olacak. Şimdilik PDF indirebilir veya Concierge ile WhatsApp üzerinden paylaşabilirsiniz.');
    return;
  }
  const currentUser = window._currentUser;
  if (!currentUser) {
    const returnUrl = encodeURIComponent(location.href);
    location.href = `login.html?return=${returnUrl}`;
    return;
  }

  const { data, formData } = window._currentPlan || {};
  if (!data) return;

  try {
    const { collection, addDoc, serverTimestamp } = window.__cloudHelpers;
    const docRef = await addDoc(collection(db, 'vacations'), {
      ownerUid:        currentUser.uid,
      dateRange:       { start: formData.dateStart, end: formData.dateEnd },
      groupSize:       { adults: formData.adults, children: formData.children },
      budget:          { amount: formData.budget, currency: formData.currency },
      items:           (data.days || []).flatMap(d => d.items || []).map(i => ({
        type:     i.type,
        refId:    i.refId || null,
        title:    i.title,
        price:    i.price || 0,
        status:   'draft',
        bookingRef: null,
      })),
      status:          'draft',
      claudeRequestId: data.requestId || null,
      totalPrice:      data.totalPrice || data.total_price || null,
      createdAt:       serverTimestamp(),
    });

    const btn = document.getElementById('btn-save');
    btn.textContent = '✅ Kaydedildi';
    btn.disabled = true;
    console.info('[vacation-planner] Plan saved:', docRef.id);
  } catch (err) {
    console.error('[vacation-planner] Save error:', err);
    alert('Kaydetme sırasında hata oluştu: ' + err.message);
  }
};

// ---------------------------------------------------------------------------
// Email — stub, wired to sendVacationPlanByEmail Cloud Function (TODO)
// ---------------------------------------------------------------------------
window.emailPlan = async function emailPlan() {
  const email = prompt('E-posta adresinizi girin:');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Geçerli bir e-posta adresi girin.');
    return;
  }
  alert('E-posta gönderme özelliği yakında aktive edilecek. (TODO: sendVacationPlanByEmail)');
  // TODO: const sendEmail = httpsCallable(fns, 'sendVacationPlanByEmail');
  // await sendEmail({ email, planData: window._currentPlan });
};

// ---------------------------------------------------------------------------
// PDF — jsPDF single-page output
// ---------------------------------------------------------------------------
window.downloadPDF = function downloadPDF() {
  const { data, formData } = window._currentPlan || {};
  if (!data || !window.jspdf) {
    alert('PDF oluşturmak için plan verisi gerekli.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const margin  = 18;
  const pageW   = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header
  doc.setFillColor(7, 33, 54);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(244, 181, 61);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KALKAN INFO — Tatil Planı', margin, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`, margin, 20);
  doc.text(`kalkaninfo.com`, pageW - margin, 20, { align: 'right' });

  y = 38;
  doc.setTextColor(10, 46, 76);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const nights = Math.round((new Date(formData.dateEnd) - new Date(formData.dateStart)) / 86400000);
  doc.text(`Kalkan Tatili — ${nights} Gece`, margin, y);

  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(93, 151, 196);
  doc.text(`${formData.adults} yetişkin · ${formatDate(formData.dateStart)} – ${formatDate(formData.dateEnd)}`, margin, y);

  const total = data.totalPrice || data.total_price;
  if (total) {
    doc.setTextColor(232, 152, 18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Toplam: ${currencySymbol(formData.currency)} ${Number(total).toLocaleString('tr-TR')}`, pageW - margin, y, { align: 'right' });
  }

  y += 10;
  doc.setDrawColor(226, 234, 242);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Days
  const days = data.days || data.timeline || [];
  days.forEach((day, idx) => {
    if (y > 260) { doc.addPage(); y = margin; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 46, 76);
    doc.text(`Gün ${idx + 1}${day.date ? ' — ' + formatDate(day.date) : ''}`, margin, y);
    y += 6;

    (day.items || []).forEach(item => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(47, 116, 168);
      const icon = { flight: '[Ucus]', transfer: '[Transfer]', accommodation: '[Konaklama]', meal: '[Yemek]', activity: '[Aktivite]' }[item.type] || '[•]';
      const line = `${icon} ${item.title || ''}${item.price ? ' — ' + Number(item.price).toLocaleString('tr-TR') : ''}`;
      const split = doc.splitTextToSize(line, pageW - 2 * margin);
      doc.text(split, margin + 3, y);
      y += split.length * 5 + 2;
      if (item.description) {
        doc.setTextColor(147, 170, 190);
        doc.setFontSize(8);
        const desc = doc.splitTextToSize(item.description, pageW - 2 * margin - 6);
        doc.text(desc, margin + 6, y);
        y += desc.length * 4 + 2;
      }
    });
    y += 4;
  });

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(200, 216, 232);
    doc.text(`Kalkan Info — Tatil planı yapay zeka tarafından oluşturulmuştur. Fiyatlar tahminidir.  Sayfa ${p}/${totalPages}`, pageW / 2, 290, { align: 'center' });
  }

  doc.save(`kalkan-tatil-${formData.dateStart}.pdf`);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function currencySymbol(code) {
  return { TRY: '₺', EUR: '€', USD: '$' }[code] || code;
}
