import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

function isAdult(day: number, month: number, year: number): boolean {
  const birthdate = new Date(Date.UTC(year, month - 1, day));
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setUTCFullYear(eighteenYearsAgo.getUTCFullYear() - 18);
  return birthdate <= eighteenYearsAgo;
}

export default function BirthdateScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [underage, setUnderage] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = { d: Number(day), m: Number(month), y: Number(year) };
  const valid =
    day.length > 0 &&
    month.length > 0 &&
    year.length === 4 &&
    parsed.d >= 1 &&
    parsed.d <= 31 &&
    parsed.m >= 1 &&
    parsed.m <= 12;

  async function onContinue() {
    if (!valid) return;
    if (!isAdult(parsed.d, parsed.m, parsed.y)) {
      setUnderage(true);
      return;
    }
    setSaving(true);
    const isoDate = `${parsed.y.toString().padStart(4, "0")}-${parsed.m.toString().padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // `profiles_birthdate_18plus` veritabanı kısıtı, buradaki JS kontrolüne
    // ek olarak son bir güvenlik ağı sağlar (18 yaş altı kayıt imkânsız).
    const { error } = await supabase
      .from("profiles")
      .update({ birthdate: isoDate })
      .eq("id", user?.id ?? "");
    setSaving(false);
    if (error) {
      setUnderage(true);
      return;
    }
    await completeStep("basics");
  }

  if (underage) {
    return <OnboardingLayout title={t.underageTitle} body={t.underageBody} />;
  }

  return (
    <OnboardingLayout
      title={t.birthdateTitle}
      body={t.birthdateBody}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={onContinue}
          disabled={!valid || saving}
        />
      }
    >
      <View className="flex-row gap-3">
        <TextInput
          value={day}
          onChangeText={setDay}
          placeholder="GG"
          keyboardType="number-pad"
          maxLength={2}
          className="w-16 rounded-button border border-celluloid px-3 py-3 text-center font-body text-ink dark:text-screen"
        />
        <TextInput
          value={month}
          onChangeText={setMonth}
          placeholder="AA"
          keyboardType="number-pad"
          maxLength={2}
          className="w-16 rounded-button border border-celluloid px-3 py-3 text-center font-body text-ink dark:text-screen"
        />
        <TextInput
          value={year}
          onChangeText={setYear}
          placeholder="YYYY"
          keyboardType="number-pad"
          maxLength={4}
          className="w-24 rounded-button border border-celluloid px-3 py-3 text-center font-body text-ink dark:text-screen"
        />
      </View>
      <Text className="mt-2 font-body text-t14 text-ink dark:text-screen">
        {t.birthdatePlaceholder}
      </Text>
    </OnboardingLayout>
  );
}
