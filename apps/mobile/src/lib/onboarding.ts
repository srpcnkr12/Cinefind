import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { OnboardingStep } from "@movieholix/core/domain/profile";
import { trackEvent } from "@movieholix/core/domain/analytics";

/**
 * Bir onboarding adımı tamamlandığında çağrılır: `profiles.onboarding_step`'i
 * günceller, ardından kök bekçiye (`app/index.tsx`) döner — bir sonraki adıma
 * o yönlendirir. Adım sırası tek kaynağı burasıdır.
 */
export async function completeStep(nextStep: OnboardingStep): Promise<void> {
  const { error } = await supabase.rpc("update_onboarding_step", {
    new_step: nextStep,
  });
  if (error) throw error;
  trackEvent("onboarding_step_completed", { step: nextStep });
  if (nextStep === "completed") {
    trackEvent("signup_completed", {});
  }
  router.replace("/");
}
