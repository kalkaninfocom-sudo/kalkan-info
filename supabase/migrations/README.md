# Supabase Migrations — Kalkan Info

## Çalıştırma Sırası

Migrations timestamp sırasıyla çalıştırılır. `supabase db push` ile deploy edilir.

```bash
supabase db push --project-ref dgichfealzdpfhdgryym
```

---

## Migration Listesi

| Dosya | İçerik |
|---|---|
| `20260513200000_initial_schema.sql` | Ana schema: users, listings, providers, reviews, jobs, vacation_requests, mail_queue, audit_log, news_items, automations, rate_limits + RLS policies |
| `20260515040000_newsletter.sql` | Newsletter subscribers tablosu + Resend entegrasyon hook'u |
| `20260515110000_lost_found.sql` | Kayıp-eşya ilanları tablosu |
| `20260515120000_villa_reviews.sql` | Villa yorumları ek indexleri |
| `20260515130000_admin_claims.sql` | Admin JWT claim helper fonksiyonu |
| `20260517220000_audit_log_retention.sql` | KVKK: audit_log 90 gün PII retention cron (pg_cron) |

---

## KVKK Retention — audit_log

**Tablo:** `public.audit_log`
**PII alanlar:** `actor_email` (citext), `ip` (inet)
**Yasal dayanak:** KVKK 6698 + 5651 (max 2 yıl)
**Pratik retention:** 90 gün (operasyonel + denetim penceresi için yeterli)

**Cron job:** `audit_log_purge_daily`
- Zamanlama: `0 3 * * *` — her gün 03:00 UTC (06:00 TRT)
- SQL: `DELETE FROM public.audit_log WHERE created_at < now() - INTERVAL '90 days'`
- Extension: `pg_cron` (Supabase Pro+ otomatik; Free tier için manuel enable)

### pg_cron yoksa (Free tier)

Supabase Dashboard → Database → Extensions → pg_cron → Enable yapılmazsa migration hata verir.

**Alternatifler:**

1. **Supabase Scheduled Edge Function** (`supabase/functions/audit-purge/index.ts`):
   - Aynı DELETE sorgusunu service_role ile çalıştırır
   - Dashboard → Edge Functions → Schedules → `0 3 * * *`

2. **Vercel Cron** (`vercel.json` + `/api/cron/audit-purge` route):
   ```json
   { "crons": [{ "path": "/api/cron/audit-purge", "schedule": "0 3 * * *" }] }
   ```

3. **Manuel** (geçici):
   ```bash
   psql $DATABASE_URL -c "DELETE FROM public.audit_log WHERE created_at < NOW() - INTERVAL '90 days'"
   ```

### Cron Job Durumunu Kontrol Et

```sql
-- Kayıtlı job'ları listele
SELECT jobname, schedule, command, active FROM cron.job;

-- Son çalışma sonuçları
SELECT jobname, start_time, end_time, status FROM cron.job_run_details
WHERE jobname = 'audit_log_purge_daily'
ORDER BY start_time DESC LIMIT 10;
```

---

## Yeni Migration Ekleme

1. Dosya adı: `YYYYMMDDHHMMSS_kisa_aciklama.sql`
2. Idempotent yaz: `CREATE ... IF NOT EXISTS`, `ON CONFLICT DO NOTHING`
3. ALTER TABLE için geriye uyumluluğu kontrol et
4. Bu README'ye satır ekle
5. KVKKGuardian agent'ı bilgilendir (PII içeren tablo değişikliğiyse)
