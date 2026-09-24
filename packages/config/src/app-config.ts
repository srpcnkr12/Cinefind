/**
 * `app_config` tablosunun (bkz. PRD bölüm 9.6) yerel varsayılan değerleri.
 * DB henüz yokken (Faz 0) ve DB'den okuma başarısız olduğunda fallback olarak kullanılır.
 * Gerçek değerler Faz 8+'da Supabase `app_config` tablosundan okunacak.
 */
export const appConfigDefaults = {
  free_daily_swipes: 25,
  free_daily_superlikes: 1,
  premium_daily_superlikes: 5,
  boost_duration_minutes: 30,
  max_daily_profile_impressions: 3,
  ai_assistant_daily_messages_free: 10,
  ai_assistant_daily_messages_premium: 100,
} as const;

export type AppConfigKey = keyof typeof appConfigDefaults;
