import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { routing } from "@/i18n/routing";

/**
 * PRD 10.2 `revalidate-web`: katalog değiştiğinde ISR sayfalarını anında
 * tazeler. Olmadan film sayfaları `revalidate = 86400` yüzünden 24 saate kadar
 * eski kalıyordu (bkz. ADR-0005 öğe 4, Faz 9/10'a ertelenmiş ama yapılmamıştı).
 *
 * Veri Supabase istemcisinden geliyor, `fetch` üzerinden değil — bu yüzden
 * `revalidateTag` işe yaramıyor, yol bazlı tazeleme kullanılıyor.
 */
const bodySchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("film"), slug: z.string().min(1).max(200) }),
  z.object({
    entity: z.literal("collection"),
    slug: z.string().min(1).max(200),
  }),
  z.object({ entity: z.literal("person"), slug: z.string().min(1).max(200) }),
  // Toplu senkron sonrası: tekil sayfalar değil, listeler ve sitemap'ler.
  z.object({ entity: z.literal("catalog") }),
]);

/** Dile göre değişen yolları her locale için üretir. */
function localized(path: string): string[] {
  return routing.locales.map((l) => `/${l}${path}`);
}

function pathsFor(body: z.infer<typeof bodySchema>): string[] {
  switch (body.entity) {
    case "film":
      return [
        ...localized(`/films/${body.slug}`),
        ...localized("/films"),
        ...localized("/popular"),
        "/films/sitemap.xml",
      ];
    case "collection":
      return [
        ...localized(`/explore/${body.slug}`),
        ...localized("/explore"),
        "/collections/sitemap.xml",
      ];
    case "person":
      return [
        ...localized(`/people/${body.slug}`),
        ...localized("/people"),
        "/people/sitemap.xml",
      ];
    case "catalog":
      return [
        ...localized("/films"),
        ...localized("/popular"),
        ...localized("/explore"),
        ...localized("/people"),
        "/films/sitemap.xml",
        "/collections/sitemap.xml",
        "/people/sitemap.xml",
        "/sitemap.xml",
      ];
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Yapılandırılmamışsa açık uçta bırakmaktansa kapalı kal.
    return NextResponse.json(
      { error: "revalidation_not_configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const paths = pathsFor(parsed.data);
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: paths.length, paths });
}
