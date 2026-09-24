import { useCallback, useState } from "react";
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
  addComment,
  getComments,
  togglePostLike,
  type CommentItem,
} from "@reelmate/api/social";
import { SpoilerBlur } from "@/components/spoiler-blur";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type PostDetail = {
  id: string;
  authorId: string;
  authorDisplayName: string | null;
  body: string | null;
  containsSpoiler: boolean;
  likeCount: number;
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useMessages().feed;
  const tCommon = useMessages().common;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select(
        "id, author_id, body, contains_spoiler, like_count, profiles(display_name)",
      )
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const profile = data.profiles as unknown as {
        display_name: string | null;
      } | null;
      setPost({
        id: data.id,
        authorId: data.author_id,
        authorDisplayName: profile?.display_name ?? null,
        body: data.body,
        containsSpoiler: data.contains_spoiler,
        likeCount: data.like_count,
      });
    }
    setComments(await getComments(supabase, id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submitComment() {
    if (draft.trim().length === 0) return;
    const comment = await addComment(supabase, id, draft.trim());
    setComments((prev) => [...prev, comment]);
    setDraft("");
  }

  async function handleLike() {
    if (!post) return;
    setPost({ ...post, likeCount: post.likeCount + 1 });
    const liked = await togglePostLike(supabase, post.id);
    if (!liked) void load();
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
          {t.postTitle}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-6 py-4"
          ListHeaderComponent={
            post ? (
              <View className="mb-4 gap-2 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
                <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
                  {post.authorDisplayName ?? t.unknownAuthor}
                </Text>
                <SpoilerBlur spoiler={post.containsSpoiler}>
                  <Text className="font-body text-t14 text-ink dark:text-screen">
                    {post.body}
                  </Text>
                </SpoilerBlur>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleLike()}
                >
                  <Text className="font-body text-t12 text-ink/70 dark:text-screen/70">
                    {"♥ "}
                    {post.likeCount}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View className="rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark">
              <SpoilerBlur spoiler={item.containsSpoiler}>
                <Text className="font-body text-t14 text-ink dark:text-screen">
                  {item.body}
                </Text>
              </SpoilerBlur>
            </View>
          )}
        />

        <View className="flex-row items-center gap-2 px-6 pb-4 pt-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.commentPlaceholder}
            className="flex-1 rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void submitComment()}
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
