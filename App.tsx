import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";

import "./src/styles/webFocus";
import { PortalHeader } from "./src/components/common/PortalHeader";
import { LoadingState } from "./src/components/common/PortalState";
import { SegmentedControl } from "./src/components/common/SegmentedControl";
import { useNetworkBadges } from "./src/lib/api/useNetworkBadges";
import { useAuthStore } from "./src/lib/auth/auth-store";
import { ScrollAnchorContext } from "./src/lib/scroll-anchor";
import { CampusConnectScreen } from "./src/screens/CampusConnectScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { styles } from "./src/styles/theme";
import type { NetworkTab } from "./src/types/network";

const networkTabs: NetworkTab[] = ["discover", "opportunities", "applications", "profile", "connections"];

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function App() {
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

  if (auth.isRestoring) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <LoadingState label="Restoring your session" />
      </SafeAreaView>
    );
  }

  if (!auth.isAuthenticated || !auth.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <LoginScreen onLogin={auth.login} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        <PortalHeader
          onLogout={auth.logout}
          profileMeta={`${roleLabel(auth.user.role)} profile - CampusConnect`}
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
