/**
 * vacation-planner.js
 * Kalkan Info — Tatil Asistanı istemci mantığı
 * Firebase Functions callable + Firestore kayıt + PDF çıktısı
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ---------------------------------------------------------------------------
// Firebase init — config from project hosting (auto-injected in prod;
// for local emulator override via window.__FIREBASE_CONFIG__)
// ---------------------------------------------------------------------------
const firebaseConfig = window.__FIREBASE_CONFIG__ || {
  apiKey:            'AIzaSy_PLACEHOLDER',
  authDomain:        'kalkan-info-prod.firebaseapp.com',
  projectId:         'kalkan-info-prod',
  storageBucket:     'kalkan-info-prod.appspot.com',
  messagingSenderId: '000000000000',
  appId:             '1:000000000000:web:00000000000000000000',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const fns  = getFunctions(app, 'europe-west3');

// Point to emulator when running locally
if (location.hostname === 'localhost') {
  const { connectFunctionsEmulator } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js');
  const { connectFirestoreEmulator }  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  connectFunctionsEmulator(fns, 'localhost', 5001);
  connectFirestoreEmulator(db, 'localhost', 8080);
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
// Auth state — track current user for save feature
// ---------------------------------------------------------------------------
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const btn = document.getElementById('btn-save');
  if (btn) btn.textContent = user ? '💾 Planı Kaydet' : '🔐 Kaydetmek için giriş yap';
});

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

  const callFn = httpsCallable(fns, 'vacationPlanner', { timeout: 545000 });

  try {
    const result = await callFn(formData);
    recordClientRequest();
    renderResult(result.data, formData);
  } catch (err) {
    console.error('[vacation-planner] Cloud Function error:', err);
    const msg = friendlyError(err);
    showError(msg);
  }
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
  document.getElementById('result-rationale').textContent =
    data.rationale || data.reasoning || '';

  // Store plan data for PDF/save
  window._currentPlan = { data, formData };
}

// ---------------------------------------------------------------------------
// Save to Firestore
// ---------------------------------------------------------------------------
window.savePlan = async function savePlan() {
  if (!currentUser) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(location.href);
    location.href = `login.html?return=${returnUrl}`;
    return;
  }

  const { data, formData } = window._currentPlan || {};
  if (!data) return;

  try {
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
