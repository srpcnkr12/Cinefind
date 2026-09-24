import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * PRD 10.2 `revenuecat-webhook`: RevenueCat, dosyada tanımlı sabit bir
 * `Authorization` header değeriyle (RevenueCat panosunda ayarlanır) veya
 * HMAC-SHA256 imzasıyla webhook gönderebilir (bkz. revenuecat.com/docs/
 * integrations/webhooks, bu oturumda doğrulandı). Bu fonksiyon daha basit
 * olan sabit-anahtar yöntemini kullanır — `send-push`/`compute-compat`'ın
 * paylaşılan-anahtar deseniyle tutarlı (bkz. ADR-0014).
 *
 * RevenueCat "en az bir kez" teslimat garantisi verir; aynı `event.id` tekrar
 * gelebilir. İdempotency `apply_revenuecat_event` RPC'sinde (tek transaction)
 * sağlanır — bu fonksiyon yalnızca doğrulama + gövde ayrıştırma yapar.
 *
 * NOT: Payload şekli burada yerel olarak tanımlanır — `packages/core/domain/
 * monetization`'daki eşdeğerini import ETMEZ. Deno'nun modül grafiği, `import
 * type` ile alınsa bile o dosyanın çalışma zamanı bağımlılığı olan `zod`'u
 * çözmeye çalışıp worker'ı başlatamıyor (test edilirken keşfedildi); bu yüzden
 * `compute-compat`'ın yalnızca `zod` İÇERMEYEN `taste.ts`'i import ettiği
 * emsal burada tutulamıyor — tip tamamen yerel tutuluyor.
 */
type WebhookEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  store?: string | null;
  transaction_id?: string | null;
};

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    const receivedAuth = req.headers.get("Authorization");
    if (!expectedAuth || receivedAuth !== expectedAuth) {
      return Response.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const payload = (await req.json()) as { event?: WebhookEvent };
    const event = payload.event;
    if (!event?.id || !event.type || !event.app_user_id || !event.product_id) {
      return Response.json({ error: "Geçersiz payload" }, { status: 400 });
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(
      "apply_revenuecat_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_app_user_id: event.app_user_id,
        p_product_id: event.product_id,
        p_expiration_at_ms: event.expiration_at_ms ?? null,
        p_store: event.store ?? null,
        p_transaction_id: event.transaction_id ?? null,
      },
    );

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  }),
};
