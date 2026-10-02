import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { registerPushToken, unregisterPushToken } from "./api/network";
import type { Language } from "./i18n";
import type { NetworkTab } from "../types/network";

const NETWORK_TABS: NetworkTab[] = ["discover", "opportunities", "applications", "profile", "connections"];

// Remote push requires a device runtime; every entry point below no-ops on web.
export const isPushSupported = Platform.OS === "ios" || Platform.OS === "android";

// Per-device opt-out from the Me tab. Stored on the device (like the language
// choice) because push tokens are per device, not per account.
const PUSH_PREFERENCE_KEY = "campusconnect.push_enabled";

export async function getPushPreference(): Promise<boolean> {
  if (!isPushSupported) {
    return false;
  }
  try {
    return (await SecureStore.getItemAsync(PUSH_PREFERENCE_KEY)) !== "0";
  } catch {
    return true;
  }
}

async function storePushPreference(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(PUSH_PREFERENCE_KEY, enabled ? "1" : "0");
}

let registeredPushToken: string | null = null;
let handlerConfigured = false;
let automaticRegistrationBlocked = false;
let pushOperation: Promise<unknown> = Promise.resolve();

// Startup/language registration must finish before opt-out unregisters its
// token. Otherwise a delayed registration could turn delivery back on.
function serializePushOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pushOperation.then(operation);
  pushOperation = result.catch(() => undefined);
  return result;
}

function configureNotificationHandling(): void {
  if (handlerConfigured || !isPushSupported) {
    return;
  }

  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "Unibridge",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function expoProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/**
 * Register this device's Expo push token with the backend. On app start this
 * only proceeds when permission was already granted; the OS permission dialog
 * is shown only when `requestPermission` is set, i.e. after the user tapped
 * "Allow" in the app's own explanation (PushPermissionPrompt) or turned the
 * Me-tab switch on.
 */
export async function registerForPushNotifications(
  apiToken: string,
  language?: Language,
  requestPermission = false,
): Promise<void> {
  return serializePushOperation(async () => {
    if (!isPushSupported || automaticRegistrationBlocked || !(await getPushPreference())) {
      return;
    }
    await registerDevicePushToken(apiToken, language, requestPermission);
  });
}

async function registerDevicePushToken(
  apiToken: string,
  language?: Language,
  requestPermission = false,
): Promise<PushToggleResult> {
  if (!isPushSupported) {
    return "failed";
  }

  try {
    configureNotificationHandling();
    await ensureAndroidChannel();

    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && requestPermission) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (!permissions.granted && permissions.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return "permission-denied";
    }

    const projectId = expoProjectId();
    const pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    // Keep the token even if the request fails: the server may have accepted
    // registration before its response was lost, and opt-out must retry it.
    registeredPushToken = pushToken;
    await registerPushToken(apiToken, pushToken, Platform.OS === "ios" ? "ios" : "android", language);
    return "enabled";
  } catch (error) {
    // Push registration is best-effort (e.g. Expo Go, simulators, offline).
    console.warn("Push notification registration skipped:", error);
    return "failed";
  }
}

/** Remove this device's push token from the backend; used on logout. */
export async function unregisterPushNotifications(apiToken: string): Promise<void> {
  return serializePushOperation(async () => {
    const pushToken = registeredPushToken;
    if (!isPushSupported || !pushToken) {
      return;
    }

    try {
      await unregisterPushToken(apiToken, pushToken);
      registeredPushToken = null;
    } catch (error) {
      console.warn("Push token unregistration failed:", error);
    }
  });
}

// The app's own "turn on notifications?" sheet is shown once per device,
// before the OS dialog (which can only be shown once).
const PUSH_PROMPT_SEEN_KEY = "campusconnect.push_prompt_seen";

/** True when the explain-first prompt should be offered on this device. */
export async function shouldOfferPushPrompt(): Promise<boolean> {
  if (!isPushSupported || !(await getPushPreference())) {
    return false;
  }
  try {
    if ((await SecureStore.getItemAsync(PUSH_PROMPT_SEEN_KEY)) === "1") {
      return false;
    }
    const permissions = await Notifications.getPermissionsAsync();
    return !permissions.granted && permissions.canAskAgain;
  } catch {
    return false;
  }
}

export async function markPushPromptSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUSH_PROMPT_SEEN_KEY, "1");
  } catch {
    // Worst case the prompt shows once more on the next launch.
  }
}

export type PushToggleResult = "enabled" | "disabled" | "permission-denied" | "failed";

/**
 * Me tab switch. Turning push off removes this device's token from the
 * backend, so the server has nothing to deliver to; turning it on asks for OS
 * permission (if needed) and registers the device again.
 */
export async function setPushNotificationsEnabled(
  apiToken: string,
  enabled: boolean,
  language?: Language,
): Promise<PushToggleResult> {
  if (!isPushSupported) {
    return "failed";
  }

  // Block background registrations immediately, including ones already queued.
  // A failed opt-out remains retryable; only an explicit successful opt-in
  // permits background registration again during this session.
  if (!enabled) {
    automaticRegistrationBlocked = true;
  }

  return serializePushOperation(async () => {
    if (!enabled) {
      automaticRegistrationBlocked = true;
      try {
        let pushToken = registeredPushToken;
        if (!pushToken) {
          const permissions = await Notifications.getPermissionsAsync();
          if (permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
            const projectId = expoProjectId();
            pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
            registeredPushToken = pushToken;
          }
        }
        if (pushToken) {
          await unregisterPushToken(apiToken, pushToken);
        }
        // Do not report/store off or discard the retry token until the server
        // confirms removal and the device preference is durably saved.
        await storePushPreference(false);
        registeredPushToken = null;
        return "disabled";
      } catch (error) {
        console.warn("Push opt-out failed:", error);
        return "failed";
      }
    }

    const previousPreference = await getPushPreference();
    try {
      await storePushPreference(true);
      const result = await registerDevicePushToken(apiToken, language, true);
      if (result === "enabled") {
        automaticRegistrationBlocked = false;
        return result;
      }
      // A failed opt-in must not silently opt the device in on next launch.
      automaticRegistrationBlocked = true;
      await storePushPreference(result === "permission-denied" ? false : previousPreference);
      return result;
    } catch (error) {
      automaticRegistrationBlocked = true;
      console.warn("Push opt-in failed:", error);
      return "failed";
    }
  });
}

function tabFromResponse(response: Notifications.NotificationResponse | null): NetworkTab | null {
  const tab = response?.notification.request.content.data?.tab;
  return typeof tab === "string" && (NETWORK_TABS as string[]).includes(tab) ? (tab as NetworkTab) : null;
}

/**
 * Invoke `onOpenTab` with the tab referenced by a tapped notification, both
 * for taps while running and for the tap that cold-started the app.
 * Returns a cleanup function.
 */
export function subscribeToNotificationTaps(onOpenTab: (tab: NetworkTab) => void): () => void {
  if (!isPushSupported) {
    return () => {};
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const tab = tabFromResponse(response);
    if (tab) {
      onOpenTab(tab);
    }
  });

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const tab = tabFromResponse(response);
      if (tab) {
        onOpenTab(tab);
      }
    })
    .catch(() => {
      // No cold-start notification to route.
    });

  return () => subscription.remove();
}
