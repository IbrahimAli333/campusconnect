import { Platform } from "react-native";

import { palette } from "./theme";

// React Native styles cannot express :focus-visible, so keyboard users on web
// get no focus indicator (WCAG 2.4.7). Inject one global rule instead.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  // !important: TextInputs ship an `outline: none` reset (webInputReset) that
  // would otherwise win the cascade and hide the ring on fields.
  const selectors = [
    '[role="button"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="link"]',
    "a[href]",
    "input",
    "textarea",
    "select",
  ]
    .map((selector) => `${selector}:focus-visible`)
    .join(", ");
  style.textContent = `${selectors} { outline: 2px solid ${palette.teal} !important; outline-offset: 2px; }`;
  document.head.appendChild(style);
}

export {};
