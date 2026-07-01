import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "campusconnect.access_token";

function webStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export async function loadStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return webStorage()?.getItem(TOKEN_KEY) ?? null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      webStorage()?.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Persisting the session is best-effort; login still works in memory.
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      webStorage()?.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore cleanup failures; the in-memory session is already cleared.
  }
}
