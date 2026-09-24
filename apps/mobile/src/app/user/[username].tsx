import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  getPublicProfile,
  requestFollow,
  togglePostLike,
  toggleBookmark,
  unfollow,
  type PostItem,
  type PublicProfile,
} from "@reelmate/api/social";
import {
  recordProfileView,
  sendSuperMessage,
} from "@reelmate/api/monetization";
import { PostCard } from "@/components/post-card";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const t = useMessages().userProfile;
  const tCommon = useMessages().common;
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(
    undefined,
  );
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [showSuperMessage, setShowSuperMessage] = useState(false);
  const [superMessageBody, setSuperMessageBody] = useState("");

  const load = useCallback(async () => {
    const p = await getPublicProfile(supabase, username);
    setProfile(p);
    if (p) {
      void recordProfileView(supabase, p.id);
      const { data } = await supabase
        .from("posts")
        .select(
          "id, author_id, type, film_id, body, rating, contains_spoiler, repost_of_id, quote_of_id, visibility, like_count, comment_count, repost_count, bookmark_count, created_at, films(original_title, poster_path)",
        )
        .eq("author_id", p.id)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as {
        id: string;
        author_id: string;
        type: PostItem["type"];
        film_id: string | null;
        body: string | null;
        rating: number | null;
        contains_spoiler: boolean;
        repost_of_id: string | null;
        quote_of_id: string | null;
        visibility: PostItem["visibility"];
        like_count: number;
        comment_count: number;
        repost_count: number;
        bookmark_count: number;
        created_at: string;
        films: { original_title: string; poster_path: string | null } | null;
      }[];
      setPosts(
        rows.map((row) => ({
          id: row.id,
          authorId: row.author_id,
          authorUsername: p.username,
          authorDisplayName: p.displayName,
          type: row.type,
          filmId: row.film_id,
          filmTitle: row.films?.original_title ?? null,
          filmPosterPath: row.films?.poster_path ?? null,
          lineId: null,
          listId: null,
          body: row.body,
          rating: row.rating,
          containsSpoiler: row.contains_spoiler,
          repostOfId: row.repost_of_id,
          quoteOfId: row.quote_of_id,
          visibility: row.visibility,
          likeCount: row.like_count,
          commentCount: row.comment_count,
          repostCount: row.repost_count,
          bookmarkCount: row.bookmark_count,
          createdAt: row.created_at,
        })),
      );
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleFollow() {
    if (!profile) return;
    if (profile.followStatus) {
      await unfollow(supabase, profile.id);
    } else {
      await requestFollow(supabase, profile.id);
    }
    void load();
  }

  async function handleSendSuperMessage() {
    if (!profile || !superMessageBody.trim()) return;
    try {
      await sendSuperMessage(supabase, profile.id, superMessageBody.trim());
      setSuperMessageBody("");
      setShowSuperMessage(false);
      Alert.alert(t.superMessageSent);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("no_super_messages_available")) {
        router.push("/premium/paywall?trigger=no_super_messages");
      } else {
        Alert.alert(t.superMessageNoBalance);
      }
    }
  }

  async function handleToggleLike(postId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likeCount: p.likeCount + 1 } : p,
      ),
    );
    const liked = await togglePostLike(supabase, postId);
    if (!liked) void load();
  }

  async function handleToggleBookmark(postId: string) {
    await toggleBookmark(supabase, postId);
  }

  if (profile === undefined) {
    return (
      <SafeAreaView
        className="flex-1 bg-screen dark:bg-ink"
        edges={["top", "bottom"]}
      />
    );
  }

  if (profile === null) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-screen dark:bg-ink"
        edges={["top", "bottom"]}
      >
        <Text className="font-body text-ink dark:text-screen">
          {t.notFound}
        </Text>
      </SafeAreaView>
    );
  }

  const followLabel =
    profile.followStatus === "accepted"
      ? t.following
      : profile.followStatus === "pending"
        ? t.requested
        : t.follow;

  const canSeePosts = !profile.isPrivate || profile.followStatus === "accepted";

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <FlatList
        data={canSeePosts ? posts : []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-6 pb-8"
        ListHeaderComponent={
          <View className="gap-3 pb-4 pt-4">
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text className="font-body text-t14 text-ink dark:text-screen">
                {tCommon.back}
              </Text>
            </Pressable>
            <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
              {profile.displayName ?? profile.username}
            </Text>
            <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
              @{profile.username}
            </Text>
            {profile.bio ? (
              <Text className="font-body text-t14 text-ink dark:text-screen">
                {profile.bio}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleFollow()}
              className={`self-start rounded-button px-4 py-2 ${profile.followStatus ? "border border-ink dark:border-screen" : "bg-reel"}`}
            >
              <Text
                className={`font-body-semibold text-t12 ${profile.followStatus ? "text-ink dark:text-screen" : "text-white"}`}
              >
                {followLabel}
              </Text>
            </Pressable>
            {profile.followStatus !== "accepted" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowSuperMessage((v) => !v)}
                className="self-start rounded-button border border-ink px-4 py-2 dark:border-screen"
              >
                <Text className="font-body-semibold text-t12 text-ink dark:text-screen">
                  {t.sendSuperMessage}
                </Text>
              </Pressable>
            ) : null}
            {showSuperMessage ? (
              <View className="gap-2">
                <TextInput
                  value={superMessageBody}
                  onChangeText={setSuperMessageBody}
                  placeholder={t.superMessagePlaceholder}
                  className="rounded-card bg-surface-1-light p-3 font-body text-t14 text-ink dark:bg-surface-1-dark dark:text-screen"
                  multiline
                />
                <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                  {t.superMessageNotice}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleSendSuperMessage()}
                  className="self-start rounded-button bg-reel px-4 py-2"
                >
                  <Text className="font-body-semibold text-t12 text-white">
                    {t.superMessageSend}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {!canSeePosts ? (
              <Text className="pt-4 text-center font-body text-t14 text-ink dark:text-screen">
                {t.privateAccountBody}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={handleToggleLike}
            onToggleBookmark={handleToggleBookmark}
          />
        )}
      />
    </SafeAreaView>
  );
}
