import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type MatchInfo = {
  otherDisplayName: string | null;
  filmTitle: string | null;
  filmPosterPath: string | null;
};

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const t = useMessages().match;
  const [info, setInfo] = useState<MatchInfo | null>(null);
  const scale = useSharedValue(0.8);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: match } = await supabase
      .from("matches")
      .select("user_low, user_high, reasons")
      .eq("id", matchId)
      .maybeSingle();
    if (!match || !user) return;

    const otherId =
      match.user_low === user.id ? match.user_high : match.user_low;
    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle();

    const reasons = (match.reasons ?? []) as {
      type: string;
      filmId?: string;
    }[];
    const sharedFavorite = reasons.find(
      (r) => r.type === "shared_favorite" && r.filmId,
    );
    let filmTitle: string | null = null;
    let filmPosterPath: string | null = null;
    if (sharedFavorite?.filmId) {
      const { data: film } = await supabase
        .from("films")
        .select("original_title, poster_path")
        .eq("id", sharedFavorite.filmId)
        .maybeSingle();
      filmTitle = film?.original_title ?? null;
      filmPosterPath = film?.poster_path ?? null;
    }

    setInfo({
      otherDisplayName: otherProfile?.display_name ?? null,
      filmTitle,
      filmPosterPath,
    });
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    scale.value = withSpring(1);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const posterUrl = info?.filmPosterPath
    ? tmdbImageUrl(info.filmPosterPath, "w500")
    : null;

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-4 bg-ink px-6"
      edges={["top", "bottom"]}
    >
      <Animated.View style={animatedStyle} className="items-center gap-4">
        <Text className="font-display text-3xl font-bold text-screen">
          {t.title}
        </Text>
        {info?.otherDisplayName ? (
          <Text className="font-body text-t16 text-screen">
            {t.subtitle.replace("{name}", info.otherDisplayName)}
          </Text>
        ) : null}
        {info?.filmTitle ? (
          <View className="items-center gap-2">
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                className="h-56 w-40 rounded-poster"
              />
            ) : null}
            <Text className="font-body text-t14 text-screen">
              {t.sharedFavorite.replace("{film}", info.filmTitle)}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/(tabs)/chats")}
        className="mt-6 rounded-button bg-ticket px-6 py-3"
      >
        <Text className="font-body-semibold text-t14 text-ink">
          {t.sendMessage}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/(tabs)/discover")}
      >
        <Text className="font-body text-t14 text-screen underline">
          {t.keepSwiping}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
