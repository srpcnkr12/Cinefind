import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { tmdbImageUrl } from "@movieholix/core/domain/film";
import type {
  TasteReaction,
  TasteReactionInput,
} from "@movieholix/core/domain/profile";
import { MIN_TASTE_REACTIONS } from "@movieholix/core/domain/profile";
import { trackEvent } from "@movieholix/core/domain/analytics";

type DeckFilm = { film_id: string; title: string; poster_path: string | null };

export default function TasteTestScreen() {
  const t = useMessages().onboarding;
  const [deck, setDeck] = useState<DeckFilm[] | null>(null);
  const [index, setIndex] = useState(0);
  const [reactions, setReactions] = useState<TasteReactionInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    void supabase
      .rpc("get_taste_test_deck", { deck_size: 30 })
      .then(({ data }) => {
        setDeck((data as DeckFilm[] | null) ?? []);
      });
  }, []);

  const current = deck?.[index];
  const scoredCount = reactions.filter((r) => r.reaction !== undefined).length;
  const canFinish = scoredCount >= MIN_TASTE_REACTIONS;

  async function finish(finalReactions: TasteReactionInput[]) {
    setSubmitting(true);
    await supabase.rpc("submit_taste_reactions", { reactions: finalReactions });
    setSubmitting(false);
    trackEvent("taste_test_completed", {
      ratedCount: finalReactions.filter((r) => r.reaction).length,
      durationS: Math.round((Date.now() - startedAt) / 1000),
    });
    await completeStep("top-four");
  }

  function react(reaction: TasteReaction | "skip") {
    if (!current) return;
    const next =
      reaction === "skip"
        ? reactions
        : [...reactions, { filmId: current.film_id, reaction }];
    setReactions(next);

    const isLastCard = !deck || index >= deck.length - 1;
    const willMeetMinimum =
      next.filter((r) => r.reaction).length >= MIN_TASTE_REACTIONS;

    if (isLastCard || (willMeetMinimum && reaction !== "skip")) {
      void finish(next);
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!deck) {
    return (
      <View className="flex-1 items-center justify-center bg-screen dark:bg-ink">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <OnboardingLayout
      title={t.tasteTestTitle}
      body={t.tasteTestBody}
      footer={
        canFinish ? (
          <ContinueButton
            label={t.reactionSkip}
            variant="secondary"
            onPress={() => void finish(reactions)}
            disabled={submitting}
          />
        ) : undefined
      }
    >
      <Text className="font-body text-t14 text-ink dark:text-screen">
        {t.tasteTestProgress
          .replace("{current}", String(index + 1))
          .replace("{total}", String(deck.length))}
      </Text>

      {current ? (
        <View className="items-center gap-4">
          <View className="aspect-[2/3] w-48 overflow-hidden rounded-poster bg-surface-1-light dark:bg-surface-1-dark">
            {current.poster_path ? (
              <Image
                source={{
                  uri: tmdbImageUrl(current.poster_path, "w500") ?? undefined,
                }}
                className="h-full w-full"
              />
            ) : null}
          </View>
          <Text className="font-body-semibold text-t16 text-ink dark:text-screen">
            {current.title}
          </Text>

          <View className="w-full gap-2">
            <ContinueButton
              label={t.reactionLiked}
              onPress={() => react("liked")}
              disabled={submitting}
            />
            <ContinueButton
              label={t.reactionOk}
              variant="secondary"
              onPress={() => react("ok")}
              disabled={submitting}
            />
            <ContinueButton
              label={t.reactionDisliked}
              variant="secondary"
              onPress={() => react("disliked")}
              disabled={submitting}
            />
            <ContinueButton
              label={t.reactionSkip}
              variant="secondary"
              onPress={() => react("skip")}
              disabled={submitting}
            />
          </View>
        </View>
      ) : null}
    </OnboardingLayout>
  );
}
