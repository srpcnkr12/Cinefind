import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";

const MAX_WIDTH = 1080;
const JPEG_QUALITY = 0.8;

/**
 * Seçilen fotoğrafı sıkıştırır/boyutlandırır, Storage'a `{userId}/{position}-{timestamp}.jpg`
 * yoluna yükler, `profile_photos` satırını oluşturur ve moderasyonu tetikler.
 */
export async function uploadProfilePhoto(params: {
  pickedUri: string;
  userId: string;
  position: number;
}): Promise<{ photoId: string; storagePath: string }> {
  const { pickedUri, userId, position } = params;

  const context = ImageManipulator.manipulate(pickedUri);
  context.resize({ width: MAX_WIDTH });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });

  const file = new File(result.uri);
  const bytes = await file.bytes();

  const storagePath = `${userId}/${position}-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data: photoRow, error: insertError } = await supabase
    .from("profile_photos")
    .upsert(
      {
        user_id: userId,
        storage_path: storagePath,
        position,
        width: result.width,
        height: result.height,
      },
      { onConflict: "user_id,position" },
    )
    .select("id")
    .single();
  if (insertError) throw insertError;

  // Moderasyonu tetikle (bkz. supabase/functions/on-photo-upload). Sonucu
  // beklemeden dönüyoruz — ekran `profile_photos`'u yeniden okuyarak durumu görür.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionsUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/on-photo-upload`;
  void fetch(functionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ photoId: photoRow.id }),
  });

  return { photoId: photoRow.id as string, storagePath };
}
