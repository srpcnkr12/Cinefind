import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { searchFilms, type SearchFilmResult } from "@reelmate/api/films";
import { createPost } from "@reelmate/api/social";
import type { PostType, PostVisibility } from "@reelmate/core/domain/social";
import { StarRating } from "@/components/star-rating";
import { ContinueButton } from "@/components/continue-button";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const TYPES: PostType[] = ["text", "review", "watched"];

export default function ComposeScreen() {
  const t = useMessages().feed;
  const tCommon = useMessages().common;
  const [type, setType] = useState<PostType>("text");
  const [body, setBody] = useState("");
  const [film, setFilm] = useState<SearchFilmResult | null>(null);
  const [filmQuery, setFilmQuery] = useState("");
  const [filmResults, setFilmResults] = useState<SearchFilmResult[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [containsSpoiler, setContainsSpoiler] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [saving, setSaving] = useState(false);

  async function onFilmSearch(query: string) {
    setFilmQuery(query);
    if (query.trim().length < 2) {
      setFilmResults([]);
      return;
    }
    setFilmResults(await searchFilms(supabase, query, 10));
  }

  async function submit() {
    setSaving(true);
    try {
      const result = await createPost(supabase, {
        type,
        body: body.trim().length > 0 ? body.trim() : undefined,
        filmId: film?.filmId,
        rating: type === "review" ? (rating ?? undefined) : undefined,
        containsSpoiler,
        visibility,
      });
      router.replace(`/(tabs)/feed/post/${result.id}`);
    } finally {
      setSaving(false);
    }
  }

  const needsFilm = type === "review" || type === "watched";
  const canSubmit = body.trim().length > 0 || (needsFilm && film !== null);

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
          {t.composeTitle}
        </Text>
      </View>

      <View className="gap-4 px-6 py-4">
        <View className="flex-row gap-2">
          {TYPES.map((tp) => (
            <Pressable
              key={tp}
              accessibilityRole="button"
              onPress={() => setType(tp)}
              className={`rounded-button px-4 py-2 ${type === tp ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
            >
              <Text
                className={`font-body text-t12 ${type === tp ? "text-white" : "text-ink dark:text-screen"}`}
              >
                {tp === "text"
                  ? t.typeText
                  : tp === "review"
                    ? t.typeReview
                    : t.typeWatched}
              </Text>
            </Pressable>
          ))}
        </View>

        {needsFilm ? (
          film ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setFilm(null)}
              className="rounded-button border border-celluloid px-4 py-3"
            >
              <Text className="font-body text-t14 text-ink dark:text-screen">
                {film.title}
              </Text>
            </Pressable>
          ) : (
            <View className="gap-2">
              <TextInput
                value={filmQuery}
                onChangeText={(v) => void onFilmSearch(v)}
                placeholder={t.filmSearchPlaceholder}
                className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
              />
              <FlatList
                data={filmResults}
                keyExtractor={(item) => item.filmId}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setFilm(item);
                      setFilmResults([]);
                      setFilmQuery("");
                    }}
                    className="py-2"
                  >
                    <Text className="font-body text-t14 text-ink dark:text-screen">
                      {item.title}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )
        ) : null}

        {type === "review" && film ? (
          <View className="gap-2">
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {t.yourRatingLabel}
            </Text>
            <StarRating value={rating} onChange={setRating} />
          </View>
        ) : null}

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t.bodyPlaceholder}
          multiline
          maxLength={2000}
          className="min-h-24 rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: containsSpoiler }}
          onPress={() => setContainsSpoiler((v) => !v)}
          className="flex-row items-center gap-2"
        >
          <View
            className={`h-5 w-5 rounded-sm border border-ink dark:border-screen ${containsSpoiler ? "bg-reel" : ""}`}
          />
          <Text className="font-body text-t12 text-ink dark:text-screen">
            {t.spoilerToggle}
          </Text>
        </Pressable>

        <View className="flex-row gap-2">
          {(["public", "followers"] as PostVisibility[]).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              onPress={() => setVisibility(v)}
              className={`rounded-button px-4 py-2 ${visibility === v ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
            >
              <Text
                className={`font-body text-t12 ${visibility === v ? "text-white" : "text-ink dark:text-screen"}`}
              >
                {v === "public" ? t.visibilityPublic : t.visibilityFollowers}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-auto px-6 pb-6">
        <ContinueButton
          label={t.publish}
          onPress={submit}
          disabled={!canSubmit || saving}
        />
      </View>
    </SafeAreaView>
  );
}
