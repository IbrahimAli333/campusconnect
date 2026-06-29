import { Text, View, useWindowDimensions } from "react-native";
import { Bell, GraduationCap, LogOut, Users } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import type { UserRole } from "../../types/portal";
import { IconButton } from "./IconButton";
import { RoleButton } from "./RoleButton";

export function PortalHeader({
  onRoleChange,
  onLogout,
  profileMeta,
  profileName,
  role,
  showNotifications = false,
  showRoleSwitcher = false,
}: {
  onLogout: () => void;
  onRoleChange?: (role: UserRole) => void;
  profileMeta: string;
  profileName: string;
  role: UserRole;
  showNotifications?: boolean;
  showRoleSwitcher?: boolean;
}) {
  const shouldShowRoleSwitcher = showRoleSwitcher && Boolean(onRoleChange);
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  return (
    <>
      <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
        <View style={[styles.brandBlock, isCompact && styles.brandBlockCompact]}>
          <View style={[styles.brandIcon, isCompact && styles.brandIconCompact]}>
            <Users color={palette.surface} size={isCompact ? 20 : 24} strokeWidth={2.4} />
          </View>
          <View style={styles.brandTextBlock}>
            <Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact]}>CampusConnect</Text>
            <Text style={[styles.brandSubtitle, isCompact && styles.brandSubtitleCompact]}>
              Academic and professional network
            </Text>
          </View>
        </View>
        <View style={[styles.topbarActions, isCompact && styles.topbarActionsCompact]}>
          {showNotifications ? <IconButton icon={Bell} accessibilityLabel="Notifications" /> : null}
          <IconButton icon={LogOut} accessibilityLabel="Sign out" onPress={onLogout} />
        </View>
      </View>

      <View style={[styles.rolePanel, isCompact && styles.rolePanelCompact]}>
        <View style={[styles.roleHeader, isCompact && styles.roleHeaderCompact, !shouldShowRoleSwitcher && { marginBottom: 0 }]}>
          <Text style={[styles.roleName, isCompact && styles.roleNameCompact]} numberOfLines={1}>
            {profileName}
          </Text>
          <Text style={[styles.roleMeta, isCompact && styles.roleMetaCompact]} numberOfLines={1}>
            {profileMeta}
          </Text>
        </View>
        {shouldShowRoleSwitcher && onRoleChange ? (
          <View style={styles.roleSwitcher}>
            <RoleButton icon={GraduationCap} label="Student" active={role === "student"} onPress={() => onRoleChange("student")} />
            <RoleButton icon={Users} label="Teacher" active={role === "teacher"} onPress={() => onRoleChange("teacher")} />
          </View>
        ) : null}
      </View>
    </>
  );
}
