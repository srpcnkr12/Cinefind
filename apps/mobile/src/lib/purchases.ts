import { Platform } from "react-native";
import {
  CONSUMABLE_PRODUCTS,
  type ConsumableProductId,
} from "@movieholix/core/domain/monetization";
import { trackEvent } from "@movieholix/core/domain/analytics";
import { supabase } from "./supabase";

/**
 * PRD 13.2 — RevenueCat ürünleri. Fiyatlar kodda sabit değil (mağaza
 * panelinden gelir); burada yalnızca ürün id'leri ve türleri tutulur.
 */
export type PurchasePackage = {
  productId: string;
  kind: "subscription" | "consumable";
};

export interface PurchasesProvider {
  getOfferings(): Promise<PurchasePackage[]>;
  purchasePackage(productId: string): Promise<void>;
  restorePurchases(): Promise<void>;
}

const SUBSCRIPTION_PRODUCT_IDS = [
  "premium_weekly",
  "premium_monthly",
  "premium_annual",
] as const;

const SUBSCRIPTION_DURATION_MS: Record<
  (typeof SUBSCRIPTION_PRODUCT_IDS)[number],
  number
> = {
  premium_weekly: 7 * 24 * 60 * 60 * 1000,
  premium_monthly: 30 * 24 * 60 * 60 * 1000,
  premium_annual: 365 * 24 * 60 * 60 * 1000,
};

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Gerçek RevenueCat SDK'sı (`react-native-purchases`) bu ortamda entegre
 * edilmedi (bkz. docs/adr/0014-purchases-mock-only.md) — gerçek pano/mağaza
 * sandbox erişimi yok. Bu mock, ürünü gerçekten satın almış gibi simüle
 * etmek için doğrudan `revenuecat-webhook` fonksiyonuna gerçek RevenueCat
 * payload şekline uygun sentetik bir olay POST'lar; böylece istemci →
 * webhook → `entitlements`/`consumable_ledger` kod yolunun tamamı gerçek
 * çalışır, yalnızca "gerçek mağaza ödemesi" adımı simüle edilir.
 *
 * `EXPO_PUBLIC_MOCK_PURCHASES_WEBHOOK_AUTH`, gerçek `REVENUECAT_WEBHOOK_AUTH`
 * ile ASLA aynı değer olmamalı — yalnızca yerel/mock akış için ayrı bir
 * paylaşılan anahtar (bkz. .env.example).
 */
export class MockPurchasesProvider implements PurchasesProvider {
  async getOfferings(): Promise<PurchasePackage[]> {
    return [
      ...SUBSCRIPTION_PRODUCT_IDS.map((productId) => ({
        productId,
        kind: "subscription" as const,
      })),
      ...Object.keys(CONSUMABLE_PRODUCTS).map((productId) => ({
        productId: productId as ConsumableProductId,
        kind: "consumable" as const,
      })),
    ];
  }

  async purchasePackage(productId: string): Promise<void> {
    trackEvent("purchase_started", { product: productId });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Oturum yok");

    const isSubscription = (
      SUBSCRIPTION_PRODUCT_IDS as readonly string[]
    ).includes(productId);
    const transactionId = randomId();

    const event = {
      id: randomId(),
      type: isSubscription ? "INITIAL_PURCHASE" : "NON_RENEWING_PURCHASE",
      app_user_id: user.id,
      product_id: productId,
      expiration_at_ms: isSubscription
        ? Date.now() +
          SUBSCRIPTION_DURATION_MS[
            productId as (typeof SUBSCRIPTION_PRODUCT_IDS)[number]
          ]
        : null,
      store: Platform.OS === "ios" ? "APP_STORE" : "PLAY_STORE",
      transaction_id: transactionId,
    };

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/revenuecat-webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            process.env.EXPO_PUBLIC_MOCK_PURCHASES_WEBHOOK_AUTH ?? "",
        },
        body: JSON.stringify({ api_version: "1.0", event }),
      },
    );

    if (!response.ok) {
      throw new Error(`Mock satın alma başarısız: ${response.status}`);
    }
    trackEvent("purchase_completed", { product: productId });
  }

  async restorePurchases(): Promise<void> {
    // Mock'ta gerçek bir mağaza kaydı yok; gerçek SDK'da bu
    // `Purchases.restorePurchases()`'ı çağırıp entitlement'ları senkronize eder.
  }
}

export function createPurchasesProvider(): PurchasesProvider {
  return new MockPurchasesProvider();
}
