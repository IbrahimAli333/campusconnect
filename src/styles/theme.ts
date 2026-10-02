import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

/**
 * Unibridge design tokens — "Caspian" theme.
 *
 * Inspired by Azerbaijan: the flag (sky blue, red, green, and the white
 * 8-point star), the Caspian Sea, Baku nights, pomegranate (nar), and
 * saffron. Every text/background pair below is checked to WCAG AA
 * (4.5:1 text, 3:1 UI boundaries); see COMPLIANCE.md.
 */
export const palette = {
  // Surfaces: warm ivory like silk carpet wool, with white cards.
  page: "#F6F3ED",
  surface: "#FFFFFF",
  surfaceAlt: "#F1ECE3",
  paper: "#FFFFFF",
  paperMuted: "#EAE4D9",
  bond: "#FFFFFF",
  // Saffron highlight (strong match scores).
  buff: "#FBF0D9",
  buffBorder: "#EBC77A",
  // Ink and Baku-night navy.
  charcoal: "#13233F",
  navy: "#0E2440",
  navySoft: "#E6ECF3",
  border: "#E6E0D5",
  hairline: "#EEE8DD",
  text: "#13233F",
  muted: "#576071", // 5.7:1 on page
  faint: "#5E6676", // >=4.5:1 on page, white, and surfaceAlt
  // Text-field boundary: 3:1 against white and page (WCAG 1.4.11).
  fieldBorder: "#8B8578",
  // Caspian blue is the primary/action colour (6.5:1 with white text).
  blue: "#0B6585",
  blueSoft: "#E3F1F5",
  teal: "#0B6585",
  tealSoft: "#E3F1F5",
  amber: "#8A5300",
  amberSoft: "#FBF0D9",
  red: "#B3261E", // pomegranate
  redSoft: "#FBE9E7",
  green: "#2F7A2A",
  greenSoft: "#E7F3E3",
  violet: "#6B3FA0",
  violetSoft: "#F1EAF9",
  // Azerbaijani accents (decorative; not used for small text).
  caspian: "#0B6585",
  caspianDeep: "#084E68",
  caspianSoft: "#E3F1F5",
  flagBlue: "#00B5E2",
  flagRed: "#EF3340",
  flagGreen: "#509E2F",
  saffron: "#F2B233",
  sky: "#8FD3F0",
  pomegranate: "#B3261E",
};

/** Header gradient: Baku night fading into the Caspian. */
export const heroGradient = ["#0E2440", "#0B4A66", "#0B6585"] as const;

/**
 * Inter (SIL Open Font License 1.1) — covers every Azerbaijani letter
 * (Ə ə, Ğ ğ, I ı, İ, Ş ş, Ç ç, Ö ö, Ü ü), Cyrillic for Russian, and ₼.
 * Each weight is its own family so Android never fakes bold.
 */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

interface ShadowStyleOptions {
  color: string;
  offset: {
    height: number;
    width: number;
  };
  opacity: number;
  radius: number;
  elevation?: number;
}

interface TextShadowStyleOptions {
  color: string;
  offset: {
    height: number;
    width: number;
  };
  radius: number;
}

export function platformShadow({ color, elevation = 2, offset, opacity, radius }: ShadowStyleOptions): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0")}`,
    };
  }

  return {
    elevation,
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

type WebPaperStyle = ViewStyle & {
  boxShadow?: string;
  outlineColor?: string;
  outlineStyle?: string;
  outlineWidth?: number;
};

type WebTextStyle = TextStyle & {
  textShadow?: string;
};

export function paperTexture(_kind: "page" | "sheet" = "sheet"): ViewStyle {
  // Flat surfaces; kept so existing call sites stay valid.
  return {};
}

/** Soft, warm elevation. "cutout" is the coloured glow under primary buttons. */
export function paperShadow(kind: "sheet" | "strip" | "pressed" | "cutout" | "sunken" = "sheet"): ViewStyle {
  if (kind === "pressed" || kind === "sunken") {
    return {};
  }

  if (Platform.OS === "web") {
    const shadows: Record<"sheet" | "strip" | "cutout", string> = {
      cutout: "0 6px 16px rgba(11, 101, 133, 0.28)",
      sheet: "0 1px 2px rgba(19, 35, 63, 0.04), 0 10px 28px rgba(19, 35, 63, 0.07)",
      strip: "0 1px 2px rgba(19, 35, 63, 0.04), 0 4px 14px rgba(19, 35, 63, 0.05)",
    };
    return { boxShadow: shadows[kind] } as WebPaperStyle;
  }

  return platformShadow({
    color: kind === "cutout" ? palette.caspian : "#13233F",
    elevation: kind === "sheet" ? 3 : 2,
    offset: { height: kind === "strip" ? 3 : 8, width: 0 },
    opacity: kind === "cutout" ? 0.25 : 0.07,
    radius: kind === "strip" ? 8 : 18,
  });
}

export function webSafeTextShadow({ color, offset, radius }: TextShadowStyleOptions): TextStyle {
  if (Platform.OS === "web") {
    return {
      textShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}`,
    } as WebTextStyle;
  }

  return {
    textShadowColor: color,
    textShadowOffset: offset,
    textShadowRadius: radius,
  };
}

export function webInputReset(): ViewStyle {
  if (Platform.OS !== "web") {
    return {};
  }

  return {
    outlineColor: "transparent",
    outlineStyle: "none",
    outlineWidth: 0,
  } as WebPaperStyle;
}

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.page,
  },
  shell: {
    alignSelf: "center",
    flex: 1,
    maxWidth: 1120,
    width: "100%",
  },
  shellCompact: {
    maxWidth: "100%",
  },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  topbarCompact: {
    gap: 8,
  },
  brandBlock: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 10,
  },
  brandBlockCompact: {
    gap: 8,
  },
  brandIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  brandIconCompact: {
    height: 36,
    width: 36,
  },
  brandTextBlock: {
    flexShrink: 1,
  },
  brandTitle: {
    color: palette.surface,
    fontSize: 18,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.2,
  },
  brandTitleCompact: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 21,
  },
  brandSubtitle: {
    color: "#C9D6E3",
    fontSize: 12,
    fontFamily: fonts.medium,
    marginTop: 1,
  },
  brandSubtitleCompact: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 0,
  },
  topbarActions: {
    flexDirection: "row",
    gap: 8,
  },
  topbarActionsCompact: {
    gap: 6,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: radii.md,
    borderWidth: 1,
    // 44x44 minimum touch target (Apple HIG / WCAG 2.5.5).
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconButtonCompact: {
    height: 44,
    width: 44,
  },
  rolePanel: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...paperShadow("strip"),
  },
  rolePanelCompact: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleHeader: {
    marginBottom: 8,
  },
  roleHeaderCompact: {
    marginBottom: 6,
  },
  roleName: {
    color: palette.text,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  roleNameCompact: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  roleMeta: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: fonts.semibold,
    marginTop: 1,
  },
  roleMetaCompact: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 0,
  },
  roleSwitcher: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    padding: 4,
  },
  roleButton: {
    alignItems: "center",
    borderRadius: radii.sm,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  roleButtonActive: {
    backgroundColor: palette.navy,
  },
  roleButtonText: {
    color: palette.muted,
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  roleButtonTextActive: {
    color: palette.surface,
  },
  segmentedWrap: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  segmentedWrapCompact: {
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  segmentedGrid: {
    alignSelf: "center",
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 6,
    maxWidth: 720,
    padding: 4,
    width: "100%",
    ...paperShadow("strip"),
  },
  segmentedGridCompact: {
    gap: 4,
    padding: 3,
  },
  segmentedItem: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 104,
    paddingHorizontal: 14,
  },
  segmentedItemCompact: {
    flex: 1,
    gap: 2,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 5,
  },
  segmentedItemPhone: {
    minHeight: 44,
    paddingHorizontal: 3,
  },
  segmentedItemActive: {
    backgroundColor: palette.navy,
  },
  segmentedText: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  segmentedTextCompact: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  segmentedTextPhone: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 12,
  },
  segmentedTextActive: {
    color: "#FFFFFF",
  },
  segmentedBadge: {
    alignItems: "center",
    backgroundColor: palette.pomegranate,
    borderColor: "#FFFFFF",
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: 3,
    top: 3,
  },
  segmentedBadgeText: {
    color: palette.surface,
    fontSize: 10,
    fontFamily: fonts.bold,
    lineHeight: 13,
  },
  content: {
    alignSelf: "center",
    maxWidth: 1040,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  contentCompact: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  stack: {
    gap: 16,
    width: "100%",
  },
  grid: {
    gap: 14,
    width: "100%",
  },
  gridWide: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  split: {
    gap: 14,
  },
  splitWide: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  splitColumn: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  statCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    flex: 1,
    minWidth: 150,
    padding: 14,
    ...paperShadow("strip"),
  },
  statIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 38,
    justifyContent: "center",
    marginBottom: 12,
    width: 38,
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontFamily: fonts.extrabold,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.2,
  },
  sectionAction: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionActionText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: 14,
    minWidth: 232,
    padding: 18,
    ...paperShadow("sheet"),
  },
  compactCard: {
    minWidth: 0,
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: palette.caspian,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    flex: 1,
    padding: 10,
  },
  metricValue: {
    color: palette.text,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 11,
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  chip: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 26,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    textTransform: "capitalize",
  },
  listRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    ...paperShadow("strip"),
  },
  listRowCompact: {
    paddingVertical: 12,
  },
  timeBox: {
    alignItems: "center",
    backgroundColor: palette.blueSoft,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 48,
    width: 58,
  },
  timeText: {
    color: palette.blue,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  timeDay: {
    color: palette.muted,
    fontSize: 10,
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  documentIcon: {
    alignItems: "center",
    backgroundColor: palette.blueSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontFamily: fonts.bold,
    lineHeight: 20,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: fonts.medium,
    lineHeight: 18,
    marginTop: 2,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  smallText: {
    color: palette.faint,
    fontSize: 13,
    fontFamily: fonts.medium,
    lineHeight: 18,
  },
  alertPanel: {
    alignItems: "center",
    backgroundColor: palette.amberSoft,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  alertIcon: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  composer: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.fieldBorder,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    ...paperShadow("strip"),
  },
  textInput: {
    color: palette.text,
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    minHeight: 44,
    ...webInputReset(),
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: palette.caspian,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
    ...paperShadow("cutout"),
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: palette.surface,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    minHeight: 88,
    padding: 18,
    ...paperShadow("strip"),
  },
  errorPanel: {
    backgroundColor: palette.redSoft,
    borderColor: "#F2C9C4",
  },
  stateIcon: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  errorIcon: {
    backgroundColor: palette.surface,
  },
  stateBody: {
    flex: 1,
    minWidth: 0,
  },
  stateTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 16,
    fontFamily: fonts.bold,
    lineHeight: 21,
  },
  stateText: {
    fontFamily: fonts.regular,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: palette.red,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  retryButtonText: {
    color: palette.surface,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  gradeItemSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gradeItemOption: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    maxWidth: 260,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  gradeItemOptionActive: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  gradeItemOptionText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  gradeItemOptionTextActive: {
    color: palette.surface,
  },
  studentRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 68,
    padding: 12,
  },
  attendanceButtons: {
    flexDirection: "row",
    gap: 6,
  },
  attendanceButton: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  attendanceButtonActive: {
    backgroundColor: palette.green,
    borderColor: palette.green,
  },
  attendanceButtonLate: {
    backgroundColor: palette.amber,
    borderColor: palette.amber,
  },
  attendanceButtonAbsent: {
    backgroundColor: palette.red,
    borderColor: palette.red,
  },
  attendanceButtonExcused: {
    backgroundColor: palette.blue,
    borderColor: palette.blue,
  },
  attendanceButtonText: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  attendanceButtonTextActive: {
    color: palette.surface,
  },
  scoreEditor: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  scoreButton: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  scoreValue: {
    color: palette.text,
    fontSize: 18,
    fontFamily: fonts.bold,
    minWidth: 34,
    textAlign: "center",
  },
  scoreInput: {
    backgroundColor: palette.surface,
    borderColor: palette.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    fontFamily: fonts.bold,
    height: 44,
    minWidth: 58,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
