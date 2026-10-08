import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  addSharedWatchlistItem,
  getSharedWatchlist,
} from "@movieholix/api/chat";
import {
  listFilmsByIds,
  searchFilms,
  type FilmListItem,
  type SearchFilmResult,
} from "@movieholix/api/films";
import { tmdbImageUrl } from "@movieholix/core/domain/film";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

/**
 * PRD 5.2 `shared-watchlist/[matchId]` + 5.3 sohbet menüsündeki "ortak liste".
 * Arka uç (tablo, RLS, `add_shared_watchlist_item` RPC'si, API fonksiyonları)
 * Faz 6'da yazılmıştı ama hiçbir ekran çağırmıyordu.
 */
type Entry = FilmListItem & { addedByMe: boolean };

export default function SharedWatchlistScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const t = useMessages().sharedWatchlist;
  const tCommon = useMessages().common;
  const locale = resolveLocale();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFilmResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const items = await getSharedWatchlist(supabase, matchId);
    const films = await listFilmsByIds(
      supabase,
      locale,
      items.map((i) => i.filmId),
    );
    const byId = new Map(films.map((f) => [f.id, f]));
    // getSharedWatchlist en yeniden eskiye sıralı döner; o sırayı koruyoruz.
    setEntries(
      items.flatMap((item) => {
        const film = byId.get(item.filmId);
        return film ? [{ ...film, addedByMe: item.addedBy === user?.id }] : [];
      }),
    );
  }, [matchId, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await searchFilms(supabase, text, 20));
  }

  async function add(filmId: string) {
    if (!matchId) return;
    setError(null);
    try {
      await addSharedWatchlistItem(supabase, matchId, filmId);
      setQuery("");
      setResults([]);
      await load();
    } catch {
      setError(t.addError);
    }
  }

  const alreadyAdded = new Set(entries.map((e) => e.id));

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
      <Text className="px-6 pt-1 font-body text-t12 text-ink/60 dark:text-screen/60">
        {t.subtitle}
      </Text>

      <View className="px-6 pt-4">
        <TextInput
          value={query}
          onChangeText={(text) => void onSearch(text)}
          placeholder={t.searchPlaceholder}
          accessibilityLabel={t.searchPlaceholder}
          className="rounded-button border border-ink/20 px-4 py-3 font-body text-t14 text-ink dark:border-screen/20 dark:text-screen"
        />
      </View>

      {error ? (
        <Text className="px-6 pt-2 font-body text-t12 text-danger">
          {error}
        </Text>
      ) : null}

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.filmId}
          contentContainerClassName="gap-2 px-6 py-4"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const added = alreadyAdded.has(item.filmId);
            return (
              <View className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark">
                <Poster path={item.posterPath} />
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: added }}
                  disabled={added}
                  onPress={() => void add(item.filmId)}
                  className={`min-h-11 justify-center rounded-button px-4 ${
                    added ? "bg-ink/10 dark:bg-screen/10" : "bg-reel"
                  }`}
                >
                  <Text
                    className={`font-body-semibold text-t12 ${
                      added ? "text-ink/50 dark:text-screen/50" : "text-white"
                    }`}
                  >
                    {added ? t.added : t.add}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-2 px-6 py-4"
          ListEmptyComponent={
            <Text className="font-body text-t14 text-ink/60 dark:text-screen/60">
              {t.empty}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/film/${item.id}`)}
              className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark"
            >
              <Poster path={item.posterPath} />
              <View className="flex-1">
                <Text
                  className="font-body-semibold text-t14 text-ink dark:text-screen"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                  {[item.releaseYear, item.addedByMe ? t.addedByYou : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Poster({ path }: { path: string | null }) {
  const url = tmdbImageUrl(path, "w185");
  return url ? (
    <Image
      source={{ uri: url }}
      className="h-20 w-14 rounded-md bg-surface-2-light dark:bg-surface-2-dark"
    />
  ) : (
    <View className="h-20 w-14 rounded-md bg-surface-2-light dark:bg-surface-2-dark" />
  );
}
