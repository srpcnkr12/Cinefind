import * as Sentry from "@sentry/react-native";

/**
 * PRD 17/19 (Faz 10) — Sentry. `SENTRY_DSN_MOBILE` bu ortamda hiç ayarlanmadı
 * (bkz. ADR-0018) — DSN yoksa init hiç çağrılmaz, SDK devre dışı kalır.
 * DSN varsa `app/_layout.tsx` `Sentry.wrap(RootLayout)` ile sarmalanmalı
 * (resmi Expo kurulum dokümanından bu oturumda doğrulandı).
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  });
}
