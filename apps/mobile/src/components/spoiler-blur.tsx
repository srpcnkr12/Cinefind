import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMessages } from "@/lib/i18n";

type Props = {
  spoiler: boolean;
  children: React.ReactNode;
};

/** PRD kabul kriteri: spoiler işaretli içerik varsayılan bulanık, dokununca açılıyor. */
export function SpoilerBlur({ spoiler, children }: Props) {
  const t = useMessages().feed;
  const [revealed, setRevealed] = useState(false);

  if (!spoiler || revealed) {
    return <>{children}</>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={() => setRevealed(true)}>
      <View className="items-center justify-center rounded-card bg-ink/80 px-4 py-6 dark:bg-screen/10">
        <Text className="font-body-semibold text-t12 text-screen">
          {t.spoilerHidden}
        </Text>
        <Text className="font-body text-t12 text-screen/70">
          {t.spoilerTapToReveal}
        </Text>
      </View>
    </Pressable>
  );
}
