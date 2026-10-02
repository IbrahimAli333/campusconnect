import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { decorativeProps, headingProps } from "../common/a11y";
import { EightPointStar, FlagStripe, HeroPattern } from "../brand/Ornaments";
import { LANGUAGES, useI18n } from "../../lib/i18n";
import { tapHaptic } from "../../lib/haptics";
import { fonts, heroGradient, palette, radii } from "../../styles/theme";

const brandMark = require("../../../assets/brand-mark.png");

// Endonyms: a language is announced in its own name, so not run through t().
const LANGUAGE_NAMES: Record<string, string> = {
  az: "Azərbaycanca",
  en: "English",
  ru: "Русский",
};

/**
 * Gradient hero at the top of every tab: brand, language and sign-out
 * controls, then the tab's greeting/title over a buta-and-star pattern, with
 * a short flag-tricolour accent under the title.
 */
export function AppHeader({
  onLogout,
  profileMeta,
  profileName,
  subtitle,
  title,
}: {
  onLogout: () => void;
  profileMeta: string;
  profileName: string;
  subtitle?: string;
  title: string;
}) {
  const { language, setLanguage, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  const languageIndex = LANGUAGES.findIndex((entry) => entry.code === language);
  const nextLanguage = LANGUAGES[(languageIndex + 1) % LANGUAGES.length];

  return (
    <LinearGradient
      colors={heroGradient}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[headerStyles.hero, { paddingTop: insets.top + (isCompact ? 12 : 18) }]}
    >
      <HeroPattern />
      <View style={headerStyles.inner}>
        <View style={headerStyles.topRow}>
          <View style={headerStyles.brand}>
            <View style={headerStyles.brandMark}>
              <Image
                {...decorativeProps}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={brandMark}
                style={{ height: 18, width: 26 }}
              />
            </View>
            <View style={headerStyles.brandText}>
              <Text style={headerStyles.brandName}>Unibridge</Text>
              <Text numberOfLines={1} style={headerStyles.brandMeta}>
                {profileName} · {profileMeta}
              </Text>
            </View>
          </View>
          <View style={headerStyles.actions}>
            <Pressable
              // Visible text is only the code ("AZ"); the name keeps it
              // (label-in-name, WCAG 2.5.3) and says what the button does.
              accessibilityHint={
                nextLanguage
                  ? t("Switches to {language}", { language: LANGUAGE_NAMES[nextLanguage.code] ?? nextLanguage.label })
                  : undefined
              }
              accessibilityLabel={t("Change language, current: {code}", { code: language.toUpperCase() })}
              accessibilityRole="button"
              onPress={() => {
                tapHaptic();
                if (nextLanguage) {
                  setLanguage(nextLanguage.code);
                }
              }}
              style={({ pressed }) => [headerStyles.headerButton, pressed && headerStyles.pressed]}
            >
              <Text style={headerStyles.languageText}>{language.toUpperCase()}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={t("Sign out")}
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [headerStyles.headerButton, pressed && headerStyles.pressed]}
            >
              <LogOut color="#FFFFFF" size={18} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View style={headerStyles.titleBlock}>
          <View style={headerStyles.titleRow}>
            <EightPointStar color={palette.saffron} size={isCompact ? 16 : 18} />
            <Text {...headingProps(2)} style={[headerStyles.title, isCompact && headerStyles.titleCompact]}>
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
          <FlagStripe height={4} style={headerStyles.flagAccent} />
        </View>
      </View>
    </LinearGradient>
  );
}

const headerStyles = StyleSheet.create({
  hero: {
    overflow: "hidden",
  },
  inner: {
    alignSelf: "center",
    gap: 22,
    maxWidth: 1040,
    // Leaves room for the page sheet that overlaps the hero's bottom edge.
    paddingBottom: 52,
    paddingHorizontal: 20,
    width: "100%",
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 10,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  brandText: {
    flexShrink: 1,
  },
  brandName: {
    color: "#FFFFFF",
    fontFamily: fonts.extrabold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  brandMeta: {
    color: "#C9D6E3",
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  pressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  languageText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  titleBlock: {
    gap: 6,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  flagAccent: {
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
    width: 72,
  },
  subtitle: {
    color: "#D6E2EC",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 560,
  },
});
