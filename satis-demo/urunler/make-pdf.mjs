/**
 * make-pdf.mjs — Ürün broşürlerini PDF'e çevirir
 *
 * Kullanım:
 *   node satis-demo/urunler/make-pdf.mjs
 *
 * Çıktı:
 *   satis-demo/urunler/<slug>.pdf   (7 ürün)
 *   satis-demo/urunler/katalog.pdf  (kapak + 7 ürün)
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const URUNLER = [
  { slug: 'web-portal',    file: 'web-portal.html' },
  { slug: 'web-domain',    file: 'web-domain.html' },
  { slug: 'meta-baglama',  file: 'meta-baglama.html' },
  { slug: 'meta-reklam',   file: 'meta-reklam.html' },
  { slug: 'reels-icerik',  file: 'reels-icerik.html' },
  { slug: 'google-isletme',file: 'google-isletme.html' },
  { slug: 'yorum-cevap',   file: 'yorum-cevap.html' },
];

const KAPAK = { slug: 'katalog-kapak', file: 'katalog-kapak.html' };

async function htmlToPdf(page, htmlPath, outPath) {
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  // Font yüklenmesi için bekle
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log(`  ✓ ${outPath.replace(__dirname + '\\', '')}`);
}

async function main() {
  console.log('\n📄 Kalkan Info — PDF Broşür Üretici\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 }); // A4 @ 96dpi

  const results = [];

  // 7 ürün PDF
  for (const urun of URUNLER) {
    const htmlPath = resolve(__dirname, urun.file);
    const outPath  = resolve(__dirname, `${urun.slug}.pdf`);
    if (!existsSync(htmlPath)) {
      console.warn(`  ⚠ Bulunamadı: ${urun.file} — atlanıyor`);
      continue;
    }
    await htmlToPdf(page, htmlPath, outPath);
    results.push(outPath);
  }

  // Katalog: kapak + 7 ürün tek PDF'te
  // Puppeteer tek sayfada tek URL'yi işler; birden fazla sayfayı birleştirmek için
  // her sayfayı ayrı PDF üretip pdf-lib ile merge etmek gerekir.
  // Basit çözüm: tüm HTML'leri tek bir scroll-document'a embed et.
  console.log('\n📚 Master katalog üretiliyor...');
  const katalogPath = resolve(__dirname, 'katalog.pdf');
  const allFiles = [KAPAK, ...URUNLER];

  // Her sayfayı ayrı PDF'e çek, sonra birleştir
  const pagePdfs = [];
  for (const item of allFiles) {
    const htmlPath = resolve(__dirname, item.file);
    if (!existsSync(htmlPath)) continue;
    const tmpPath = resolve(__dirname, `_tmp_${item.slug}.pdf`);
    await htmlToPdf(page, htmlPath, tmpPath);
    pagePdfs.push(tmpPath);
  }

  // pdf-lib ile birleştir (varsa) yoksa ilk sayfayı katalog olarak kullan
  try {
    const { PDFDocument } = await import('pdf-lib');
    const merged = await PDFDocument.create();
    for (const pdfPath of pagePdfs) {
      const { readFile } = await import('fs/promises');
      const bytes = await readFile(pdfPath);
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const mergedBytes = await merged.save();
    const { writeFile } = await import('fs/promises');
    await writeFile(katalogPath, mergedBytes);
    console.log(`  ✓ katalog.pdf (${allFiles.length} sayfa, pdf-lib merge)`);
    results.push(katalogPath);

    // tmp dosyaları sil
    const { unlink } = await import('fs/promises');
    for (const tmp of pagePdfs) {
      await unlink(tmp).catch(() => {});
    }
  } catch (e) {
    // pdf-lib yoksa: kapak PDF'i katalog olarak kaydet, uyarı ver
    console.warn('  ℹ pdf-lib bulunamadı — katalog.pdf = kapak sayfası (npm install pdf-lib ile tam birleştirme yapılabilir)');
    const { copyFile } = await import('fs/promises');
    await copyFile(pagePdfs[0], katalogPath);
    results.push(katalogPath);
    // tmp temizle
    const { unlink } = await import('fs/promises');
    for (const tmp of pagePdfs) {
      await unlink(tmp).catch(() => {});
    }
  }

  await browser.close();

  console.log('\n✅ Tamamlandı!\n');
  console.log('Üretilen dosyalar:');
  results.forEach(f => console.log('  ' + f));
  console.log();
}

main().catch(err => {
  console.error('HATA:', err);
  process.exit(1);
});
