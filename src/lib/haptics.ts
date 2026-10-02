import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Haptics are a native-only nicety; the web build silently skips them.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

/** Light tick for taps on tabs, chips, and secondary actions. */
export function tapHaptic(): void {
  if (enabled) {
    void Haptics.selectionAsync().catch(() => undefined);
  }
}

/** Firmer bump for primary actions (Apply, Connect, Send). */
export function actionHaptic(): void {
  if (enabled) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }
}

/** Success pattern after an action completes. */
export function successHaptic(): void {
  if (enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }
}
