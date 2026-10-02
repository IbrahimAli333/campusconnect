import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react-native";

import { liveRegionProps, useAnnounce } from "../components/common/a11y";
import { ConsentCheckboxes, openLegalPage } from "../components/legal/ConsentCheckboxes";
import { DELETE_ACCOUNT_URL } from "../lib/legal";
import type { AuthUser } from "../lib/api/auth";
import { useI18n } from "../lib/i18n";
import { fonts, palette, styles } from "../styles/theme";

/**
 * Shown instead of the app whenever the signed-in user has not accepted the
 * current Terms/Privacy version (new version, or an account created before
 * consent was recorded). Declining is always possible: the user can sign out,
 * and nothing is pre-ticked.
 */
export function TermsAcceptanceScreen({
  onAccept,
  onSignOut,
  user,
}: {
  onAccept: (termsVersion: string) => Promise<unknown>;
  onSignOut: () => void;
  user: AuthUser;
}) {
  const { t } = useI18n();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUpdate = Boolean(user.terms_version);
  useAnnounce(error);

  async function submit() {
    if (!acceptTerms || !confirmAge) {
      setError(t("Tick both boxes to continue."));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onAccept(user.current_terms_version);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : t("Could not save your answer. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={termsStyles.scroll} keyboardShouldPersistTaps="handled">
      <View style={termsStyles.card}>
        <View style={termsStyles.iconWrap}>
          <ShieldCheck color={palette.blue} size={28} strokeWidth={2.4} />
        </View>
        <Text accessibilityRole="header" style={termsStyles.title}>
          {isUpdate ? t("We updated our Terms and Privacy Policy") : t("Review our Terms and Privacy Policy")}
        </Text>
        <Text style={termsStyles.body}>
          {isUpdate
            ? t("Please review the updated documents (version {version}) and confirm to keep using Unibridge.", {
                version: user.current_terms_version,
              })
            : t("Before you continue, please review the documents (version {version}) and confirm.", {
                version: user.current_terms_version,
              })}
        </Text>

        <ConsentCheckboxes
          acceptTerms={acceptTerms}
          confirmAge={confirmAge}
          onAcceptTermsChange={setAcceptTerms}
          onConfirmAgeChange={setConfirmAge}
        />

        {error ? (
          <Text {...liveRegionProps("assertive")} role="alert" style={termsStyles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          onPress={() => void submit()}
          style={({ pressed }) => [termsStyles.primary, pressed && styles.pressed, saving && termsStyles.disabled]}
        >
          {saving ? <ActivityIndicator color={palette.surface} size="small" /> : null}
          <Text style={termsStyles.primaryText}>{t("Agree and continue")}</Text>
        </Pressable>

        <Text style={termsStyles.note}>
          {t("If you do not agree, you can sign out. You can also ask us to delete your account without agreeing.")}
        </Text>
        <Pressable
          accessibilityHint={t("Opens in your browser")}
          accessibilityRole="link"
          onPress={() => openLegalPage(DELETE_ACCOUNT_URL)}
          style={({ pressed }) => [termsStyles.link, pressed && styles.pressed]}
        >
          <Text style={termsStyles.linkText}>{t("How account deletion works")}</Text>
          <ExternalLink color={palette.blue} size={14} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onSignOut}
          style={({ pressed }) => [termsStyles.secondary, pressed && styles.pressed]}
        >
          <LogOut color={palette.text} size={18} strokeWidth={2.4} />
          <Text style={termsStyles.secondaryText}>{t("Sign out")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const termsStyles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    alignSelf: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    maxWidth: 560,
    padding: 20,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: palette.blueSoft,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontFamily: fonts.extrabold,
  },
  body: {
    fontFamily: fonts.regular,
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: palette.red,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  primary: {
    alignItems: "center",
    backgroundColor: palette.blue,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: palette.surface,
    fontSize: 16,
    fontFamily: fonts.extrabold,
  },
  disabled: {
    opacity: 0.6,
  },
  note: {
    fontFamily: fonts.regular,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    minHeight: 44,
  },
  linkText: {
    color: palette.blue,
    fontSize: 14,
    fontFamily: fonts.bold,
    textDecorationLine: "underline",
  },
  secondary: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: palette.text,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
