import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import type { Intent } from "@movieholix/core/domain/profile";

const INTENTS: Intent[] = ["dating", "friendship", "watch_buddy"];

export default function IntentScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [selected, setSelected] = useState<Intent[]>([]);
  const [saving, setSaving] = useState(false);

  const label: Record<Intent, string> = {
    dating: t.intentDating,
    friendship: t.intentFriendship,
    watch_buddy: t.intentWatchBuddy,
  };

  function toggle(intent: Intent) {
    setSelected((prev) =>
      prev.includes(intent)
        ? prev.filter((x) => x !== intent)
        : [...prev, intent],
    );
  }

  async function onContinue() {
    if (selected.length === 0) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ intents: selected })
      .eq("id", user?.id ?? "");
    setSaving(false);
    if (!error) await completeStep("photos");
  }

  return (
    <OnboardingLayout
      title={t.intentTitle}
      body={t.intentBody}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={onContinue}
          disabled={selected.length === 0 || saving}
        />
      }
    >
      <View className="gap-3">
        {INTENTS.map((intent) => {
          const isSelected = selected.includes(intent);
          return (
            <Pressable
              key={intent}
              accessibilityRole="button"
              onPress={() => toggle(intent)}
              className={`rounded-card border px-4 py-4 ${isSelected ? "border-reel bg-reel" : "border-celluloid"}`}
            >
              <Text
                className={`font-body-semibold text-t16 ${isSelected ? "text-white" : "text-ink dark:text-screen"}`}
              >
                {label[intent]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
