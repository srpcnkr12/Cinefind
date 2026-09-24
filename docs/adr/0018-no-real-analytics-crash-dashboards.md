# ADR 0018 — Gerçek PostHog/Sentry Panosu Yok; Enstrümantasyon Birim Testleriyle Doğrulanır

- Durum: Kabul edildi
- Tarih: 2026-09-19

## Karar

`EXPO_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN_MOBILE`, `NEXT_PUBLIC_SENTRY_DSN_WEB` bu ortamda hiç ayarlanmadı — gerçek bir PostHog/Sentry hesabı yok. Buna rağmen:

- `packages/core/src/domain/analytics.ts`'in tam PRD 17.1 olay taksonomisi + `trackEvent`/`setAnalyticsSink` mekanizması gerçek ve test edilebilir (`analytics.test.ts`).
- `packages/api` ve mobil/web'in ilgili çağrı siteleri gerçekten `trackEvent(...)` çağırıyor (bkz. `docs/events.md`) — anahtar/DSN olmadığında bu çağrılar sessizce no-op olur.
- Anahtar/DSN varsa gerçek `posthog-react-native`/`posthog-js`/`@sentry/react-native`/`@sentry/nextjs` SDK'ları devreye girer (resmi güncel kurulum dokümanlarından bu oturumda doğrulanan kod).

## Gerekçe

PRD'nin "tüm funnel olayları PostHog'da görünüyor" kabul kriteri iki yarıya ayrılabilir: (a) doğru olayın doğru özelliklerle doğru anda tetiklenmesi — bu kod tarafı, tamamen test edilebilir ve edildi; (b) bu olayların gerçek bir PostHog projesinde görünmesi — bu yalnızca gerçek bir hesapla test edilebilir, RevenueCat/TMDB/Apple-Google OAuth'taki gibi bu ortamda mevcut değil.

## Sonuç

Gerçek bir PostHog/Sentry hesabı açıldığında yapılacak tek şey ortam değişkenlerini doldurmak — kod hiç değişmeden gerçek SDK'lar devreye girer. "Crash-free oturum ≥ %99.5" hedefi de aynı gerekçeyle test edilemez: gerçek bir iç test grubunun gerçek kullanımı olmadan bu oran hiç ölçülemez.
