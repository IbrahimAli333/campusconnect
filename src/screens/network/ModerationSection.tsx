import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { Ban, Check, EyeOff, RefreshCw, ShieldAlert, X } from "lucide-react-native";

import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusChip } from "../../components/common/StatusChip";
import {
  closeOpportunityAsAdmin,
  deactivateUser,
  listOpenReports,
  setReportStatus,
  type AdminReport,
} from "../../lib/api/network";
import { useI18n } from "../../lib/i18n";
import { translateApiError } from "../../lib/i18n/apiErrors";
import { fonts, palette, radii, styles } from "../../styles/theme";
import { ActionMessage, InlineAction, formatFullDate } from "./shared";
import { networkStyles } from "./styles";

// Destructive actions ask first; RN's Alert is a no-op on web.
function confirmAction(title: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" && window.confirm(title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      { onPress: () => resolve(false), style: "cancel", text: cancelLabel },
      { onPress: () => resolve(true), style: "destructive", text: confirmLabel },
    ]);
  });
}

/**
 * Moderation queue for admin accounts, at the top of the Me tab (where the
 * "new report" push alert lands). Open reports can be resolved or dismissed,
 * reported posts closed, and the account behind a report deactivated (which
 * hides it everywhere). Reporters' names are shown to admins only.
 */
export function ModerationSection({ token }: { token: string | null }) {
  const { t } = useI18n();
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      setReports(await listOpenReports(token));
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? translateApiError(t, error.message) : t("Request failed") });
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(report: AdminReport, action: "resolve" | "dismiss" | "close" | "deactivate") {
    if (!token || busyId !== null) {
      return;
    }
    if (action === "deactivate") {
      const ok = await confirmAction(
        t("Deactivate this account? It is signed out and hidden from everyone."),
        t("Deactivate"),
        t("Cancel"),
      );
      if (!ok) {
        return;
      }
    }
    setBusyId(report.id);
    setMessage(null);
    try {
      if (action === "deactivate" && report.target_user_id !== null) {
        await deactivateUser(token, report.target_user_id);
      }
      if (action === "close" && report.target_opportunity_id !== null) {
        await closeOpportunityAsAdmin(token, report.target_opportunity_id);
      }
      await setReportStatus(token, report.id, action === "dismiss" ? "dismissed" : "resolved");
      setReports((current) => (current ? current.filter((item) => item.id !== report.id) : current));
      setMessage({
        error: false,
        text:
          action === "deactivate"
            ? t("Account deactivated and report resolved.")
            : action === "close"
              ? t("Post closed and report resolved.")
              : action === "dismiss"
                ? t("Report dismissed.")
                : t("Report resolved."),
      });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? translateApiError(t, error.message) : t("Request failed") });
    } finally {
      setBusyId(null);
    }
  }

  const openCount = reports?.length ?? 0;

  return (
    <View style={[styles.card, styles.compactCard, networkStyles.contentSizedCard, moderationStyles.card]}>
      <SectionHeader
        action={reports ? t("{n} open", { n: openCount }) : t("Loading")}
        icon={ShieldAlert}
        title={t("Moderation")}
      />
      <Text style={styles.smallText}>
        {t("Act on reports within 8 hours. People are never told who reported them.")}
      </Text>
      <InlineAction
        icon={RefreshCw}
        label={loading ? t("Loading") : t("Refresh")}
        loading={loading}
        onPress={() => void load()}
        secondary
      />
      {message ? <ActionMessage error={message.error}>{message.text}</ActionMessage> : null}

      {reports && reports.length === 0 ? <Text style={moderationStyles.empty}>{t("No open reports.")}</Text> : null}

      {reports?.map((report) => {
        const busy = busyId === report.id;
        return (
          <View key={report.id} style={moderationStyles.report}>
            <View style={moderationStyles.reportTop}>
              <StatusChip
                label={report.target_type === "profile" ? t("Reported profile") : t("Reported post")}
                tone={report.target_type === "profile" ? "violet" : "amber"}
              />
              <Text style={moderationStyles.date}>{formatFullDate(report.created_at, t)}</Text>
            </View>
            <Text numberOfLines={2} style={moderationStyles.label}>
              {report.target_label}
            </Text>
            <Text style={moderationStyles.reason}>
              {report.reason ? t("Reason: {reason}", { reason: report.reason }) : t("No reason given")}
            </Text>
            <Text style={moderationStyles.meta}>{t("Reported by {name}", { name: report.reporter_name })}</Text>
            <View style={networkStyles.actionRow}>
              <InlineAction
                accessibilityLabel={t("Resolve report about {name}", { name: report.target_label })}
                disabled={busy}
                icon={Check}
                label={t("Resolve")}
                onPress={() => void act(report, "resolve")}
                secondary
              />
              <InlineAction
                accessibilityLabel={t("Dismiss report about {name}", { name: report.target_label })}
                disabled={busy}
                icon={X}
                label={t("Dismiss")}
                onPress={() => void act(report, "dismiss")}
                secondary
              />
              {report.target_type === "opportunity" && report.target_opportunity_id !== null ? (
                <InlineAction
                  accessibilityLabel={t("Close post {name}", { name: report.target_label })}
                  disabled={busy}
                  icon={EyeOff}
                  label={t("Close post")}
                  onPress={() => void act(report, "close")}
                  secondary
                />
              ) : null}
              {report.target_user_id !== null ? (
                <InlineAction
                  accessibilityLabel={t("Deactivate the account behind {name}", { name: report.target_label })}
                  disabled={busy}
                  icon={Ban}
                  label={t("Deactivate account")}
                  loading={busy}
                  onPress={() => void act(report, "deactivate")}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const moderationStyles = StyleSheet.create({
  card: {
    borderColor: "#F2C9C4",
  },
  empty: {
    color: palette.muted,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  report: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  reportTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  date: {
    color: palette.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  label: {
    color: palette.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  reason: {
    color: palette.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: palette.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
});
