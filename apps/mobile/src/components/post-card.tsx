import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { PostItem } from "@reelmate/api/social";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import { SpoilerBlur } from "@/components/spoiler-blur";
import { useMessages } from "@/lib/i18n";

type Props = {
  post: PostItem;
  onToggleLike: (postId: string) => void;
  onToggleBookmark: (postId: string) => void;
};

export function PostCard({ post, onToggleLike, onToggleBookmark }: Props) {
  const t = useMessages().feed;
  const posterUrl = tmdbImageUrl(post.filmPosterPath, "w185");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/(tabs)/feed/post/${post.id}`)}
      className="gap-2 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
    >
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          post.authorUsername && router.push(`/user/${post.authorUsername}`)
        }
      >
        <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
          {post.authorDisplayName ?? t.unknownAuthor}
        </Text>
      </Pressable>

      <SpoilerBlur spoiler={post.containsSpoiler}>
        <View className="gap-2">
          {post.filmId ? (
            <View className="flex-row items-center gap-2">
              {posterUrl ? (
                <Image
                  source={{ uri: posterUrl }}
                  className="h-16 w-11 rounded-md"
                />
              ) : null}
              <View className="flex-1">
                <Text
                  className="font-body-semibold text-t12 text-ink dark:text-screen"
                  numberOfLines={1}
                >
                  {post.filmTitle}
                </Text>
                {post.rating ? (
                  <Text className="font-body text-t12 text-popcorn">
                    {"★ "}
                    {post.rating}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
          {post.body ? (
            <Text className="font-body text-t14 text-ink dark:text-screen">
              {post.body}
            </Text>
          ) : null}
        </View>
      </SpoilerBlur>

      <View className="flex-row gap-6 pt-1">
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleLike(post.id)}
        >
          <Text className="font-body text-t12 text-ink/70 dark:text-screen/70">
            {"♥ "}
            {post.likeCount}
          </Text>
        </Pressable>
        <Text className="font-body text-t12 text-ink/70 dark:text-screen/70">
          {t.commentCountLabel.replace("{count}", String(post.commentCount))}
        </Text>
        <Text className="font-body text-t12 text-ink/70 dark:text-screen/70">
          {"↻ "}
          {post.repostCount}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleBookmark(post.id)}
        >
          <Text className="font-body text-t12 text-ink/70 dark:text-screen/70">
            {"⚑ "}
            {post.bookmarkCount}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
