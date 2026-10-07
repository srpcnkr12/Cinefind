import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getLikesReceived,
  type LikesReceivedResult,
} from "@movieholix/api/discovery";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function LikesReceivedScreen() {
  const t = useMessages().chats;
  const tCommon = useMessages().common;
  const [result, setResult] = useState<LikesReceivedResult | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getLikesReceived(supabase).then(setResult);
    }, []),
  );

  const totalCount = result?.totalCount ?? 0;

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
          {t.likesYou}
        </Text>
      </View>

      {result?.likers ? (
        <FlatList
          data={result.likers}
          keyExtractor={(item) => item.userId}
          contentContainerClassName="gap-2 px-6 py-4"
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-2-light dark:bg-surface-2-dark">
                <Text className="font-display text-t16 text-ink dark:text-screen">
                  {(item.displayName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
                {item.displayName ?? t.unknownName}
              </Text>
            </View>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-4 px-10">
          <View className="flex-row flex-wrap justify-center gap-3">
            {Array.from({ length: Math.min(totalCount, 9) }).map((_, i) => (
              <View
                key={i}
                className="h-20 w-20 rounded-card bg-surface-2-light dark:bg-surface-2-dark"
              />
            ))}
          </View>
          <Text className="text-center font-display text-3xl font-bold text-ink dark:text-screen">
            {totalCount}
          </Text>
          <Text className="text-center font-body text-t14 text-ink dark:text-screen">
            {t.likesYouBody}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/premium/paywall?trigger=likes_you")}
            className="rounded-button bg-reel px-5 py-3"
          >
            <Text className="font-body-semibold text-t14 text-white">
              {t.likesYouUnlockCta}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
