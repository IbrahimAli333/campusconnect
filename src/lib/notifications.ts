import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushToken, unregisterPushToken } from "./api/network";
import type { NetworkTab } from "../types/network";

const NETWORK_TABS: NetworkTab[] = ["discover", "opportunities", "applications", "profile", "connections"];

// Remote push requires a device runtime; every entry point below no-ops on web.
const isPushSupported = Platform.OS === "ios" || Platform.OS === "android";

let registeredPushToken: string | null = null;
let handlerConfigured = false;

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
    name: "CampusConnect",
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
 * Ask for notification permission and register this device's Expo push token
 * with the backend. Called only after the user is authenticated, so the
 * permission prompt never appears on the login screen.
 */
export async function registerForPushNotifications(apiToken: string): Promise<void> {
  if (!isPushSupported) {
    return;
  }

  try {
    configureNotificationHandling();
    await ensureAndroidChannel();

    const permissions = await Notifications.requestPermissionsAsync();
    if (!permissions.granted && permissions.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return;
    }

    const projectId = expoProjectId();
    const pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await registerPushToken(apiToken, pushToken, Platform.OS === "ios" ? "ios" : "android");
    registeredPushToken = pushToken;
  } catch (error) {
    // Push registration is best-effort (e.g. Expo Go, simulators, offline).
    console.warn("Push notification registration skipped:", error);
  }
}

/** Remove this device's push token from the backend; used on logout. */
export async function unregisterPushNotifications(apiToken: string): Promise<void> {
  const pushToken = registeredPushToken;
  if (!isPushSupported || !pushToken) {
    return;
  }

  registeredPushToken = null;
  try {
    await unregisterPushToken(apiToken, pushToken);
  } catch (error) {
    console.warn("Push token unregistration failed:", error);
  }
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
