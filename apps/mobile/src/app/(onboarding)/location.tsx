import { useState } from "react";
import { TextInput, View } from "react-native";
import * as Location from "expo-location";
import { slugify } from "@movieholix/i18n";
import { TR_CITY_CENTERS } from "@movieholix/core/domain/tr-cities";
import { useMessages } from "@/lib/i18n";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { ContinueButton } from "@/components/continue-button";
import { completeStep } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

export default function LocationScreen() {
  const t = useMessages().onboarding;
  const tCommon = useMessages().common;
  const [city, setCity] = useState("");
  const [showCityInput, setShowCityInput] = useState(false);
  const [saving, setSaving] = useState(false);

  async function allowLocation() {
    setSaving(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      setSaving(false);
      setShowCityInput(true);
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    const { error } = await supabase.rpc("update_my_location", {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    setSaving(false);
    if (!error) await completeStep("genres");
  }

  async function continueWithCity() {
    if (city.trim().length === 0) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ city: city.trim() })
      .eq("id", user?.id ?? "");

    // Gerçek bir geocoding sağlayıcısı olmadığı için (kapsam dışı), en büyük
    // şehirler için sabit merkez koordinatı kullanılır (PRD 14.2).
    const center = TR_CITY_CENTERS[slugify(city.trim())];
    if (center) {
      await supabase.rpc("update_my_location", {
        lat: center.lat,
        lng: center.lng,
      });
    }

    setSaving(false);
    if (!error) await completeStep("genres");
  }

  return (
    <OnboardingLayout
      title={t.locationTitle}
      body={t.locationBody}
      footer={
        showCityInput ? (
          <ContinueButton
            label={tCommon.continue}
            onPress={continueWithCity}
            disabled={city.trim().length === 0 || saving}
          />
        ) : (
          <ContinueButton
            label={t.allowLocation}
            onPress={allowLocation}
            disabled={saving}
          />
        )
      }
    >
      {showCityInput ? (
        <View className="gap-3">
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t.cityPlaceholder}
            className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
          />
        </View>
      ) : (
        <ContinueButton
          label={t.denyLocationCityPrompt}
          variant="secondary"
          onPress={() => setShowCityInput(true)}
        />
      )}
    </OnboardingLayout>
  );
}
