import { Pressable, Text, View } from "react-native";

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  size?: number;
};

/** 5 yıldızlı hızlı puanlama — bir dokunuşla puanlar (Faz 4 kabul: ≤2 dokunuş). */
export function StarRating({ value, onChange, size = 22 }: Props) {
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`${n} / 5`}
          hitSlop={8}
          onPress={() => onChange(n)}
        >
          <Text
            style={{ fontSize: size }}
            className={
              value !== null && n <= value
                ? "text-popcorn"
                : "text-ink/25 dark:text-screen/25"
            }
          >
            {value !== null && n <= value ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
