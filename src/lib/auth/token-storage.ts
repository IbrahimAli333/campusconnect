import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "campusconnect.access_token";
const REFRESH_TOKEN_KEY = "campusconnect.refresh_token";

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
}

function webStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return webStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const accessToken = await getItem(TOKEN_KEY);
    if (!accessToken) {
      return null;
    }
    return {
      accessToken,
      refreshToken: await getItem(REFRESH_TOKEN_KEY),
    };
  } catch {
    return null;
  }
}

export async function storeSession(accessToken: string, refreshToken: string | null): Promise<void> {
  try {
    await setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      await setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Persisting the session is best-effort; login still works in memory.
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await removeItem(TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore cleanup failures; the in-memory session is already cleared.
  }
}
