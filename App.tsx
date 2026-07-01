import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, ScrollView, View, useWindowDimensions } from "react-native";

import { PortalHeader } from "./src/components/common/PortalHeader";
import { LoadingState } from "./src/components/common/PortalState";
import { SegmentedControl } from "./src/components/common/SegmentedControl";
import { useAuthStore } from "./src/lib/auth/auth-store";
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
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

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

        <SegmentedControl<NetworkTab> active={activeTab} items={networkTabs} onChange={setActiveTab} />

        <ScrollView contentContainerStyle={[styles.content, isCompact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <CampusConnectScreen activeTab={activeTab} token={auth.token} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
