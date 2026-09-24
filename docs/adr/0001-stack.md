# ADR 0001 — Teknoloji Yığını

- Durum: Kabul edildi
- Tarih: 2026-09-11

## Karar

- Monorepo: pnpm workspaces + Turborepo.
- Backend: **Supabase** (Postgres + PostGIS + pg_trgm + pg_cron, Auth, Realtime, Storage, Edge Functions).
- Mobil: Expo (güncel SDK) + expo-router + TypeScript + NativeWind + Reanimated + Gesture Handler + expo-image + FlashList.
- Mobil durum: TanStack Query (sunucu) + Zustand (yerel UI).
- Web: Next.js App Router + next-intl + Tailwind CSS.
- Doğrulama: Zod, tüm sınırlarda (`packages/core`).
- Ödemeler: RevenueCat (`react-native-purchases`) + webhook.
- Push: expo-notifications.
- AI: Anthropic Claude API (yalnızca Edge Function tarafında; v1.1).
- Film verisi: TMDB API (bkz. ADR-0002, karar #3).
- Analitik: PostHog. Hata izleme: Sentry.
- Test: Vitest, Playwright (web), Maestro (mobil E2E), pgTAP/SQL (RLS).
- CI/CD: GitHub Actions, EAS Build, Vercel.

## Gerekçe

PRD (`docs/PRD.md`, bölüm 8) varsayılanı; Supabase, RLS ile güvenliği ve Auth/Realtime/Storage/Edge Functions'ı hazır sağlayarak geliştirme hızını önemli ölçüde artırır. Kullanıcı, özel Node.js + Postgres alternatifine karşı Supabase'i onayladı (2026-09-11).

## Sonuç

Faz 0 bu yığın üzerine kurulur. Kütüphane sürümleri ve API imzaları kodlama sırasında güncel resmi dokümantasyondan doğrulanacak (hafızaya güvenilmeyecek).

## Ek not — TypeScript sürümü (2026-09-11, npm registry ile doğrulandı)

`typescript@latest` şu an **7.0.2** (yeni native/Go tabanlı derleyici). Ancak `typescript-eslint@8.70.0` henüz yalnızca `typescript <6.1.0` peer aralığını destekliyor. Bu yüzden TypeScript **6.0.3** (7.x öncesi son stabil sürüm) sabitlendi. typescript-eslint TS7'yi desteklediğinde ayrı bir ADR ile yükseltme değerlendirilecek.
