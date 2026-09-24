import { useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { searchFilms, type SearchFilmResult } from "@reelmate/api/films";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import { StarRating } from "@/components/star-rating";
import { useMessages } from "@/lib/i18n";
import { callOrQueue } from "@/lib/mutation-queue";
import { supabase } from "@/lib/supabase";

export default function LibrarySearchScreen() {
  const t = useMessages().library;
  const tCommon = useMessages().common;
  const tFilm = useMessages().filmScreen;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFilmResult[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  async function onSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    const found = await searchFilms(supabase, text, 20);
    setResults(found);
  }

  async function rate(filmId: string, rating: number) {
    setRatings((r) => ({ ...r, [filmId]: rating }));
    await callOrQueue("upsert_user_film", {
      p_film_id: filmId,
      p_status: "watched",
      p_rating: rating,
      p_liked: rating >= 3.5,
    });
  }

  async function addToWatchlist(filmId: string) {
    await callOrQueue("upsert_user_film", {
      p_film_id: filmId,
      p_status: "watchlist",
      p_rating: null,
      p_liked: null,
    });
  }

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {tCommon.back}
          </Text>
        </Pressable>
        <Text className="font-display text-xl font-bold text-ink dark:text-screen">
          {t.searchTitle}
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={(text) => void onSearch(text)}
        placeholder={t.searchPlaceholder}
        className="mx-6 mb-3 rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
        autoFocus
      />

      <FlatList
        data={results}
        keyExtractor={(item) => item.filmId}
        contentContainerClassName="gap-3 px-6 pb-8"
        ListEmptyComponent={
          query.trim().length >= 2 ? (
            <Text className="text-center font-body text-t14 text-ink dark:text-screen">
              {t.searchEmpty}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const posterUrl = tmdbImageUrl(item.posterPath, "w185");
          return (
            <View className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/film/${item.slug}`)}
                className="flex-1 flex-row items-center gap-3"
              >
                {posterUrl ? (
                  <Image
                    source={{ uri: posterUrl }}
                    className="h-20 w-14 rounded-md bg-surface-2-light dark:bg-surface-2-dark"
                  />
                ) : (
                  <View className="h-20 w-14 rounded-md bg-surface-2-light dark:bg-surface-2-dark" />
                )}
                <View className="flex-1">
                  <Text
                    className="font-body-semibold text-t14 text-ink dark:text-screen"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.releaseYear ? (
                    <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                      {item.releaseYear}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <View className="items-end gap-2">
                <StarRating
                  value={ratings[item.filmId] ?? null}
                  onChange={(rating) => void rate(item.filmId, rating)}
                  size={16}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void addToWatchlist(item.filmId)}
                >
                  <Text className="font-body text-t12 text-reel">
                    {tFilm.addToWatchlist}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
