import { Platform } from "react-native";

import { palette } from "./theme";

// React Native styles cannot express :focus-visible, so keyboard users on web
// get no focus indicator (WCAG 2.4.7). Inject one global rule instead.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `[role="button"]:focus-visible, [role="tab"]:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${palette.teal}; outline-offset: 2px; }`;
  document.head.appendChild(style);
}

export {};
