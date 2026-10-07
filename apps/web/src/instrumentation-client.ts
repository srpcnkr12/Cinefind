import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { setAnalyticsSink } from "@movieholix/core/domain/analytics";

/**
 * PRD 17/19 (Faz 10) — PostHog + Sentry, tarayıcı tarafı. Next.js'in
 * `instrumentation-client.ts` sözleşmesi (resmi PostHog/Sentry Next.js
 * dokümanlarından bu oturumda doğrulandı) — bu dosya build'de otomatik olarak
 * en erken noktada çalıştırılır.
 *
 * `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_SENTRY_DSN_WEB` bu ortamda hiç
 * ayarlanmadı (bkz. ADR-0018) — anahtar/DSN yoksa ilgili SDK hiç init
 * edilmez, `trackEvent` no-op kalır.
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, { api_host: "https://us.i.posthog.com" });
  setAnalyticsSink((name, properties) => posthog.capture(name, properties));
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 1.0,
  });
}
