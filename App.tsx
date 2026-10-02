import * as Sentry from "@sentry/react-native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DefaultTheme, NavigationContainer, createNavigationContainerRef, type Theme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Briefcase, FileText, Search, UserRound, Users } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import "./src/styles/webFocus";
import { LoadingState } from "./src/components/common/PortalState";
import type { IconComponent } from "./src/components/common/types";
import { AppHeader } from "./src/components/ui/AppHeader";
import { useNetworkBadges } from "./src/lib/api/useNetworkBadges";
import type { AuthUser } from "./src/lib/api/auth";
import { useAuthStore } from "./src/lib/auth/auth-store";
import { tapHaptic } from "./src/lib/haptics";
import { I18nProvider, useI18n } from "./src/lib/i18n";
import {
  registerForPushNotifications,
  subscribeToNotificationTaps,
  unregisterPushNotifications,
} from "./src/lib/notifications";
import { CampusConnectScreen } from "./src/screens/CampusConnectScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { TermsAcceptanceScreen } from "./src/screens/TermsAcceptanceScreen";
import { fonts, palette, styles } from "./src/styles/theme";
import type { NetworkTab } from "./src/types/network";

type TabParamList = Record<NetworkTab, undefined>;

const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<TabParamList>();

const tabConfig: Record<NetworkTab, { icon: IconComponent; label: string; subtitle: string; title: string }> = {
  discover: {
    icon: Search,
    label: "Discover",
    subtitle: "Find students, mentors, and teams across your university.",
    title: "Hello, {name}",
  },
  opportunities: {
    icon: Briefcase,
    label: "Posts",
    subtitle: "Research, startups, internships, jobs, and projects.",
    title: "Opportunities",
  },
  applications: {
    icon: FileText,
    label: "Applied",
    subtitle: "Track every application from submission to decision.",
    title: "My applications",
  },
  profile: {
    icon: UserRound,
    label: "Me",
    subtitle: "Your portfolio, privacy, and account settings.",
    title: "My profile",
  },
  connections: {
    icon: Users,
    label: "Network",
    subtitle: "Connections, requests, and messages.",
    title: "My network",
  },
};

const networkTabs = Object.keys(tabConfig) as NetworkTab[];

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.page,
    border: palette.hairline,
    card: palette.surface,
    notification: palette.pomegranate,
    primary: palette.caspian,
    text: palette.text,
  },
  fonts: {
    bold: { fontFamily: fonts.bold, fontWeight: "normal" },
    heavy: { fontFamily: fonts.extrabold, fontWeight: "normal" },
    medium: { fontFamily: fonts.medium, fontWeight: "normal" },
    regular: { fontFamily: fonts.regular, fontWeight: "normal" },
  },
};

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

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={appStyles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <BottomSheetModalProvider>
            {/* Fonts ship inside the app bundle, so this wait is a frame or two. */}
            {fontsLoaded || fontError ? <AppInner /> : null}
          </BottomSheetModalProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds the error boundary that reports render crashes.
export default Sentry.wrap(App);

function TabPage({
  account,
  onAccountDeleted,
  onLogout,
  tab,
  token,
}: {
  account: AuthUser;
  onAccountDeleted: () => void;
  onLogout: () => void;
  tab: NetworkTab;
  token: string | null;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const config = tabConfig[tab];

  return (
    <ScrollView
      contentContainerStyle={appStyles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={appStyles.page}
    >
      <AppHeader
        onLogout={onLogout}
        profileMeta={t(roleLabel(account.role))}
        profileName={account.full_name}
        subtitle={t(config.subtitle)}
        title={t(config.title, { name: firstName(account.full_name) })}
      />
      {/* Page sheet with rounded top corners, overlapping the hero. */}
      <View style={appStyles.sheet}>
        <View style={[styles.content, isCompact && styles.contentCompact]}>
          <CampusConnectScreen account={account} activeTab={tab} onAccountDeleted={onAccountDeleted} token={token} />
        </View>
      </View>
    </ScrollView>
  );
}

function AppInner() {
  const { language, t } = useI18n();
  const auth = useAuthStore();
  const [activeTab, setActiveTab] = useState<NetworkTab>("discover");
  const { badges, markApplicationsSeen } = useNetworkBadges(auth.token, activeTab);

  const handleTabFocused = useCallback(
    (tab: NetworkTab) => {
      setActiveTab(tab);
      if (tab === "applications") {
        markApplicationsSeen();
      }
    },
    [markApplicationsSeen],
  );

  const openTab = useCallback((tab: NetworkTab) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(tab);
    }
  }, []);

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

  const termsAcceptanceRequired = Boolean(auth.user?.terms_acceptance_required);

  // Ask for notification permission and register the device only once a
  // session exists and the current terms are accepted, so the prompt never
  // shows on the login or consent screens. Users can opt out in the Me tab.
  // Re-runs when the language changes so notifications follow it.
  useEffect(() => {
    if (auth.token && !termsAcceptanceRequired) {
      void registerForPushNotifications(auth.token, language);
    }
  }, [auth.token, language, termsAcceptanceRequired]);

  useEffect(() => subscribeToNotificationTaps(openTab), [openTab]);

  if (auth.isRestoring) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={appStyles.centered}>
          <LoadingState label={t("Restoring your session")} />
        </View>
      </SafeAreaView>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return (
      // Navy behind the status bar so it blends into the login banner.
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, appStyles.loginSafeArea]}>
        <StatusBar style="light" />
        <LoginScreen onGoogleLogin={auth.loginWithGoogle} onLogin={auth.login} onRegister={auth.register} />
      </SafeAreaView>
    );
  }

  if (auth.user.terms_acceptance_required) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <TermsAcceptanceScreen onAccept={auth.acceptTerms} onSignOut={handleLogout} user={auth.user} />
      </SafeAreaView>
    );
  }

  const account = auth.user;

  return (
    <NavigationContainer
      onStateChange={(state) => {
        const route = state?.routes[state.index ?? 0];
        if (route) {
          handleTabFocused(route.name as NetworkTab);
        }
      }}
      ref={navigationRef}
      theme={navigationTheme}
    >
      <StatusBar style="light" />
      <Tab.Navigator
        screenListeners={{ tabPress: () => tapHaptic() }}
        screenOptions={({ route }) => {
          const config = tabConfig[route.name];
          const Icon = config.icon;
          const label = t(config.label);
          const badge = badges[route.name] ?? 0;

          return {
            headerShown: false,
            tabBarAccessibilityLabel: badge > 0 ? t("{label}, {n} new", { label, n: badge > 99 ? "99+" : badge }) : label,
            tabBarActiveTintColor: palette.caspian,
            tabBarBadge: badge > 0 ? (badge > 99 ? "99+" : badge) : undefined,
            tabBarBadgeStyle: appStyles.badge,
            tabBarIcon: ({ color, focused }) => (
              <View style={[appStyles.tabIcon, focused && appStyles.tabIconActive]}>
                <Icon color={color} size={21} strokeWidth={focused ? 2.6 : 2.1} />
              </View>
            ),
            tabBarInactiveTintColor: palette.muted,
            tabBarLabel: label,
            tabBarLabelStyle: appStyles.tabLabel,
            tabBarStyle: appStyles.tabBar,
          };
        }}
      >
        {networkTabs.map((tab) => (
          <Tab.Screen key={tab} name={tab}>
            {() => (
              <TabPage
                account={account}
                onAccountDeleted={auth.logout}
                onLogout={handleLogout}
                tab={tab}
                token={auth.token}
              />
            )}
          </Tab.Screen>
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const appStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loginSafeArea: {
    backgroundColor: palette.navy,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  page: {
    backgroundColor: palette.navy,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: palette.page,
    flexGrow: 1,
  },
  sheet: {
    backgroundColor: palette.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexGrow: 1,
    marginTop: -28,
  },
  tabBar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.hairline,
    minHeight: 64,
    paddingTop: 6,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginTop: 2,
  },
  tabIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 56,
  },
  tabIconActive: {
    backgroundColor: palette.caspianSoft,
  },
  badge: {
    backgroundColor: palette.pomegranate,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
});
