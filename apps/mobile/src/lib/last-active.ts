import { useEffect } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * `profiles.last_active_at` damgasını tazeler.
 *
 * Keşfet aday sorgusu son 30 gün içinde aktif olmayan profilleri eliyor; damga
 * hiç atılmazsa kullanıcı keşfette kalıcı olarak görünmez kalıyor. Onboarding
 * tamamlanırken bir kez damgalanıyor, burada da her uygulama açılışında ve
 * arka plandan öne gelişte tazeliyoruz.
 */
async function touchLastActive(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase.rpc("touch_last_active");
}

export function useTouchLastActive(): void {
  useEffect(() => {
    void touchLastActive();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void touchLastActive();
    });
    return () => subscription.remove();
  }, []);
}
