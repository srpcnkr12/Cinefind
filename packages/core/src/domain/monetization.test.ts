import { describe, expect, it } from "vitest";
import {
  CONSUMABLE_PRODUCTS,
  consumableProductIdSchema,
  revenueCatWebhookPayloadSchema,
} from "./monetization";

describe("CONSUMABLE_PRODUCTS", () => {
  it("her ürün id'si için doğru tür/miktar tanımlar (PRD 13.2)", () => {
    expect(CONSUMABLE_PRODUCTS.boost_1).toEqual({ kind: "boosts", amount: 1 });
    expect(CONSUMABLE_PRODUCTS.boost_3).toEqual({ kind: "boosts", amount: 3 });
    expect(CONSUMABLE_PRODUCTS.boost_5).toEqual({ kind: "boosts", amount: 5 });
    expect(CONSUMABLE_PRODUCTS.super_message_3).toEqual({
      kind: "super_messages",
      amount: 3,
    });
    expect(CONSUMABLE_PRODUCTS.super_message_5).toEqual({
      kind: "super_messages",
      amount: 5,
    });
    expect(CONSUMABLE_PRODUCTS.super_message_9).toEqual({
      kind: "super_messages",
      amount: 9,
    });
  });

  it("tanımlı her ürün id'si zod şemasında da geçerlidir", () => {
    for (const productId of Object.keys(CONSUMABLE_PRODUCTS)) {
      expect(() => consumableProductIdSchema.parse(productId)).not.toThrow();
    }
  });
});

describe("revenueCatWebhookPayloadSchema", () => {
  it("gerçek şekle uygun bir INITIAL_PURCHASE payload'ını doğrular", () => {
    const payload = {
      api_version: "1.0",
      event: {
        id: "evt_1",
        type: "INITIAL_PURCHASE",
        app_user_id: "user-1",
        product_id: "premium_monthly",
        expiration_at_ms: 1234567890000,
        store: "APP_STORE",
        transaction_id: "txn_1",
      },
    };
    expect(revenueCatWebhookPayloadSchema.parse(payload)).toBeTruthy();
  });

  it("bilinmeyen bir event.type'ı reddeder", () => {
    const payload = {
      api_version: "1.0",
      event: {
        id: "evt_1",
        type: "UNKNOWN_TYPE",
        app_user_id: "user-1",
        product_id: "boost_1",
      },
    };
    expect(() => revenueCatWebhookPayloadSchema.parse(payload)).toThrow();
  });
});
