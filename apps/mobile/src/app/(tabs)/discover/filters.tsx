import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { Intent } from "@reelmate/core/domain/profile";
import { ContinueButton } from "@/components/continue-button";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const INTENTS: Intent[] = ["dating", "friendship", "watch_buddy"];

export default function DiscoverFiltersScreen() {
  const t = useMessages().discover;
  const tOnboarding = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("55");
  const [maxDistanceKm, setMaxDistanceKm] = useState("50");
  const [intents, setIntents] = useState<Intent[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("age_min, age_max, max_distance_km, intents")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setAgeMin(String(data.age_min));
      setAgeMax(String(data.age_max));
      setMaxDistanceKm(String(data.max_distance_km));
      setIntents((data.intents as Intent[]) ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function toggleIntent(intent: Intent) {
    setIntents((prev) =>
      prev.includes(intent)
        ? prev.filter((i) => i !== intent)
        : [...prev, intent],
    );
  }

  async function save() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("profiles")
      .update({
        age_min: Number(ageMin) || 18,
        age_max: Number(ageMax) || 55,
        max_distance_km: Number(maxDistanceKm) || 50,
        intents,
      })
      .eq("id", user?.id ?? "");
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
          {t.filters}
        </Text>
      </View>

      <View className="gap-5 px-6 py-6">
        <View className="gap-2">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.ageRangeLabel}
          </Text>
          <View className="flex-row gap-3">
            <TextInput
              value={ageMin}
              onChangeText={setAgeMin}
              keyboardType="number-pad"
              className="flex-1 rounded-button border border-celluloid px-4 py-3 text-center font-body text-ink dark:text-screen"
            />
            <TextInput
              value={ageMax}
              onChangeText={setAgeMax}
              keyboardType="number-pad"
              className="flex-1 rounded-button border border-celluloid px-4 py-3 text-center font-body text-ink dark:text-screen"
            />
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.maxDistanceLabel}
          </Text>
          <TextInput
            value={maxDistanceKm}
            onChangeText={setMaxDistanceKm}
            keyboardType="number-pad"
            className="rounded-button border border-celluloid px-4 py-3 text-center font-body text-ink dark:text-screen"
          />
        </View>

        <View className="gap-2">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.intentsLabel}
          </Text>
          <View className="gap-2">
            {INTENTS.map((intent) => (
              <Pressable
                key={intent}
                accessibilityRole="button"
                onPress={() => toggleIntent(intent)}
                className={`rounded-button border px-4 py-3 ${intents.includes(intent) ? "border-reel bg-reel/10" : "border-celluloid"}`}
              >
                <Text className="font-body text-t14 text-ink dark:text-screen">
                  {intent === "dating"
                    ? tOnboarding.intentDating
                    : intent === "friendship"
                      ? tOnboarding.intentFriendship
                      : tOnboarding.intentWatchBuddy}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="mt-auto px-6 pb-6">
        <ContinueButton label={tCommon.done} onPress={save} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}
