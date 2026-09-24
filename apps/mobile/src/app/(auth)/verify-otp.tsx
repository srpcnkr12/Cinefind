import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function VerifyOtpScreen() {
  const t = useMessages().auth;
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setVerifying(false);
    if (verifyError) {
      setError(t.signInError);
      return;
    }
    // Kök bekçiye dön (app/index.tsx) — oturum artık var, profile.onboarding_step'e
    // göre doğru ekrana o yönlendirecek.
    router.replace("/");
  }

  async function resend() {
    setError(null);
    await supabase.auth.signInWithOtp({ email });
  }

  return (
    <SafeAreaView
      className="flex-1 justify-center gap-4 bg-screen px-6 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <Text className="font-display text-2xl font-bold text-ink dark:text-screen">
        {t.verifyTitle}
      </Text>
      <Text className="font-body text-ink dark:text-screen">
        {t.verifyBody.replace("{email}", email ?? "")}
      </Text>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t.codePlaceholder}
        keyboardType="number-pad"
        maxLength={6}
        className="rounded-button border border-celluloid px-4 py-3 text-center font-body text-2xl tracking-widest text-ink dark:text-screen"
      />

      <Pressable
        accessibilityRole="button"
        disabled={verifying || code.length < 6}
        onPress={verify}
        className="items-center rounded-button bg-reel px-5 py-4"
        style={verifying || code.length < 6 ? { opacity: 0.5 } : undefined}
      >
        <Text className="font-body-semibold text-t16 text-white">
          {t.verifyButton}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={resend}>
        <Text className="text-center font-body text-t14 text-ink underline dark:text-screen">
          {t.resendCode}
        </Text>
      </Pressable>

      {error ? (
        <Text className="text-center font-body text-t14 text-danger">
          {error}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
