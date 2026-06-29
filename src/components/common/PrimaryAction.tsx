import { Pressable, Text } from "react-native";

import { palette, styles } from "../../styles/theme";
import type { IconComponent } from "./types";

export function PrimaryAction({
  disabled = false,
  icon: Icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: IconComponent;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        disabled && styles.primaryActionDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon color={palette.surface} size={18} strokeWidth={2.6} />
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}
