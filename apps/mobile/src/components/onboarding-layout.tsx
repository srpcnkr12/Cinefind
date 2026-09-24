import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  title: string;
  body?: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export function OnboardingLayout({ title, body, children, footer }: Props) {
  return (
    <SafeAreaView
      className="flex-1 bg-screen dark:bg-ink"
      edges={["top", "bottom"]}
    >
      <ScrollView
        className="flex-1 px-6 py-6"
        contentContainerClassName="gap-4"
      >
        <Text className="font-display text-3xl font-bold text-ink dark:text-screen">
          {title}
        </Text>
        {body ? (
          <Text className="font-body text-base text-ink dark:text-screen">
            {body}
          </Text>
        ) : null}
        {children}
      </ScrollView>
      {footer ? <View className="px-6 pb-4">{footer}</View> : null}
    </SafeAreaView>
  );
}
