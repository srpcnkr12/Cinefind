import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getDiscoveryDeck,
  swipe,
  type DiscoveryCandidate,
  type SwipeAction,
} from "@movieholix/api/discovery";
import { activateBoost } from "@movieholix/api/monetization";
import { trackEvent } from "@movieholix/core/domain/analytics";
import { DiscoveryCard } from "@/components/discovery-card";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

function noop() {
  // Arkadaki (peek) kart etkileşimsizdir; yalnızca en üstteki kart kaydırılabilir.
}

export default function DiscoverScreen() {
  const t = useMessages().discover;
  const [deck, setDeck] = useState<DiscoveryCandidate[] | null>(null);
  const [index, setIndex] = useState(0);
  const [boostActive, setBoostActive] = useState(false);

  async function handleBoost() {
    try {
      const { endsAt } = await activateBoost(supabase);
      setBoostActive(true);
      const remainingMs = new Date(endsAt).getTime() - Date.now();
      setTimeout(() => setBoostActive(false), Math.max(0, remainingMs));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("no_boosts_available")) {
        router.push("/premium/paywall?trigger=no_boosts");
      } else {
        Alert.alert(t.boostNoBalance);
      }
    }
  }

  const load = useCallback(async () => {
    const cards = await getDiscoveryDeck(supabase);
    setDeck(cards);
    setIndex(0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (deck?.[index]) {
      trackEvent("discover_card_viewed", {});
    }
  }, [deck, index]);

  async function handleSwipe(action: SwipeAction) {
    const current = deck?.[index];
    if (!current) return;
    setIndex((i) => i + 1);
    try {
      const result = await swipe(
        supabase,
        current.userId,
        action,
        current.compatPercent,
        current.reasons.length,
      );
      if (result.matched && result.matchId) {
        router.push(`/match/${result.matchId}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (
        message.includes("daily_limit_reached") ||
        message.includes("daily_superlike_limit_reached")
      ) {
        trackEvent("swipe_limit_reached", {});
        router.push("/(tabs)/discover/limit-reached");
      }
    }
  }

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
          {t.title}
        </Text>
        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleBoost()}
          >
            <Text className="font-body-semibold text-t14 text-reel">
              {boostActive ? t.boostActiveLabel : t.boostTitle}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/discover/filters")}
          >
            <Text className="font-body-semibold text-t14 text-reel">
              {t.filters}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 px-6 py-4">
        {deck === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : index >= deck.length ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Text className="text-center font-body text-t16 text-ink dark:text-screen">
              {t.emptyDeck}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text className="font-body-semibold text-t14 text-reel">
                {t.refresh}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1">
            {(() => {
              const visible = deck.slice(index, index + 2).reverse();
              const topCardId = visible[visible.length - 1]?.userId;
              return visible.map((candidate) => (
                <DiscoveryCard
                  key={candidate.userId}
                  candidate={candidate}
                  onSwipe={candidate.userId === topCardId ? handleSwipe : noop}
                />
              ));
            })()}
          </View>
        )}
      </View>

      {deck !== null && index < deck.length ? (
        <View className="flex-row items-center justify-center gap-6 px-6 pb-6">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.pass}
            onPress={() => void handleSwipe("pass")}
            className="h-16 w-16 items-center justify-center rounded-full bg-surface-1-light dark:bg-surface-1-dark"
          >
            <Text className="text-2xl">{"✕"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.superlike}
            onPress={() => void handleSwipe("superlike")}
            className="h-14 w-14 items-center justify-center rounded-full bg-surface-1-light dark:bg-surface-1-dark"
          >
            <Text className="text-xl">{"★"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.like}
            onPress={() => void handleSwipe("like")}
            className="h-16 w-16 items-center justify-center rounded-full bg-reel"
          >
            <Text className="text-2xl text-white">{"♥"}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
