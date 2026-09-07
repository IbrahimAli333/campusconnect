import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";

import "./src/styles/webFocus";
import { PortalHeader } from "./src/components/common/PortalHeader";
import { LoadingState } from "./src/components/common/PortalState";
import { SegmentedControl } from "./src/components/common/SegmentedControl";
import { useNetworkBadges } from "./src/lib/api/useNetworkBadges";
import { useAuthStore } from "./src/lib/auth/auth-store";
import { I18nProvider, useI18n } from "./src/lib/i18n";
import {
  registerForPushNotifications,
  subscribeToNotificationTaps,
  unregisterPushNotifications,
} from "./src/lib/notifications";
import { ScrollAnchorContext } from "./src/lib/scroll-anchor";
import { CampusConnectScreen } from "./src/screens/CampusConnectScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { styles } from "./src/styles/theme";
import type { NetworkTab } from "./src/types/network";

const networkTabs: NetworkTab[] = ["discover", "opportunities", "applications", "profile", "connections"];

// Crash reporting stays entirely off unless a DSN is baked into the build, so
// development and Expo Go never send events.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    // Profile text and messages are user content, so no PII is attached.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

// Sentry.wrap adds the error boundary that reports render crashes.
export default Sentry.wrap(App);

function AppInner() {
  const { t } = useI18n();
  const auth = useAuthStore();
  const [activeTab, setActiveTab] = useState<NetworkTab>("discover");
  const { badges, markApplicationsSeen } = useNetworkBadges(auth.token, activeTab);
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  const handleTabChange = useCallback(
    (tab: NetworkTab) => {
      setActiveTab(tab);
      if (tab === "applications") {
        markApplicationsSeen();
      }
    },
    [markApplicationsSeen],
  );

  const handleLogout = useCallback(() => {
    const performLogout = () => {
      if (auth.token) {
        void unregisterPushNotifications(auth.token);
      }
      auth.logout();
    };

    // RN's Alert is a no-op on web, so the confirm dialog needs both paths.
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || window.confirm(t("Sign out of Unibridge?"))) {
        performLogout();
      }
      return;
    }

    Alert.alert(t("Sign out of Unibridge?"), undefined, [
      { style: "cancel", text: t("Cancel") },
      { onPress: performLogout, style: "destructive", text: t("Sign out") },
    ]);
  }, [auth, t]);

  // Ask for notification permission and register the device only once a
  // session exists, so the prompt never shows on the login screen.
  useEffect(() => {
    if (auth.token) {
      void registerForPushNotifications(auth.token);
    }
  }, [auth.token]);

  useEffect(() => subscribeToNotificationTaps(handleTabChange), [handleTabChange]);

  if (auth.isRestoring) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <LoadingState label={t("Restoring your session")} />
      </SafeAreaView>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <LoginScreen onGoogleLogin={auth.loginWithGoogle} onLogin={auth.login} onRegister={auth.register} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        <PortalHeader
          onLogout={handleLogout}
          profileMeta={t(roleLabel(auth.user.role))}
          profileName={auth.user.full_name}
          role={auth.user.role === "teacher" ? "teacher" : auth.user.role === "member" ? "member" : "student"}
        />

        <SegmentedControl<NetworkTab> active={activeTab} badges={badges} items={networkTabs} onChange={handleTabChange} />

        <ScrollView
          contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <ScrollAnchorContext.Provider value={scrollRef}>
            <CampusConnectScreen activeTab={activeTab} onAccountDeleted={auth.logout} token={auth.token} />
          </ScrollAnchorContext.Provider>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
