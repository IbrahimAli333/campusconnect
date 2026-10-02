import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bell, BriefcaseBusiness, MessageCircle, UserPlus } from "lucide-react-native";

import { headingProps } from "../common/a11y";
import type { IconComponent } from "../common/types";
import { useI18n } from "../../lib/i18n";
import { markPushPromptSeen, setPushNotificationsEnabled, shouldOfferPushPrompt } from "../../lib/notifications";
import { fonts, palette, radii } from "../../styles/theme";
import { DetailSheet, useDetailSheet } from "./DetailSheet";
import { PressableScale } from "./PressableScale";

const BENEFITS: Array<{ icon: IconComponent; text: string }> = [
  { icon: MessageCircle, text: "New messages from your connections" },
  { icon: UserPlus, text: "Connection requests and acceptances" },
  { icon: BriefcaseBusiness, text: "Decisions on your applications" },
];

function PromptBody({ onAllow, onLater }: { onAllow: () => Promise<void>; onLater: () => void }) {
  const { t } = useI18n();
  const sheet = useDetailSheet();
  const [busy, setBusy] = useState(false);

  return (
    <View style={promptStyles.body}>
      <View style={promptStyles.iconWrap}>
        <Bell color={palette.caspian} size={26} strokeWidth={2.4} />
      </View>
      <Text {...headingProps(2)} style={promptStyles.title}>
        {t("Turn on notifications?")}
      </Text>
      <Text style={promptStyles.text}>
        {t("Unibridge only notifies you about things that involve you. You can change this anytime in the Me tab.")}
      </Text>
      <View style={promptStyles.list}>
        {BENEFITS.map(({ icon: Icon, text }) => (
          <View key={text} style={promptStyles.row}>
            <Icon color={palette.caspian} size={18} strokeWidth={2.4} />
            <Text style={promptStyles.rowText}>{t(text)}</Text>
          </View>
        ))}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        haptic="action"
        onPress={async () => {
          setBusy(true);
          await onAllow();
          sheet?.dismiss();
        }}
        style={promptStyles.primary}
      >
        <Text style={promptStyles.primaryText}>{t("Allow notifications")}</Text>
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        onPress={() => {
          onLater();
          sheet?.dismiss();
        }}
        style={promptStyles.secondary}
      >
        <Text style={promptStyles.secondaryText}>{t("Not now")}</Text>
      </PressableScale>
    </View>
  );
}

/**
 * Explain-first notification prompt: shown once per device, after sign-in
 * and terms acceptance, before the one-time OS permission dialog. "Not now"
 * never triggers the OS dialog, so it can still be shown later from the Me
 * tab switch.
 */
export function PushPermissionPrompt({ token }: { token: string | null }) {
  const { language } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (token) {
      void shouldOfferPushPrompt().then((offer) => {
        if (!cancelled && offer) {
          setVisible(true);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!visible || !token) {
    return null;
  }

  return (
    <DetailSheet
      fitContent
      onClose={() => {
        void markPushPromptSeen();
        setVisible(false);
      }}
    >
      <PromptBody
        onAllow={async () => {
          await markPushPromptSeen();
          await setPushNotificationsEnabled(token, true, language);
        }}
        onLater={() => void markPushPromptSeen()}
      />
    </DetailSheet>
  );
}

const promptStyles = StyleSheet.create({
  body: {
    alignItems: "stretch",
    gap: 14,
    paddingBottom: 8,
  },
  iconWrap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.caspianSoft,
    borderRadius: radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  text: {
    color: palette.muted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.lg,
    gap: 12,
    padding: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  rowText: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  primary: {
    alignItems: "center",
    backgroundColor: palette.caspian,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryText: {
    color: palette.surface,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  secondary: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryText: {
    color: palette.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
