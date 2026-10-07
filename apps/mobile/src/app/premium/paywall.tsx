import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { createPurchasesProvider, type PurchasePackage } from "@/lib/purchases";
import { trackEvent } from "@movieholix/core/domain/analytics";
import { useMessages } from "@/lib/i18n";

const purchases = createPurchasesProvider();

const SUBSCRIPTION_LABEL_KEYS: Record<
  string,
  "planWeekly" | "planMonthly" | "planAnnual"
> = {
  premium_weekly: "planWeekly",
  premium_monthly: "planMonthly",
  premium_annual: "planAnnual",
};

/**
 * PRD 5.3 "Paywall" + 14.4 "Mağaza kuralları": karşılaştırma listesi, fiyatlar
 * RevenueCat offerings'ten dinamik (kodda sabit fiyat yok — bkz. ADR-0014,
 * bu ortamda mock), geri yükleme düğmesi, abonelik şartları + otomatik
 * yenileme/iptal bilgisi zorunlu metinleri.
 */
export default function PaywallScreen() {
  const t = useMessages().premium;
  const tCommon = useMessages().common;
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("paywall_viewed", { trigger: trigger ?? "unknown" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscriptions: PurchasePackage[] = [
    { productId: "premium_weekly", kind: "subscription" },
    { productId: "premium_monthly", kind: "subscription" },
    { productId: "premium_annual", kind: "subscription" },
  ];

  async function handlePurchase(productId: string) {
    setBusyProductId(productId);
    try {
      await purchases.purchasePackage(productId);
      Alert.alert(t.purchaseSuccess);
      router.back();
    } catch {
      Alert.alert(t.purchaseError);
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleRestore() {
    await purchases.restorePurchases();
    Alert.alert(t.restoreSuccess);
  }

  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <ScrollView contentContainerClassName="gap-4 px-6 pb-10 pt-4">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-t14 text-ink dark:text-screen">
            {tCommon.back}
          </Text>
        </Pressable>

        <Text className="font-display text-3xl font-bold text-ink dark:text-screen">
          {t.paywallTitle}
        </Text>
        <Text className="font-body text-t14 text-ink dark:text-screen">
          {t.paywallSubtitle}
        </Text>

        <View className="gap-2 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
          <FeatureRow
            free=""
            premium=""
            label={t.compareFreeHeader}
            isHeader
            premiumHeader={t.comparePremiumHeader}
          />
          <FeatureRow label={t.featureUnlimitedSwipes} free="—" premium="✓" />
          <FeatureRow label={t.featureSuperlikes} free="1" premium="5" />
          <FeatureRow label={t.featureLikesYou} free="—" premium="✓" />
          <FeatureRow label={t.featureUndo} free="—" premium="✓" />
          <FeatureRow label={t.featureAdvancedFilters} free="—" premium="✓" />
          <FeatureRow label={t.featureWeeklyStats} free="—" premium="✓" />
          <FeatureRow label={t.featureReadReceipts} free="—" premium="✓" />
        </View>

        <View className="gap-3">
          {subscriptions.map((pkg) => (
            <Pressable
              key={pkg.productId}
              accessibilityRole="button"
              disabled={busyProductId !== null}
              onPress={() => void handlePurchase(pkg.productId)}
              className="flex-row items-center justify-between rounded-button bg-reel px-5 py-4"
            >
              <Text className="font-body-semibold text-t14 text-white">
                {t[SUBSCRIPTION_LABEL_KEYS[pkg.productId]]}
              </Text>
              <Text className="font-body-semibold text-t14 text-white">
                {t.buy}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-body text-t12 text-ink/60 dark:text-screen/60">
          {t.priceFromStore}
        </Text>

        <View className="gap-1 rounded-card bg-surface-1-light p-4 dark:bg-surface-1-dark">
          <Text className="font-body-semibold text-t14 text-ink dark:text-screen">
            {t.legalTitle}
          </Text>
          <Text className="font-body text-t12 text-ink/80 dark:text-screen/80">
            {t.legalBody}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void handleRestore()}
          className="items-center py-2"
        >
          <Text className="font-body-semibold text-t14 text-reel">
            {t.restorePurchases}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({
  label,
  free,
  premium,
  isHeader,
  premiumHeader,
}: {
  label: string;
  free: string;
  premium: string;
  isHeader?: boolean;
  premiumHeader?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={`flex-1 font-body text-t14 text-ink dark:text-screen ${isHeader ? "font-body-semibold" : ""}`}
      >
        {label}
      </Text>
      <Text className="w-14 text-center font-body-semibold text-t12 text-ink dark:text-screen">
        {isHeader ? "" : free}
      </Text>
      <Text className="w-14 text-center font-body-semibold text-t12 text-reel">
        {isHeader ? premiumHeader : premium}
      </Text>
    </View>
  );
}
