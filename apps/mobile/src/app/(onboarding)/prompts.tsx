import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

/** PRD 4.4 örnek profil soruları. */
const PROMPT_KEYS = [
  "subtitles_or_dubbing",
  "credits_scene",
  "guilty_pleasure",
] as const;

export default function PromptsScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const promptLabel: Record<(typeof PROMPT_KEYS)[number], string> = {
    subtitles_or_dubbing: t.promptSubtitleDublaj,
    credits_scene: t.promptSubtitleEnding,
    guilty_pleasure: t.promptGuiltyPleasure,
  };

  async function save() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rows = PROMPT_KEYS.map((key, position) => ({
      user_id: user?.id ?? "",
      prompt_key: key,
      answer: answers[key]?.trim() ?? "",
      position: position + 1,
    })).filter((row) => row.answer.length > 0);

    if (rows.length > 0) {
      await supabase
        .from("profile_prompts")
        .upsert(rows, { onConflict: "user_id,position" });
    }
    setSaving(false);
    await completeStep("notifications");
  }

  return (
    <OnboardingLayout
      title={t.promptsTitle}
      body={t.promptsBody}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={save}
          disabled={saving}
        />
      }
    >
      {PROMPT_KEYS.map((key) => (
        <View key={key} className="gap-2">
          <Text className="font-body font-semibold text-ink dark:text-screen">
            {promptLabel[key]}
          </Text>
          <TextInput
            value={answers[key] ?? ""}
            onChangeText={(text) =>
              setAnswers((prev) => ({ ...prev, [key]: text }))
            }
            placeholder={t.promptAnswerPlaceholder}
            maxLength={200}
            className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
          />
        </View>
      ))}
    </OnboardingLayout>
  );
}
