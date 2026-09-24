import { z } from "zod";

/** PRD bölüm 9.1 — profil ve onboarding domain tipleri. */

export const genderSchema = z.enum(["woman", "man", "nonbinary", "other"]);
export type Gender = z.infer<typeof genderSchema>;

export const intentSchema = z.enum(["dating", "friendship", "watch_buddy"]);
export type Intent = z.infer<typeof intentSchema>;

export const onboardingStepSchema = z.enum([
  "birthdate",
  "basics",
  "intent",
  "photos",
  "location",
  "genres",
  "taste-test",
  "top-four",
  "prompts",
  "notifications",
  "completed",
]);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const consentTypeSchema = z.enum([
  "kvkk_notice",
  "special_category_data",
  "location",
  "marketing",
  "analytics",
]);
export type ConsentType = z.infer<typeof consentTypeSchema>;

/** Her rıza türü için geçerli metin sürümü — tek kaynak (PRD 14.3). */
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  kvkk_notice: "v1",
  special_category_data: "v1",
  location: "v1",
  marketing: "v1",
  analytics: "v1",
};

export const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  birthdate: z.string().nullable(),
  gender: genderSchema.nullable(),
  genderCustom: z.string().nullable(),
  showGender: z.boolean(),
  interestedIn: z.array(genderSchema),
  intents: z.array(intentSchema),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  onboardingStep: onboardingStepSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const profilePhotoSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  storagePath: z.string(),
  position: z.number().int().min(1).max(6),
  blurhash: z.string().nullable(),
  moderationStatus: z.enum(["pending", "approved", "rejected"]),
});
export type ProfilePhoto = z.infer<typeof profilePhotoSchema>;

export type TasteReaction = "liked" | "ok" | "disliked";

/** `submit_taste_reactions` RPC'sine gönderilen tek bir öğe. */
export const tasteReactionInputSchema = z.object({
  filmId: z.uuid(),
  reaction: z.enum(["liked", "ok", "disliked"]),
});
export type TasteReactionInput = z.infer<typeof tasteReactionInputSchema>;

/** Onboarding'in min. eşiği (PRD 3.1): 10 puan VEYA 4 favori olmadan keşfet açılmaz. */
export const MIN_TASTE_REACTIONS = 10;
export const TOP_FOUR_COUNT = 4;

export type GenreOption = { id: string; slug: string; name: string };

export const MIN_FAVORITE_GENRES = 3;
export const MAX_FAVORITE_GENRES = 5;
