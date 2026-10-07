import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getNotifications,
  markNotificationRead,
  respondToFollowRequest,
  type NotificationItem,
} from "@movieholix/api/social";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function NotificationsScreen() {
  const t = useMessages().notifications;
  const tCommon = useMessages().common;
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    setItems(await getNotifications(supabase));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function labelFor(item: NotificationItem): string {
    switch (item.type) {
      case "new_message":
        return t.newMessage;
      case "mention":
        return t.mention;
      case "follow_request":
        return t.followRequest;
      case "follow_accepted":
        return t.followAccepted;
      case "like":
        return t.like;
      case "comment":
        return t.comment;
      case "super_message":
        return t.superMessage;
      case "weekly_stats_ready":
        return t.weeklyStatsReady;
      default:
        return "";
    }
  }

  async function handlePress(item: NotificationItem) {
    await markNotificationRead(supabase, item.id);
    if (
      item.type === "new_message" &&
      typeof item.entity.conversationId === "string"
    ) {
      router.push(`/(tabs)/chats/${item.entity.conversationId}`);
    } else if (
      item.type === "comment" ||
      item.type === "like" ||
      item.type === "mention"
    ) {
      const postId = (item.entity.postId ?? item.entity.sourceId) as
        string | undefined;
      if (postId) router.push(`/(tabs)/feed/post/${postId}`);
    } else if (item.type === "super_message") {
      router.push("/(tabs)/chats");
    } else if (item.type === "weekly_stats_ready") {
      router.push("/premium/weekly-stats");
    }
    void load();
  }

  async function acceptFollowRequest(item: NotificationItem) {
    if (!item.actorId) return;
    await respondToFollowRequest(supabase, item.actorId, true);
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
          {t.title}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 px-6 py-4"
        ListEmptyComponent={
          <Text className="text-center font-body text-t14 text-ink dark:text-screen">
            {t.empty}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handlePress(item)}
            className={`flex-row items-center justify-between rounded-card p-4 ${item.readAt ? "bg-surface-1-light dark:bg-surface-1-dark" : "bg-reel/10"}`}
          >
            <Text className="flex-1 font-body text-t14 text-ink dark:text-screen">
              {labelFor(item)}
            </Text>
            {item.type === "follow_request" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void acceptFollowRequest(item)}
                className="rounded-button bg-reel px-3 py-1.5"
              >
                <Text className="font-body-semibold text-t12 text-white">
                  {t.accept}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
