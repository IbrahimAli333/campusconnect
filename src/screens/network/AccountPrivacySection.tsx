import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, Download, ExternalLink, Scale } from "lucide-react-native";

import { SectionHeader } from "../../components/common/SectionHeader";
import { openLegalPage } from "../../components/legal/ConsentCheckboxes";
import { exportMyData, type AuthUser } from "../../lib/api/auth";
import { useI18n } from "../../lib/i18n";
import {
  CHILD_SAFETY_URL,
  DELETE_ACCOUNT_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "../../lib/legal";
import {
  getPushPreference,
  isPushSupported,
  setPushNotificationsEnabled,
} from "../../lib/notifications";
import { palette, styles } from "../../styles/theme";
import { ActionMessage, InlineAction, formatFullDate } from "./shared";
import { networkStyles } from "./styles";

function saveJsonFile(fileName: string, json: string): Promise<unknown> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return Promise.resolve();
  }

  // Native: hand the JSON to the system share sheet (save to Files, email,
  // etc.) without adding a file-system dependency.
  return Share.share({ message: json, title: fileName });
}

/**
 * Me tab controls for notifications, the user's data, and legal documents.
 * Rendered above "Delete Account" so all account controls sit together.
 */
export function AccountPrivacySection({ account, token }: { account?: AuthUser | null; token: string | null }) {
  const { t } = useI18n();
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPushPreference().then((enabled) => {
      if (!cancelled) {
        setPushEnabled(enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePush(next: boolean) {
    if (!token || pushBusy) {
      return;
    }
    setPushBusy(true);
    setPushMessage(null);
    const result = await setPushNotificationsEnabled(token, next);
    setPushBusy(false);

    if (result === "enabled") {
      setPushEnabled(true);
      setPushMessage(t("Push notifications are on for this device."));
    } else if (result === "disabled") {
      setPushEnabled(false);
      setPushMessage(t("Push notifications are off for this device."));
    } else if (result === "permission-denied") {
      setPushEnabled(false);
      setPushMessage(t("Notifications are blocked in your device settings. Allow them there to turn this on."));
    } else {
      setPushMessage(t("Could not change notification settings. Try again."));
    }
  }

  async function downloadData() {
    if (!token || exportState === "saving") {
      return;
    }
    setExportState("saving");
    setExportMessage(null);
    try {
      const data = await exportMyData(token);
      const fileName = `unibridge-data-${new Date().toISOString().slice(0, 10)}.json`;
      await saveJsonFile(fileName, JSON.stringify(data, null, 2));
      setExportState("saved");
      setExportMessage(t("Your data export is ready."));
    } catch (error) {
      setExportState("error");
      setExportMessage(error instanceof Error ? error.message : t("Could not export your data. Try again."));
    }
  }

  const legalLinks = [
    { label: t("Terms of Service"), url: TERMS_URL },
    { label: t("Privacy Policy"), url: PRIVACY_POLICY_URL },
    { label: t("Child Safety Standards"), url: CHILD_SAFETY_URL },
    { label: t("How account deletion works"), url: DELETE_ACCOUNT_URL },
  ];

  return (
    <>
      <View style={[styles.card, styles.compactCard, networkStyles.contentSizedCard]}>
        <SectionHeader action={t("This device")} icon={Bell} title={t("Notifications")} />
        {isPushSupported ? (
          <>
            <View style={localStyles.settingRow}>
              <Text style={localStyles.settingLabel}>
                {t("Push notifications")}
              </Text>
              <Switch
                accessibilityHint={t("New messages, connection requests, and application updates")}
                accessibilityLabel={t("Push notifications")}
                accessibilityState={{ busy: pushBusy, checked: Boolean(pushEnabled), disabled: pushBusy || pushEnabled === null }}
                disabled={pushBusy || pushEnabled === null}
                onValueChange={(value) => void togglePush(value)}
                trackColor={{ false: palette.muted, true: palette.blue }}
                value={Boolean(pushEnabled)}
              />
            </View>
            <Text style={styles.smallText}>
              {t("Get alerts for new messages, connection requests, and application updates. Turning this off removes this device from our notification list.")}
            </Text>
            <ActionMessage>{pushMessage}</ActionMessage>
            {pushEnabled === false && Platform.OS !== "web" ? (
              <InlineAction
                icon={ExternalLink}
                label={t("Open device settings")}
                onPress={() => void Linking.openSettings().catch(() => undefined)}
                secondary
              />
            ) : null}
          </>
        ) : (
          <Text style={styles.smallText}>{t("Push notifications are only available in the mobile app.")}</Text>
        )}
      </View>

      <View style={[styles.card, styles.compactCard, networkStyles.contentSizedCard]}>
        <SectionHeader action={t("JSON")} icon={Download} title={t("Your Data")} />
        <Text style={styles.smallText}>
          {t("Download a copy of your account, profile, skills, portfolio, posts, applications, connections, and messages.")}
        </Text>
        <InlineAction
          icon={Download}
          label={exportState === "saving" ? t("Preparing") : t("Download my data")}
          loading={exportState === "saving"}
          onPress={() => void downloadData()}
          secondary
        />
        <ActionMessage error={exportState === "error"}>{exportMessage}</ActionMessage>
      </View>

      <View style={[styles.card, styles.compactCard, networkStyles.contentSizedCard]}>
        <SectionHeader action={t("Documents")} icon={Scale} title={t("Legal")} />
        {account?.terms_accepted_at && account.terms_version ? (
          <Text style={styles.smallText}>
            {t("You accepted the Terms and Privacy Policy version {version} on {date}.", {
              date: formatFullDate(account.terms_accepted_at),
              version: account.terms_version,
            })}
          </Text>
        ) : null}
        <View style={localStyles.legalLinkList}>
          {legalLinks.map((link) => (
            <Pressable
              accessibilityHint={t("Opens in your browser")}
              accessibilityLabel={link.label}
              accessibilityRole="link"
              key={link.url}
              onPress={() => openLegalPage(link.url)}
              style={({ pressed }) => [localStyles.legalLink, pressed && styles.pressed]}
            >
              <Text style={localStyles.legalLinkText}>{link.label}</Text>
              <ExternalLink color={palette.blue} size={16} strokeWidth={2.4} />
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 44,
  },
  settingLabel: {
    color: palette.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  legalLinkList: {
    gap: 2,
  },
  legalLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
  },
  legalLinkText: {
    color: palette.blue,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
