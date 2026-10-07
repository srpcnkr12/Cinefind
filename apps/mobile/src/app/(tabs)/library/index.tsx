import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
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
} from "@movieholix/api/user-films";
import { tmdbImageUrl, type Locale } from "@movieholix/core/domain/film";
import type { FilmStats } from "@movieholix/core/domain/sinematek";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

// "İstatistik" artık bir sekme değil, listenin üstünde sabit duran bir şerit:
// beş sekme yatay kaydırmaya sığmıyor ve etiketleri kırpılıyordu. Kalan dördü
// eşit genişlikte tek satıra sığıyor.
type Segment = "watched" | "watchlist" | "diary" | "lines";

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
    // İstatistik şeridi her sekmede görünüyor, o yüzden segmentten bağımsız çekiliyor.
    setStats(await getMyFilmStats(supabase));
    if (segment === "watched" || segment === "watchlist") {
      setLibrary(await getMyLibrary(supabase, locale));
    } else if (segment === "diary") {
      setDiary(await getMyDiary(supabase, locale));
    } else {
      setLines(await getMyFilmLines(supabase, locale));
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

      <StatsStrip stats={stats} />

      {/* Dört sekme eşit genişlikte tek satıra sığıyor; yatay kaydırma ve
          etiket kırpılması bu yüzden kaldırıldı. */}
      <View className="flex-row gap-1.5 px-6 pb-3 pt-4">
        {segments.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === s.key }}
            onPress={() => setSegment(s.key)}
            className={`flex-1 items-center rounded-button py-2.5 ${segment === s.key ? "bg-reel" : "bg-surface-1-light dark:bg-surface-1-dark"}`}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`font-body-semibold text-t12 ${segment === s.key ? "text-white" : "text-ink dark:text-screen"}`}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
    </SafeAreaView>
  );
}

/** Listenin üstünde sabit duran özet şerit (eski "İstatistik" sekmesinin yerine). */
function StatsStrip({ stats }: { stats: FilmStats | null }) {
  const t = useMessages().library;
  const tiles = [
    { value: String(stats?.totalWatched ?? 0), label: t.stripWatched },
    {
      value: stats?.averageRating ? stats.averageRating.toFixed(1) : "—",
      label: t.stripAverage,
    },
    { value: String(stats?.rewatchCount ?? 0), label: t.stripRewatch },
  ];
  const topGenre = stats?.topGenres[0]?.slug;

  return (
    <View className="gap-2 px-6 pt-4">
      <View className="flex-row gap-3">
        {tiles.map((tile) => (
          <View
            key={tile.label}
            className="flex-1 items-center gap-0.5 rounded-card bg-surface-1-light py-3 dark:bg-surface-1-dark"
          >
            <Text className="font-display text-t20 text-ink dark:text-screen">
              {tile.value}
            </Text>
            <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
              {tile.label}
            </Text>
          </View>
        ))}
      </View>
      {topGenre && stats?.topDecade ? (
        <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
          {t.statsMore
            .replace("{genre}", topGenre)
            .replace("{decade}", String(stats.topDecade))}
        </Text>
      ) : null}
    </View>
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
