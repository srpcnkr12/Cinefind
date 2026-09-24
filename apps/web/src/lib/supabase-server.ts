import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin panel için çerez-farkında (authenticated) sunucu istemcisi (Faz 9).
 * `@supabase/ssr`'ın Server Component/Server Action deseni: `getAll`/`setAll`
 * `next/headers`'ın `cookies()`'ine bağlanır. Server Component'lerden çerez
 * yazılamaz (Next.js kısıtı) — `setAll` orada sessizce yutulur, gerçek oturum
 * yenilemesi `proxy.ts`'te yapılır (bkz. `@supabase/ssr` README'si, bu
 * oturumda kurulu paketten doğrulandı).
 */
export async function createAdminServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ayarlanmalı (bkz. .env.example).",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component içinden çağrıldıysa yazılamaz; `proxy.ts` oturumu
          // zaten yeniliyor, burada yutmak güvenli (bkz. @supabase/ssr README).
        }
      },
    },
  });
}
