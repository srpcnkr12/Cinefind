import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getDiscoverFeed,
  getFollowingFeed,
  togglePostLike,
  toggleBookmark,
  type PostItem,
} from "@reelmate/api/social";
import { PostCard } from "@/components/post-card";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type Segment = "following" | "discover";

export default function FeedScreen() {
  const t = useMessages().feed;
  const [segment, setSegment] = useState<Segment>("following");
  const [posts, setPosts] = useState<PostItem[] | null>(null);

  const load = useCallback(async () => {
    const items =
      segment === "following"
        ? await getFollowingFeed(supabase)
        : await getDiscoverFeed(supabase);
    setPosts(items);
  }, [segment]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleToggleLike(postId: string) {
    setPosts(
      (prev) =>
        prev?.map((p) =>
          p.id === postId ? { ...p, likeCount: p.likeCount + 1 } : p,
        ) ?? null,
    );
    const liked = await togglePostLike(supabase, postId);
    if (!liked) void load();
  }

  async function handleToggleBookmark(postId: string) {
    await toggleBookmark(supabase, postId);
  }

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
          onPress={() => router.push("/(tabs)/feed/compose")}
        >
          <Text className="font-body-semibold text-t14 text-reel">
            {t.compose}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-6 py-4">
        {(["following", "discover"] as Segment[]).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            onPress={() => setSegment(s)}
            className={`rounded-button px-4 py-2 ${segment === s ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
          >
            <Text
              className={`font-body-semibold text-t12 ${segment === s ? "text-white" : "text-ink dark:text-screen"}`}
            >
              {s === "following" ? t.segmentFollowing : t.segmentDiscover}
            </Text>
          </Pressable>
        ))}
      </View>

      {posts !== null && posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-center font-body text-t14 text-ink dark:text-screen">
            {segment === "following" ? t.emptyFollowing : t.emptyDiscover}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-6 pb-8"
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
