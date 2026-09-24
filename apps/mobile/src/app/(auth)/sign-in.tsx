import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useMessages } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/** Supabase OAuth geri çağrısı token'ları URL fragment'ında döner (#access_token=...). */
function parseFragmentParams(url: string): Record<string, string> {
  const fragment = url.split("#")[1];
  if (!fragment) return {};
  return Object.fromEntries(new URLSearchParams(fragment));
}

export default function SignInScreen() {
  const t = useMessages().auth;
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "ios") {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  async function signInWithApple() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("identityToken yok");
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (signInError) throw signInError;
    } catch {
      setError(t.signInError);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    try {
      const redirectTo = AuthSession.makeRedirectUri();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError || !data.url) throw oauthError ?? new Error("URL yok");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success" || !result.url) return;

      const params = parseFragmentParams(result.url);
      if (!params.access_token || !params.refresh_token)
        throw new Error("token yok");
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
    } catch {
      setError(t.signInError);
    }
  }

  async function sendOtp() {
    setError(null);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email });
    setSending(false);
    if (otpError) {
      setError(t.signInError);
      return;
    }
    router.push({ pathname: "/(auth)/verify-otp", params: { email } });
  }

  return (
    <SafeAreaView
      className="flex-1 justify-center gap-4 bg-screen px-6 dark:bg-ink"
      edges={["top", "bottom"]}
    >
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={{ height: 50, width: "100%" }}
          onPress={signInWithApple}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={signInWithGoogle}
        className="items-center rounded-button border border-ink px-5 py-4 dark:border-screen"
      >
        <Text className="font-body-semibold text-t16 text-ink dark:text-screen">
          {t.continueWithGoogle}
        </Text>
      </Pressable>

      <View className="mt-4 gap-3">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t.emailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          className="rounded-button border border-celluloid px-4 py-3 font-body text-ink dark:text-screen"
        />
        <Pressable
          accessibilityRole="button"
          disabled={sending || email.length === 0}
          onPress={sendOtp}
          className="items-center rounded-button bg-reel px-5 py-4"
          style={sending || email.length === 0 ? { opacity: 0.5 } : undefined}
        >
          <Text className="font-body-semibold text-t16 text-white">
            {t.sendCode}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text className="text-center font-body text-t14 text-danger">
          {error}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
