import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ExternalLink } from "lucide-react-native";

import { useI18n } from "../../lib/i18n";
import { MINIMUM_AGE, PRIVACY_POLICY_URL, TERMS_URL } from "../../lib/legal";
import { palette, styles } from "../../styles/theme";

export function openLegalPage(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  // react-native-web activates non-"button" roles only with Enter, but a
  // checkbox must also toggle with Space for keyboard users (WCAG 2.1.1).
  const webKeyboardProps =
    Platform.OS === "web"
      ? {
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === " " || event.key === "Spacebar") {
              event.preventDefault();
              onChange(!checked);
            }
          },
        }
      : {};

  return (
    <Pressable
      {...webKeyboardProps}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [consentStyles.row, pressed && styles.pressed]}
    >
      <View style={[consentStyles.box, checked && consentStyles.boxChecked]}>
        {checked ? <Check color={palette.surface} size={16} strokeWidth={3} /> : null}
      </View>
      <Text style={consentStyles.label}>{label}</Text>
    </Pressable>
  );
}

/** Links to the public Terms of Service and Privacy Policy pages. */
export function LegalLinks({ align = "flex-start", indent = false }: { align?: "center" | "flex-start"; indent?: boolean }) {
  const { t } = useI18n();

  return (
    <View style={[consentStyles.links, indent && consentStyles.linksIndented, { justifyContent: align }]}>
      {[
        { label: t("Terms of Service"), url: TERMS_URL },
        { label: t("Privacy Policy"), url: PRIVACY_POLICY_URL },
      ].map((link) => (
        <Pressable
          accessibilityHint={t("Opens in your browser")}
          accessibilityLabel={link.label}
          accessibilityRole="link"
          key={link.url}
          onPress={() => openLegalPage(link.url)}
          style={({ pressed }) => [consentStyles.link, pressed && styles.pressed]}
        >
          <Text style={consentStyles.linkText}>{link.label}</Text>
          <ExternalLink color={palette.blue} size={14} strokeWidth={2.4} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The two required signup confirmations. Both start unchecked and are never
 * pre-ticked; callers block the action until both are true.
 */
export function ConsentCheckboxes({
  acceptTerms,
  confirmAge,
  onAcceptTermsChange,
  onConfirmAgeChange,
}: {
  acceptTerms: boolean;
  confirmAge: boolean;
  onAcceptTermsChange: (next: boolean) => void;
  onConfirmAgeChange: (next: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <View style={consentStyles.wrap}>
      <Checkbox
        checked={acceptTerms}
        label={t("I agree to the Terms of Service and Privacy Policy")}
        onChange={onAcceptTermsChange}
      />
      <LegalLinks indent />
      <Checkbox
        checked={confirmAge}
        label={t("I confirm I am {age} or older", { age: MINIMUM_AGE })}
        onChange={onConfirmAgeChange}
      />
    </View>
  );
}

const consentStyles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  box: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.muted,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  boxChecked: {
    backgroundColor: palette.blue,
    borderColor: palette.blue,
  },
  label: {
    color: palette.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  links: {
    columnGap: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  linksIndented: {
    // Lines the links up under the checkbox label.
    paddingLeft: 36,
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
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
