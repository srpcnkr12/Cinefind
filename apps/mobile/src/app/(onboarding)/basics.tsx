import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import type { Gender } from "@movieholix/core/domain/profile";

const GENDERS: Gender[] = ["woman", "man", "nonbinary", "other"];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-button border px-4 py-2 ${selected ? "border-reel bg-reel" : "border-celluloid"}`}
    >
      <Text
        className={`font-body text-t14 ${selected ? "text-white" : "text-ink dark:text-screen"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function BasicsScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<Gender[]>([]);
  const [saving, setSaving] = useState(false);

  const genderLabel: Record<Gender, string> = {
    woman: t.genderWoman,
    man: t.genderMan,
    nonbinary: t.genderNonbinary,
    other: t.genderOther,
  };

  function toggleInterestedIn(g: Gender) {
    setInterestedIn((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  const valid =
    name.trim().length > 0 && gender !== null && interestedIn.length > 0;

  async function onContinue() {
    if (!valid || !gender) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        gender,
        interested_in: interestedIn,
      })
      .eq("id", user?.id ?? "");
    setSaving(false);
    if (!error) await completeStep("intent");
  }

  return (
    <OnboardingLayout
      title={t.basicsTitle}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={onContinue}
          disabled={!valid || saving}
        />
      }
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t.namePlaceholder}
        className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
      />

      <Text className="mt-4 font-body font-semibold text-ink dark:text-screen">
        {t.genderTitle}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {GENDERS.map((g) => (
          <Chip
            key={g}
            label={genderLabel[g]}
            selected={gender === g}
            onPress={() => setGender(g)}
          />
        ))}
      </View>

      <Text className="mt-4 font-body font-semibold text-ink dark:text-screen">
        {t.interestedInTitle}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {GENDERS.map((g) => (
          <Chip
            key={g}
            label={genderLabel[g]}
            selected={interestedIn.includes(g)}
            onPress={() => toggleInterestedIn(g)}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}
