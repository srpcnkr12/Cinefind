import "../global.css";
import "../lib/nativewind-interop";

import {
  useFonts as useBigShouldersDisplay,
  BigShouldersDisplay_700Bold,
} from "@expo-google-fonts/big-shoulders-display";
import {
  useFonts as useHankenGrotesk,
  HankenGrotesk_400Regular,
  HankenGrotesk_600SemiBold,
} from "@expo-google-fonts/hanken-grotesk";
import { Slot } from "expo-router";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { trackEvent } from "@movieholix/core/domain/analytics";
import { AnalyticsProvider } from "@/lib/analytics";
import { useTouchLastActive } from "@/lib/last-active";
import { initSentry } from "@/lib/sentry";

SplashScreen.preventAutoHideAsync();
initSentry();

function RootLayout() {
  const [displayLoaded] = useBigShouldersDisplay({
    BigShouldersDisplay_700Bold,
  });
  const [bodyLoaded] = useHankenGrotesk({
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
  });
  const fontsLoaded = displayLoaded && bodyLoaded;

  useTouchLastActive();

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
      trackEvent("app_opened", {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AnalyticsProvider>
        <SafeAreaProvider>
          <Slot />
        </SafeAreaProvider>
      </AnalyticsProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
