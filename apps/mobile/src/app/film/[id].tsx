import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getFilmBySlug, type FilmDetail } from "@movieholix/api/films";
import { getMyUserFilm } from "@movieholix/api/user-films";
import { tmdbImageUrl, type Locale } from "@movieholix/core/domain/film";
import type { DiaryVenue } from "@movieholix/core/domain/sinematek";
import { StarRating } from "@/components/star-rating";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { callOrQueue } from "@/lib/mutation-queue";
import { supabase } from "@/lib/supabase";

const VENUES: DiaryVenue[] = ["cinema", "home", "festival", "other"];

export default function FilmDetailScreen() {
  const { id: slug } = useLocalSearchParams<{ id: string }>();
  const locale: Locale = resolveLocale();
  const t = useMessages().filmScreen;
  const tLib = useMessages().library;
  const tCommon = useMessages().common;

  const [film, setFilm] = useState<FilmDetail | null | undefined>(undefined);
  const [rating, setRating] = useState<number | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [note, setNote] = useState("");
  const [venue, setVenue] = useState<DiaryVenue | null>(null);
  const [isRewatch, setIsRewatch] = useState(false);
  const [lineText, setLineText] = useState("");
  const [characterName, setCharacterName] = useState("");

  const load = useCallback(async () => {
    const detail = await getFilmBySlug(supabase, slug, locale);
    setFilm(detail);
    if (detail) {
      const mine = await getMyUserFilm(supabase, detail.id);
      setRating(mine?.rating ?? null);
    }
  }, [slug, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (film === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (film === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <Text className="font-body text-ink dark:text-screen">
          {t.notFound}
        </Text>
      </SafeAreaView>
    );
  }

  const filmData: FilmDetail = film;

  async function rate(newRating: number) {
    setRating(newRating);
    await callOrQueue("upsert_user_film", {
      p_film_id: filmData.id,
      p_status: "watched",
      p_rating: newRating,
      p_liked: newRating >= 3.5,
    });
  }

  async function addToWatchlist() {
    await callOrQueue("upsert_user_film", {
      p_film_id: filmData.id,
      p_status: "watchlist",
      p_rating: null,
      p_liked: null,
    });
  }

  async function saveDiaryEntry() {
    await callOrQueue("add_diary_entry", {
      p_film_id: filmData.id,
      p_watched_on: new Date().toISOString().slice(0, 10),
      p_rating: rating,
      p_is_rewatch: isRewatch,
      p_venue: venue,
      p_note: note.trim().length > 0 ? note.trim() : null,
      p_contains_spoiler: false,
    });
    setDiaryOpen(false);
    setNote("");
    setVenue(null);
    setIsRewatch(false);
  }

  async function saveLine() {
    if (lineText.trim().length === 0) return;
    await callOrQueue("add_film_line", {
      p_film_id: filmData.id,
      p_text: lineText.trim(),
      p_character_name:
        characterName.trim().length > 0 ? characterName.trim() : null,
      p_contains_spoiler: false,
    });
    setLineOpen(false);
    setLineText("");
    setCharacterName("");
  }

  const posterUrl = tmdbImageUrl(film.posterPath, "w500");

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <ScrollView contentContainerClassName="gap-4 px-6 pb-10 pt-4">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {tCommon.back}
          </Text>
        </Pressable>

        <View className="flex-row gap-4">
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              className="h-44 w-32 rounded-poster bg-surface-2-light dark:bg-surface-2-dark"
            />
          ) : (
            <View className="h-44 w-32 rounded-poster bg-surface-2-light dark:bg-surface-2-dark" />
          )}
          <View className="flex-1 gap-1">
            <Text className="font-display text-xl font-bold text-ink dark:text-screen">
              {film.title}
            </Text>
            {film.releaseYear ? (
              <Text className="font-body text-t14 text-ink/60 dark:text-screen/60">
                {film.releaseYear}
              </Text>
            ) : null}
            {film.genres.length > 0 ? (
              <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                {film.genres.map((g) => g.name).join(", ")}
              </Text>
            ) : null}
            {film.directors.length > 0 ? (
              <Text className="font-body text-t12 text-ink dark:text-screen">
                {t.director}: {film.directors.map((d) => d.name).join(", ")}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.yourRating}
          </Text>
          <StarRating value={rating} onChange={(r) => void rate(r)} />
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => void addToWatchlist()}
            className="rounded-button border border-ink px-4 py-2 dark:border-screen"
          >
            <Text className="font-body-semibold text-t12 text-ink dark:text-screen">
              {t.addToWatchlist}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDiaryOpen((v) => !v)}
            className="rounded-button border border-ink px-4 py-2 dark:border-screen"
          >
            <Text className="font-body-semibold text-t12 text-ink dark:text-screen">
              {t.addDiaryEntry}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLineOpen((v) => !v)}
            className="rounded-button border border-ink px-4 py-2 dark:border-screen"
          >
            <Text className="font-body-semibold text-t12 text-ink dark:text-screen">
              {t.addLine}
            </Text>
          </Pressable>
        </View>

        {diaryOpen ? (
          <View className="gap-3 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {tLib.diaryFormTitle}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {VENUES.map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="button"
                  onPress={() => setVenue(v)}
                  className={`rounded-button px-3 py-1.5 ${venue === v ? "bg-reel" : "bg-surface-2-light dark:bg-surface-2-dark"}`}
                >
                  <Text
                    className={`font-body text-t12 ${venue === v ? "text-white" : "text-ink dark:text-screen"}`}
                  >
                    {
                      tLib[
                        `diaryVenue${v.charAt(0).toUpperCase()}${v.slice(1)}` as "diaryVenueCinema"
                      ]
                    }
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isRewatch }}
              onPress={() => setIsRewatch((v) => !v)}
              className="flex-row items-center gap-2"
            >
              <View
                className={`h-5 w-5 rounded-sm border border-ink dark:border-screen ${isRewatch ? "bg-reel" : ""}`}
              />
              <Text className="font-body text-t12 text-ink dark:text-screen">
                {tLib.diaryRewatch}
              </Text>
            </Pressable>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={tLib.diaryNote}
              multiline
              className="rounded-button border border-celluloid px-3 py-2 font-body text-ink dark:text-screen"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void saveDiaryEntry()}
              className="items-center rounded-button bg-reel px-4 py-3"
            >
              <Text className="font-body-semibold text-t14 text-white">
                {tLib.diarySave}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {lineOpen ? (
          <View className="gap-3 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {tLib.lineFormTitle}
            </Text>
            <TextInput
              value={lineText}
              onChangeText={setLineText}
              placeholder={tLib.linePlaceholder}
              multiline
              maxLength={280}
              className="rounded-button border border-celluloid px-3 py-2 font-body text-ink dark:text-screen"
            />
            <TextInput
              value={characterName}
              onChangeText={setCharacterName}
              placeholder={tLib.lineCharacterPlaceholder}
              className="rounded-button border border-celluloid px-3 py-2 font-body text-ink dark:text-screen"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void saveLine()}
              className="items-center rounded-button bg-reel px-4 py-3"
            >
              <Text className="font-body-semibold text-t14 text-white">
                {tLib.lineSave}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {film.cast.length > 0 ? (
          <View className="gap-2">
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {t.cast}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-4">
                {film.cast.map((person) => (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/person/${person.slug}`)}
                    className="w-24"
                  >
                    <Text
                      className="font-body-semibold text-t12 text-ink dark:text-screen"
                      numberOfLines={1}
                    >
                      {person.name}
                    </Text>
                    {person.character ? (
                      <Text
                        className="font-body text-t12 text-ink/60 dark:text-screen/60"
                        numberOfLines={1}
                      >
                        {person.character}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
