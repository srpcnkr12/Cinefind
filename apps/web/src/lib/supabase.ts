import { createReadOnlyClient } from "@reelmate/api/supabase-client";

/** Sunucu bileşenlerinde kullanılan, yalnızca okuma amaçlı Supabase istemcisi. */
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ayarlanmalı (bkz. .env.example).",
    );
  }
  return createReadOnlyClient(url, anonKey);
}
