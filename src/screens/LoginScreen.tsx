import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Home,
  LogIn,
  Search,
  Server,
  SlidersHorizontal,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react-native";

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { API_BASE_URL } from "../lib/api/config";
import { AuthApiError } from "../lib/api/auth";
import { palette, platformShadow, styles, webSafeTextShadow } from "../styles/theme";
import type { IconComponent } from "../components/common/types";

WebBrowser.maybeCompleteAuthSession();

type LoginRole = "member" | "student" | "teacher";
type AuthMode = "login" | "signup";

// Store builds must not ship one-tap demo credentials. Direct member access on
// process.env is required for Expo to inline the value at bundle time.
const DEMO_LOGINS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGINS !== "0";

// University SSO stays hidden until an OAuth client ID is provisioned for the
// build. Direct member access keeps Expo env inlining working (no optional
// chaining — see the crash note above DEMO_LOGINS_ENABLED).
const GOOGLE_OAUTH_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

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
  description: string;
  icon: IconComponent;
  label: string;
  value: AuthMode;
}> = [
  {
    description: "Existing demo accounts",
    icon: LogIn,
    label: "Log in",
    value: "login",
  },
  {
    compactLabel: "New account",
    description: "New campus access",
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

const previewProfiles = [
  { name: "Prof. Leyla", role: "Mentor", tone: "mentor" },
  { name: "Rauf H.", role: "Student", tone: "student" },
  { name: "Aydin M.", role: "Student", tone: "student" },
];

const previewOpportunities = [
  { icon: Briefcase, label: "Research", title: "AI Research Intern" },
  { icon: Users, label: "Project", title: "Smart City Team" },
  { icon: GraduationCap, label: "Teaching", title: "Teaching Assistant" },
];

const previewNavItems: Array<{ icon: IconComponent; label: string; active?: boolean }> = [
  { active: true, icon: Home, label: "Discover" },
  { icon: FileText, label: "Posts" },
  { icon: Briefcase, label: "Applied" },
  { icon: UserRound, label: "Me" },
  { icon: Users, label: "Network" },
];

function HeroPaperScene({ compact }: { compact: boolean }) {
  if (compact) {
    return null;
  }

  return (
    <View style={loginStyles.paperScene}>
      <View style={loginStyles.paperMoon} />
      <View style={loginStyles.paperHillBack} />
      <View style={loginStyles.paperHillFront} />
      <View style={loginStyles.paperTreeLeft} />
      <View style={loginStyles.paperTreeRight} />
      <View style={loginStyles.paperBuilding}>
        <View style={loginStyles.paperRoof} />
        <View style={loginStyles.paperFlagPole} />
        <View style={loginStyles.paperFlag} />
        <View style={loginStyles.paperColumnRow}>
          <View style={loginStyles.paperColumn} />
          <View style={loginStyles.paperColumn} />
          <View style={loginStyles.paperColumn} />
          <View style={loginStyles.paperColumn} />
        </View>
        <View style={loginStyles.paperSteps} />
      </View>
      <View style={loginStyles.paperClockTower}>
        <View style={loginStyles.paperTowerRoof} />
        <View style={loginStyles.paperClockFace} />
      </View>
    </View>
  );
}

function DashboardPreview({ compact }: { compact: boolean }) {
  if (compact) {
    return null;
  }

  return (
    <View style={loginStyles.previewStack}>
      <View style={loginStyles.previewSearchRow}>
        <View style={loginStyles.previewSearch}>
          <Search color={palette.navy} size={18} strokeWidth={2.5} />
          <Text style={loginStyles.previewSearchText} numberOfLines={1}>
            Search people, skills, or universities
          </Text>
        </View>
        <View style={loginStyles.previewFilterButton}>
          <SlidersHorizontal color={palette.navy} size={18} strokeWidth={2.5} />
        </View>
      </View>

      <View style={loginStyles.previewSectionHeader}>
        <Text style={loginStyles.previewSectionTitle}>Recommended for you</Text>
        <Text style={loginStyles.previewSectionAction}>See all</Text>
      </View>
      <View style={loginStyles.previewProfileRow}>
        {previewProfiles.map((profile) => (
          <View key={profile.name} style={loginStyles.previewProfileCard}>
            <View
              style={[
                loginStyles.previewAvatar,
                profile.tone === "mentor" ? loginStyles.previewAvatarMentor : loginStyles.previewAvatarStudent,
              ]}
            >
              <UserRound
                color={profile.tone === "mentor" ? palette.violet : palette.blue}
                size={17}
                strokeWidth={2.6}
              />
            </View>
            <Text style={loginStyles.previewProfileName} numberOfLines={2}>
              {profile.name}
            </Text>
            <Text
              style={[
                loginStyles.previewRolePill,
                profile.tone === "mentor" ? loginStyles.previewRolePillMentor : loginStyles.previewRolePillStudent,
              ]}
              numberOfLines={1}
            >
              {profile.role}
            </Text>
          </View>
        ))}
      </View>

      <View style={loginStyles.previewSectionHeader}>
        <Text style={loginStyles.previewSectionTitle}>Top opportunities</Text>
        <Text style={loginStyles.previewSectionAction}>See all</Text>
      </View>
      <View style={loginStyles.previewOpportunityRow}>
        {previewOpportunities.map((item) => {
          const Icon = item.icon;

          return (
            <View key={item.title} style={loginStyles.previewOpportunityCard}>
              <View style={loginStyles.previewOpportunityIcon}>
                <Icon color={palette.surface} size={16} strokeWidth={2.5} />
              </View>
              <Text style={loginStyles.previewOpportunityTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={loginStyles.previewOpportunityMeta}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={loginStyles.previewBottomNav}>
        {previewNavItems.map((item) => {
          const Icon = item.icon;
          const active = Boolean(item.active);

          return (
            <View key={item.label} style={loginStyles.previewNavItem}>
              <Icon color={active ? palette.teal : palette.navy} size={18} strokeWidth={2.5} />
              <Text style={[loginStyles.previewNavText, active && loginStyles.previewNavTextActive]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RequestAccessPanel({ onUseDemoLogin }: { onUseDemoLogin: () => void }) {
  return (
    <View style={loginStyles.requestStack}>
      <View style={loginStyles.requestPanel}>
        <View style={loginStyles.requestIcon}>
          <UserPlus color={palette.teal} size={22} strokeWidth={2.5} />
        </View>
        <View style={loginStyles.requestCopy}>
          <Text style={loginStyles.requestTitle}>Account creation is invite-based right now.</Text>
          <Text style={loginStyles.requestBody}>
            {DEMO_LOGINS_ENABLED
              ? "This API does not expose public registration. New accounts should come from a campus invite or admin setup; demo access is available through the role presets."
              : "New accounts are provisioned by campus or program administrators. Ask your faculty coordinator for an invite, then log in with the credentials you receive."}
          </Text>
        </View>
      </View>

      <View style={loginStyles.accessGrid}>
        <View style={loginStyles.accessTile}>
          <View style={loginStyles.accessIcon}>
            <Building2 color={palette.blue} size={18} strokeWidth={2.5} />
          </View>
          <Text style={loginStyles.accessTitle}>Campus invite</Text>
          <Text style={loginStyles.accessBody}>Faculty or program admins provision new users for the MVP.</Text>
        </View>
        {DEMO_LOGINS_ENABLED ? (
          <View style={loginStyles.accessTile}>
            <View style={loginStyles.accessIcon}>
              <CheckCircle2 color={palette.green} size={18} strokeWidth={2.5} />
            </View>
            <Text style={loginStyles.accessTitle}>Demo roles</Text>
            <Text style={loginStyles.accessBody}>Member, Student, and Teacher presets remain ready to test.</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onUseDemoLogin}
        style={({ pressed }) => [loginStyles.secondaryButton, pressed && styles.pressed]}
      >
        <LogIn color={palette.text} size={18} strokeWidth={2.6} />
        <Text style={loginStyles.secondaryButtonText}>{DEMO_LOGINS_ENABLED ? "Use demo login" : "Back to log in"}</Text>
      </Pressable>
    </View>
  );
}

// Mounted only when GOOGLE_OAUTH_CLIENT_ID exists so the auth-request hook
// never runs with an empty client ID.
function GoogleSsoButton({
  disabled,
  onError,
  onIdToken,
}: {
  disabled: boolean;
  onError: (message: string) => void;
  onIdToken: (idToken: string) => void;
}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === "success") {
      const idToken = response.params.id_token;
      if (idToken) {
        onIdToken(idToken);
      } else {
        onError("Google sign-in did not return an identity token.");
      }
    } else if (response.type === "error") {
      onError(response.error?.message ?? "Google sign-in failed. Try again.");
    }
    // The callbacks are stable enough for this screen; re-running on response
    // changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || !request}
      onPress={() => void promptAsync()}
      style={({ pressed }) => [
        loginStyles.secondaryButton,
        (disabled || !request) && loginStyles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <GraduationCap color={palette.text} size={18} strokeWidth={2.6} />
      <Text style={loginStyles.secondaryButtonText}>Continue with university Google account</Text>
    </Pressable>
  );
}

export function LoginScreen({
  onLogin,
  onGoogleLogin,
}: {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onGoogleLogin?: (idToken: string) => Promise<unknown>;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    // Warm the backend as soon as the login screen appears so a spun-down
    // Render instance is already waking while the user types.
    void fetch(`${API_BASE_URL}/health`).catch(() => {});
  }, []);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isCompact = width < 520;
  const pagePadding = isWide ? 20 : 14;
  const availableShellWidth = width - pagePadding * 2;
  const shellWidth = Math.max(Math.min(availableShellWidth, isWide ? 1120 : 720), 0);
  const visibleHighlights = isCompact ? [] : heroHighlights;

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
      setError("Enter your university email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const slowHintTimer = setTimeout(() => setShowSlowHint(true), SLOW_LOGIN_HINT_MS);

    try {
      await onLogin(normalizedEmail, password);
    } catch (loginError) {
      if (loginError instanceof AuthApiError) {
        setError(loginError.message);
      } else {
        setError("Could not connect to the API. Check the backend URL and try again.");
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
      await onGoogleLogin(idToken);
    } catch (loginError) {
      if (loginError instanceof AuthApiError) {
        setError(loginError.message);
      } else {
        setError("Could not connect to the API. Check the backend URL and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={loginStyles.container}>
      <ScrollView
        contentContainerStyle={[loginStyles.scrollContent, !isWide && loginStyles.scrollContentCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[loginStyles.shell, { width: shellWidth }, !isWide && loginStyles.shellNarrow, isWide && loginStyles.shellWide]}>
          <View style={[loginStyles.heroPanel, isWide && loginStyles.heroPanelWide, isCompact && loginStyles.heroPanelCompact]}>
            <View
              {...(Platform.OS === "web" ? {} : { pointerEvents: "none" as const })}
              style={[StyleSheet.absoluteFill, loginStyles.heroChromeLayer]}
            >
              <View style={loginStyles.heroGridLineTop} />
              <View style={loginStyles.heroGridLineBottom} />
              <View style={loginStyles.heroGridLineLeft} />
              <View style={loginStyles.heroGridLineRight} />
              <View style={loginStyles.heroDiagonalOne} />
              <View style={loginStyles.heroDiagonalTwo} />
              <View style={loginStyles.heroAccentBlock} />
            </View>

            <View style={[loginStyles.heroContent, isCompact && loginStyles.heroContentCompact]}>
              <View style={loginStyles.heroBrandRow}>
                <View style={loginStyles.assetMark}>
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    source={require("../../assets/icon.png")}
                    style={loginStyles.assetImage}
                  />
                </View>
                <View style={loginStyles.heroBrandText}>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    numberOfLines={1}
                    style={[loginStyles.heroBrandTitle, isCompact && loginStyles.heroBrandTitleCompact]}
                  >
                    CampusConnect
                  </Text>
                  <Text style={loginStyles.heroBrandSubtitle}>Academic and professional network</Text>
                </View>
              </View>

              <View style={loginStyles.heroCopy}>
                <Text style={loginStyles.heroEyebrow}>University access portal</Text>
                <Text style={[loginStyles.heroTitle, isCompact && loginStyles.heroTitleCompact]}>
                  {isCompact ? "CampusConnect access for campus roles." : "Connect classroom work to real campus opportunity."}
                </Text>
                <Text style={[loginStyles.heroBody, isCompact && loginStyles.heroBodyCompact]}>
                  {DEMO_LOGINS_ENABLED
                    ? isCompact
                      ? "Log in with a demo role or check invite-based account access."
                      : "Sign in as a member, student, or teacher to test a role-specific network for projects, applications, mentorship, and academic review."
                    : isCompact
                      ? "Log in or request invite-based account access."
                      : "Sign in to a role-aware campus network for projects, applications, mentorship, and academic review."}
                </Text>
              </View>

              <HeroPaperScene compact={isCompact} />

              {visibleHighlights.length > 0 ? (
                <View style={[loginStyles.heroHighlights, isWide && loginStyles.heroHighlightsWide]}>
                  {visibleHighlights.map((item) => {
                    const Icon = item.icon;

                    return (
                      <View key={item.title} style={loginStyles.highlightTile}>
                        <View style={loginStyles.highlightIcon}>
                          <Icon color="#7DD3FC" size={18} strokeWidth={2.5} />
                        </View>
                        <View style={loginStyles.highlightCopy}>
                          <Text style={loginStyles.highlightTitle}>{item.title}</Text>
                          <Text style={loginStyles.highlightBody}>{item.body}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>

          <View style={[loginStyles.authColumn, isWide && loginStyles.authColumnWide]}>
            <View style={[loginStyles.loginPanel, isWide && loginStyles.loginPanelWide, isCompact && loginStyles.loginPanelCompact]}>
              <View style={[loginStyles.formHeader, isCompact && loginStyles.formHeaderCompact]}>
                <Text style={loginStyles.formEyebrow}>{authMode === "login" ? "Existing users" : "New users"}</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.84}
                  numberOfLines={isCompact ? 1 : 2}
                  style={[loginStyles.formTitle, isCompact && loginStyles.formTitleCompact]}
                >
                  {authMode === "login" ? (isCompact ? "CampusConnect login" : "Log in to CampusConnect") : "Create account"}
                </Text>
                <Text style={[loginStyles.formIntro, isCompact && loginStyles.formIntroCompact]}>
                  {authMode === "login"
                    ? DEMO_LOGINS_ENABLED
                      ? isCompact
                        ? "Use a demo role preset or working credentials."
                        : "Use a demo role preset or enter working credentials manually."
                      : "Sign in with your CampusConnect credentials."
                    : DEMO_LOGINS_ENABLED
                      ? "CampusConnect account creation is currently managed by invite and demo access."
                      : "CampusConnect account creation is currently managed by campus invite."}
                </Text>
              </View>

              <View style={[loginStyles.modeSwitch, isCompact && loginStyles.modeSwitchCompact]}>
                {authModes.map((mode) => {
                  const active = authMode === mode.value;
                  const Icon = mode.icon;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={mode.value}
                      onPress={() => switchAuthMode(mode.value)}
                      style={({ pressed }) => [
                        loginStyles.modeOption,
                        isCompact && loginStyles.modeOptionCompact,
                        active && loginStyles.modeOptionActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[loginStyles.modeIcon, isCompact && loginStyles.modeIconCompact, active && loginStyles.modeIconActive]}>
                        <Icon color={active ? palette.surface : palette.teal} size={isCompact ? 16 : 17} strokeWidth={2.6} />
                      </View>
                      <View style={loginStyles.modeCopy}>
                        <Text style={[loginStyles.modeLabel, active && loginStyles.modeLabelActive]} numberOfLines={1}>
                          {isCompact ? mode.compactLabel ?? mode.label : mode.label}
                        </Text>
                        {!isCompact ? (
                          <Text style={[loginStyles.modeDescription, active && loginStyles.modeDescriptionActive]}>
                            {mode.description}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {authMode === "login" ? (
                <>
                  {DEMO_LOGINS_ENABLED ? (
                  <View style={[loginStyles.roleSection, isCompact && loginStyles.roleSectionCompact]}>
                    <View style={loginStyles.sectionLabelRow}>
                      <Text style={[loginStyles.sectionLabel, isCompact && loginStyles.sectionLabelCompact]}>
                        Choose a role to continue
                      </Text>
                      {!isCompact ? <Text style={loginStyles.sectionMeta}>Tap to fill</Text> : null}
                    </View>

                    <View style={[loginStyles.roleStack, isCompact && loginStyles.roleStackCompact]}>
                      {loginPresets.map((preset) => {
                        const Icon = preset.icon;
                        const active = selectedRole === preset.role;

                        return (
                          <Pressable
                            accessibilityRole="button"
                            key={preset.role}
                            onPress={() => selectPreset(preset.role)}
                            style={({ pressed }) => [
                              loginStyles.roleCard,
                              isCompact && loginStyles.roleCardCompact,
                              active && loginStyles.roleCardActive,
                              pressed && styles.pressed,
                            ]}
                          >
                            <View style={[loginStyles.roleCardHeader, isCompact && loginStyles.roleCardHeaderCompact]}>
                              <View style={[loginStyles.roleIcon, isCompact && loginStyles.roleIconCompact, active && loginStyles.roleIconActive]}>
                                <Icon color={active ? palette.surface : palette.teal} size={isCompact ? 20 : 24} strokeWidth={2.45} />
                              </View>
                              <View style={[loginStyles.roleTextBlock, isCompact && loginStyles.roleTextBlockCompact]}>
                                <View style={[loginStyles.roleTitleRow, isCompact && loginStyles.roleTitleRowCompact]}>
                                  <Text
                                    style={[loginStyles.roleTitle, isCompact && loginStyles.roleTitleCompact, active && loginStyles.roleTitleActive]}
                                    numberOfLines={1}
                                  >
                                    {preset.label}
                                  </Text>
                                  {active && !isCompact ? <Text style={loginStyles.activeBadge}>Loaded</Text> : null}
                                </View>
                                {!isCompact ? (
                                  <Text style={[loginStyles.roleDescription, active && loginStyles.roleDescriptionActive]}>
                                    {preset.description}
                                  </Text>
                                ) : null}
                                <Text style={[loginStyles.roleCredential, isCompact && loginStyles.roleCredentialCompact]} numberOfLines={1}>
                                  {preset.email}
                                </Text>
                              </View>
                            </View>

                            {!isCompact ? (
                              <View style={loginStyles.permissionWrap}>
                                {preset.permissions.map((permission) => (
                                  <Text
                                    key={`${preset.role}-${permission}`}
                                    style={[loginStyles.permissionBadge, active && loginStyles.permissionBadgeActive]}
                                  >
                                    {permission}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  ) : null}

                  <View style={[loginStyles.formStack, isCompact && loginStyles.formStackCompact]}>
                    <View style={loginStyles.field}>
                      <Text style={loginStyles.label}>Email</Text>
                      <View style={[loginStyles.inputFrame, isCompact && loginStyles.inputFrameCompact]}>
                        <TextInput
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect={false}
                          keyboardType="email-address"
                          onChangeText={(value) => {
                            setEmail(value);
                            setSelectedRole(null);
                          }}
                          placeholder={DEMO_LOGINS_ENABLED ? "member@example.edu" : "you@university.edu"}
                          placeholderTextColor={palette.faint}
                          returnKeyType="next"
                          style={[loginStyles.textInput, isCompact && loginStyles.textInputCompact]}
                          textContentType="emailAddress"
                          value={email}
                        />
                      </View>
                    </View>

                    <View style={loginStyles.field}>
                      <Text style={loginStyles.label}>Password</Text>
                      <View style={[loginStyles.inputFrame, isCompact && loginStyles.inputFrameCompact]}>
                        <TextInput
                          autoCapitalize="none"
                          autoComplete="password"
                          onChangeText={(value) => {
                            setPassword(value);
                            setSelectedRole(null);
                          }}
                          onSubmitEditing={submit}
                          placeholder="Password"
                          placeholderTextColor={palette.faint}
                          returnKeyType="go"
                          secureTextEntry={!showPassword}
                          style={[loginStyles.textInput, isCompact && loginStyles.textInputCompact]}
                          textContentType="password"
                          value={password}
                        />
                        <Pressable
                          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => setShowPassword((visible) => !visible)}
                          style={({ pressed }) => [loginStyles.passwordToggle, pressed && styles.pressed]}
                        >
                          {showPassword ? (
                            <EyeOff color={palette.muted} size={18} strokeWidth={2.4} />
                          ) : (
                            <Eye color={palette.muted} size={18} strokeWidth={2.4} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {error ? (
                    <View style={loginStyles.errorPanel}>
                      <Text style={loginStyles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {loading && showSlowHint ? (
                    <View style={loginStyles.slowHintPanel}>
                      <Text style={loginStyles.slowHintText}>
                        Still connecting - the campus server may be waking up. The first login after a quiet period can
                        take up to a minute.
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={submit}
                    style={({ pressed }) => [
                      loginStyles.submitButton,
                      isCompact && loginStyles.submitButtonCompact,
                      loading && loginStyles.disabled,
                      pressed && !loading && styles.pressed,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color={palette.surface} size="small" />
                    ) : (
                      <LogIn color={palette.surface} size={18} strokeWidth={2.6} />
                    )}
                    <Text style={loginStyles.submitButtonText}>{loading ? "Logging in" : "Log in"}</Text>
                  </Pressable>

                  {GOOGLE_OAUTH_CLIENT_ID && onGoogleLogin ? (
                    <GoogleSsoButton
                      disabled={loading}
                      onError={setError}
                      onIdToken={(idToken) => void submitGoogleToken(idToken)}
                    />
                  ) : null}
                </>
              ) : (
                <RequestAccessPanel onUseDemoLogin={() => switchAuthMode("login")} />
              )}

              {DEMO_LOGINS_ENABLED ? (
                <View style={loginStyles.apiHint}>
                  <Server color={palette.navy} size={16} strokeWidth={2.4} />
                  <View style={loginStyles.apiHintText}>
                    <Text style={loginStyles.hintLabel}>API endpoint</Text>
                    <Text style={loginStyles.hintValue} numberOfLines={2}>
                      {API_BASE_URL}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
            <DashboardPreview compact={isCompact} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.page,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
  },
  scrollContentCompact: {
    justifyContent: "flex-start",
    padding: 12,
    paddingBottom: 24,
  },
  shell: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 1180,
    width: "100%",
  },
  shellNarrow: {
    alignSelf: "center",
    flexDirection: "column-reverse",
  },
  shellWide: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 22,
  },
  heroPanel: {
    alignSelf: "stretch",
    backgroundColor: "#09233D",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    padding: 24,
    ...platformShadow({
      color: "#03101E",
      offset: { height: 18, width: 0 },
      opacity: 0.22,
      radius: 32,
    }),
  },
  heroPanelWide: {
    flex: 1.02,
    justifyContent: "center",
    minHeight: 760,
    padding: 44,
  },
  heroPanelCompact: {
    minHeight: 214,
    padding: 18,
  },
  heroChromeLayer: {
    pointerEvents: "none",
  },
  heroGridLineTop: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: 72,
  },
  heroGridLineBottom: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    bottom: 116,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
  },
  heroGridLineLeft: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    bottom: 0,
    left: 76,
    position: "absolute",
    top: 0,
    width: 1,
  },
  heroGridLineRight: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    bottom: 0,
    position: "absolute",
    right: 118,
    top: 0,
    width: 1,
  },
  heroDiagonalOne: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    height: 134,
    position: "absolute",
    right: -86,
    top: 104,
    transform: [{ rotate: "-22deg" }],
    width: 420,
  },
  heroDiagonalTwo: {
    backgroundColor: "rgba(15, 118, 110, 0.28)",
    borderRadius: 8,
    bottom: 108,
    height: 92,
    left: -96,
    position: "absolute",
    transform: [{ rotate: "-22deg" }],
    width: 380,
  },
  heroAccentBlock: {
    backgroundColor: "rgba(255, 253, 248, 0.1)",
    borderColor: "rgba(255, 253, 248, 0.16)",
    borderWidth: 1,
    bottom: 24,
    height: 118,
    position: "absolute",
    right: 26,
    transform: [{ rotate: "-8deg" }],
    width: 118,
  },
  heroContent: {
    gap: 24,
  },
  heroContentCompact: {
    gap: 18,
  },
  heroBrandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  assetMark: {
    alignItems: "center",
    backgroundColor: palette.teal,
    borderColor: "rgba(255, 255, 255, 0.32)",
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
    ...platformShadow({
      color: "#020617",
      offset: { height: 10, width: 0 },
      opacity: 0.34,
      radius: 18,
    }),
  },
  assetImage: {
    height: 58,
    width: 58,
  },
  heroBrandText: {
    flex: 1,
    minWidth: 0,
  },
  heroBrandTitle: {
    color: palette.surface,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  heroBrandTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroBrandSubtitle: {
    color: "#E1E8EF",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  heroCopy: {
    gap: 12,
    maxWidth: 620,
  },
  heroEyebrow: {
    color: "#2DD4BF",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: palette.surface,
    fontSize: 45,
    fontWeight: "900",
    lineHeight: 53,
    ...webSafeTextShadow({
      color: "rgba(2, 6, 23, 0.36)",
      offset: { height: 3, width: 0 },
      radius: 0,
    }),
  },
  heroTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroBody: {
    color: "#E5ECF4",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 26,
    maxWidth: 520,
  },
  heroBodyCompact: {
    fontSize: 14,
    lineHeight: 21,
  },
  heroHighlights: {
    gap: 13,
  },
  heroHighlightsWide: {
    flexDirection: "column",
    maxWidth: 430,
  },
  highlightTile: {
    alignItems: "center",
    backgroundColor: "rgba(7, 29, 51, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minWidth: 0,
    padding: 12,
    ...platformShadow({
      color: "#020617",
      offset: { height: 8, width: 0 },
      opacity: 0.18,
      radius: 16,
    }),
  },
  highlightIcon: {
    alignItems: "center",
    backgroundColor: "#0A2540",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  highlightTitle: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: "900",
  },
  highlightBody: {
    color: "#D9E2EE",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  highlightCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  authColumn: {
    alignSelf: "stretch",
    gap: 18,
    minWidth: 0,
  },
  authColumnWide: {
    flexBasis: 540,
    flexShrink: 0,
    maxWidth: 540,
  },
  loginPanel: {
    alignSelf: "stretch",
    backgroundColor: "#FFFDF8",
    borderColor: "rgba(221, 214, 202, 0.96)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    minWidth: 0,
    padding: 22,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 22, width: 0 },
      opacity: 0.18,
      radius: 30,
    }),
  },
  loginPanelWide: {
    padding: 24,
  },
  loginPanelCompact: {
    gap: 12,
    padding: 14,
  },
  formHeader: {
    gap: 6,
    minWidth: 0,
  },
  formHeaderCompact: {
    gap: 4,
  },
  formEyebrow: {
    color: palette.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  formTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  formTitleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  formIntro: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  formIntroCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  formStack: {
    gap: 12,
  },
  formStackCompact: {
    gap: 9,
  },
  modeSwitch: {
    backgroundColor: "#F4F1EA",
    borderColor: "rgba(221, 214, 202, 0.66)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 0,
    minWidth: 0,
    padding: 4,
  },
  modeSwitchCompact: {
    flexDirection: "row",
    gap: 4,
  },
  modeOption: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeOptionCompact: {
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeOptionActive: {
    backgroundColor: palette.surface,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 8, width: 0 },
      opacity: 0.12,
      radius: 16,
    }),
  },
  modeIcon: {
    alignItems: "center",
    backgroundColor: palette.tealSoft,
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  modeIconCompact: {
    height: 30,
    width: 30,
  },
  modeIconActive: {
    backgroundColor: palette.teal,
  },
  modeCopy: {
    flex: 1,
    minWidth: 0,
  },
  modeLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  modeLabelActive: {
    color: palette.teal,
  },
  modeDescription: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    marginTop: 1,
  },
  modeDescriptionActive: {
    color: palette.text,
  },
  roleSection: {
    gap: 10,
    minWidth: 0,
  },
  roleSectionCompact: {
    gap: 8,
  },
  sectionLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
  },
  sectionLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionMeta: {
    color: palette.faint,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  roleStack: {
    gap: 10,
    minWidth: 0,
  },
  roleStackCompact: {
    flexDirection: "row",
    gap: 7,
  },
  roleCard: {
    alignItems: "stretch",
    alignSelf: "stretch",
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minHeight: 108,
    minWidth: 0,
    padding: 14,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 8, width: 0 },
      opacity: 0.08,
      radius: 16,
    }),
  },
  roleCardCompact: {
    alignItems: "center",
    flex: 1,
    gap: 0,
    minHeight: 86,
    padding: 8,
  },
  roleCardActive: {
    backgroundColor: "#F7FFFC",
    borderColor: palette.teal,
    ...platformShadow({
      color: "#0F766E",
      offset: { height: 12, width: 0 },
      opacity: 0.18,
      radius: 20,
    }),
  },
  roleCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  roleCardHeaderCompact: {
    alignItems: "center",
    flexDirection: "column",
    gap: 6,
  },
  roleIcon: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "rgba(221, 214, 202, 0.88)",
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 8, width: 0 },
      opacity: 0.1,
      radius: 14,
    }),
  },
  roleIconCompact: {
    height: 36,
    width: 36,
  },
  roleIconActive: {
    backgroundColor: palette.teal,
    borderColor: palette.teal,
  },
  roleTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  roleTextBlockCompact: {
    alignItems: "center",
    alignSelf: "stretch",
    flex: 0,
  },
  roleTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  roleTitleRowCompact: {
    justifyContent: "center",
  },
  roleTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  roleTitleCompact: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: "center",
  },
  roleTitleActive: {
    color: palette.teal,
  },
  activeBadge: {
    backgroundColor: palette.teal,
    borderRadius: 7,
    color: palette.surface,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  roleDescription: {
    color: palette.muted,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 2,
  },
  roleDescriptionActive: {
    color: palette.text,
  },
  roleCredential: {
    color: palette.muted,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: 2,
  },
  roleCredentialCompact: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
    maxWidth: "100%",
    textAlign: "center",
  },
  permissionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  permissionBadge: {
    backgroundColor: "#F1F5F9",
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.text,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  permissionBadgeActive: {
    backgroundColor: palette.tealSoft,
    borderColor: "#A7D8D0",
    color: palette.teal,
  },
  field: {
    gap: 7,
    minWidth: 0,
  },
  label: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
  },
  inputFrame: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  inputFrameCompact: {
    minHeight: 44,
    paddingHorizontal: 11,
  },
  textInput: {
    color: palette.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 44,
  },
  textInputCompact: {
    minHeight: 40,
  },
  errorPanel: {
    backgroundColor: palette.redSoft,
    borderColor: "#F2B7B2",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  slowHintPanel: {
    backgroundColor: palette.tealSoft,
    borderColor: "#B9E5DC",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  slowHintText: {
    color: palette.teal,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  passwordToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    width: 36,
  },
  errorText: {
    color: palette.red,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.66,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: palette.teal,
    borderColor: "#0A5E57",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    ...platformShadow({
      color: "#0F766E",
      offset: { height: 10, width: 0 },
      opacity: 0.26,
      radius: 18,
    }),
  },
  submitButtonCompact: {
    minHeight: 48,
  },
  submitButtonText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  requestStack: {
    gap: 12,
  },
  requestPanel: {
    alignItems: "flex-start",
    backgroundColor: palette.tealSoft,
    borderColor: "#B9E5DC",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  requestIcon: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  requestBody: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  accessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  accessTile: {
    backgroundColor: "#F8FAFC",
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minWidth: 142,
    padding: 12,
  },
  accessIcon: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  accessTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  accessBody: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  apiHint: {
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  apiHintText: {
    flex: 1,
    minWidth: 0,
  },
  hintLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  hintValue: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 1,
  },
  paperScene: {
    height: 210,
    marginBottom: 4,
    marginTop: 6,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  paperMoon: {
    backgroundColor: "rgba(255, 253, 248, 0.08)",
    borderColor: "rgba(255, 253, 248, 0.12)",
    borderRadius: 90,
    borderWidth: 1,
    height: 180,
    position: "absolute",
    right: -58,
    top: -34,
    width: 180,
  },
  paperHillBack: {
    backgroundColor: "#0E5F62",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderTopLeftRadius: 90,
    borderTopRightRadius: 120,
    borderWidth: 1,
    bottom: 10,
    height: 88,
    left: -28,
    position: "absolute",
    right: 68,
    transform: [{ rotate: "5deg" }],
  },
  paperHillFront: {
    backgroundColor: "#0B2F55",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderTopLeftRadius: 130,
    borderTopRightRadius: 80,
    borderWidth: 1,
    bottom: -38,
    height: 98,
    left: -38,
    position: "absolute",
    right: -28,
    transform: [{ rotate: "-5deg" }],
  },
  paperTreeLeft: {
    backgroundColor: "#1A7772",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 46,
    borderWidth: 1,
    bottom: 32,
    height: 76,
    left: 4,
    position: "absolute",
    width: 76,
  },
  paperTreeRight: {
    backgroundColor: "#3C8B7E",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 52,
    borderWidth: 1,
    bottom: 40,
    height: 94,
    position: "absolute",
    right: 10,
    width: 94,
  },
  paperBuilding: {
    alignItems: "center",
    backgroundColor: "#F7F2E7",
    borderColor: "#D8D1C4",
    borderRadius: 3,
    borderWidth: 1,
    bottom: 44,
    height: 86,
    justifyContent: "flex-end",
    left: 80,
    paddingBottom: 9,
    position: "absolute",
    width: 172,
    ...platformShadow({
      color: "#020617",
      offset: { height: 8, width: 0 },
      opacity: 0.22,
      radius: 12,
    }),
  },
  paperRoof: {
    backgroundColor: "#FFFDF8",
    borderColor: "#D8D1C4",
    borderRadius: 2,
    borderWidth: 1,
    height: 48,
    position: "absolute",
    top: -27,
    transform: [{ rotate: "45deg" }],
    width: 48,
  },
  paperFlagPole: {
    backgroundColor: "#E7DDD0",
    height: 42,
    left: 85,
    position: "absolute",
    top: -58,
    width: 3,
  },
  paperFlag: {
    backgroundColor: "#FFFDF8",
    borderColor: "#D8D1C4",
    borderRadius: 3,
    borderWidth: 1,
    height: 20,
    left: 88,
    position: "absolute",
    top: -58,
    width: 38,
  },
  paperColumnRow: {
    flexDirection: "row",
    gap: 11,
  },
  paperColumn: {
    backgroundColor: "#E7DDD0",
    borderColor: "#D8D1C4",
    borderRadius: 2,
    borderWidth: 1,
    height: 52,
    width: 18,
  },
  paperSteps: {
    backgroundColor: "#DDD4C7",
    borderRadius: 2,
    bottom: 0,
    height: 8,
    left: 20,
    position: "absolute",
    right: 20,
  },
  paperClockTower: {
    alignItems: "center",
    backgroundColor: "#F2EBDD",
    borderColor: "#D8D1C4",
    borderRadius: 3,
    borderWidth: 1,
    bottom: 44,
    height: 110,
    justifyContent: "center",
    position: "absolute",
    right: 52,
    width: 62,
    ...platformShadow({
      color: "#020617",
      offset: { height: 8, width: 0 },
      opacity: 0.16,
      radius: 12,
    }),
  },
  paperTowerRoof: {
    backgroundColor: "#FFFDF8",
    borderColor: "#D8D1C4",
    borderRadius: 2,
    borderWidth: 1,
    height: 38,
    position: "absolute",
    top: -20,
    transform: [{ rotate: "45deg" }],
    width: 38,
  },
  paperClockFace: {
    backgroundColor: "#FFFDF8",
    borderColor: "#B9AFA1",
    borderRadius: 15,
    borderWidth: 2,
    height: 30,
    width: 30,
  },
  previewStack: {
    alignSelf: "stretch",
    gap: 14,
  },
  previewSearchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  previewSearch: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 14,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 10, width: 0 },
      opacity: 0.1,
      radius: 18,
    }),
  },
  previewSearchText: {
    color: palette.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  previewFilterButton: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 10, width: 0 },
      opacity: 0.1,
      radius: 18,
    }),
  },
  previewSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewSectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  previewSectionAction: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "900",
  },
  previewProfileRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewProfileCard: {
    alignItems: "flex-start",
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 132,
    minWidth: 0,
    padding: 12,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 10, width: 0 },
      opacity: 0.12,
      radius: 18,
    }),
  },
  previewAvatar: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  previewAvatarMentor: {
    backgroundColor: palette.violetSoft,
  },
  previewAvatarStudent: {
    backgroundColor: palette.blueSoft,
  },
  previewProfileName: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  previewRolePill: {
    borderRadius: 7,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  previewRolePillMentor: {
    backgroundColor: palette.violetSoft,
    color: palette.violet,
  },
  previewRolePillStudent: {
    backgroundColor: palette.blueSoft,
    color: palette.blue,
  },
  previewOpportunityRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewOpportunityCard: {
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 118,
    minWidth: 0,
    padding: 12,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 10, width: 0 },
      opacity: 0.12,
      radius: 18,
    }),
  },
  previewOpportunityIcon: {
    alignItems: "center",
    backgroundColor: palette.teal,
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  previewOpportunityTitle: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  previewOpportunityMeta: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  previewBottomNav: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#DDD6CA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: 10,
    ...platformShadow({
      color: "#0A2540",
      offset: { height: 12, width: 0 },
      opacity: 0.14,
      radius: 20,
    }),
  },
  previewNavItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  previewNavText: {
    color: palette.navy,
    fontSize: 10,
    fontWeight: "800",
  },
  previewNavTextActive: {
    color: palette.teal,
  },
});
