import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getLatestDataExportRequest,
  requestDataExport,
  type DataExportRequest,
} from "@reelmate/api/compliance";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

/**
 * PRD 14.3 "veri dışa aktarma" — `data-export` Edge Function'ını istemci
 * tetikler (bkz. ADR-0016: e-posta yerine uygulama içi imzalı bağlantı).
 */
export default function ExportDataScreen() {
  const t = useMessages().settings;
  const tCommon = useMessages().common;
  const [request, setRequest] = useState<DataExportRequest | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRequest(await getLatestDataExportRequest(supabase));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleRequest() {
    setBusy(true);
    try {
      const requestId = await requestDataExport(supabase);
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/data-export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ requestId }),
        },
      );
      const result = (await response.json()) as { downloadUrl?: string };
      if (result.downloadUrl) setDownloadUrl(result.downloadUrl);
      void load();
    } catch {
      Alert.alert(t.exportDataError);
    } finally {
      setBusy(false);
    }
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
          {t.exportData}
        </Text>
      </View>

      <View className="gap-4 px-6 py-4">
        <Text className="font-body text-t14 text-ink dark:text-screen">
          {t.exportDataBody}
        </Text>

        {request ? (
          <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
            {t.exportDataStatusPrefix} {request.status}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleRequest()}
          className="self-start rounded-button bg-reel px-5 py-3"
        >
          <Text className="font-body-semibold text-t14 text-white">
            {t.exportDataRequestCta}
          </Text>
        </Pressable>

        {downloadUrl ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(downloadUrl)}
            className="self-start rounded-button bg-surface-1-light px-5 py-3 dark:bg-surface-1-dark"
          >
            <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
              {t.exportDataDownloadCta}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
