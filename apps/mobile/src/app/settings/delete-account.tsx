import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { requestAccountDeletion } from "@movieholix/api/compliance";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function DeleteAccountScreen() {
  const t = useMessages().settings;
  const tCommon = useMessages().common;
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await requestAccountDeletion(supabase);
    await supabase.auth.signOut();
    router.replace("/(auth)/welcome");
  }

  function handlePress() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    Alert.alert(t.deleteAccountConfirmTitle, t.deleteAccountConfirmBody, [
      {
        text: tCommon.back,
        style: "cancel",
        onPress: () => setConfirming(false),
      },
      {
        text: t.deleteAccountConfirmCta,
        style: "destructive",
        onPress: () => void handleDelete(),
      },
    ]);
  }

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center gap-3 px-6 pt-4">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {tCommon.back}
          </Text>
        </Pressable>
        <Text className="font-display text-xl font-bold text-ink dark:text-screen">
          {t.deleteAccount}
        </Text>
      </View>

      <View className="gap-4 px-6 py-4">
        <Text className="font-body text-t14 text-ink dark:text-screen">
          {t.deleteAccountBody}
        </Text>
        <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
          {t.deleteAccountRetentionNote}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={handlePress}
          className="self-start rounded-button bg-danger px-5 py-3"
        >
          <Text className="font-body-semibold text-t14 text-white">
            {t.deleteAccountCta}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
