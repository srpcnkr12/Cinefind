import { ImageResponse } from "next/og";
import { getSupabaseClient } from "@/lib/supabase";
import { getFilmBySlug } from "@reelmate/api/films";
import type { Locale } from "@reelmate/core/domain/film";
import { brand } from "@reelmate/config/brand";

export const alt = brand.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const db = getSupabaseClient();
  const film = await getFilmBySlug(db, slug, locale as Locale);
  const title = film?.title ?? brand.name;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 80,
        background: "#1B2440",
        color: "#F4F7FB",
      }}
    >
      <div style={{ fontSize: 28, color: "#6E7689", marginBottom: 16 }}>
        {brand.name}
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
        {title}
      </div>
    </div>,
    { ...size },
  );
}
