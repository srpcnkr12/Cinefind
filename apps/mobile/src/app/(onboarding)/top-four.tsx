import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { searchFilms, type SearchFilmResult } from "@reelmate/api/films";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import { TOP_FOUR_COUNT } from "@reelmate/core/domain/profile";
import { trackEvent } from "@reelmate/core/domain/analytics";

export default function TopFourScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchFilmResult[]>([]);
  const [selected, setSelected] = useState<SearchFilmResult[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    const found = await searchFilms(supabase, text, 10);
    setResults(found);
  }

  function toggleSelect(film: SearchFilmResult) {
    setSelected((prev) => {
      if (prev.some((f) => f.filmId === film.filmId)) {
        return prev.filter((f) => f.filmId !== film.filmId);
      }
      if (prev.length >= TOP_FOUR_COUNT) return prev;
      return [...prev, film];
    });
  }

  async function onContinue() {
    if (selected.length !== TOP_FOUR_COUNT) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_top_four", {
      film_ids: selected.map((f) => f.filmId),
    });
    setSaving(false);
    if (!error) {
      trackEvent("top_four_set", {});
      await completeStep("prompts");
    }
  }

  return (
    <OnboardingLayout
      title={t.topFourTitle}
      body={t.topFourBody}
      footer={
        <ContinueButton
          label={`${tCommon.continue} (${t.topFourCount.replace("{count}", String(selected.length))})`}
          onPress={onContinue}
          disabled={selected.length !== TOP_FOUR_COUNT || saving}
        />
      }
    >
      <TextInput
        value={query}
        onChangeText={onSearch}
        placeholder={t.searchFilmsPlaceholder}
        className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
      />

      {selected.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((film) => (
            <Pressable
              key={film.filmId}
              onPress={() => toggleSelect(film)}
              className="w-16"
            >
              <View className="aspect-[2/3] overflow-hidden rounded-poster bg-surface-1-light dark:bg-surface-1-dark">
                {film.posterPath ? (
                  <Image
                    source={{
                      uri: tmdbImageUrl(film.posterPath, "w185") ?? undefined,
                    }}
                    className="h-full w-full"
                  />
                ) : null}
              </View>
              <Text className="text-center font-body text-t14 text-ink dark:text-screen">
                ×
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        {results.map((film) => {
          const isSelected = selected.some((f) => f.filmId === film.filmId);
          return (
            <Pressable
              key={film.filmId}
              onPress={() => toggleSelect(film)}
              className={`flex-row items-center gap-3 rounded-card border px-3 py-2 ${isSelected ? "border-reel" : "border-celluloid"}`}
            >
              <Text className="flex-1 font-body text-t14 text-ink dark:text-screen">
                {film.title} {film.releaseYear ? `(${film.releaseYear})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
