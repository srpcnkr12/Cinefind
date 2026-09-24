import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMessages } from "@/lib/i18n";

export default function WelcomeScreen() {
  const t = useMessages().auth;
  const tCommon = useMessages().common;
  const [step, setStep] = useState(0);

  const slides = [
    { title: t.welcomeTitle1, body: t.welcomeBody1 },
    { title: t.welcomeTitle2, body: t.welcomeBody2 },
    { title: t.welcomeTitle3, body: t.welcomeBody3 },
  ];
  const isLast = step === slides.length - 1;
  const current = slides[step];

  return (
    <SafeAreaView
      className="flex-1 justify-between bg-screen px-6 py-8 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row gap-2">
        {slides.map((slide, i) => (
          <View
            key={slide.title}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-reel" : "bg-surface-2"}`}
          />
        ))}
      </View>

      <View className="gap-4">
        <Text className="font-display text-3xl font-bold text-ink dark:text-screen">
          {current?.title}
        </Text>
        <Text className="font-body text-base text-ink dark:text-screen">
          {current?.body}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          isLast ? router.push("/(auth)/sign-in") : setStep((s) => s + 1)
        }
        className="items-center rounded-button bg-reel px-5 py-4"
      >
        <Text className="font-body-semibold text-t16 text-white">
          {isLast ? t.getStarted : tCommon.continue}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
