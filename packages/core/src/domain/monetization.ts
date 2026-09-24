import { z } from "zod";

/** PRD bölüm 13.2 — RevenueCat ürün id'leri, kodda sabit fiyat yok. */

export const subscriptionProductIdSchema = z.enum([
  "premium_weekly",
  "premium_monthly",
  "premium_annual",
]);
export type SubscriptionProductId = z.infer<typeof subscriptionProductIdSchema>;

export const consumableKindSchema = z.enum(["boosts", "super_messages"]);
export type ConsumableKind = z.infer<typeof consumableKindSchema>;

export const consumableProductIdSchema = z.enum([
  "boost_1",
  "boost_3",
  "boost_5",
  "super_message_3",
  "super_message_5",
  "super_message_9",
]);
export type ConsumableProductId = z.infer<typeof consumableProductIdSchema>;

/**
 * Ürün id'si → tüketilebilir tür/miktar eşlemesi. SQL tarafındaki
 * `consumable_products` tablosuyla (Faz 8 migration'ı) davranışça eşdeğer
 * tutulmalı — dual-runtime emsali (bkz. ADR-0009).
 */
export const CONSUMABLE_PRODUCTS: Record<
  ConsumableProductId,
  { kind: ConsumableKind; amount: number }
> = {
  boost_1: { kind: "boosts", amount: 1 },
  boost_3: { kind: "boosts", amount: 3 },
  boost_5: { kind: "boosts", amount: 5 },
  super_message_3: { kind: "super_messages", amount: 3 },
  super_message_5: { kind: "super_messages", amount: 5 },
  super_message_9: { kind: "super_messages", amount: 9 },
};

export const revenueCatEventTypeSchema = z.enum([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "CANCELLATION",
  "EXPIRATION",
  "NON_RENEWING_PURCHASE",
]);
export type RevenueCatEventType = z.infer<typeof revenueCatEventTypeSchema>;

export const revenueCatWebhookEventSchema = z.object({
  id: z.string(),
  type: revenueCatEventTypeSchema,
  app_user_id: z.string(),
  product_id: z.string(),
  expiration_at_ms: z.number().nullable().optional(),
  store: z.string().nullable().optional(),
  transaction_id: z.string().nullable().optional(),
});

export const revenueCatWebhookPayloadSchema = z.object({
  api_version: z.string(),
  event: revenueCatWebhookEventSchema,
});
export type RevenueCatWebhookPayload = z.infer<
  typeof revenueCatWebhookPayloadSchema
>;
