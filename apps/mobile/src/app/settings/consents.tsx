import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getConsents,
  recordConsent,
  revokeConsent,
  type Consent,
  type ConsentType,
} from "@movieholix/api/compliance";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const TOGGLEABLE: ConsentType[] = ["marketing", "analytics"];
const READ_ONLY: ConsentType[] = [
  "kvkk_notice",
  "special_category_data",
  "location",
];

function latestFor(consents: Consent[], type: ConsentType): Consent | null {
  const rows = consents.filter((c) => c.consentType === type);
  if (rows.length === 0) return null;
  return rows.reduce((latest, row) => {
    const latestTime = latest.grantedAt ?? latest.revokedAt ?? "";
    const rowTime = row.grantedAt ?? row.revokedAt ?? "";
    return rowTime > latestTime ? row : latest;
  });
}

function isGranted(consent: Consent | null): boolean {
  if (!consent) return false;
  return consent.grantedAt !== null && consent.revokedAt === null;
}

export default function ConsentsScreen() {
  const t = useMessages().settings;
  const tCommon = useMessages().common;
  const [consents, setConsents] = useState<Consent[]>([]);

  const load = useCallback(async () => {
    setConsents(await getConsents(supabase));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleToggle(type: ConsentType, currentlyGranted: boolean) {
    if (currentlyGranted) {
      await revokeConsent(supabase, type);
    } else {
      await recordConsent(supabase, type, "v1");
    }
    void load();
  }

  function labelFor(type: ConsentType): string {
    switch (type) {
      case "kvkk_notice":
        return t.consentKvkkNotice;
      case "special_category_data":
        return t.consentSpecialCategory;
      case "location":
        return t.consentLocation;
      case "marketing":
        return t.consentMarketing;
      case "analytics":
        return t.consentAnalytics;
    }
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
          {t.consents}
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-3 px-6 py-4">
        {TOGGLEABLE.map((type) => {
          const consent = latestFor(consents, type);
          const granted = isGranted(consent);
          return (
            <Pressable
              key={type}
              accessibilityRole="switch"
              accessibilityState={{ checked: granted }}
              onPress={() => void handleToggle(type, granted)}
              className="flex-row items-center justify-between rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
            >
              <Text className="flex-1 font-body text-t14 text-ink dark:text-screen">
                {labelFor(type)}
              </Text>
              <Text
                className={`font-body-semibold text-t12 ${granted ? "text-success" : "text-ink/50 dark:text-screen/50"}`}
              >
                {granted ? t.consentOn : t.consentOff}
              </Text>
            </Pressable>
          );
        })}

        <Text className="mt-4 font-body-semibold text-t12 text-ink/60 dark:text-screen/60">
          {t.consentReadOnlyNote}
        </Text>
        {READ_ONLY.map((type) => {
          const consent = latestFor(consents, type);
          const granted = isGranted(consent);
          return (
            <View
              key={type}
              className="flex-row items-center justify-between rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
            >
              <Text className="flex-1 font-body text-t14 text-ink dark:text-screen">
                {labelFor(type)}
              </Text>
              <Text className="font-body-semibold text-t12 text-ink/50 dark:text-screen/50">
                {granted ? t.consentOn : t.consentOff}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
