import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getConversations,
  getPendingSuperMessages,
  type ConversationSummary,
  type PendingSuperMessage,
} from "@reelmate/api/chat";
import { respondToSuperMessage } from "@reelmate/api/monetization";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function ChatsScreen() {
  const t = useMessages().chats;
  const [conversations, setConversations] = useState<
    ConversationSummary[] | null
  >(null);
  const [pendingSuperMessages, setPendingSuperMessages] = useState<
    PendingSuperMessage[]
  >([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setConversations(await getConversations(supabase, user.id));
    setPendingSuperMessages(await getPendingSuperMessages(supabase, user.id));
  }, []);

  async function handleRespond(conversationId: string, accept: boolean) {
    await respondToSuperMessage(supabase, conversationId, accept);
    void load();
    if (accept) router.push(`/(tabs)/chats/${conversationId}`);
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
          {t.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/chats/likes")}
        >
          <Text className="font-body-semibold text-t14 text-reel">
            {t.likesYou}
          </Text>
        </Pressable>
      </View>

      {pendingSuperMessages.length > 0 ? (
        <View className="gap-2 px-6 pt-4">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.superMessageRequestsTitle}
          </Text>
          {pendingSuperMessages.map((item) => (
            <View
              key={item.conversationId}
              className="gap-2 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
            >
              <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
                {item.senderDisplayName ?? t.unknownName}
              </Text>
              {item.body ? (
                <Text className="font-body text-t14 text-ink dark:text-screen">
                  {item.body}
                </Text>
              ) : null}
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleRespond(item.conversationId, true)}
                  className="rounded-button bg-reel px-4 py-2"
                >
                  <Text className="font-body-semibold text-t12 text-white">
                    {t.superMessageAccept}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleRespond(item.conversationId, false)}
                  className="rounded-button bg-surface-2-light px-4 py-2 dark:bg-surface-2-dark"
                >
                  <Text className="font-body-semibold text-t12 text-ink dark:text-screen">
                    {t.superMessageDelete}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {conversations !== null && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-center font-body text-t14 text-ink dark:text-screen">
            {t.empty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.conversationId}
          contentContainerClassName="gap-3 px-6 py-4"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(`/(tabs)/chats/${item.conversationId}`)
              }
              className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-2-light dark:bg-surface-2-dark">
                <Text className="font-display text-t16 text-ink dark:text-screen">
                  {(item.otherDisplayName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
                  {item.otherDisplayName ?? t.unknownName}
                </Text>
                <Text
                  className="font-body text-t12 text-ink/60 dark:text-screen/60"
                  numberOfLines={1}
                >
                  {item.lastMessage
                    ? item.lastMessage.kind === "text"
                      ? (item.lastMessage.body ?? "")
                      : t.nonTextPreview
                    : t.sayHi}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
