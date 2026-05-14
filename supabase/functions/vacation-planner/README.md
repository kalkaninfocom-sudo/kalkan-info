# vacation-planner Edge Function

Kalkan Info Tatil Asistanı — Firebase Cloud Function → Supabase Edge Function (Deno) port.

## Deploy

```bash
supabase functions deploy vacation-planner --project-ref dgichfealzdpfhdgryym
```

## Env Secrets

```bash
# Zorunlu (otomatik inject edilir):
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Anthropic (yoksa stub mode):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref dgichfealzdpfhdgryym

# Opsiyonel overrides:
supabase secrets set AGENT_TATIL_PLANNER_MODEL=claude-sonnet-4-6 --project-ref dgichfealzdpfhdgryym
supabase secrets set AGENT_DAILY_USER_LIMIT_ANON=1 --project-ref dgichfealzdpfhdgryym
supabase secrets set AGENT_DAILY_USER_LIMIT_AUTH=5 --project-ref dgichfealzdpfhdgryym
```

## Stub Mode

`ANTHROPIC_API_KEY` set edilmemişse function çalışmaya devam eder. Response'da `stub: true` gelir ve `plan.rationale` içinde "STUB MODE" notu bulunur.

## Test (curl)

```bash
curl -X POST https://dgichfealzdpfhdgryym.supabase.co/functions/v1/vacation-planner \
  -H "Content-Type: application/json" \
  -d '{
    "dateStart":"2027-07-01","dateEnd":"2027-07-08",
    "adults":2,"children":0,"budget":50000,"currency":"TRY",
    "departureAirport":"İstanbul","activities":["boat_tour"],"food":["restaurant"]
  }'
```
