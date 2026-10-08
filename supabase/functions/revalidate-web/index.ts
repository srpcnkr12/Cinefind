import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * PRD 10.2 `revalidate-web`: katalog/koleksiyon/kişi güncellendiğinde web'in
 * ISR sayfalarını anında tazelemesi için Next.js rotasını tetikler.
 *
 * Yapılandırma (ikisi de yoksa fonksiyon 503 döner, sessizce başarılı olmaz):
 *   WEB_REVALIDATE_URL  — ör. https://movieholix.app/api/revalidate
 *   REVALIDATE_SECRET   — Next tarafındaki değerle aynı
 */
type Body =
  | { entity: "film" | "collection" | "person"; slug: string }
  | { entity: "catalog" };

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, _ctx) => {
    const target = Deno.env.get("WEB_REVALIDATE_URL");
    const secret = Deno.env.get("REVALIDATE_SECRET");
    if (!target || !secret) {
      return Response.json(
        { error: "revalidation_not_configured" },
        { status: 503 },
      );
    }

    let body: Body = { entity: "catalog" };
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        body = (await req.json()) as Body;
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
    }

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify(body),
    });

    // Web tarafının cevabını olduğu gibi yansıt; sessiz başarısızlık olmasın.
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }),
};
