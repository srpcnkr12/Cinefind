import { z } from "zod";

/**
 * Moderasyon sağlayıcı arayüzü (PRD 21, açık karar #6: "Arayüz + mock, sağlayıcı
 * sonra seçilir"). Bu tipler hem uygulama tarafında hem de
 * `supabase/functions/_shared/moderation` (Deno) tarafında referans şema olarak
 * kullanılır — Deno kendi kopyasını tutar (bkz. Faz 1'deki FilmDataProvider deseni).
 */

export const moderationStatusSchema = z.enum([
  "approved",
  "rejected",
  "pending",
]);
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;

export const moderationResultSchema = z.object({
  status: moderationStatusSchema,
  labels: z.record(z.string(), z.number()).optional(),
  reason: z.string().nullable().optional(),
});
export type ModerationResult = z.infer<typeof moderationResultSchema>;
