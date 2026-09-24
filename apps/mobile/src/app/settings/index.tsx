import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMessages } from "@/lib/i18n";

/** PRD 5.2 `settings/` — yalnızca uyumluluk ağırlığı olan alt ekranlar (Faz 9, gerekçe #6). */
export default function SettingsHubScreen() {
  const t = useMessages().settings;
  const tCommon = useMessages().common;

  const items: { label: string; href: Parameters<typeof router.push>[0] }[] = [
    { label: t.consents, href: "/settings/consents" },
    { label: t.blocked, href: "/settings/blocked" },
    { label: t.exportData, href: "/settings/export-data" },
    { label: t.deleteAccount, href: "/settings/delete-account" },
  ];

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
        {items.map((item) => (
          <Pressable
            key={String(item.href)}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            className="rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
          >
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
