import type { ModerationProvider, ModerationResult } from "./provider.ts";

/**
 * Geliştirme/test sağlayıcısı: her görseli onaylar — tek istisna, dosya adı
 * "reject-" ile başlıyorsa reddeder (red yolunu elle test edebilmek için).
 */
export class MockModerationProvider implements ModerationProvider {
  async moderateImage(publicOrSignedUrl: string): Promise<ModerationResult> {
    const fileName = publicOrSignedUrl.split("/").pop() ?? "";
    if (fileName.startsWith("reject-")) {
      return {
        status: "rejected",
        reason: "mock: dosya adı 'reject-' ile başlıyor",
      };
    }
    return { status: "approved", labels: {} };
  }
}

export function createModerationProvider(): ModerationProvider {
  return new MockModerationProvider();
}
