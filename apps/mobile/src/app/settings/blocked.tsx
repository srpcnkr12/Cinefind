import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getBlockedUsers,
  unblockUser,
  type BlockedUser,
} from "@reelmate/api/compliance";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function BlockedUsersScreen() {
  const t = useMessages().settings;
  const tCommon = useMessages().common;
  const [items, setItems] = useState<BlockedUser[]>([]);

  const load = useCallback(async () => {
    setItems(await getBlockedUsers(supabase));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleUnblock(userId: string) {
    await unblockUser(supabase, userId);
    void load();
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
          {t.blocked}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.userId}
        contentContainerClassName="gap-2 px-6 py-4"
        ListEmptyComponent={
          <Text className="text-center font-body text-t14 text-ink dark:text-screen">
            {t.blockedEmpty}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
            <Text className="flex-1 font-body text-t14 text-ink dark:text-screen">
              {item.displayName ?? t.blockedUnknownName}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleUnblock(item.userId)}
              className="rounded-button bg-reel px-3 py-1.5"
            >
              <Text className="font-body-semibold text-t12 text-white">
                {t.unblock}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
