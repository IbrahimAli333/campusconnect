import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const palette = {
  page: "#F1EADF",
  surface: "#FFFDF6",
  surfaceAlt: "#F4EFE6",
  paper: "#FFF7EA",
  paperMuted: "#E8DFD2",
  bond: "#FFFDF8",
  buff: "#F6E2B9",
  buffBorder: "#E3B66A",
  charcoal: "#202327",
  navy: "#0A2540",
  navySoft: "#E7EEF4",
  border: "#D8CDC0",
  text: "#15181D",
  muted: "#596170",
  faint: "#8B97A6",
  blue: "#1F5FBF",
  blueSoft: "#E8F1FF",
  teal: "#0F766E",
  tealSoft: "#E2F3EF",
  amber: "#B76312",
  amberSoft: "#FFF0D6",
  red: "#B42318",
  redSoft: "#FDE8E7",
  green: "#177245",
  greenSoft: "#E6F4EA",
  violet: "#6D28D9",
  violetSoft: "#F0E9FF",
};

interface ShadowStyleOptions {
  color: string;
  offset: {
    height: number;
    width: number;
  };
  opacity: number;
  radius: number;
}

interface TextShadowStyleOptions {
  color: string;
  offset: {
    height: number;
    width: number;
  };
  radius: number;
}

export function platformShadow({ color, offset, opacity, radius }: ShadowStyleOptions): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0")}`,
    };
  }

  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

type WebPaperStyle = ViewStyle & {
  backgroundBlendMode?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  boxShadow?: string;
  outlineColor?: string;
  outlineStyle?: string;
  outlineWidth?: number;
};

type WebTextStyle = TextStyle & {
  textShadow?: string;
};

export function paperTexture(kind: "page" | "sheet" = "sheet"): ViewStyle {
  if (Platform.OS !== "web") {
    return {};
  }

  const pageTexture =
    "radial-gradient(circle at 10px 12px, rgba(61, 52, 39, 0.055) 0 0.7px, transparent 0.9px), " +
    "radial-gradient(circle at 28px 30px, rgba(255, 255, 255, 0.7) 0 0.8px, transparent 1px), " +
    "linear-gradient(180deg, rgba(255, 253, 248, 0.3), rgba(222, 211, 194, 0.18))";
  const sheetTexture =
    "radial-gradient(circle at 8px 10px, rgba(61, 52, 39, 0.035) 0 0.6px, transparent 0.8px), " +
    "linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(248, 241, 230, 0.2))";

  return {
    backgroundImage: kind === "page" ? pageTexture : sheetTexture,
    backgroundSize: kind === "page" ? "34px 34px, 42px 42px, 100% 100%" : "24px 24px, 100% 100%",
  } as WebPaperStyle;
}

export function paperShadow(kind: "sheet" | "strip" | "pressed" | "cutout" | "sunken" = "sheet"): ViewStyle {
  if (Platform.OS === "web") {
    const shadows: Record<typeof kind, string> = {
      cutout:
        "inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 4px 0 #075B55, 0 12px 18px rgba(8, 117, 104, 0.18)",
      pressed:
        "inset 0 2px 3px rgba(47, 39, 29, 0.22), inset 0 -1px 0 rgba(255, 255, 255, 0.65)",
      sheet:
        "inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 3px 0 #E1D7C8, 0 18px 24px rgba(35, 29, 20, 0.09)",
      strip:
        "inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 2px 0 #E5DBCD, 0 12px 18px rgba(35, 29, 20, 0.08)",
      sunken:
        "inset 0 2px 3px rgba(69, 58, 42, 0.16), inset 0 -1px 0 rgba(255, 255, 255, 0.62)",
    };

    return { boxShadow: shadows[kind] } as WebPaperStyle;
  }

  if (kind === "pressed" || kind === "sunken") {
    return {};
  }

  return platformShadow({
    color: kind === "cutout" ? "#0F766E" : "#3C3124",
    offset: { height: kind === "strip" ? 7 : 10, width: 0 },
    opacity: kind === "cutout" ? 0.18 : 0.08,
    radius: kind === "strip" ? 13 : 18,
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
    ...paperTexture("page"),
  },
  shell: {
    alignSelf: "center",
    flex: 1,
    maxWidth: 1120,
    paddingTop: Platform.OS === "android" ? 16 : 0,
    width: "100%",
  },
  shellCompact: {
    maxWidth: "100%",
  },
  topbar: {
    alignItems: "center",
    backgroundColor: palette.bond,
    borderBottomColor: "#D7CBBE",
    borderBottomWidth: 2,
    borderColor: "#E2D9CC",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  topbarCompact: {
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
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
    backgroundColor: "#087568",
    borderBottomColor: "#075B55",
    borderBottomWidth: 3,
    borderColor: "#0A8A7A",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
    ...paperShadow("cutout"),
  },
  brandIconCompact: {
    height: 30,
    width: 30,
  },
  brandTextBlock: {
    flexShrink: 1,
  },
  brandTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  brandTitleCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  brandSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  brandSubtitleCompact: {
    fontSize: 10,
    lineHeight: 13,
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
    backgroundColor: "#FAF5EC",
    borderColor: "#DCD1C3",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
    ...paperShadow("sunken"),
  },
  iconButtonCompact: {
    height: 34,
    width: 34,
  },
  rolePanel: {
    backgroundColor: palette.bond,
    borderBottomColor: "#D6CABD",
    borderBottomWidth: 2,
    borderColor: "#E3DACD",
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...paperTexture("sheet"),
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
    fontWeight: "900",
  },
  roleNameCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  roleMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  roleMetaCompact: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 0,
  },
  roleSwitcher: {
    backgroundColor: "#F5EFE5",
    borderColor: "#D9CFC1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 4,
    ...paperShadow("sunken"),
  },
  roleButton: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  roleButtonActive: {
    backgroundColor: palette.charcoal,
    ...paperShadow("pressed"),
  },
  roleButtonText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  roleButtonTextActive: {
    color: palette.surface,
  },
  segmentedWrap: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  segmentedWrapCompact: {
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  segmentedGrid: {
    alignSelf: "center",
    backgroundColor: palette.bond,
    borderBottomColor: "#D6CABD",
    borderBottomWidth: 2,
    borderColor: "#E2D9CC",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: 720,
    padding: 4,
    width: "100%",
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  segmentedGridCompact: {
    gap: 4,
    padding: 3,
  },
  segmentedItem: {
    alignItems: "center",
    backgroundColor: "#FCF7EF",
    borderColor: "#E7DED1",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 104,
    paddingHorizontal: 14,
    ...paperShadow("sunken"),
  },
  segmentedItemCompact: {
    flex: 1,
    gap: 2,
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 5,
  },
  segmentedItemPhone: {
    minHeight: 36,
    paddingHorizontal: 3,
  },
  segmentedItemActive: {
    backgroundColor: "#E8DECF",
    borderColor: "#C9BAA7",
    ...paperShadow("pressed"),
  },
  segmentedText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  segmentedTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  segmentedTextPhone: {
    fontSize: 10,
    lineHeight: 12,
  },
  segmentedTextActive: {
    color: palette.charcoal,
    ...webSafeTextShadow({
      color: "rgba(255, 255, 255, 0.55)",
      offset: { height: 1, width: 0 },
      radius: 0,
    }),
  },
  segmentedBadge: {
    alignItems: "center",
    backgroundColor: palette.teal,
    borderColor: palette.tealSoft,
    borderRadius: 9,
    borderWidth: 1,
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
    fontWeight: "800",
    lineHeight: 13,
  },
  content: {
    alignSelf: "center",
    maxWidth: 1040,
    padding: 20,
    paddingBottom: 32,
    width: "100%",
  },
  contentCompact: {
    padding: 12,
    paddingBottom: 24,
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
    justifyContent: "center",
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
    borderColor: palette.border,
    borderBottomColor: "#D4C8BA",
    borderBottomWidth: 2,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    padding: 14,
    ...paperTexture("sheet"),
  },
  statIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    marginBottom: 12,
    width: 38,
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 7,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  sectionActionText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    backgroundColor: palette.surface,
    borderBottomColor: "#D0C4B5",
    borderBottomWidth: 3,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 13,
    minWidth: 232,
    padding: 16,
    ...paperTexture("sheet"),
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
    color: palette.teal,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 8,
    flex: 1,
    padding: 9,
  },
  metricValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  chip: {
    alignItems: "center",
    borderRadius: 5,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 9,
    ...paperTexture("sheet"),
  },
  chipText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  listRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderBottomColor: "#D7CBBE",
    borderBottomWidth: 2,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  listRowCompact: {
    paddingVertical: 10,
  },
  timeBox: {
    alignItems: "center",
    backgroundColor: palette.blueSoft,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    width: 58,
  },
  timeText: {
    color: palette.blue,
    fontSize: 14,
    fontWeight: "900",
  },
  timeDay: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  documentIcon: {
    alignItems: "center",
    backgroundColor: palette.blueSoft,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  smallText: {
    color: palette.faint,
    fontSize: 12,
    fontWeight: "700",
  },
  alertPanel: {
    alignItems: "center",
    backgroundColor: palette.amberSoft,
    borderColor: "#F4D39A",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  alertIcon: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  composer: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: palette.bond,
    borderBottomColor: "#D5CABD",
    borderBottomWidth: 2,
    borderColor: "#DDD3C6",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  textInput: {
    color: palette.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 40,
    ...webInputReset(),
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: palette.teal,
    borderBottomColor: "#075B55",
    borderBottomWidth: 3,
    borderColor: "#0A8A7A",
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
    ...paperShadow("cutout"),
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderBottomColor: "#D7CBBE",
    borderBottomWidth: 2,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    minHeight: 88,
    padding: 16,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  errorPanel: {
    backgroundColor: palette.redSoft,
    borderColor: "#F4B9B4",
  },
  stateIcon: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
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
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  stateText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: palette.red,
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  gradeItemSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gradeItemOption: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 260,
    minHeight: 38,
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
    fontWeight: "900",
  },
  gradeItemOptionTextActive: {
    color: palette.surface,
  },
  studentRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
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
    fontWeight: "900",
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
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  scoreValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    minWidth: 34,
    textAlign: "center",
  },
  scoreInput: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
    height: 36,
    minWidth: 58,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
