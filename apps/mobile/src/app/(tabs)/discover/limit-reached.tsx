import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMessages } from "@/lib/i18n";

export default function LimitReachedScreen() {
  const t = useMessages().discover;

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-4 bg-screen px-6 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
        {t.limitReachedTitle}
      </Text>
      <Text className="text-center font-body text-t14 text-ink dark:text-screen">
        {t.limitReachedBody}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/premium/paywall?trigger=limit_reached")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {t.goPremiumCta}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/library")}
        className="rounded-button bg-surface-1-light px-5 py-3 dark:bg-surface-1-dark"
      >
        <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
          {t.limitReachedCta}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
