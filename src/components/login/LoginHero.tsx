import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { decorativeProps, headingProps } from "../common/a11y";
import type { IconComponent } from "../common/types";
import { EightPointStar, FlagStripe, FlameSkyline, HeroPattern } from "../brand/Ornaments";
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
 * Upper-cases a short label for display. `textTransform: "uppercase"` turns
 * Azerbaijani "i" into a dotless "I" ("ISTIFADƏÇI"), so map the dotted and
 * dotless pairs first to get "İSTİFADƏÇİ".
 */
export function displayUppercase(text: string, language: string): string {
  const prepared = language === "az" ? text.replace(/i/g, "İ").replace(/ı/g, "I") : text;
  return prepared.toUpperCase();
}

/** How far the auth card overlaps the bottom edge of the phone banner. */
export const BANNER_CARD_OVERLAP = 36;

/** Cycles AZ -> EN -> RU so people can switch language before signing in. */
function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  const languageIndex = LANGUAGES.findIndex((entry) => entry.code === language);
  const nextLanguage = LANGUAGES[(languageIndex + 1) % LANGUAGES.length];

  return (
    <Pressable
      // Visible text is only the code ("AZ"); the name keeps it (label-in-name,
      // WCAG 2.5.3) and the hint says what the button does.
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
      style={({ pressed }) => [heroStyles.languageButton, pressed && heroStyles.languageButtonPressed]}
    >
      <Text style={heroStyles.languageText}>{language.toUpperCase()}</Text>
    </Pressable>
  );
}

function BrandRow({ large = false }: { large?: boolean }) {
  const { t } = useI18n();

  return (
    <View style={heroStyles.topRow}>
      <View style={heroStyles.brand}>
        <View style={[heroStyles.brandMark, large && heroStyles.brandMarkLarge]}>
          <Image
            {...decorativeProps}
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={brandMark}
            style={large ? heroStyles.brandImageLarge : heroStyles.brandImage}
          />
        </View>
        <View style={heroStyles.brandText}>
          <Text numberOfLines={1} style={[heroStyles.brandName, large && heroStyles.brandNameLarge]}>
            Unibridge
          </Text>
          <Text numberOfLines={2} style={heroStyles.brandMeta}>
            {t("Academic and professional network")}
          </Text>
        </View>
      </View>
      <LanguageToggle />
    </View>
  );
}

/**
 * Compact gradient banner for phones and tablets: brand, a short welcome
 * title, the flag accent, and the Flame Towers rising behind the auth card
 * that overlaps its bottom edge.
 */
export function LoginBanner({ body, compact, title }: { body?: string; compact: boolean; title: string }) {
  return (
    <LinearGradient
      colors={heroGradient}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[heroStyles.banner, compact && heroStyles.bannerCompact]}
    >
      <HeroPattern />
      <FlameSkyline
        height={compact ? 118 : 140}
        style={[heroStyles.bannerSkyline, { bottom: BANNER_CARD_OVERLAP - 12 }]}
      />
      <View style={heroStyles.bannerInner}>
        <BrandRow />
        <View style={heroStyles.titleBlock}>
          <View style={heroStyles.titleRow}>
            <EightPointStar color={palette.saffron} size={compact ? 16 : 18} style={heroStyles.titleStar} />
            <Text {...headingProps(2)} style={[heroStyles.bannerTitle, compact && heroStyles.bannerTitleCompact]}>
              {title}
            </Text>
          </View>
          {body ? <Text style={heroStyles.bannerBody}>{body}</Text> : null}
          <FlagStripe height={4} style={heroStyles.flagAccent} />
        </View>
      </View>
    </LinearGradient>
  );
}

export interface HeroHighlight {
  body: string;
  icon: IconComponent;
  title: string;
}

/** Tall gradient panel for the wide two-column layout. */
export function LoginHeroPanel({
  body,
  eyebrow,
  height,
  highlights,
  title,
}: {
  body: string;
  eyebrow: string;
  /** Usually the viewport height, so the skyline shows on the first screen. */
  height: number;
  highlights: HeroHighlight[];
  title: string;
}) {
  const { language } = useI18n();

  return (
    <LinearGradient
      colors={heroGradient}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[heroStyles.panel, { minHeight: height }]}
    >
      <HeroPattern opacity={0.12} />
      {/* Caspian glow along the bottom edge that the skyline stands on. */}
      <LinearGradient
        {...decorativeProps}
        colors={["rgba(0, 181, 226, 0)", "rgba(0, 181, 226, 0.2)"]}
        pointerEvents="none"
        style={heroStyles.seaWash}
      />
      <View style={heroStyles.panelContent}>
        <BrandRow large />

        <View style={heroStyles.panelMiddle}>
          <View style={heroStyles.panelCopy}>
            <View style={heroStyles.eyebrowRow}>
              <EightPointStar color={palette.saffron} size={14} />
              <Text style={heroStyles.panelEyebrow}>{displayUppercase(eyebrow, language)}</Text>
            </View>
            <Text {...headingProps(2)} style={heroStyles.panelTitle}>
              {title}
            </Text>
            <Text style={heroStyles.panelBody}>{body}</Text>
            <FlagStripe height={4} style={heroStyles.flagAccentWide} />
          </View>

          <View style={heroStyles.highlights}>
            {highlights.map((item) => (
              <HighlightTile icon={item.icon} key={item.title} title={item.title}>
                {item.body}
              </HighlightTile>
            ))}
          </View>
        </View>
      </View>
      <FlameSkyline height={150} style={heroStyles.panelSkyline} />
    </LinearGradient>
  );
}

function HighlightTile({ children, icon: Icon, title }: { children: ReactNode; icon: IconComponent; title: string }) {
  return (
    <View style={heroStyles.highlightTile}>
      <View {...decorativeProps} style={heroStyles.highlightIcon}>
        <Icon color={palette.saffron} size={18} strokeWidth={2.4} />
      </View>
      <View style={heroStyles.highlightCopy}>
        <Text style={heroStyles.highlightTitle}>{title}</Text>
        <Text style={heroStyles.highlightBody}>{children}</Text>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  // Shared brand row ----------------------------------------------------
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
    gap: 12,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  brandMarkLarge: {
    borderRadius: 16,
    height: 52,
    width: 52,
  },
  brandImage: {
    height: 20,
    width: 30,
  },
  brandImageLarge: {
    height: 24,
    width: 36,
  },
  brandText: {
    flexShrink: 1,
  },
  brandName: {
    color: "#FFFFFF",
    fontFamily: fonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  brandNameLarge: {
    fontSize: 22,
    lineHeight: 27,
  },
  brandMeta: {
    color: "#C9D6E3",
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  languageButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  languageButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  languageText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  flagAccent: {
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
    width: 72,
  },
  flagAccentWide: {
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
    width: 96,
  },

  // Phone / tablet banner -------------------------------------------------
  banner: {
    overflow: "hidden",
    // Room for the skyline plus the card that overlaps the bottom edge.
    paddingBottom: BANNER_CARD_OVERLAP + 112,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  bannerCompact: {
    paddingBottom: BANNER_CARD_OVERLAP + 96,
    paddingTop: 16,
  },
  bannerSkyline: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  bannerInner: {
    alignSelf: "center",
    gap: 22,
    maxWidth: 560,
    width: "100%",
  },
  titleBlock: {
    gap: 6,
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  titleStar: {
    marginTop: 9,
  },
  bannerTitle: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  bannerTitleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  bannerBody: {
    color: "#D6E2EC",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 520,
  },

  // Wide hero panel -------------------------------------------------------
  panel: {
    borderRadius: 28,
    overflow: "hidden",
  },
  panelContent: {
    flex: 1,
    gap: 26,
    paddingHorizontal: 40,
    paddingTop: 36,
  },
  panelMiddle: {
    flex: 1,
    gap: 24,
    justifyContent: "center",
  },
  panelCopy: {
    gap: 12,
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  panelEyebrow: {
    color: palette.saffron,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
  },
  panelTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.extrabold,
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 43,
    maxWidth: 520,
  },
  panelBody: {
    color: "#D6E2EC",
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 500,
  },
  highlights: {
    gap: 10,
    maxWidth: 520,
  },
  highlightTile: {
    alignItems: "flex-start",
    // Navy-tinted glass darkens the gradient behind it, keeping the light
    // body text well above 4.5:1 wherever the tile sits.
    backgroundColor: "rgba(8, 24, 44, 0.38)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  highlightIcon: {
    alignItems: "center",
    backgroundColor: "rgba(242, 178, 51, 0.16)",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  highlightCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  highlightTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  highlightBody: {
    color: "#D6E2EC",
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  panelSkyline: {
    marginTop: 8,
  },
  seaWash: {
    bottom: 0,
    height: 64,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
