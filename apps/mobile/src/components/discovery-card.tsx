import { Image, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { DiscoveryCandidate, SwipeAction } from "@reelmate/api/discovery";
import { tmdbImageUrl } from "@reelmate/core/domain/film";
import { useMessages } from "@/lib/i18n";

const SWIPE_THRESHOLD = 120;
const SCREEN_EXIT_DISTANCE = 500;

type Props = {
  candidate: DiscoveryCandidate;
  onSwipe: (action: SwipeAction) => void;
};

export function DiscoveryCard({ candidate, onSwipe }: Props) {
  const t = useMessages().discover;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  function finish(action: SwipeAction) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwipe(action);
  }

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onFinalize((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_EXIT_DISTANCE, { duration: 200 });
        runOnJS(finish)("like");
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_EXIT_DISTANCE, { duration: 200 });
        runOnJS(finish)("pass");
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value / 20}deg` },
    ],
  }));

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, translateX.value / SWIPE_THRESHOLD)),
  }));
  const passStampStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, -translateX.value / SWIPE_THRESHOLD)),
  }));

  const photoUrl = candidate.photoUrl;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={cardStyle}
        className="absolute inset-0 overflow-hidden rounded-card bg-surface-1-light dark:bg-surface-1-dark"
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="h-3/5 w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-3/5 w-full bg-surface-2-light dark:bg-surface-2-dark" />
        )}

        <Animated.View
          style={likeStampStyle}
          className="absolute left-6 top-10 rotate-[-15deg] rounded-md border-4 border-success px-3 py-1"
        >
          <Text className="font-display text-xl font-bold text-success">
            {t.stampLike}
          </Text>
        </Animated.View>
        <Animated.View
          style={passStampStyle}
          className="absolute right-6 top-10 rotate-[15deg] rounded-md border-4 border-danger px-3 py-1"
        >
          <Text className="font-display text-xl font-bold text-danger">
            {t.stampPass}
          </Text>
        </Animated.View>

        <View className="flex-1 gap-2 p-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
              {candidate.displayName ?? "—"}
              {candidate.age ? `, ${candidate.age}` : ""}
            </Text>
            <Text className="font-body text-t14 text-ink/60 dark:text-screen/60">
              {candidate.distanceBucket === "<1"
                ? t.distanceUnder1
                : `${candidate.distanceBucket} km`}
            </Text>
          </View>

          <Text className="font-body-semibold text-t14 text-reel">
            {t.compatLabel.replace(
              "{percent}",
              String(candidate.compatPercent),
            )}
          </Text>

          {candidate.intents.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {candidate.intents.map((intent) => (
                <View
                  key={intent}
                  className="rounded-full bg-surface-2-light px-3 py-1 dark:bg-surface-2-dark"
                >
                  <Text className="font-body text-t12 text-ink dark:text-screen">
                    {intent}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {candidate.topFourFilms && candidate.topFourFilms.length > 0 ? (
            <View className="flex-row gap-1">
              {candidate.topFourFilms.map((film) => {
                const posterUrl = tmdbImageUrl(film.posterPath, "w185");
                return posterUrl ? (
                  <Image
                    key={film.filmId}
                    source={{ uri: posterUrl }}
                    className="h-16 w-11 rounded-md bg-surface-2-light dark:bg-surface-2-dark"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    key={film.filmId}
                    className="h-16 w-11 rounded-md bg-surface-2-light dark:bg-surface-2-dark"
                  />
                );
              })}
            </View>
          ) : null}

          {candidate.reasons.length > 0 ? (
            <Text
              className="font-body text-t12 text-ink/70 dark:text-screen/70"
              numberOfLines={2}
            >
              {t.reasonPrefix} {candidate.reasons.length} {t.reasonSuffix}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
