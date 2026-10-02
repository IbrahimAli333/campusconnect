import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { actionHaptic, tapHaptic } from "../../lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that springs down slightly while pressed and gives a haptic tick,
 * so taps feel physical. Respects the OS "reduce motion" setting.
 */
export function PressableScale({
  children,
  haptic = "tap",
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  style,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  children?: ReactNode;
  haptic?: "tap" | "action" | "none";
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        if (!reduceMotion) {
          scale.value = withSpring(scaleTo, { damping: 18, stiffness: 420 });
        }
        if (haptic === "tap") {
          tapHaptic();
        } else if (haptic === "action") {
          actionHaptic();
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 320 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
