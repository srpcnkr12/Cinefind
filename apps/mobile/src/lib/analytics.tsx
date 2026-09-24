import { useEffect, type ReactNode } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { setAnalyticsSink } from "@reelmate/core/domain/analytics";

/**
 * PRD 17 — PostHog. `EXPO_PUBLIC_POSTHOG_KEY` bu ortamda hiç ayarlanmadı
 * (bkz. Faz 10 ADR-0018) — anahtar yoksa sağlayıcı hiç kurulmaz, `trackEvent`
 * çağrıları güvenli şekilde no-op kalır (sink hiç kaydedilmez).
 */
function AnalyticsBridge() {
  const posthog = usePostHog();

  useEffect(() => {
    setAnalyticsSink((name, properties) => posthog.capture(name, properties));
    return () => setAnalyticsSink(null);
  }, [posthog]);

  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return children;
  }

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{ host: "https://us.i.posthog.com" }}
    >
      <AnalyticsBridge />
      {children}
    </PostHogProvider>
  );
}
