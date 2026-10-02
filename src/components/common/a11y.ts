import { AccessibilityInfo, Platform } from "react-native";
import { useEffect } from "react";

const isWeb = Platform.OS === "web";

/**
 * On/off state for a toggle-like control that keeps role="button" (filter
 * chips, role switcher). Native reads accessibilityState.selected; on web
 * aria-selected is not allowed on buttons, so expose aria-pressed instead.
 * aria-pressed is not in React Native's typings, hence the cast.
 */
export function selectedButtonProps(selected: boolean): object {
  return isWeb ? { "aria-pressed": selected } : { "aria-selected": selected };
}

/**
 * Section/panel titles as headings. react-native-web renders role="header"
 * as <h1> unless aria-level is given, which flattens the outline.
 */
export function headingProps(level: 2 | 3 = 2): object {
  return isWeb ? { role: "heading", "aria-level": level } : { accessibilityRole: "header" };
}

/** Props that hide a purely decorative element from assistive technology. */
export const decorativeProps = {
  accessible: false,
  "aria-hidden": true,
  importantForAccessibility: "no-hide-descendants",
} as const;

/**
 * Status messages (WCAG 4.1.3): Android and web pick up the live region on
 * the element; iOS has no live regions, so announce explicitly.
 */
export function useAnnounce(message: string | null | undefined) {
  useEffect(() => {
    if (message && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}

/**
 * Live-region props for a Text status line. RN's Text only understands the
 * Android accessibilityLiveRegion prop, while react-native-web wants aria-live
 * (and warns on the legacy prop), so pick per platform.
 */
export function liveRegionProps(politeness: "polite" | "assertive"): object {
  return isWeb ? { "aria-live": politeness } : { accessibilityLiveRegion: politeness };
}
