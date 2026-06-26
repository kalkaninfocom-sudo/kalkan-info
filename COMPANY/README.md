# Kalkan Info — Şirket Dokümanları

**Versiyon:** 1.0
**Tarih:** 2026-05-17

> Bu dizin, agent şirketi olarak Kalkan Info'nun kurumsal, hukuki ve operasyonel dökümanlarını barındırır.

## İçerik

| Dosya | Amaç | Sahip |
|---|---|---|
| [CHARTER.md](CHARTER.md) | Şirket anayasası — misyon, agent ekibi, karar hiyerarşisi | Berkay |
| [KVKK_MATRIX.md](KVKK_MATRIX.md) | KVKK uyum matrisi — yasal sorumluluk haritası | KVKKGuardian agent |
| [DATA_INVENTORY.md](DATA_INVENTORY.md) | Kişisel veri envanteri (20 kategori) — VERBİS uyumlu | KVKKGuardian agent |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | Olay müdahale playbook (P0-P3) | Berkay + Avukat |
| [APP_SUBMISSION.md](APP_SUBMISSION.md) | iOS App Store + Google Play yayın rehberi | AppBundler agent |
| AUDIT_FINDINGS.md | Düzenli denetim bulguları (oluşturulacak) | AuditAgent |
| INCIDENT_LOG.md | Gerçekleşen olaylar logu (oluşturulacak) | Tüm agent'lar |
| KVKK_LOG.md | KVKKGuardian DPIA + retention check kayıtları (oluşturulacak) | KVKKGuardian |

## Agent Dosyaları

`../.claude/agents/` altında 15 agent persona:

### Operasyonel (4)
- `audit-agent.md` — eksik tespit (Sonnet)
- `kvkk-guardian.md` — veri koruma (Sonnet)
- `deploy-agent.md` — CI/CD (Sonnet)
- `app-bundler.md` — mobile build (Sonnet)

### Fonksiyonel (9)
- `tatil-planner.md` (Sonnet)
- `gezgin-rehber.md` (Sonnet)
- `provider-matcher.md` (Sonnet)
- `news-verifier.md` (Sonnet)
- `menu-chef.md` (Haiku)
- `dil-cevirmen.md` (Haiku)
- `hava-plan.md` (Haiku)
- `social-writer.md` (Haiku) — caption + search SEO + serialized formats
- `whatsapp-reception.md` (Haiku)

### Pazarlama (2 — 2026-06-27 eklendi)
- `ads-optimizer.md` (Sonnet) — Meta/TikTok/Google Ads, lean $300-500/ay
- `social-analyst.md` (Haiku) — Plausible+IG+Clarity weekly digest

## Karar Akışı

```
Berkay → Stratejik karar
   ↓
AuditAgent → Eksik tespit → COMPANY/AUDIT_FINDINGS.md
   ↓
KVKKGuardian → Veri/uyum kontrolü → COMPANY/KVKK_LOG.md
   ↓
DeployAgent → Kod değişiklik + deploy
   ↓
9 fonksiyonel agent → Kullanıcı tetikli işler
```

## Operasyonel Tetikleyiciler

```bash
# Audit (Manuel)
claude -p "audit-agent: tam tarama, çıktıyı COMPANY/AUDIT_FINDINGS.md'ye yaz"

# KVKK (yeni schema sonrası)
claude -p "kvkk-guardian: son migration'ı denetle"

# Deploy
claude -p "deploy-agent: master'ı production'a deploy et + smoke test"

# App build
claude -p "app-bundler: v1.0.0 tag için iOS+Android paketi hazırla"
```

## İlk Yayın Süreci

Faz 0 yasal kuruluş + agent setup tamamlandıktan sonra:

1. **Charter onay** — Berkay imzalar
2. **VERBİS başvuru** (Faz 0)
3. **ETBİS kayıt** (Faz 0)
4. **Apple/Google Developer hesaplar**
5. **İlk audit run** — AuditAgent çalıştır, AUDIT_FINDINGS.md üret
6. **Eksik fix'leri** DeployAgent + Berkay onayıyla canlıya
7. **App submission** — Apple + Google review
8. **Yayın** ✅

## Versiyon

Tüm dokümanlar **living document**. Her büyük değişiklik:
- Git commit ile audit trail
- "Versiyon" tablosu her dosyada
- Çeyreklik review (Berkay + avukat)
