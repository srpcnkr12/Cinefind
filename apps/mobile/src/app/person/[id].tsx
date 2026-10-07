import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getPersonBySlug, type PersonDetail } from "@movieholix/api/films";
import { tmdbImageUrl, type Locale } from "@movieholix/core/domain/film";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function PersonDetailScreen() {
  const { id: slug } = useLocalSearchParams<{ id: string }>();
  const locale: Locale = resolveLocale();
  const t = useMessages().personScreen;
  const tCommon = useMessages().common;
  const [person, setPerson] = useState<PersonDetail | null | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    setPerson(await getPersonBySlug(supabase, slug, locale));
  }, [slug, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (person === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (person === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <Text className="font-body text-ink dark:text-screen">
          {t.notFound}
        </Text>
      </SafeAreaView>
    );
  }

  const photoUrl = tmdbImageUrl(person.profilePath, "w185");

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <FlatList
        data={person.filmography}
        keyExtractor={(item) => `${item.role}-${item.id}`}
        contentContainerClassName="gap-3 px-6 pb-10"
        ListHeaderComponent={
          <View className="gap-3 pb-4 pt-4">
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text className="font-body text-t14 text-ink dark:text-screen">
                {tCommon.back}
              </Text>
            </Pressable>
            <View className="flex-row items-center gap-4">
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  className="h-24 w-24 rounded-full bg-surface-2-light dark:bg-surface-2-dark"
                />
              ) : (
                <View className="h-24 w-24 rounded-full bg-surface-2-light dark:bg-surface-2-dark" />
              )}
              <Text className="flex-1 font-display text-xl font-bold text-ink dark:text-screen">
                {person.name}
              </Text>
            </View>
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {t.filmography}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const posterUrl = tmdbImageUrl(item.posterPath, "w185");
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/film/${item.slug}`)}
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
                  {item.title}
                </Text>
                {item.releaseYear ? (
                  <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                    {item.releaseYear}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
