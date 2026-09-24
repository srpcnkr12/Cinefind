import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { OnboardingStep } from "@reelmate/core/domain/profile";

export type ProfileRow = {
  id: string;
  onboarding_step: OnboardingStep;
  display_name: string | null;
  birthdate: string | null;
  gender: string | null;
  interested_in: string[];
  intents: string[];
  city: string | null;
};

/**
 * `profile === null` iki farklı durumu ayırt edemez: "henüz fetch bitmedi" ile
 * "fetch bitti ama profil yok/erişilemiyor" (ör. oturum geçerli ama kullanıcı
 * artık DB'de yok — bu tam olarak yaşandı: bir DB reset sonrası eski bir
 * cihazdaki oturum hâlâ geçerliyken profil satırı silinmiş olur ve eski kod
 * `loading`'i sonsuza kadar `true` bırakıp uygulamayı donuk bir spinner'da
 * bırakıyordu). Bu yüzden hangi `userId` için fetch tamamlandığını ayrıca
 * tutuyoruz; `setState` yalnızca `.then()` içinde (async) çağrılıyor, effect
 * gövdesinde eşzamanlı değil (react-hooks/set-state-in-effect'i tetiklemez).
 */
export function useProfile(userId: string | undefined) {
  const [state, setState] = useState<{
    fetchedForUserId: string | undefined;
    profile: ProfileRow | null;
  }>({ fetchedForUserId: undefined, profile: null });

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select(
        "id, onboarding_step, display_name, birthdate, gender, interested_in, intents, city",
      )
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setState({
          fetchedForUserId: userId,
          profile: (data as ProfileRow | null) ?? null,
        });
      });
  }, [userId]);

  const fetched = state.fetchedForUserId === userId;
  return {
    profile: fetched ? state.profile : null,
    loading: Boolean(userId) && !fetched,
  };
}
