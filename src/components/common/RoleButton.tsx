import { Pressable, Text } from "react-native";

import { palette, styles } from "../../styles/theme";
import type { IconComponent } from "./types";

export function RoleButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleButton, active && styles.roleButtonActive, pressed && styles.pressed]}
    >
      <Icon color={active ? palette.surface : palette.muted} size={18} strokeWidth={2.4} />
      <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
