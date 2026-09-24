import { Stack } from "expo-router";

export default function ChatsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[conversationId]" />
      <Stack.Screen name="likes" />
    </Stack>
  );
}
