import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, type Href } from "expo-router";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";
import type { OnboardingStep } from "@movieholix/core/domain/profile";

const ONBOARDING_ROUTE: Record<Exclude<OnboardingStep, "completed">, string> = {
  birthdate: "/(onboarding)/birthdate",
  basics: "/(onboarding)/basics",
  intent: "/(onboarding)/intent",
  photos: "/(onboarding)/photos",
  location: "/(onboarding)/location",
  genres: "/(onboarding)/genres",
  "taste-test": "/(onboarding)/taste-test",
  "top-four": "/(onboarding)/top-four",
  prompts: "/(onboarding)/prompts",
  notifications: "/(onboarding)/notifications",
};

/**
 * Kök yönlendirme bekçisi: oturum yoksa (auth), varsa onboarding_step'e göre
 * kaldığı adıma, tamamlanmışsa Keşfet'e (Faz 5'e kadar yer tutucu `home`) yönlendirir.
 * Bu, "onboarding yarıda bırakılınca kaldığı adımdan devam ediyor" kabul kriterini karşılar.
 */
export default function IndexGate() {
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile(session?.user.id);

  // Oturum geçerli ama profil satırı yok (ör. yerel DB sıfırlandı, cihazdaki
  // eski oturum artık var olmayan bir kullanıcıyı işaret ediyor) — bu bir
  // onboarding adımı değil, geçersiz bir oturum: çıkış yapıp welcome'a dön.
  const isOrphanedSession = Boolean(session) && !profileLoading && !profile;
  useEffect(() => {
    if (isOrphanedSession) void supabase.auth.signOut();
  }, [isOrphanedSession]);

  if (sessionLoading || (session && profileLoading) || isOrphanedSession) {
    return (
      <View className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile && profile.onboarding_step !== "completed") {
    const target =
      ONBOARDING_ROUTE[
        profile.onboarding_step as Exclude<OnboardingStep, "completed">
      ];
    return <Redirect href={(target ?? "/(onboarding)/birthdate") as Href} />;
  }

  return <Redirect href="/(tabs)/library" />;
}
