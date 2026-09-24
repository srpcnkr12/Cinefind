import { colorScheme, useColorScheme } from "nativewind";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const t = useMessages();
  const { colorScheme: current } = useColorScheme();

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-6 bg-screen px-6 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <Text
        className="font-display text-t40 text-ink dark:text-screen"
        accessibilityRole="header"
      >
        {t.common.appName}
      </Text>
      <Text className="text-center font-body text-t16 leading-6 text-ink dark:text-screen">
        {t.common.hello}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/profile/notifications")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {t.notifications.title}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/premium/paywall?trigger=menu")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {t.premium.goPremium}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/premium/weekly-stats")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {t.premium.weeklyStatsTitle}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {t.settings.title}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => colorScheme.set(current === "dark" ? "light" : "dark")}
        className="rounded-button bg-reel px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-white">
          {current === "dark" ? t.theme.light : t.theme.dark}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void supabase.auth.signOut()}
        className="rounded-button bg-ticket px-5 py-3"
      >
        <Text className="font-body-semibold text-t14 text-ink">
          {t.common.signOut}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
