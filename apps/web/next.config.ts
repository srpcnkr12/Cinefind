import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Supabase Storage host'u — katalog TMDB dışı bir kaynaktan besleniyorsa
 * (gerçek TMDB anahtarı yokken kullanılan fixture kataloğu kapak görsellerini
 * kendi Storage'ımızda tutuyor) `poster_path` mutlak bir URL oluyor ve
 * `next/image` izin verilmeyen host'u reddediyor.
 */
function supabaseImagePattern() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const { protocol, hostname, port } = new URL(raw);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        port: port || undefined,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    // Next 16 varsayılan olarak özel IP'lerden görsel çekmeyi engelliyor (SSRF).
    // Yerel Supabase 127.0.0.1'de çalıştığı için geliştirmede açıyoruz; prod'da
    // koruma aynen yürürlükte kalır.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    // TMDB image CDN (bkz. PRD 11.1) — görseller asla kendi sunucumuza kopyalanmaz.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      ...supabaseImagePattern(),
    ],
  },
};

export default withNextIntl(nextConfig);
