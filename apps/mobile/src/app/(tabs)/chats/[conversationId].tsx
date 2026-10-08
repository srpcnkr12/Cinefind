import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  getMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  unmatch,
  type ChatMessage,
} from "@movieholix/api/chat";
import {
  generateIcebreakers,
  type IcebreakerSuggestion,
} from "@movieholix/core/domain/icebreaker";
import type { CompatibilityReason } from "@movieholix/core/domain/taste";
import { useMessages as useI18nMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type ConversationContext = {
  matchId: string;
  otherUserId: string;
  otherDisplayName: string | null;
};

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const t = useI18nMessages().chats;
  const tCommon = useI18nMessages().common;
  const tShared = useI18nMessages().sharedWatchlist;
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [icebreakers, setIcebreakers] = useState<IcebreakerSuggestion[]>([]);
  const [filmTitles, setFilmTitles] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const { data: conversation } = await supabase
      .from("conversations")
      .select("match_id, conversation_members(user_id)")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation) return;

    const members = (conversation.conversation_members ?? []) as {
      user_id: string;
    }[];
    const otherUserId =
      members.find((m) => m.user_id !== user.id)?.user_id ?? "";

    const [{ data: profile }, { data: match }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", otherUserId)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("reasons")
        .eq("id", conversation.match_id)
        .maybeSingle(),
    ]);

    setContext({
      matchId: conversation.match_id,
      otherUserId,
      otherDisplayName: profile?.display_name ?? null,
    });

    const loadedMessages = await getMessages(supabase, conversationId);
    setMessages(loadedMessages);
    await markConversationRead(supabase, conversationId);

    if (loadedMessages.length === 0) {
      const reasons = (match?.reasons ?? []) as CompatibilityReason[];
      const suggestions = generateIcebreakers(reasons);
      setIcebreakers(suggestions);

      const filmIds = suggestions
        .filter(
          (
            s,
          ): s is Extract<IcebreakerSuggestion, { kind: "shared_favorite" }> =>
            s.kind === "shared_favorite",
        )
        .map((s) => s.filmId);
      if (filmIds.length > 0) {
        const { data: films } = await supabase
          .from("films")
          .select("id, original_title")
          .in("id", filmIds);
        const titles: Record<string, string> = {};
        for (const f of films ?? []) titles[f.id] = f.original_title;
        setFilmTitles(titles);
      }
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const channel = subscribeToMessages(supabase, conversationId, (message) => {
      setMessages((prev) => [message, ...prev]);
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function send(body: string) {
    if (body.trim().length === 0) return;
    setDraft("");
    const message = await sendMessage(
      supabase,
      conversationId,
      "text",
      body.trim(),
    );
    setMessages((prev) => [message, ...prev]);
    void fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ conversationId, messageId: message.id }),
      },
    ).catch(() => {
      // Push en iyi çaba (best-effort); mesajlaşma push'a bağımlı değil.
    });
  }

  function suggestionLabel(suggestion: IcebreakerSuggestion): string {
    if (suggestion.kind === "shared_favorite") {
      const title = filmTitles[suggestion.filmId] ?? "";
      return t.icebreakerSharedFavorite.replace("{film}", title);
    }
    if (suggestion.kind === "shared_director")
      return t.icebreakerSharedDirector;
    if (suggestion.kind === "rating_agreement")
      return t.icebreakerRatingAgreement;
    return t.icebreakerSharedWatchlist;
  }

  async function handleUnmatch() {
    if (!context) return;
    await unmatch(supabase, context.matchId);
    router.back();
  }

  const hasScamWarning = messages.some(
    (m) => m.moderationFlag && m.senderId !== myUserId,
  );

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text className="font-body text-t14 text-ink dark:text-screen">
              {tCommon.back}
            </Text>
          </Pressable>
          <Text className="font-display text-xl font-bold text-ink dark:text-screen">
            {context?.otherDisplayName ?? "—"}
          </Text>
        </View>
        <View className="flex-row gap-4">
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              context && router.push(`/shared-watchlist/${context.matchId}`)
            }
          >
            <Text className="font-body text-t12 text-reel">
              {tShared.openChat}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              context && router.push(`/report/user/${context.otherUserId}`)
            }
          >
            <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
              {t.report}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleUnmatch()}
          >
            <Text className="font-body text-t12 text-danger">{t.unmatch}</Text>
          </Pressable>
        </View>
      </View>

      {hasScamWarning ? (
        <View className="mx-6 mt-3 rounded-card bg-danger/10 p-3">
          <Text className="font-body text-t12 text-danger">
            {t.scamWarning}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-2 px-6 py-4"
          renderItem={({ item }) => {
            const mine = item.senderId === myUserId;
            return (
              <View
                className={`flex-row ${mine ? "justify-end" : "justify-start"}`}
              >
                <View
                  className={`max-w-[80%] rounded-card px-4 py-2 ${mine ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
                >
                  <Text
                    className={`font-body text-t14 ${mine ? "text-white" : "text-ink dark:text-screen"}`}
                  >
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            messages.length === 0 && icebreakers.length > 0 ? (
              <View className="gap-2 pb-4">
                <Text className="font-body-semibold text-t12 text-ink/60 dark:text-screen/60">
                  {t.icebreakerTitle}
                </Text>
                {icebreakers.map((suggestion, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    onPress={() => setDraft(suggestionLabel(suggestion))}
                    className="rounded-button border border-celluloid px-4 py-3"
                  >
                    <Text className="font-body text-t14 text-ink dark:text-screen">
                      {suggestionLabel(suggestion)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
        />

        <View className="flex-row items-center gap-2 px-6 pb-4 pt-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.messagePlaceholder}
            multiline
            className="flex-1 rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void send(draft)}
            disabled={draft.trim().length === 0}
            className="rounded-button bg-reel px-4 py-3"
            style={draft.trim().length === 0 ? { opacity: 0.5 } : undefined}
          >
            <Text className="font-body-semibold text-t14 text-white">
              {t.send}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
