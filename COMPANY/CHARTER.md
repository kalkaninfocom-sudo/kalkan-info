# Kalkan Info — Agent Şirketi Anayasası (Charter)

**Versiyon:** 1.0
**Tarih:** 2026-05-17
**Sahip:** Berkay Elmastaş (Kurucu / DPO)
**Yayın:** Türk hukuku altında faaliyet gösteren kurumsal yapı

---

## 1. Misyon

Kalkan-Kaş-Antalya bölgesinde yerel + yabancı kullanıcılara **AI-otomasyonlu**, **KVKK/ETBİS/e-Fatura uyumlu**, **kurumsal düzey** bilgi + rezervasyon + pazaryeri platformu sunmak. İnsan eli **stratejik karar + saha karşılaması** ile sınırlı; içerik, çeviri, müşteri hizmeti, pazarlama, mali rapor otomatize.

## 2. Hedef Çıktı (12 ay)

- 200 listelenmiş işletme
- 1.500 aylık aktif kullanıcı
- $30K aylık GMV / $3.6K komisyon
- KVKK A notu (yıllık denetim)
- 5 dil aktif (TR/EN/DE/RU/AR) — DilCevirmen agent ile beslenir

## 3. Şirket Yapısı (Şu an: tek kurucu + agent ekibi)

| Rol | Sorumlu | Tip |
|---|---|---|
| Founder / CEO / DPO | Berkay | İnsan |
| Operations | 13 agent ekibi (aşağıda) | AI |
| Hukuk danışmanı | Dış avukat (KVKK + ticaret) | İnsan (retainer) |
| Mali müşavir | Dış mali müşavir | İnsan (retainer) |

**Saha kadrosu (Faz 2 sonrası):** sezon kadrosu, saha karşılama, villa kontrol.

## 4. Agent Ekibi (13 rol)

### Operasyonel (4 — sürekli arka plan)

| Agent | Model | Tetikleyici | Çıktı |
|---|---|---|---|
| **AuditAgent** | Sonnet | Manuel veya cron | Eksik tespit raporu (KVKK/UX/perf/SEO) |
| **KVKKGuardian** | Sonnet | Veri akışı değişikliği | Veri envanteri + DPIA + retention check |
| **DeployAgent** | Sonnet | Git push / manuel | Vercel + Supabase + Edge Function deploy |
| **AppBundler** | Sonnet | Release tag | Capacitor build → iOS/Android bundle |

### Fonksiyonel (9 — kullanıcı/cron tetiklemeli)

| Agent | Model | Tetik | Görev |
|---|---|---|---|
| TatilPlanner | Sonnet | User | 7 günlük rota tasarımı |
| GezginRehber | Sonnet | User | Antik kent / Likya storytelling |
| ProviderMatcher | Sonnet | User | Villa/restoran eşleştirme |
| NewsVerifier | Sonnet | Cron 6h | RSS kalite filtresi |
| MenuChef | Haiku | User | Restoran menü asistanı |
| DilCevirmen | Haiku | Yeni içerik | Otomatik 5 dil çeviri |
| HavaPlan | Haiku | Cron daily | Hava bazlı program revizyonu |
| SocialWriter | Haiku | Admin | IG/X/FB caption |
| WhatsAppReception | Haiku | Webhook | Gelen WhatsApp triage |

**Agent dosyaları:** `kalkan-info/.claude/agents/*.md`

## 5. Karar Hiyerarşisi

1. **Stratejik (yeni özellik, yatırımcı, işbirliği):** Berkay onayı şart.
2. **Operasyonel (deploy, bugfix, içerik):** AuditAgent öneri → DeployAgent uygula → günlük rapor.
3. **Veri (PII, KVKK):** KVKKGuardian onay olmadan akışa giremez.
4. **Pazarlama:** SocialWriter taslak → Berkay onayı → yayın.
5. **Müşteri yanıtı:** WhatsAppReception/chatbot güven ≥0.7 → otomatik, <0.7 → insan eskale.

## 6. Bütçe Kontrolü

- `AGENT_DAILY_BUDGET_USD=10` üst sınır (Edge Function ortam değişkeni)
- Aylık hedef: $200 AI maliyeti (Sonnet+Haiku karışım)
- Hard limit aşılırsa: Haiku fallback, sonra Gemini 2.5 Pro (Workspace ücretsiz)
- Aşıldığında SocialWriter/SocialPublisher otomatik pause

## 7. KVKK Sorumluluk Matrisi

DPO: **Berkay Elmastaş** (info@kalkaninfo.com)
Veri Sorumlusu: Kalkan Info Bilişim ve Turizm Ltd. Şti. (kuruluş Faz 0'da)
Veri İşleyen: Supabase (eu-central-1), Vercel (eu-west), Resend (EU), Twilio
Retention: bkz. `COMPANY/DATA_INVENTORY.md`
DPIA tetikleyici: KVKKGuardian her schema değişikliğinde otomatik

## 8. Olay Müdahale (Incident Response)

bkz. `COMPANY/INCIDENT_RESPONSE.md`

- KVKK ihlali: 72 saat içinde KVKK Kurumu bildirim (zorunlu)
- Veri sızıntısı: tüm kullanıcılara mail + KEP'le hukuki danışman
- Production down: Berkay'a Telegram + uptime robot alarm

## 9. Yayın Hedefi (App Store + Play Store)

bkz. `COMPANY/APP_SUBMISSION.md`

- **Web:** kalkaninfo.com (canlı, Vercel)
- **Mobile (PWA → Native):** Capacitor wrapper, hedef Y1 Q3
- **Android:** Google Play (TWA + Capacitor hibrit)
- **iOS:** App Store (Capacitor + WKWebView)
- Onay süreci: Play 1-3 gün, Apple 3-7 gün (review)

## 10. Çıkış Stratejisi

- Y2 sonu hedef: $1.089M ARR, $420K EBITDA, exit görüşmeleri
- Olası alıcılar: Booking.com TR, Etstur, Jolly, Tatil Bütçem, yerel turizm grupları
- Multiple: 4-6x ARR (turizm tech sektör ortalaması)
- Hedef değerleme: $4-7M

## 11. Versiyon Tarihi

| Versiyon | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 2026-05-17 | İlk yayın — 13 agent rolü tanımlandı, app submission planı eklendi |

## 12. Onay

Bu Charter, Berkay Elmastaş onayıyla yürürlüğe girer. Her çeyrek revize edilir. Değişiklikler git history'de takip edilir.
