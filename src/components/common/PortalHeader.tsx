import { Text, View, useWindowDimensions } from "react-native";
import { Bell, GraduationCap, LogOut, Users } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import { IconButton } from "./IconButton";
import { RoleButton } from "./RoleButton";

type UserRole = "member" | "student" | "teacher";

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
            <Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact]}>Unibridge</Text>
            <Text style={[styles.brandSubtitle, isCompact && styles.brandSubtitleCompact]} numberOfLines={1}>
              {profileName} · {profileMeta}
            </Text>
          </View>
        </View>
        <View style={[styles.topbarActions, isCompact && styles.topbarActionsCompact]}>
          {showNotifications ? <IconButton icon={Bell} accessibilityLabel="Notifications" /> : null}
          <IconButton icon={LogOut} accessibilityLabel="Sign out" onPress={onLogout} />
        </View>
      </View>

      {shouldShowRoleSwitcher && onRoleChange ? (
        <View style={[styles.rolePanel, isCompact && styles.rolePanelCompact]}>
          <View style={styles.roleSwitcher}>
            <RoleButton icon={GraduationCap} label="Student" active={role === "student"} onPress={() => onRoleChange("student")} />
            <RoleButton icon={Users} label="Teacher" active={role === "teacher"} onPress={() => onRoleChange("teacher")} />
          </View>
        </View>
      ) : null}
    </>
  );
}
