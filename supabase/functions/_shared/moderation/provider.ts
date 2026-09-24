export type ModerationStatus = "approved" | "rejected" | "pending";

export type ModerationResult = {
  status: ModerationStatus;
  labels?: Record<string, number>;
  reason?: string | null;
};

/**
 * Görsel moderasyon soyutlaması (PRD 21, açık karar #6 — "Arayüz + mock, sağlayıcı
 * sonra seçilir"). Gerçek bir sağlayıcı (ör. bulut görsel moderasyon API'si)
 * eklendiğinde bu arayüzü uygulayan yeni bir sınıf yazılır; `on-photo-upload`
 * fonksiyonu değişmez.
 */
export interface ModerationProvider {
  moderateImage(publicOrSignedUrl: string): Promise<ModerationResult>;
}
