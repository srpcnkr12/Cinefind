import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { uploadProfilePhoto } from "@/lib/photo-upload";

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 2;

type PhotoSlot = { id: string; position: number; localUri: string };

export default function PhotosScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (picked.canceled || !userId) return;

    setUploading(true);
    try {
      const position = photos.length + 1;
      const { photoId } = await uploadProfilePhoto({
        pickedUri: picked.assets[0].uri,
        userId,
        position,
      });
      setPhotos((prev) => [
        ...prev,
        { id: photoId, position, localUri: picked.assets[0].uri },
      ]);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    void supabase.from("profile_photos").delete().eq("id", id);
  }

  async function onContinue() {
    if (photos.length < MIN_PHOTOS) return;
    await completeStep("location");
  }

  return (
    <OnboardingLayout
      title={t.photosTitle}
      body={t.photosBody}
      footer={
        <ContinueButton
          label={tCommon.continue}
          onPress={onContinue}
          disabled={photos.length < MIN_PHOTOS || uploading}
        />
      }
    >
      <View className="flex-row flex-wrap gap-3">
        {photos.map((photo) => (
          <View key={photo.id} className="relative">
            <Image
              source={{ uri: photo.localUri }}
              className="h-32 w-24 rounded-card"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.removePhoto}
              onPress={() => removePhoto(photo.id)}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-ink"
            >
              <Text className="font-body text-t14 text-white">×</Text>
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <Pressable
            accessibilityRole="button"
            onPress={addPhoto}
            disabled={uploading}
            className="h-32 w-24 items-center justify-center rounded-card border border-dashed border-celluloid"
          >
            <Text className="text-center font-body text-t14 text-ink dark:text-screen">
              {t.addPhoto}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {photos.length < MIN_PHOTOS ? (
        <Text className="mt-3 font-body text-t14 text-ink dark:text-screen">
          {t.minPhotosHint}
        </Text>
      ) : null}
    </OnboardingLayout>
  );
}
