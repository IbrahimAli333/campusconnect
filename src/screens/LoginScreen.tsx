import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  GraduationCap,
  Lock,
  LogIn,
  Mail,
  Server,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react-native";

import { API_BASE_URL } from "../lib/api/config";
import { AuthApiError, CONSENT_REQUIRED_STATUS } from "../lib/api/auth";
import type { SignupConsent } from "../lib/legal";
import { ConsentCheckboxes, LegalLinks } from "../components/legal/ConsentCheckboxes";
import { useI18n } from "../lib/i18n";
import { GOOGLE_OAUTH_CLIENT_ID } from "../lib/google-oauth";
import { GoogleIdTokenGate } from "../components/common/GoogleIdTokenGate";
import { decorativeProps, headingProps, liveRegionProps, selectedButtonProps, useAnnounce } from "../components/common/a11y";
import { PressableScale } from "../components/ui/PressableScale";
import { AuthField, PasswordVisibilityToggle } from "../components/login/AuthField";
import { BANNER_CARD_OVERLAP, LoginBanner, LoginHeroPanel, displayUppercase } from "../components/login/LoginHero";
import { fonts, palette, paperShadow, radii } from "../styles/theme";
import type { IconComponent } from "../components/common/types";
import { NETWORK_ERROR_MESSAGE, translateApiError } from "../lib/i18n/apiErrors";

type LoginRole = "member" | "student" | "teacher";
type AuthMode = "login" | "signup";

// Store builds must not ship one-tap demo credentials. Direct member access on
// process.env is required for Expo to inline the value at bundle time.
const DEMO_LOGINS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGINS !== "0";

// The ternary keeps the preset credentials out of the production bundle
// entirely: with the flag inlined to "0", the minifier folds the condition and
// drops the array literal, so the strings never reach the shipped binary.
const loginPresets: Array<{
  description: string;
  email: string;
  icon: IconComponent;
  label: string;
  permissions: string[];
  role: LoginRole;
}> = !DEMO_LOGINS_ENABLED ? [] : [
  {
    description: "Save opportunities and build your campus network.",
    email: "member@example.edu",
    icon: UserRound,
    label: "Member",
    permissions: ["Browse", "Save", "Apply", "Connect"],
    role: "member",
  },
  {
    description: "Launch projects, apply to roles, and show your work.",
    email: "student@example.edu",
    icon: GraduationCap,
    label: "Student",
    permissions: ["Post startups", "Post projects", "Apply"],
    role: "student",
  },
  {
    description: "Review student work and support academic teams.",
    email: "teacher@example.edu",
    icon: Users,
    label: "Teacher",
    permissions: ["Post research", "Review applicants", "Connect"],
    role: "teacher",
  },
];

const authModes: Array<{
  compactLabel?: string;
  icon: IconComponent;
  label: string;
  value: AuthMode;
}> = [
  {
    icon: LogIn,
    label: "Log in",
    value: "login",
  },
  {
    compactLabel: "New account",
    icon: UserPlus,
    label: "Create account",
    value: "signup",
  },
];

// Render on a free plan spins the API down when idle; the first request after
// that can take 30-60s. The threshold is when we stop assuming a normal
// round-trip and explain the wait to the user.
const SLOW_LOGIN_HINT_MS = 4000;

const heroHighlights: Array<{
  body: string;
  icon: IconComponent;
  title: string;
}> = [
  {
    body: "Role-aware profiles for students, faculty, and members.",
    icon: Building2,
    title: "Campus identity",
  },
  {
    body: "Projects, applications, and saved opportunities in one flow.",
    icon: Briefcase,
    title: "Career momentum",
  },
  {
    body: "Faculty review paths stay clear without slowing students down.",
    icon: CheckCircle2,
    title: "Academic trust",
  },
];

// Mounted only when GOOGLE_OAUTH_CLIENT_ID exists so the auth-request hook
// never runs with an empty client ID.
function GoogleSsoButton({
  canPrompt,
  clientId,
  disabled,
  onError,
  onIdToken,
}: {
  // Return false to stop the Google prompt (e.g. consent boxes not ticked).
  canPrompt?: () => boolean;
  clientId: string;
  disabled: boolean;
  onError: (message: string) => void;
  onIdToken: (idToken: string) => void;
}) {
  const { t } = useI18n();

  return (
    <GoogleIdTokenGate clientId={clientId} onError={onError} onIdToken={onIdToken}>
      {(promptGoogleSignIn, ready) => (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || !ready }}
          disabled={disabled || !ready}
          onPress={() => {
            if (!canPrompt || canPrompt()) {
              promptGoogleSignIn();
            }
          }}
          style={[loginStyles.secondaryButton, (disabled || !ready) && loginStyles.disabled]}
        >
          <GraduationCap color={palette.caspian} size={18} strokeWidth={2.4} />
          <Text style={loginStyles.secondaryButtonText}>{t("Continue with university Google account")}</Text>
        </PressableScale>
      )}
    </GoogleIdTokenGate>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <View {...liveRegionProps("assertive")} role="alert" style={loginStyles.errorPanel}>
      <View {...decorativeProps} style={loginStyles.noticeIcon}>
        <AlertCircle color={palette.red} size={18} strokeWidth={2.4} />
      </View>
      <Text style={loginStyles.errorText}>{message}</Text>
    </View>
  );
}

function SlowHintPanel({ message }: { message: string }) {
  return (
    <View style={loginStyles.slowHintPanel}>
      <View {...decorativeProps} style={loginStyles.noticeIcon}>
        <Clock color={palette.amber} size={18} strokeWidth={2.4} />
      </View>
      <Text style={loginStyles.slowHintText}>{message}</Text>
    </View>
  );
}

export function LoginScreen({
  onLogin,
  onGoogleLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onGoogleLogin?: (idToken: string, consent?: SignupConsent) => Promise<unknown>;
  onRegister: (email: string, password: string, fullName: string, consent: SignupConsent) => Promise<unknown>;
}) {
  const { language, t } = useI18n();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  // Signup consent: both boxes start unchecked and must be ticked by the user.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const hasConsent = acceptTerms && confirmAge;
  useAnnounce(error);

  useEffect(() => {
    // Warm the backend as soon as the login screen appears so a spun-down
    // Render instance is already waking while the user types.
    void fetch(`${API_BASE_URL}/health`).catch(() => {});
  }, []);
  const { height: windowHeight, width } = useWindowDimensions();
  const isWide = width >= 900;
  const isCompact = width < 520;

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setError(null);
  }

  function selectPreset(role: LoginRole) {
    const preset = loginPresets.find((item) => item.role === role);
    if (!preset) {
      return;
    }

    setSelectedRole(role);
    setEmail(preset.email);
    // Presets intentionally leave the password blank: demo passwords rotate on
    // prod, so shipping one in the bundle would only produce failed logins.
    setPassword("");
    setError(null);
  }

  async function submit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(t("Enter your university email and password."));
      return;
    }

    setLoading(true);
    setError(null);

    const slowHintTimer = setTimeout(() => setShowSlowHint(true), SLOW_LOGIN_HINT_MS);

    try {
      await onLogin(normalizedEmail, password);
    } catch (loginError) {
      if (loginError instanceof AuthApiError) {
        setError(translateApiError(t, loginError.message));
      } else {
        setError(t(NETWORK_ERROR_MESSAGE));
      }
    } finally {
      clearTimeout(slowHintTimer);
      setShowSlowHint(false);
      setLoading(false);
    }
  }

  async function submitSignup() {
    const normalizedEmail = email.trim();
    const normalizedName = fullName.trim();
    if (!normalizedName || !normalizedEmail || !password) {
      setError(t("Enter your name, email, and a password."));
      return;
    }
    if (password.length < 8) {
      setError(t("Password must be at least 8 characters."));
      return;
    }
    if (!hasConsent) {
      setError(t("Tick both boxes to create an account."));
      return;
    }

    setLoading(true);
    setError(null);

    const slowHintTimer = setTimeout(() => setShowSlowHint(true), SLOW_LOGIN_HINT_MS);

    try {
      await onRegister(normalizedEmail, password, normalizedName, {
        accept_terms: acceptTerms,
        confirm_age: confirmAge,
      });
    } catch (registerError) {
      if (registerError instanceof AuthApiError) {
        setError(translateApiError(t, registerError.message));
      } else {
        setError(t(NETWORK_ERROR_MESSAGE));
      }
    } finally {
      clearTimeout(slowHintTimer);
      setShowSlowHint(false);
      setLoading(false);
    }
  }

  async function submitGoogleToken(idToken: string) {
    if (!onGoogleLogin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Consent is sent only from the signup form, where the user ticked it;
      // a Google login for an existing account needs none.
      await onGoogleLogin(
        idToken,
        authMode === "signup" && hasConsent ? { accept_terms: true, confirm_age: true } : undefined,
      );
    } catch (loginError) {
      if (loginError instanceof AuthApiError && loginError.status === CONSENT_REQUIRED_STATUS) {
        setAuthMode("signup");
        setError(t("No Unibridge account uses this Google account yet. Tick both boxes below, then continue with Google to create one."));
      } else if (loginError instanceof AuthApiError) {
        setError(translateApiError(t, loginError.message));
      } else {
        setError(t(NETWORK_ERROR_MESSAGE));
      }
    } finally {
      setLoading(false);
    }
  }

  const passwordToggle = (
    <PasswordVisibilityToggle
      hideLabel={t("Hide password")}
      onToggle={() => setShowPassword((visible) => !visible)}
      showLabel={t("Show password")}
      visible={showPassword}
    />
  );

  const formCard = (
    <View
      style={[
        loginStyles.card,
        isWide ? loginStyles.cardWide : loginStyles.cardStacked,
        isCompact && loginStyles.cardCompact,
      ]}
    >
      <View style={loginStyles.formHeader}>
        <Text style={loginStyles.formEyebrow}>
          {displayUppercase(authMode === "login" ? t("Existing users") : t("New users"), language)}
        </Text>
        <Text {...headingProps(2)} style={[loginStyles.formTitle, isCompact && loginStyles.formTitleCompact]}>
          {authMode === "login" ? t("Log in to Unibridge") : t("Create account")}
        </Text>
        <Text style={loginStyles.formIntro}>
          {authMode === "login"
            ? DEMO_LOGINS_ENABLED
              ? isCompact
                ? t("Use a demo role preset or working credentials.")
                : t("Use a demo role preset or enter working credentials manually.")
              : t("Sign in with your Unibridge credentials.")
            : GOOGLE_OAUTH_CLIENT_ID
              ? t("Member accounts can browse, save, apply, and connect. Students and faculty join with their university Google account.")
              : t("Member accounts can browse, save, apply, and connect. Student and faculty roles are granted by university administrators.")}
        </Text>
      </View>

      <View style={loginStyles.modeSwitch}>
        {authModes.map((mode) => {
          const active = authMode === mode.value;
          const Icon = mode.icon;

          return (
            <PressableScale
              accessibilityRole="button"
              {...selectedButtonProps(active)}
              key={mode.value}
              onPress={() => switchAuthMode(mode.value)}
              scaleTo={0.98}
              style={[loginStyles.modeOption, active && loginStyles.modeOptionActive]}
            >
              <Icon color={active ? palette.caspian : palette.muted} size={17} strokeWidth={2.4} />
              <Text numberOfLines={1} style={[loginStyles.modeLabel, active && loginStyles.modeLabelActive]}>
                {t(isCompact ? mode.compactLabel ?? mode.label : mode.label)}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {authMode === "login" ? (
        <>
          {DEMO_LOGINS_ENABLED ? (
            <View style={loginStyles.roleSection}>
              <View style={loginStyles.sectionLabelRow}>
                <Text style={loginStyles.sectionLabel}>{t("Choose a role to continue")}</Text>
                {!isCompact ? <Text style={loginStyles.sectionMeta}>{t("Tap to fill")}</Text> : null}
              </View>

              <View style={[loginStyles.roleStack, isCompact && loginStyles.roleStackCompact]}>
                {loginPresets.map((preset) => {
                  const Icon = preset.icon;
                  const active = selectedRole === preset.role;

                  return (
                    <PressableScale
                      accessibilityRole="button"
                      {...selectedButtonProps(active)}
                      key={preset.role}
                      onPress={() => selectPreset(preset.role)}
                      scaleTo={0.98}
                      style={[
                        loginStyles.roleCard,
                        isCompact && loginStyles.roleCardCompact,
                        active && loginStyles.roleCardActive,
                      ]}
                    >
                      <View style={[loginStyles.roleCardHeader, isCompact && loginStyles.roleCardHeaderCompact]}>
                        <View style={[loginStyles.roleIcon, active && loginStyles.roleIconActive]}>
                          <Icon color={active ? palette.surface : palette.caspian} size={isCompact ? 18 : 20} strokeWidth={2.4} />
                        </View>
                        <View style={[loginStyles.roleTextBlock, isCompact && loginStyles.roleTextBlockCompact]}>
                          <View style={loginStyles.roleTitleRow}>
                            <Text
                              numberOfLines={1}
                              style={[loginStyles.roleTitle, active && loginStyles.roleTitleActive]}
                            >
                              {t(preset.label)}
                            </Text>
                            {active && !isCompact ? <Text style={loginStyles.activeBadge}>{t("Loaded")}</Text> : null}
                          </View>
                          {!isCompact ? (
                            <>
                              <Text style={loginStyles.roleDescription}>{t(preset.description)}</Text>
                              <Text numberOfLines={1} style={loginStyles.roleCredential}>
                                {preset.email}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>

                      {!isCompact ? (
                        <View style={loginStyles.permissionWrap}>
                          {preset.permissions.map((permission) => (
                            <Text
                              key={`${preset.role}-${permission}`}
                              style={[loginStyles.permissionBadge, active && loginStyles.permissionBadgeActive]}
                            >
                              {t(permission)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={loginStyles.formStack}>
            <AuthField
              accessibilityLabel={t("Email")}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              icon={Mail}
              keyboardType="email-address"
              label={t("Email")}
              onChangeText={(value) => {
                setEmail(value);
                setSelectedRole(null);
              }}
              placeholder={DEMO_LOGINS_ENABLED ? "member@example.edu" : t("you@university.edu")}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <AuthField
              accessibilityLabel={t("Password")}
              autoCapitalize="none"
              autoComplete="password"
              icon={Lock}
              label={t("Password")}
              onChangeText={(value) => {
                setPassword(value);
                setSelectedRole(null);
              }}
              onSubmitEditing={submit}
              placeholder={t("Password")}
              returnKeyType="go"
              secureTextEntry={!showPassword}
              textContentType="password"
              trailing={passwordToggle}
              value={password}
            />
          </View>

          {error ? <ErrorPanel message={error} /> : null}

          {loading && showSlowHint ? (
            <SlowHintPanel
              message={t("Still connecting - the campus server may be waking up. The first login after a quiet period can take up to a minute.")}
            />
          ) : null}

          <View style={loginStyles.actions}>
            <PressableScale
              accessibilityRole="button"
              disabled={loading}
              haptic="action"
              onPress={submit}
              style={[loginStyles.submitButton, loading && loginStyles.disabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.surface} size="small" />
              ) : (
                <LogIn color={palette.surface} size={18} strokeWidth={2.6} />
              )}
              <Text style={loginStyles.submitButtonText}>{loading ? t("Logging in") : t("Log in")}</Text>
            </PressableScale>

            {GOOGLE_OAUTH_CLIENT_ID && onGoogleLogin ? (
              <GoogleSsoButton
                clientId={GOOGLE_OAUTH_CLIENT_ID}
                disabled={loading}
                onError={setError}
                onIdToken={(idToken) => void submitGoogleToken(idToken)}
              />
            ) : null}
          </View>
        </>
      ) : (
        <>
          <View style={loginStyles.formStack}>
            <AuthField
              accessibilityLabel={t("Full name")}
              autoComplete="name"
              autoCorrect={false}
              icon={UserRound}
              label={t("Full name")}
              onChangeText={setFullName}
              placeholder={t("Your name")}
              returnKeyType="next"
              textContentType="name"
              value={fullName}
            />
            <AuthField
              accessibilityLabel={t("Email")}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              icon={Mail}
              keyboardType="email-address"
              label={t("Email")}
              onChangeText={setEmail}
              placeholder={t("you@university.edu")}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <AuthField
              accessibilityLabel={t("Password")}
              autoCapitalize="none"
              autoComplete="password-new"
              icon={Lock}
              label={t("Password")}
              onChangeText={setPassword}
              onSubmitEditing={submitSignup}
              placeholder={t("At least 8 characters")}
              returnKeyType="go"
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              trailing={passwordToggle}
              value={password}
            />
          </View>

          <View style={loginStyles.consentPanel}>
            <ConsentCheckboxes
              acceptTerms={acceptTerms}
              confirmAge={confirmAge}
              onAcceptTermsChange={(next) => {
                setAcceptTerms(next);
                setError(null);
              }}
              onConfirmAgeChange={(next) => {
                setConfirmAge(next);
                setError(null);
              }}
            />
          </View>

          {error ? <ErrorPanel message={error} /> : null}

          {loading && showSlowHint ? (
            <SlowHintPanel
              message={t("Still connecting - the campus server may be waking up. The first signup after a quiet period can take up to a minute.")}
            />
          ) : null}

          <View style={loginStyles.actions}>
            <PressableScale
              accessibilityRole="button"
              disabled={loading}
              haptic="action"
              onPress={submitSignup}
              style={[loginStyles.submitButton, loading && loginStyles.disabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.surface} size="small" />
              ) : (
                <UserPlus color={palette.surface} size={18} strokeWidth={2.6} />
              )}
              <Text style={loginStyles.submitButtonText}>
                {loading ? t("Creating account") : t("Create member account")}
              </Text>
            </PressableScale>

            {GOOGLE_OAUTH_CLIENT_ID && onGoogleLogin ? (
              <GoogleSsoButton
                canPrompt={() => {
                  if (!hasConsent) {
                    setError(t("Tick both boxes to create an account."));
                    return false;
                  }
                  return true;
                }}
                clientId={GOOGLE_OAUTH_CLIENT_ID}
                disabled={loading}
                onError={setError}
                onIdToken={(idToken) => void submitGoogleToken(idToken)}
              />
            ) : null}
          </View>
        </>
      )}

      {authMode === "login" ? <LegalLinks align="center" /> : null}

      {DEMO_LOGINS_ENABLED ? (
        <View style={loginStyles.apiHint}>
          <Server color={palette.muted} size={16} strokeWidth={2.4} />
          <View style={loginStyles.apiHintText}>
            <Text style={loginStyles.hintLabel}>{t("API endpoint")}</Text>
            <Text numberOfLines={2} style={loginStyles.hintValue}>
              {API_BASE_URL}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={loginStyles.container}>
      <ScrollView
        contentContainerStyle={[loginStyles.scrollContent, isWide && loginStyles.scrollContentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isWide ? (
          <View style={loginStyles.wideShell}>
            <View style={[loginStyles.heroColumn, webStickyHero]}>
              <LoginHeroPanel
                body={
                  DEMO_LOGINS_ENABLED
                    ? t("Sign in as a member, student, or teacher to test a role-specific network for projects, applications, mentorship, and academic review.")
                    : t("Sign in to a role-aware campus network for projects, applications, mentorship, and academic review.")
                }
                eyebrow={t("University access portal")}
                height={Math.max(windowHeight - 48, 660)}
                highlights={heroHighlights.map((item) => ({
                  body: t(item.body),
                  icon: item.icon,
                  title: t(item.title),
                }))}
                title={t("Connect classroom work to real campus opportunity.")}
              />
            </View>
            <View style={loginStyles.formColumn}>{formCard}</View>
          </View>
        ) : (
          <>
            <LoginBanner
              body={
                isCompact
                  ? undefined
                  : DEMO_LOGINS_ENABLED
                    ? t("Log in with a demo role or create a member account.")
                    : t("Log in or create a member account.")
              }
              compact={isCompact}
              title={authMode === "login" ? t("Welcome back") : t("Join as a member")}
            />
            <View style={[loginStyles.stackedBody, isCompact && loginStyles.stackedBodyCompact]}>{formCard}</View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// On web the hero panel stays in view while a long form (e.g. with the demo
// presets) scrolls past it. Native has no sticky positioning, hence the cast.
const webStickyHero = (Platform.OS === "web" ? { position: "sticky", top: 24 } : {}) as ViewStyle;

const loginStyles = StyleSheet.create({
  container: {
    backgroundColor: palette.page,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentWide: {
    justifyContent: "center",
    padding: 24,
  },

  // Layout ---------------------------------------------------------------
  wideShell: {
    alignItems: "stretch",
    alignSelf: "center",
    flexDirection: "row",
    gap: 24,
    maxWidth: 1180,
    width: "100%",
  },
  heroColumn: {
    // Sized to the viewport rather than stretched to the (often taller) form.
    alignSelf: "flex-start",
    flex: 1.05,
    minWidth: 0,
  },
  formColumn: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  stackedBody: {
    alignItems: "center",
    // The card rides up over the banner's bottom edge.
    marginTop: -BANNER_CARD_OVERLAP,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  stackedBodyCompact: {
    paddingBottom: 24,
    paddingHorizontal: 14,
  },

  // Card -------------------------------------------------------------------
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderRadius: 28,
    borderWidth: 1,
    gap: 20,
    padding: 28,
    width: "100%",
    ...paperShadow("sheet"),
  },
  cardWide: {
    padding: 36,
  },
  cardStacked: {
    maxWidth: 560,
  },
  cardCompact: {
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  formHeader: {
    gap: 6,
  },
  formEyebrow: {
    color: palette.caspian,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  formTitle: {
    color: palette.text,
    fontFamily: fonts.extrabold,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  formTitleCompact: {
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  formIntro: {
    color: palette.muted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },

  // Segmented mode switch -------------------------------------------------
  modeSwitch: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  modeOption: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  modeOptionActive: {
    backgroundColor: palette.surface,
    ...paperShadow("strip"),
  },
  modeLabel: {
    color: palette.muted,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
  modeLabelActive: {
    color: palette.text,
    fontFamily: fonts.bold,
  },

  // Demo role presets -----------------------------------------------------
  roleSection: {
    gap: 10,
  },
  sectionLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: palette.text,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionMeta: {
    color: palette.faint,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  roleStack: {
    gap: 10,
  },
  roleStackCompact: {
    flexDirection: "row",
    gap: 8,
  },
  roleCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    gap: 10,
    minHeight: 44,
    padding: 14,
  },
  roleCardCompact: {
    borderRadius: radii.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 76,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  roleCardActive: {
    backgroundColor: palette.caspianSoft,
    borderColor: palette.caspian,
  },
  roleCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  roleCardHeaderCompact: {
    alignItems: "center",
    flexDirection: "column",
    gap: 6,
  },
  roleIcon: {
    alignItems: "center",
    backgroundColor: palette.caspianSoft,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  roleIconActive: {
    backgroundColor: palette.caspian,
  },
  roleTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  roleTextBlockCompact: {
    alignItems: "center",
    flex: 0,
    maxWidth: "100%",
  },
  roleTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  roleTitle: {
    color: palette.text,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
  roleTitleActive: {
    color: palette.caspianDeep,
    fontFamily: fonts.bold,
  },
  activeBadge: {
    backgroundColor: palette.caspian,
    borderRadius: radii.pill,
    color: palette.surface,
    fontFamily: fonts.bold,
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleDescription: {
    color: palette.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  roleCredential: {
    color: palette.caspian,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  permissionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 52,
  },
  permissionBadge: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.pill,
    color: palette.muted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  permissionBadgeActive: {
    backgroundColor: palette.surface,
    color: palette.caspianDeep,
  },

  // Fields & actions ------------------------------------------------------
  formStack: {
    gap: 16,
  },
  consentPanel: {
    backgroundColor: palette.page,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actions: {
    gap: 12,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: palette.caspian,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 20,
    ...paperShadow("cutout"),
  },
  submitButtonText: {
    color: palette.surface,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: palette.text,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },

  // Notices ---------------------------------------------------------------
  noticeIcon: {
    paddingTop: 1,
  },
  errorPanel: {
    alignItems: "flex-start",
    backgroundColor: palette.redSoft,
    borderColor: "#F2C9C4",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: palette.red,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  slowHintPanel: {
    alignItems: "flex-start",
    backgroundColor: palette.amberSoft,
    borderColor: palette.buffBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slowHintText: {
    color: palette.amber,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  apiHint: {
    alignItems: "center",
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  apiHintText: {
    flex: 1,
    minWidth: 0,
  },
  hintLabel: {
    color: palette.faint,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  hintValue: {
    color: palette.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
});
