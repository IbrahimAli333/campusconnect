import { Pressable, useWindowDimensions } from "react-native";

import { palette, styles } from "../../styles/theme";
import type { IconComponent } from "./types";

export function IconButton({
  accessibilityLabel,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: IconComponent;
  onPress?: () => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, isCompact && styles.iconButtonCompact, pressed && styles.pressed]}
    >
      <Icon color={palette.text} size={isCompact ? 18 : 19} strokeWidth={2.4} />
    </Pressable>
  );
}
