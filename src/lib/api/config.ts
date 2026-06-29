import { NativeModules, Platform } from "react-native";

declare const process:
  | {
      env?: {
        EXPO_PUBLIC_API_URL?: string;
      };
    }
  | undefined;
declare const __DEV__: boolean | undefined;

const API_PORT = "8000";
const LOCAL_API_URL = `http://localhost:${API_PORT}`;
const ANDROID_EMULATOR_API_URL = `http://10.0.2.2:${API_PORT}`;

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isNativeProductionRuntime(): boolean {
  return Platform.OS !== "web" && typeof __DEV__ === "boolean" && !__DEV__;
}

function isLocalOrPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "10.0.2.2" ||
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  );
}

function assertProductionApiUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid URL for production builds.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use https:// for production builds.");
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error("Production builds cannot use localhost, emulator hosts, or private LAN API URLs.");
  }
}

function getNativeDevHostApiUrl(): string | null {
  const scriptUrl = NativeModules.SourceCode?.scriptURL;
  if (typeof scriptUrl !== "string") {
    return null;
  }

  const hostMatch = scriptUrl.match(/^(?:https?|exp):\/\/([^/:?#]+)(?::\d+)?/);
  const host = hostMatch?.[1];
  if (!host) {
    return null;
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return Platform.OS === "android" ? ANDROID_EMULATOR_API_URL : LOCAL_API_URL;
  }

  return `http://${host}:${API_PORT}`;
}

function getDefaultApiBaseUrl(): string {
  if (Platform.OS === "web") {
    return LOCAL_API_URL;
  }

  return getNativeDevHostApiUrl() ?? LOCAL_API_URL;
}

const configuredApiUrl = typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_URL : undefined;

const configuredApiBaseUrl = configuredApiUrl?.trim();

if (isNativeProductionRuntime()) {
  if (!configuredApiBaseUrl) {
    throw new Error("Production builds require EXPO_PUBLIC_API_URL.");
  }

  assertProductionApiUrl(configuredApiBaseUrl);
}

export const API_BASE_URL = cleanBaseUrl(configuredApiBaseUrl || getDefaultApiBaseUrl());
