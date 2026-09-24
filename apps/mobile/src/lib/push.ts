import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import { supabase } from "./supabase";

/**
 * Faz 6: cihaz push token'ını kaydeder. Expo Go'da uzak push desteklenmiyor
 * (SDK 57) ve bu projede henüz bir EAS `projectId` yok — bu yüzden gerçek bir
 * cihaz/development build dışında `getExpoPushTokenAsync` başarısız olur.
 * Hata sessizce yutulur (push, uygulamanın çekirdek işlevi değil).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as
      string | undefined;
    if (!projectId) return;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("device_tokens").upsert(
      {
        user_id: user.id,
        token: token.data,
        platform: Platform.OS === "ios" ? "ios" : "android",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
  } catch {
    // Expo Go / EAS kurulumu olmadan burası her zaman başarısız olur — bkz. üstteki not.
  }
}

/** Bildirime dokununca doğru sohbete yönlendirir. */
export function subscribeToNotificationTaps(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const conversationId = response.notification.request.content.data
        ?.conversationId as string | undefined;
      if (conversationId) {
        router.push(`/(tabs)/chats/${conversationId}` as Href);
      }
    },
  );
  return () => subscription.remove();
}
