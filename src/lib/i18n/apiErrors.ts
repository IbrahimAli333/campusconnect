/**
 * Server and network error messages arrive in English (FastAPI `detail`
 * strings, Pydantic validation messages, fetch failures). This maps them to
 * the user's language: exact messages are dictionary keys in az.ts/ru.ts,
 * and the few dynamic shapes are recognised here and re-emitted through
 * translatable templates. Unknown messages fall back to English unchanged.
 */
type Translate = (source: string, vars?: Record<string, string | number>) => string;

export const NETWORK_ERROR_MESSAGE = "Could not reach Unibridge. Check your internet connection and try again.";

// What fetch rejects with when the server can't be reached, per platform.
const NETWORK_FAILURES = [
  /^Failed to fetch$/i, // Chrome
  /^Load failed$/i, // Safari
  /^Network request failed$/i, // React Native
  /^NetworkError when attempting to fetch resource\.?$/i, // Firefox
  /^Request timed out\./i, // fetchWithTimeout
  /^Could not connect to the API/i,
];

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function translateLine(t: Translate, rawLine: string): string {
  // Pydantic model validators prefix their message.
  const line = rawLine.replace(/^Value error, /, "").trim();

  if (NETWORK_FAILURES.some((pattern) => pattern.test(line))) {
    return t(NETWORK_ERROR_MESSAGE);
  }

  const status = /^Request failed with status (\d+)$/.exec(line);
  if (status) {
    return t("Request failed with status {status}", { status: status[1] });
  }

  const atLeast = /^String should have at least (\d+) characters?$/.exec(line);
  if (atLeast) {
    return t("Must be at least {n} characters", { n: atLeast[1] });
  }

  const atMost = /^String should have at most (\d+) characters?$/.exec(line);
  if (atMost) {
    return t("Must be at most {n} characters", { n: atMost[1] });
  }

  // e.g. "Student profiles can post only these opportunity types: project, startup"
  const authoring = /^(\w+) profiles can post only these opportunity types: (.+)$/.exec(line);
  if (authoring) {
    const types = authoring[2]
      .split(",")
      .map((type) => t(titleCase(type.trim())))
      .join(", ");
    return t("{role} profiles can post only these opportunity types: {list}", {
      list: types,
      role: t(titleCase(authoring[1].toLowerCase())),
    });
  }

  return t(line);
}

/** Translate an API/network error message (possibly several lines). */
export function translateApiError(t: Translate, message: string): string {
  return message
    .split("\n")
    .map((line) => translateLine(t, line))
    .join("\n");
}
