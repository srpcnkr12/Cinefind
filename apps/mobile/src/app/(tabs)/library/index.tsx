import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getMyDiary,
  getMyFilmLines,
  getMyFilmStats,
  getMyLibrary,
  type DiaryEntryItem,
  type FilmLineItem,
  type LibraryEntry,
} from "@reelmate/api/user-films";
import { tmdbImageUrl, type Locale } from "@reelmate/core/domain/film";
import type { FilmStats } from "@reelmate/core/domain/sinematek";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type Segment = "watched" | "watchlist" | "diary" | "lines" | "stats";

export default function LibraryScreen() {
  const t = useMessages().library;
  const tTabs = useMessages().tabs;
  const locale: Locale = resolveLocale();
  const [segment, setSegment] = useState<Segment>("watched");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [diary, setDiary] = useState<DiaryEntryItem[]>([]);
  const [lines, setLines] = useState<FilmLineItem[]>([]);
  const [stats, setStats] = useState<FilmStats | null>(null);

  const load = useCallback(async () => {
    if (segment === "watched" || segment === "watchlist") {
      setLibrary(await getMyLibrary(supabase, locale));
    } else if (segment === "diary") {
      setDiary(await getMyDiary(supabase, locale));
    } else if (segment === "lines") {
      setLines(await getMyFilmLines(supabase, locale));
    } else {
      setStats(await getMyFilmStats(supabase));
    }
  }, [segment, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const segments: { key: Segment; label: string }[] = [
    { key: "watched", label: t.segmentWatched },
    { key: "watchlist", label: t.segmentWatchlist },
    { key: "diary", label: t.segmentDiary },
    { key: "lines", label: t.segmentLines },
    { key: "stats", label: t.segmentStats },
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
          {tTabs.library}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/library/search")}
          className="rounded-button bg-reel px-4 py-2"
        >
          <Text className="font-body-semibold text-t14 text-white">
            {t.addFilm}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-6 py-4"
      >
        {segments.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            onPress={() => setSegment(s.key)}
            className={`rounded-button px-4 py-2 ${segment === s.key ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
          >
            <Text
              className={`font-body-semibold text-t12 ${segment === s.key ? "text-white" : "text-ink dark:text-screen"}`}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {segment === "watched" || segment === "watchlist" ? (
        <LibraryList
          entries={library.filter((e) => e.status === segment)}
          emptyText={segment === "watched" ? t.emptyWatched : t.emptyWatchlist}
        />
      ) : null}
      {segment === "diary" ? (
        <DiaryList entries={diary} emptyText={t.emptyDiary} />
      ) : null}
      {segment === "lines" ? (
        <LinesList entries={lines} emptyText={t.emptyLines} />
      ) : null}
      {segment === "stats" ? <StatsView stats={stats} /> : null}
    </SafeAreaView>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="flex-1 items-center justify-center px-10">
      <Text className="text-center font-body text-t14 text-ink dark:text-screen">
        {text}
      </Text>
    </View>
  );
}

function LibraryList({
  entries,
  emptyText,
}: {
  entries: LibraryEntry[];
  emptyText: string;
}) {
  if (entries.length === 0) return <EmptyState text={emptyText} />;
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.film.id}
      contentContainerClassName="gap-3 px-6 pb-8"
      renderItem={({ item }) => (
        <FilmRow
          slug={item.film.slug}
          title={item.film.title}
          subtitle={
            item.film.releaseYear ? String(item.film.releaseYear) : null
          }
          posterPath={item.film.posterPath}
          trailing={item.rating ? `★ ${item.rating}` : null}
        />
      )}
    />
  );
}

function DiaryList({
  entries,
  emptyText,
}: {
  entries: DiaryEntryItem[];
  emptyText: string;
}) {
  if (entries.length === 0) return <EmptyState text={emptyText} />;
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-3 px-6 pb-8"
      renderItem={({ item }) => (
        <FilmRow
          slug={item.film.slug}
          title={item.film.title}
          subtitle={item.watchedOn}
          posterPath={item.film.posterPath}
          trailing={item.rating ? `★ ${item.rating}` : null}
        />
      )}
    />
  );
}

function LinesList({
  entries,
  emptyText,
}: {
  entries: FilmLineItem[];
  emptyText: string;
}) {
  if (entries.length === 0) return <EmptyState text={emptyText} />;
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-3 px-6 pb-8"
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/film/${item.film.slug}`)}
          className="rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark"
        >
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            &ldquo;{item.text}&rdquo;
          </Text>
          <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
            {item.film.title}
            {item.characterName ? ` · ${item.characterName}` : ""}
          </Text>
        </Pressable>
      )}
    />
  );
}

function FilmRow({
  slug,
  title,
  subtitle,
  posterPath,
  trailing,
}: {
  slug: string;
  title: string;
  subtitle: string | null;
  posterPath: string | null;
  trailing: string | null;
}) {
  const posterUrl = tmdbImageUrl(posterPath, "w185");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/film/${slug}`)}
      className="flex-row items-center gap-3 rounded-card bg-surface-1-light p-3 dark:bg-surface-1-dark"
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
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text className="font-body-semibold text-t12 text-popcorn">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

function StatsView({ stats }: { stats: FilmStats | null }) {
  const t = useMessages().library;
  if (!stats || stats.totalWatched === 0) {
    return <EmptyState text={t.statsNoData} />;
  }
  const rows: { label: string; value: string }[] = [
    { label: t.statsWatched, value: String(stats.totalWatched) },
    { label: t.statsWatchlist, value: String(stats.totalWatchlist) },
    {
      label: t.statsAverageRating,
      value: stats.averageRating ? stats.averageRating.toFixed(1) : "—",
    },
    { label: t.statsRewatches, value: String(stats.rewatchCount) },
  ];
  if (stats.topGenres[0]) {
    rows.push({ label: t.statsTopGenre, value: stats.topGenres[0].slug });
  }
  if (stats.topDecade !== null) {
    rows.push({ label: t.statsTopDecade, value: `${stats.topDecade}s` });
  }
  return (
    <ScrollView contentContainerClassName="gap-3 px-6 pb-8">
      {rows.map((row) => (
        <View
          key={row.label}
          className="flex-row items-center justify-between rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
        >
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {row.label}
          </Text>
          <Text className="font-body-semibold text-t16 text-ink dark:text-screen">
            {row.value}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
