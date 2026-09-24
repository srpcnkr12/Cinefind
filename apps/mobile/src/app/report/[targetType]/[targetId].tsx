import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  blockUser,
  reportContent,
  type ReportReason,
} from "@reelmate/api/discovery";
import { ContinueButton } from "@/components/continue-button";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const REASONS: ReportReason[] = [
  "fake_profile",
  "underage",
  "harassment",
  "hate",
  "sexual_content",
  "spam",
  "scam",
  "spoiler_abuse",
  "other",
];

export default function ReportScreen() {
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: string;
    targetId: string;
  }>();
  const t = useMessages().report;
  const tCommon = useMessages().common;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!reason) return;
    setSaving(true);
    await reportContent(
      supabase,
      targetType,
      targetId,
      reason,
      details.trim() || undefined,
    );
    if (alsoBlock && targetType === "user") {
      await blockUser(supabase, targetId);
    }
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center gap-3 px-6 pt-4">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {tCommon.back}
          </Text>
        </Pressable>
        <Text className="font-display text-xl font-bold text-ink dark:text-screen">
          {t.title}
        </Text>
      </View>

      <View className="gap-2 px-6 py-4">
        {REASONS.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            onPress={() => setReason(r)}
            className={`rounded-button border px-4 py-3 ${reason === r ? "border-reel bg-reel/10" : "border-celluloid"}`}
          >
            <Text className="font-body text-t14 text-ink dark:text-screen">
              {t.reasons[r]}
            </Text>
          </Pressable>
        ))}

        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder={t.detailsPlaceholder}
          multiline
          className="mt-2 rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
        />

        {targetType === "user" ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoBlock }}
            onPress={() => setAlsoBlock((v) => !v)}
            className="mt-2 flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 rounded-sm border border-ink dark:border-screen ${alsoBlock ? "bg-reel" : ""}`}
            />
            <Text className="font-body text-t12 text-ink dark:text-screen">
              {t.alsoBlock}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="mt-auto px-6 pb-6">
        <ContinueButton
          label={t.submit}
          onPress={submit}
          disabled={!reason || saving}
        />
      </View>
    </SafeAreaView>
  );
}
