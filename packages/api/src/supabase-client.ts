import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Yalnızca **okuma** amaçlı, RLS'e tabi istemci (anon/publishable key).
 * Service role anahtarı istemci koduna asla girmez (CLAUDE.md #5). URL/anahtar
 * çağıran taraftan (Next.js `NEXT_PUBLIC_*`, Expo `EXPO_PUBLIC_*`) enjekte edilir
 * ki bu paket platformdan bağımsız kalsın.
 */
export function createReadOnlyClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
