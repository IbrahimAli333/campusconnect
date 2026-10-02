import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Bell, GraduationCap, LogOut, Users } from "lucide-react-native";

import { LANGUAGES, useI18n } from "../../lib/i18n";

const brandMark = require("../../../assets/brand-mark.png");

import { palette, styles } from "../../styles/theme";
import { decorativeProps } from "./a11y";
import { IconButton } from "./IconButton";
import { RoleButton } from "./RoleButton";

type UserRole = "member" | "student" | "teacher";

// Endonyms: a language is announced in its own name, so these are not run
// through t().
const LANGUAGE_NAMES: Record<string, string> = {
  az: "Azərbaycanca",
  en: "English",
  ru: "Русский",
};

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
  const { language, setLanguage, t } = useI18n();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  const languageIndex = LANGUAGES.findIndex((entry) => entry.code === language);
  const nextLanguage = LANGUAGES[(languageIndex + 1) % LANGUAGES.length];

  const cycleLanguage = () => {
    if (nextLanguage) {
      setLanguage(nextLanguage.code);
    }
  };

  return (
    <>
      <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
        <View style={[styles.brandBlock, isCompact && styles.brandBlockCompact]}>
          <View style={[styles.brandIcon, isCompact && styles.brandIconCompact]}>
            {/* Decorative: the visible "Unibridge" title next to it names the brand. */}
            <Image
              {...decorativeProps}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={brandMark}
              style={{ height: isCompact ? 16 : 20, width: isCompact ? 24 : 28 }}
            />
          </View>
          <View style={styles.brandTextBlock}>
            <Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact]}>Unibridge</Text>
            <Text style={[styles.brandSubtitle, isCompact && styles.brandSubtitleCompact]} numberOfLines={1}>
              {profileName} · {profileMeta}
            </Text>
          </View>
        </View>
        <View style={[styles.topbarActions, isCompact && styles.topbarActionsCompact]}>
          <Pressable
            // The visible text is only the code ("EN"), so the name keeps the
            // code (label-in-name, WCAG 2.5.3) and says what the button does.
            accessibilityHint={
              nextLanguage
                ? t("Switches to {language}", {
                    language: LANGUAGE_NAMES[nextLanguage.code] ?? nextLanguage.label,
                  })
                : undefined
            }
            accessibilityLabel={t("Change language, current: {code}", { code: language.toUpperCase() })}
            accessibilityRole="button"
            onPress={cycleLanguage}
            style={({ pressed }) => [
              styles.iconButton,
              isCompact && styles.iconButtonCompact,
              pressed && styles.pressed,
            ]}
          >
            <Text style={{ color: palette.muted, fontSize: isCompact ? 11 : 12, fontWeight: "700" }}>
              {language.toUpperCase()}
            </Text>
          </Pressable>
          {showNotifications ? <IconButton icon={Bell} accessibilityLabel={t("Notifications")} /> : null}
          <IconButton icon={LogOut} accessibilityLabel={t("Sign out")} onPress={onLogout} />
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
