import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { getWeeklyStats, type WeeklyStats } from "@reelmate/api/monetization";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

/**
 * PRD 5.3 "Haftalık istatistik (premium, ücretsizde kısmi)" — ücretsizde
 * yalnızca sayısal alanlar, premium'da görüntüleyenler + bölgesel sıralama
 * da eklenir (PRD 13.1). Kilitli alana dokunma, 13.3'ün paywall
 * tetikleyicilerinden biri.
 */
export default function WeeklyStatsScreen() {
  const t = useMessages().premium;
  const tCommon = useMessages().common;
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  const load = useCallback(async () => {
    setStats(await getWeeklyStats(supabase));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isPremium = stats ? stats.viewers !== null : false;

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
        <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
          {t.weeklyStatsTitle}
        </Text>

        {stats ? (
          <>
            <StatRow
              label={t.weeklyStatsProfileViews}
              value={String(stats.profileViewsThisWeek)}
            />
            <StatRow
              label={t.weeklyStatsMatches}
              value={String(stats.matchesThisWeek)}
            />
            {stats.topPost ? (
              <StatRow
                label={t.weeklyStatsTopPost}
                value={`${stats.topPost.likeCount + stats.topPost.commentCount}`}
              />
            ) : null}
            {stats.topMatchFilm ? (
              <StatRow
                label={t.weeklyStatsTopMatchFilm}
                value={stats.topMatchFilm.title}
              />
            ) : null}

            {isPremium ? (
              <>
                <Text className="mt-2 font-body-semibold text-t14 text-ink dark:text-screen">
                  {t.weeklyStatsViewers}
                </Text>
                {(stats.viewers ?? []).length === 0 ? (
                  <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
                    {t.weeklyStatsNoData}
                  </Text>
                ) : (
                  (stats.viewers ?? []).map((viewer) => (
                    <Text
                      key={viewer.userId}
                      className="font-body text-t14 text-ink dark:text-screen"
                    >
                      {viewer.displayName ?? "?"}
                    </Text>
                  ))
                )}
                {stats.regionalRank !== null ? (
                  <StatRow
                    label={t.weeklyStatsRegionalRank}
                    value={`%${stats.regionalRank}`}
                  />
                ) : null}
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push("/premium/paywall?trigger=weekly_stats_locked")
                }
                className="mt-2 items-center rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark"
              >
                <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
                  {t.weeklyStatsLocked}
                </Text>
                <Text className="mt-1 font-body-semibold text-t14 text-reel">
                  {t.weeklyStatsUnlock}
                </Text>
              </Pressable>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
      <Text className="font-body text-t14 text-ink dark:text-screen">
        {label}
      </Text>
      <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
        {value}
      </Text>
    </View>
  );
}
