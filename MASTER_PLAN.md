# Kalkan Info — Master Plan

**Versiyon:** 1.0
**Tarih:** 2026-05-14
**Sahip:** Berkay Elmastaş
**Hedef:** kalkaninfo.com'u Türk hukukuna uygun, kurumsal düzey, AI-otomasyonlu bilgi + rezervasyon + pazaryeri platformuna dönüştürmek.

---

## 1. Vizyon (tek cümle)

Kalkan, Kaş ve Antalya bölgesinde yerel + yabancı kullanıcının **bilgi alıp, rota planlayıp, hizmet rezervasyonu yapıp, ödeme yapıp, fatura alabildiği**; işletmelerin **kendi kendine kayıt olup, hizmet ekleyip, komisyon karşılığı satış yapabildiği**; arkada **AI agent'ların içerik, çeviri, müşteri hizmeti, pazarlama, mali raporlama** işlerini otomatik yürüttüğü; tüm akışın **KVKK, ETBİS, e-Fatura, 6563 sayılı E-Ticaret Kanunu**'na uyumlu çalıştığı bir platform.

## 2. Şu anki durum (2026-05-14)

- ✅ kalkan-info-two.vercel.app CANLI (statik HTML + dinamik haber)
- ✅ Gerçek RSS aggregator (3 kaynak) + 6h cron
- ✅ İş ilanları (ilanlar.html)
- ⏳ kalkaninfo.com DNS propagation
- ❌ Auth (Firebase Faz 1 commit'li, Supabase'e geçilecek)
- ❌ Ödeme, fatura, rezervasyon
- ❌ Hukuki uyumluluk denetimi
- ❌ AI agent altyapısı

## 3. 6 Faz Plan (~24 hafta / 6 ay)

### FAZ 0 — Hukuki + Kurumsal Temel (Hafta 1-3, paralel başlar)

**Hedef:** Site herhangi bir komisyonlu işlem öncesi yasal zemin hazır.

**Çıktılar:**
- Şirket kuruluşu (LTD ya da A.Ş. — danışmanla karar)
- VERBİS kayıt (KVKK), Veri Sorumlusu atama
- Aydınlatma metni v2 (avukat onaylı): konum + IP + cihaz + cookie kapsamlı
- Açık rıza modülü: pazarlama ileti / üçüncü taraf paylaşım için ayrı checkbox
- Çerez Politikası v2 + cookie banner (TR/EN, opt-in/out)
- 6502 Tüketicinin Korunması: Mesafeli Satış Sözleşmesi + Ön Bilgilendirme Formu
- 6563 E-Ticaret: ETBİS başvurusu, ticari ileti İYS entegrasyonu
- Vergi: e-Fatura/e-Arşiv mükellef başvurusu (GİB)
- Turizm Bakanlığı: tur düzenleme yapılacaksa **A grubu seyahat acentesi izni** + TÜRSAB üyelik (yoksa "aracı" sıfatıyla iş yapılır)
- Banka: ticari hesap + sanal POS başvurusu (iyzico Türkiye, PayTR alternatif)
- Sigortalama: siber sorumluluk + mesleki sorumluluk
- KOR sistemi (Konaklama Operasyon Raporu) — villa/otel yabancı misafir bildirimi

**Hukuki kontrol noktaları:**
- KVKK Aydınlatma metni avukat onaylı mı?
- VERBİS kaydı yapıldı mı? (Yıllık ciro $500K eşiği aşılınca zorunlu)
- ETBİS aktif mi? (E-ticaret faaliyeti başlamadan önce)
- ÖTV/KDV planı netleşti mi? (Turizm hizmeti %1-10-20 KDV oranı)

**Sorumlu:** Berkay + avukat + mali müşavir (Claude bu fazda destek değil — danışmanlık yetkisi yok)

---

### FAZ 1 — Kimlik + Veri Katmanı (Hafta 2-5)

**Hedef:** Üye + işletme + admin için sağlam, ölçeklenebilir auth + Postgres veritabanı.

**Çıktılar:**
- Supabase Faz 2 deploy (dev + prod ortam, eu-central-1)
- 13 tablo schema (SUPABASE_SCHEMA.sql 852 satır — hazır)
- 130+ RLS (Row Level Security) policy
- Supabase Auth: email/password + Google + Apple + Magic Link
- Rol bazlı yetki: `guest`, `member`, `provider`, `staff`, `admin`, `super_admin`
- Multi-Factor Auth (TOTP / SMS — provider için zorunlu)
- KVKK uyumlu veri envanteri: hangi tablo hangi PII tutuyor, retention süreleri
- Veri silme talebi otomasyonu: kullanıcı "hesabımı sil" → 30 gün gecikmeli soft delete + hard delete
- Audit log tablosu: kim, ne, ne zaman, nereden (IP+UA)

**Otomasyon:**
- Yeni üye → Welcome email (Resend) → onboarding sürümü (tatil tercihleri)
- Cron job: 30 günden eski soft-deleted user'lar hard delete

**Hukuki kontrol noktaları:**
- RLS testleri geçti mi? (Kullanıcı X, kullanıcı Y'nin verisini göremiyor)
- Veri saklama süreleri politikada belirtildi mi?
- KVKK bildirim mekanizması (`info@kalkaninfo.com` → DPO) çalışıyor mu?

---

### FAZ 2 — Rezervasyon + Pazaryeri (Hafta 5-10)

**Hedef:** Villa + restoran + transfer + tekne turu için end-to-end rezervasyon + işletme self-onboarding.

**Çıktılar:**
- **Hizmet sağlayıcı modülü:**
  - Self-signup (KYC: TC kimlik + vergi no + IBAN doğrulama)
  - Hizmet yönetimi (CRUD: villa, oda, sezonluk fiyat, müsaitlik takvimi)
  - Çoklu görsel + menü editörü (Storage + image transform)
  - Yorum & değerlendirme moderasyonu
- **Rezervasyon akışı:**
  - Müsaitlik sorgulama → fiyat hesabı → rezervasyon talebi → işletme onayı → ödeme → onay maili
  - Mesafeli Satış Sözleşmesi otomatik üretim (PDF) → e-imza (KEP veya basit checkbox)
  - Ön Bilgilendirme Formu (cayma hakkı, iade prosedürü)
- **Komisyon mekanizması:**
  - Platform %12 (sektör ortalaması; Airbnb %15.5, Booking %15)
  - Otomatik split ödeme: iyzico Marketplace API ile işletmeye direkt
- **Takvim entegrasyon:** iCal export (Airbnb/Booking ile çift booking önleme)

**Otomasyon (AI):**
- **ProviderMatcher agent**: kullanıcı tercihine göre villa/restoran öner
- **MenuChef agent**: restoran menüsü oluşturma asistanı (foto + açıklama yazma)
- **TatilPlanner agent**: 7 günlük rota üretimi

**Hukuki kontrol noktaları:**
- Mesafeli Satış Sözleşmesi her rezervasyonda saklanıyor mu?
- KOR bildirimi (yabancı misafir) otomatik yapılıyor mu?
- Tur düzenlerken seyahat acentesi belgesi var mı? Yoksa "aracılık" sıfatıyla mı?

---

### FAZ 3 — Ödeme + Faturalama (Hafta 8-12, Faz 2 ile paralel)

**Hedef:** Sıfır manuel müdahale ile sanal POS + e-Fatura/e-Arşiv otomasyonu.

**Çıktılar:**
- **iyzico Marketplace** entegrasyonu (alt-bayilik modeli — komisyon split)
- 3DS Secure zorunlu (BDDK gereği)
- İade akışı: 14 gün cayma hakkı + iyzico iade API
- e-Fatura/e-Arşiv otomasyon (Paraşüt, eFinans veya doğrudan GİB)
  - Müşteriye e-Arşiv (B2C, mail PDF)
  - İşletmeden komisyon e-Faturası (B2B)
- TÜFE'ye duyarlı KDV oranı tablosu (turizm %1, otel %10, restoran %10, hizmet %20)
- Aylık mali rapor otomasyonu (cron → PDF → mali müşavir mail)

**Otomasyon:**
- Ödeme başarılı → fatura kesim → mail gönderim → KOR bildirimi → CRM kayıt (paralel)
- Otomatik mutabakat: ay sonu işletmelere komisyon raporu + hesaba yatış

**Hukuki kontrol noktaları:**
- Her satışta e-Arşiv kesildi mi? (GİB denetim riski)
- 3DS bypass var mı? (BDDK ceza riski)
- İade SLA 14 gün içinde mi?

---

### FAZ 4 — AI Otomasyon Yatay (Hafta 10-16, Faz 2-3 ile paralel)

**Hedef:** 9 agent rolü ile içerik + müşteri hizmeti + pazarlama tamamen otomatize.

**9 Agent (planlı, detay: `project_kalkan_info_ai_agents.md`):**

| Agent | Model | Görev | Tetikleyici |
|---|---|---|---|
| TatilPlanner | Sonnet 4.6 | 7 günlük rota tasarımı | User-triggered |
| GezginRehber | Sonnet 4.6 | Antik kent / Likya storytelling | User |
| ProviderMatcher | Sonnet 4.6 | Villa/restoran eşleştirme | User |
| **NewsVerifier** | Sonnet 4.6 | RSS kalite filtresi (mahkeme tebligatı vb. ele) | Cron |
| MenuChef | Haiku 4.5 | Restoran menü önerisi | User |
| **DilCevirmen** | Haiku 4.5 | Otomatik 5 dil çeviri | Yeni içerik |
| HavaPlan | Haiku 4.5 | Hava bazlı program revizyonu | Auto |
| SocialWriter | Haiku 4.5 | IG/X/FB/TikTok caption | Admin |
| WhatsAppReception | Haiku 4.5 | Gelen WhatsApp triage | Webhook |

**Çıktılar:**
- Edge Function deploy (Supabase Deno runtime)
- Maliyet kontrol: `AGENT_DAILY_BUDGET_USD=10` üst sınır, kullanıcı rate limit
- Analytics: `agent_calls` tablosu (model, token, ms, user_id)
- Fallback: Gemini 2.5 Pro (LOA Workspace ücretsiz) — Anthropic outage

**Otomasyon zinciri (örnek):**
- Yeni haber RSS → NewsVerifier filtre → DilCevirmen 5 dil → SocialWriter caption üret → Buffer/Publer publish

---

### FAZ 5 — Pazarlama + Büyüme (Hafta 14-20)

**Hedef:** Organik trafik, dönüşüm optimizasyonu, otomatize müşteri yolculuğu.

**Çıktılar:**
- **SEO:** schema.org full coverage (LocalBusiness + Hotel + Restaurant + TouristAttraction + Event), hreflang TR/EN/RU/JA/AR, sitemap dinamik, robots.txt opt
- **i18n tam:** 5 dil aktif (DilCevirmen ile otomatik)
- **Analytics:** GA4 + Mixpanel funnel (görüntüleme → rezervasyon → ödeme)
- **A/B test framework:** Vercel Edge Config + GrowthBook
- **Email otomasyon:** Resend + segment (yeni üye / sezon açılışı / sepeti terk / 60 gün önce tatil)
- **WhatsApp Business** onay + chatbot
- **PWA + Push notification:** yeni etkinlik + acil duyuru
- **Bağlı kanallar:** Airbnb iCal sync (çift booking önleme), Booking.com API (Pro tier)

**Otomasyon:**
- Sepeti terk → 1 saat sonra hatırlatma mail → 24s sonra %5 indirim
- Tatil yaklaştı (D-7) → öneri + transfer linki

---

### FAZ 6 — Sertleşme + Ölçeklendirme (Hafta 18-24)

**Hedef:** Kurumsal denetim hazır, 10K MAU ölçeklenebilir, single-point-of-failure sıfır.

**Çıktılar:**
- **CI/CD:** GitHub Actions full pipeline (test + lint + security scan + auto-deploy)
- **Test coverage:** Playwright e2e (kritik akış: signup → rezervasyon → ödeme), unit %60+
- **Security:** OWASP top 10 audit (security-reviewer agent), secret rotation cron, WAF (Vercel firewall)
- **Backup:** Supabase point-in-time recovery + günlük S3 export
- **Monitoring:** Sentry (error), Vercel Analytics, Uptime Robot (5 endpoint), PagerDuty alarm
- **Disaster recovery plan:** RTO 4 saat, RPO 24 saat
- **Documentation:** /docs (developer + admin + user manual)
- **Çalışan rolleri:** ileride kişi alındığında onboarding hazır

**Hukuki kontrol noktaları:**
- Yıllık KVKK denetim raporu hazırlandı mı? (DPO sorumluluğu)
- Hukuk bürosu yıllık review sözleşmesi var mı?

---

## 4. Türk Hukuk Matrisi (kısa referans)

| Yasa / Kurum | Konu | Aksiyon | Faz |
|---|---|---|---|
| **KVKK 6698** | Kişisel veri | Aydınlatma + Açık rıza + VERBİS | 0 |
| **6502 Tüketici** | Mesafeli satış | Sözleşme + Ön bilgilendirme + İade | 2 |
| **6563 E-Ticaret** | İleti + iade + ETBİS | İYS + ETBİS kayıt | 0 |
| **5651 İnternet** | İçerik sorumluluğu | Yer sağlayıcı bildirimi BTK | 0 |
| **GİB** | e-Fatura/e-Arşiv | Mükellef başvuru + entegrasyon | 0+3 |
| **BDDK** | Ödeme | 3DS + iyzico/PayTR | 3 |
| **Turizm Bakanlığı** | Seyahat acenteliği | A grubu izin (tur düzenleme) | 0 |
| **KOR** | Konaklama bildirim | Yabancı misafir bildirimi | 2 |
| **İYS** | Ticari ileti | Onay alma + yönetim | 0+5 |
| **TPMK** | Marka | "Kalkan Info" + "Aeternum Fragments" (LOA) | 0 |

---

## 5. Otomasyon Haritası (kim neyi otomatize ediyor)

| Süreç | Otomasyon | Manuel |
|---|---|---|
| Yeni haber yayını | RSS → NewsVerifier → DilCevirmen → SocialWriter | Hiç |
| Yeni üye | Resend welcome + onboarding flow | Hiç |
| Rezervasyon | iyzico → fatura → KOR bildirim → CRM | İşletme onayı |
| Villa içerik üretimi | MenuChef benzeri ProviderHelp agent | Görsel yükleme |
| Pazarlama | SocialWriter + Buffer | Strateji onay |
| Çeviri | DilCevirmen 5 dil | Hassas hukuki metinler |
| Müşteri desteği | WhatsAppReception + chatbot | Eskalasyon → insan |
| Mali rapor | Cron → Paraşüt → mali müşavir mail | Onay imza |

**Berkay'ın günlük zaman ayırdığı işler (hedef: <2 saat/gün):**
- E-postaları okuma + onaylar
- Stratejik karar (yeni feature / yatırımcı / işbirliği)
- AI agent çıktılarının %5 örneklemini gözden geçirme

---

## 6. Risk Matrisi

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| KVKK ihlal cezası | Orta | $50K | Faz 0 avukat onayı + VERBİS |
| iyzico hesap dondurma | Düşük | Yüksek | İkincil POS (PayTR) yedek |
| AI agent halüsinasyon (yanlış haber) | Orta | Marka | NewsVerifier double-check + insan örnekleme |
| Vercel Hobby limit aşımı | Düşük | Site offline | Pro plan'a geç ($20/ay) tetikleyici metrik |
| GitHub Actions cron fail | Düşük | Stale haber | Vercel build cron fallback |
| WhatsApp Business onay gecikme | Yüksek | 2 hafta gecikme | Twilio sandbox geçici |
| Tek developer (Berkay) SPOF | Yüksek | İş duruyor | M12 işe alım planı |

---

## 7. KPI'lar (Faz sonu hedefler)

| Metrik | Faz 0 | Faz 2 | Faz 4 | Faz 6 |
|---|---|---|---|---|
| Aktif üye (MAU) | 0 | 500 | 5K | 20K |
| Listelenen işletme | 50 | 200 | 500 | 1500 |
| Rezervasyon (aylık) | 0 | 50 | 500 | 3000 |
| GMV (aylık) | 0 | $30K | $200K | $1M |
| Komisyon geliri (aylık) | 0 | $3.6K | $24K | $120K |
| Hukuki denetim notu | - | A | A | A+ |
| Site uptime | 99% | 99.5% | 99.9% | 99.95% |
| AI cost / month | $0 | $50 | $200 | $500 |

---

## 8. Hemen Başlanacak Sıra (yeni session)

1. **DNS canlı** kontrol (P0.1)
2. **Bu plan onay** (Berkay'ın "evet" + değişiklik notları)
3. **Faz 0 paralel başlat:** avukat görüşmesi takvimleme + ETBİS + e-Fatura başvurusu (Berkay'ın işi)
4. **Faz 1 başlat:** Supabase project create + schema deploy (Claude'un işi)

---

## 9. Plan'ın güncellenmesi
Bu dosya living document. Her faz sonu Berkay onayıyla güncelleyeceğiz. Versiyon takibi: header'daki "Versiyon" + git history.
