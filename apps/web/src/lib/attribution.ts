/**
 * Sağlayıcıdan bağımsız indirme linki kurucu (PRD 21, açık karar #7: attribution
 * sağlayıcısı — Adjust/AppsFlyer/Branch — henüz seçilmedi). `NEXT_PUBLIC_ATTRIBUTION_LINK_BASE`
 * ayarlıysa (gerçek sağlayıcı linki) oraya; yoksa doğrudan mağaza linklerine
 * kampanya/adgroup parametreleriyle yönlendirir.
 */
export type AttributionPosition =
  "hero" | "film_inline" | "film_bar" | "footer" | "download_page";

export type StoreTarget = "ios" | "android";

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function getDownloadUrl(
  target: StoreTarget,
  position: AttributionPosition,
): string {
  const attributionBase = process.env.NEXT_PUBLIC_ATTRIBUTION_LINK_BASE;
  const storeUrl =
    target === "ios"
      ? process.env.NEXT_PUBLIC_APP_STORE_URL
      : process.env.NEXT_PUBLIC_PLAY_STORE_URL;

  const params = { campaign: "web", adgroup: position, target };

  if (attributionBase) {
    return buildUrl(attributionBase, params);
  }
  if (storeUrl) {
    return buildUrl(storeUrl, params);
  }
  // Mağaza linkleri henüz ortam değişkenlerinde tanımlı değilse (yerel geliştirme)
  // sessizce kırılmak yerine indirme sayfasına düşer.
  return "/download";
}
