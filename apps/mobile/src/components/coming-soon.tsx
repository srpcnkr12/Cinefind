import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMessages } from "@/lib/i18n";

export function ComingSoon({ title }: { title: string }) {
  const t = useMessages().tabs;
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-2 bg-screen px-6 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <Text className="font-body-semibold text-t14 text-reel">
        {t.comingSoonTitle}
      </Text>
      <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
        {title}
      </Text>
      <Text className="text-center font-body text-t14 text-ink dark:text-screen">
        {t.comingSoonBody}
      </Text>
    </SafeAreaView>
  );
}
