import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import {
  MAX_FAVORITE_GENRES,
  MIN_FAVORITE_GENRES,
  type GenreOption,
} from "@movieholix/core/domain/profile";

export default function GenresScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [genres, setGenres] = useState<GenreOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.rpc("get_genres").then(({ data }) => {
      setGenres((data as GenreOption[] | null) ?? []);
    });
  }, []);

  function toggle(genreId: string) {
    setSelected((prev) => {
      if (prev.includes(genreId)) return prev.filter((id) => id !== genreId);
      if (prev.length >= MAX_FAVORITE_GENRES) return prev;
      return [...prev, genreId];
    });
  }

  async function onContinue() {
    if (selected.length < MIN_FAVORITE_GENRES) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ favorite_genre_ids: selected })
      .eq("id", user?.id ?? "");
    setSaving(false);
    if (!error) await completeStep("taste-test");
  }

  if (!genres) {
    return (
      <View className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <OnboardingLayout
      title={t.genresTitle}
      body={t.genresBody}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={onContinue}
          disabled={selected.length < MIN_FAVORITE_GENRES || saving}
        />
      }
    >
      <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
        {t.genresMinHint}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {genres.map((genre) => {
          const isSelected = selected.includes(genre.id);
          return (
            <Pressable
              key={genre.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => toggle(genre.id)}
              hitSlop={8}
              className={`rounded-full border px-4 py-3 ${isSelected ? "border-reel bg-reel" : "border-celluloid"}`}
            >
              <Text
                className={`font-body-semibold text-t14 ${isSelected ? "text-white" : "text-ink dark:text-screen"}`}
              >
                {genre.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
