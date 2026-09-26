import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colorScheme, useColorScheme } from "nativewind";
import { router, useFocusEffect } from "expo-router";
import {
  getMyProfileSummary,
  type MyProfileSummary,
} from "@reelmate/api/profile";
import { getMyFilmStats } from "@reelmate/api/user-films";
import { tmdbImageUrl, type Locale } from "@reelmate/core/domain/film";
import type { FilmStats } from "@reelmate/core/domain/sinematek";
import { resolveLocale, useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const t = useMessages();
  const tProfile = t.profile;
  const locale: Locale = resolveLocale();
  const { colorScheme: current } = useColorScheme();
  const [profile, setProfile] = useState<MyProfileSummary | null>(null);
  const [stats, setStats] = useState<FilmStats | null>(null);

  const load = useCallback(async () => {
    const [summary, filmStats] = await Promise.all([
      getMyProfileSummary(supabase, locale),
      getMyFilmStats(supabase),
    ]);
    setProfile(summary);
    setStats(filmStats);
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const menu: { label: string; onPress: () => void; tone?: "danger" }[] = [
    {
      label: t.notifications.title,
      onPress: () => router.push("/(tabs)/profile/notifications"),
    },
    {
      label: t.premium.goPremium,
      onPress: () => router.push("/premium/paywall?trigger=menu"),
    },
    {
      label: t.premium.weeklyStatsTitle,
      onPress: () => router.push("/premium/weekly-stats"),
    },
    { label: t.settings.title, onPress: () => router.push("/settings") },
    {
      label: current === "dark" ? t.theme.light : t.theme.dark,
      onPress: () => colorScheme.set(current === "dark" ? "light" : "dark"),
    },
    {
      label: t.common.signOut,
      onPress: () => void supabase.auth.signOut(),
      tone: "danger",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-screen dark:bg-ink" edges={["top"]}>
      <ScrollView contentContainerClassName="gap-5 px-6 pb-10 pt-4">
        {/* Kimlik kartı */}
        <View className="flex-row items-center gap-4">
          {profile?.photoUrl ? (
            <Image
              source={{ uri: profile.photoUrl }}
              className="h-24 w-24 rounded-full bg-surface-2-light dark:bg-surface-2-dark"
              resizeMode="cover"
            />
          ) : (
            <View className="h-24 w-24 rounded-full bg-surface-2-light dark:bg-surface-2-dark" />
          )}
          <View className="flex-1 gap-1">
            <Text
              className="font-display text-t28 text-ink dark:text-screen"
              accessibilityRole="header"
              numberOfLines={1}
            >
              {profile?.displayName ?? t.common.appName}
              {profile?.age ? `, ${profile.age}` : ""}
            </Text>
            {profile?.username ? (
              <Text className="font-body text-t14 text-reel">
                @{profile.username}
              </Text>
            ) : null}
            {profile?.city ? (
              <Text className="font-body text-t14 text-ink/60 dark:text-screen/60">
                {profile.city}
              </Text>
            ) : null}
          </View>
        </View>

        <Text className="font-body text-t14 leading-5 text-ink dark:text-screen">
          {profile?.bio && profile.bio.length > 0
            ? profile.bio
            : tProfile.bioEmpty}
        </Text>

        {/* İstatistik şeridi */}
        <View className="flex-row gap-3">
          {[
            {
              value: String(stats?.totalWatched ?? 0),
              label: tProfile.filmsWatched,
            },
            {
              value: stats?.averageRating
                ? stats.averageRating.toFixed(1)
                : "—",
              label: tProfile.avgRating,
            },
            {
              value: String(stats?.totalWatchlist ?? 0),
              label: tProfile.inWatchlist,
            },
          ].map((tile) => (
            <View
              key={tile.label}
              className="flex-1 items-center gap-1 rounded-card bg-surface-1-light py-3 dark:bg-surface-1-dark"
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

        {/* Kadrajım — PRD 3.1: profilin görsel imzası */}
        <View className="gap-2">
          <Text className="font-body-semibold text-t16 text-ink dark:text-screen">
            {tProfile.kadrajim}
          </Text>
          {profile && profile.kadrajim.length > 0 ? (
            <View className="flex-row gap-2">
              {profile.kadrajim.map((film) => {
                const posterUrl = tmdbImageUrl(film.posterPath, "w185");
                return (
                  <View key={film.filmId} className="flex-1 gap-1">
                    {posterUrl ? (
                      <Image
                        source={{ uri: posterUrl }}
                        className="aspect-[2/3] w-full rounded-poster bg-surface-2-light dark:bg-surface-2-dark"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="aspect-[2/3] w-full rounded-poster bg-surface-2-light dark:bg-surface-2-dark" />
                    )}
                    <Text
                      className="font-body text-t12 text-ink/70 dark:text-screen/70"
                      numberOfLines={2}
                    >
                      {film.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="font-body text-t14 text-ink/60 dark:text-screen/60">
              {tProfile.kadrajimEmpty}
            </Text>
          )}
        </View>

        {/* Hesap menüsü */}
        <View className="gap-2">
          <Text className="font-body-semibold text-t16 text-ink dark:text-screen">
            {tProfile.menu}
          </Text>
          {menu.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={item.onPress}
              className="rounded-card bg-surface-1-light px-4 py-4 dark:bg-surface-1-dark"
            >
              <Text
                className={`font-body-semibold text-t14 ${item.tone === "danger" ? "text-danger" : "text-ink dark:text-screen"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
