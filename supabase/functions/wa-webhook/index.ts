/**
 * supabase/functions/wa-webhook/index.ts
 * WhatsApp Cloud API webhook → Lyra AI. Gelen WhatsApp mesajını lyra-chat'e verir,
 * cevabı WhatsApp'a geri yollar. Kullanıcı İLK yazdığı için 24h serbest pencere (şablon gerekmez).
 *
 * DEPLOY: supabase functions deploy wa-webhook --no-verify-jwt --project-ref dgichfealzdpfhdgryym
 *   (Meta JWT göndermez → --no-verify-jwt ZORUNLU)
 *
 * SUPABASE SECRETS (Berkay ekler):
 *   WHATSAPP_TOKEN            — Cloud API kalıcı erişim tokenı (system user)
 *   WHATSAPP_PHONE_NUMBER_ID  — Cloud API telefon numarası ID'si
 *   WHATSAPP_VERIFY_TOKEN     — webhook doğrulama için rastgele string (Meta panelinde de aynısı)
 *   (SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY otomatik var)
 *
 * META PANEL: WhatsApp > Configuration > Webhook URL =
 *   https://dgichfealzdpfhdgryym.supabase.co/functions/v1/wa-webhook
 *   Verify token = WHATSAPP_VERIFY_TOKEN · Subscribe: "messages"
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';
const env = (k: string) => Deno.env.get(k) ?? '';

async function sendWhatsApp(to: string, body: string) {
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  const token = env('WHATSAPP_TOKEN');
  if (!phoneId || !token) { console.error('[wa-webhook] WHATSAPP_PHONE_NUMBER_ID/TOKEN eksik'); return; }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4000) } }),
  });
  if (!res.ok) console.error('[wa-webhook] gönderim hatası:', res.status, (await res.text()).slice(0, 200));
}

async function askLyra(message: string, conversationId: string | null, waId: string) {
  const url = `${env('SUPABASE_URL')}/functions/v1/lyra-chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env('SUPABASE_ANON_KEY')}`,
      Origin: 'https://kalkaninfo.com',
    },
    body: JSON.stringify({ message, conversationId, channel: 'whatsapp' }),
  });
  const d = await res.json().catch(() => ({}));
  return { reply: d?.reply as string | undefined, conversationId: (d?.conversationId as string) ?? conversationId };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── 1) Webhook doğrulama (Meta GET) ──
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === env('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // ── 2) Gelen mesaj (Meta POST) — hızlı 200 dön, işlemi yap ──
  let body: any = {};
  try { body = await req.json(); } catch { return new Response('bad json', { status: 200 }); }

  try {
    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const changes = body?.entry?.[0]?.changes ?? [];
    for (const ch of changes) {
      const messages = ch?.value?.messages ?? [];
      for (const m of messages) {
        if (m.type !== 'text' || !m.text?.body) continue;   // sadece metin (durum/receipt atla)
        const from = String(m.from);
        const text = String(m.text.body);

        // Bu numaranın süregelen konuşmasını bul
        const { data: existing } = await supabase
          .from('ai_conversations')
          .select('id').eq('wa_id', from).eq('status', 'active')
          .order('last_at', { ascending: false }).limit(1).maybeSingle();
        const priorId = existing?.id ?? null;

        // Lyra'ya sor
        const { reply, conversationId } = await askLyra(text, priorId, from);

        // Yeni konuşmaysa wa_id'yi bağla (sonraki mesajlar için)
        if (!priorId && conversationId) {
          await supabase.from('ai_conversations').update({ wa_id: from }).eq('id', conversationId);
        }

        if (reply) await sendWhatsApp(from, reply);
      }
    }
  } catch (e) {
    console.error('[wa-webhook] hata:', e instanceof Error ? e.message : String(e));
  }

  // Meta'ya her durumda 200 (yeniden denemesin)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
