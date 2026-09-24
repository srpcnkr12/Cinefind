import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { useMessages } from "@/lib/i18n";
import { useMutationQueueFlush } from "@/lib/mutation-queue";
import {
  registerForPushNotifications,
  subscribeToNotificationTaps,
} from "@/lib/push";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focusedName,
  unfocusedName,
  color,
  size,
  focused,
}: {
  focusedName: IconName;
  unfocusedName: IconName;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? focusedName : unfocusedName}
      size={size}
      color={color}
    />
  );
}

function tabIcon(focusedName: IconName, unfocusedName: IconName) {
  return function BoundTabIcon(props: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return (
      <TabIcon
        focusedName={focusedName}
        unfocusedName={unfocusedName}
        {...props}
      />
    );
  };
}

export default function TabsLayout() {
  const t = useMessages().tabs;
  useMutationQueueFlush();

  useEffect(() => {
    void registerForPushNotifications();
    return subscribeToNotificationTaps();
  }, []);

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarActiveTintColor: "#17736E" }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: t.discover,
          tabBarIcon: tabIcon("flame", "flame-outline"),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: t.feed,
          tabBarIcon: tabIcon("newspaper", "newspaper-outline"),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t.library,
          tabBarIcon: tabIcon("film", "film-outline"),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: t.chats,
          tabBarIcon: tabIcon("chatbubbles", "chatbubbles-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: tabIcon("person", "person-outline"),
        }}
      />
    </Tabs>
  );
}
