import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function ContinueButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: Props) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`items-center rounded-button px-5 py-4 ${isPrimary ? "bg-reel" : "bg-surface-2-light dark:bg-surface-2-dark"}`}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Text
        className={`font-body-semibold text-t16 ${isPrimary ? "text-white" : "text-ink dark:text-screen"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
