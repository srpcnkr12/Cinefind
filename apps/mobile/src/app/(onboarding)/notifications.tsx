import { useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

export default function NotificationsScreen() {
  const t = useMessages().onboarding;
  const [saving, setSaving] = useState(false);

  async function registerDeviceToken() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("device_tokens").upsert(
      {
        user_id: user.id,
        token: token.data,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      { onConflict: "user_id,token" },
    );
  }

  async function finish() {
    setSaving(true);
    await registerDeviceToken().catch(() => undefined);
    setSaving(false);
    await completeStep("completed");
  }

  return (
    <OnboardingLayout
      title={t.notificationsTitle}
      body={t.notificationsBody}
      footer={
        <ContinueButton
          label={t.enableNotifications}
          onPress={finish}
          disabled={saving}
        />
      }
    >
      <ContinueButton
        label={t.notNow}
        variant="secondary"
        onPress={() => void completeStep("completed")}
        disabled={saving}
      />
    </OnboardingLayout>
  );
}
