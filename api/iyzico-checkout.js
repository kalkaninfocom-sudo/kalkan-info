// 2026-05-22: iyzico sandbox stub — production aktivasyon iyzico merchant onayı sonrası
// Berkay manuel: vergi levhası + IBAN + ticari sicil → merchant.iyzipay.com

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve(process.cwd());

function bad(res, code, msg) {
  res.status(code).json({ ok: false, error: msg });
}

async function loadTiers() {
  try {
    const raw = await readFile(path.join(PUBLIC_DIR, 'data/pricing-tiers.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS minimal
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    // Public tier list (frontend için)
    const tiers = await loadTiers();
    if (!tiers) return bad(res, 500, 'tiers_missing');
    return res.status(200).json({ ok: true, ...tiers });
  }

  if (req.method !== 'POST') return bad(res, 405, 'method_not_allowed');

  // Stub mode: iyzico merchant onayı henüz yok → 501 Not Implemented
  const hasIyzico = Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
  if (!hasIyzico) {
    return res.status(501).json({
      ok: false,
      error: 'payment_not_active',
      message: 'iyzico merchant onayı bekleniyor. WhatsApp üzerinden başvuru: +90 530 665 07 94',
      whatsapp: 'https://wa.me/905306650794',
    });
  }

  // Production handler (placeholder — gerçek iyzico flow merchant onayı sonrası)
  // TODO: iyzipay SDK import + createCheckoutFormInitialize call
  return res.status(501).json({ ok: false, error: 'production_handler_pending' });
}
