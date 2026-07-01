import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  GraduationCap,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";

import { EmptyState, ErrorState, LoadingState } from "../components/common/PortalState";
import { SectionHeader } from "../components/common/SectionHeader";
import { StatusChip } from "../components/common/StatusChip";
import type { IconComponent } from "../components/common/types";
import {
  NetworkApiError,
  addMySkill,
  addResumeEntry,
  applyToOpportunity,
  createOpportunity,
  deleteMySkill,
  deleteResumeEntry,
  getMyApplications,
  getMyConnections,
  getMyOwnedOpportunities,
  getMyProfile,
  getOpportunityApplications,
  getOpportunityDetail,
  getProfileDetail,
  getRecommendedOpportunities,
  getRecommendedProfiles,
  listOpportunities,
  listProfiles,
  requestConnection,
  saveOpportunity,
  unsaveOpportunity,
  updateApplicationStatus,
  updateConnectionStatus,
  updateMySkill,
  updateMyProfile,
  updateOpportunity,
  updateResumeEntry,
  withdrawApplication,
} from "../lib/api/network";
import { usePortalData } from "../lib/api/usePortalData";
import { palette, paperShadow, paperTexture, styles, webSafeTextShadow } from "../styles/theme";
import type {
  ConnectionRequestDecision,
  ConnectionRequestRead,
  MyOpportunityApplicationRead,
  NetworkTab,
  NetworkRole,
  OwnerApplicationStatusUpdate,
  OwnerOpportunityApplicationRead,
  OpportunityDetailRead,
  OpportunityRead,
  OpportunityType,
  ProfileRead,
  ProfileRecommendationRead,
  ProfileSummary,
  ProfileVisibility,
  ResumeEntryRead,
  ResumeEntryType,
  SkillLevel,
  UserSkillRead,
} from "../types/network";

type ActionState = "idle" | "sending" | "sent" | "error";
type OpportunityFilter = OpportunityType | "all";
type PortfolioSaveState = "idle" | "saving" | "saved" | "error";

interface CampusConnectScreenProps {
  activeTab: NetworkTab;
  token: string | null;
}

interface DiscoverData {
  myProfile: ProfileRead;
  profiles: ProfileRead[];
  recommendedProfiles: ProfileRecommendationRead[];
}

interface ProfileDraft {
  headline: string;
  bio: string;
  university: string;
  faculty: string;
  graduation_year: string;
  location: string;
  visibility: ProfileVisibility;
}

interface SkillDraft {
  name: string;
  level: SkillLevel;
}

interface ResumeDraft {
  entry_type: ResumeEntryType;
  title: string;
  organization: string;
  description: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  url: string;
}

const opportunityTypes: OpportunityType[] = ["startup", "research", "internship", "job", "project"];
const opportunityFilters: OpportunityFilter[] = ["all", ...opportunityTypes];
const opportunityAuthorTypesByRole: Record<NetworkRole, OpportunityType[]> = {
  member: [],
  student: ["startup", "project"],
  teacher: ["research"],
  mentor: ["startup", "project", "research"],
  employer: ["internship", "job", "project"],
  admin: ["startup", "research", "internship", "job", "project"],
};
const ownerApplicationStatuses: OwnerApplicationStatusUpdate[] = ["reviewing", "accepted", "rejected"];
const visibilityOptions: ProfileVisibility[] = ["public", "university_only", "private"];
const skillLevels: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];
const resumeEntryTypes: ResumeEntryType[] = ["education", "work", "project", "research", "award", "certification"];

function allowedOpportunityTypes(role: NetworkRole | undefined): OpportunityType[] {
  if (!role) {
    return [];
  }

  return opportunityAuthorTypesByRole[role] ?? [];
}

function opportunityAuthoringCopy(role: NetworkRole | undefined): string {
  if (!role) {
    return "Loading posting permissions.";
  }

  if (role === "student") {
    return "Student can post Startup and Project opportunities. Browse, connect, save, and apply are available.";
  }

  if (role === "member") {
    return "Member can browse, save, apply, and connect. Posting is not available for this role.";
  }

  if (role === "teacher") {
    return "Teacher can post Research opportunities and review applicants.";
  }

  const allowedTypes = allowedOpportunityTypes(role);
  if (!allowedTypes.length) {
    return "This profile can browse, save, apply, and connect. Posting is not available for this role.";
  }

  return `${titleCase(role)} can post: ${allowedTypes.map(titleCase).join(", ")}.`;
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
}

function isConflict(error: unknown): boolean {
  return error instanceof NetworkApiError && error.status === 409;
}

function isNotFound(error: unknown): boolean {
  return error instanceof NetworkApiError && error.status === 404;
}

function profileSkills(profile: ProfileRead): string[] {
  return profile.skills.map((item) => item.skill.name);
}

function opportunityOwner(opportunity: { owner_profile: ProfileSummary }): string {
  return opportunity.owner_profile.user.full_name;
}

function profileMeta(profile: ProfileSummary): string {
  const parts = [profile.university, profile.faculty, profile.location].filter(Boolean);
  return parts.length ? parts.join(" - ") : "CampusConnect member";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Present";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatFullDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function resumeDateRange(entry: ResumeEntryRead): string {
  const start = formatDate(entry.start_date);
  const end = entry.is_current ? "Present" : formatDate(entry.end_date);
  return `${start} - ${end}`;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function profileToDraft(profile: ProfileRead): ProfileDraft {
  return {
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    university: profile.university ?? "",
    faculty: profile.faculty ?? "",
    graduation_year: profile.graduation_year === null ? "" : String(profile.graduation_year),
    location: profile.location ?? "",
    visibility: profile.visibility,
  };
}

function emptySkillDraft(): SkillDraft {
  return {
    name: "",
    level: "intermediate",
  };
}

function skillToDraft(userSkill: UserSkillRead): SkillDraft {
  return {
    name: userSkill.skill.name,
    level: userSkill.level,
  };
}

function emptyResumeDraft(): ResumeDraft {
  return {
    entry_type: "project",
    title: "",
    organization: "",
    description: "",
    start_date: "",
    end_date: "",
    is_current: false,
    url: "",
  };
}

function resumeToDraft(entry: ResumeEntryRead): ResumeDraft {
  return {
    entry_type: entry.entry_type,
    title: entry.title,
    organization: entry.organization ?? "",
    description: entry.description ?? "",
    start_date: entry.start_date ?? "",
    end_date: entry.end_date ?? "",
    is_current: entry.is_current,
    url: entry.url ?? "",
  };
}

function normalizeDateInput(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${label} must be a valid date.`);
  }

  return trimmed;
}

function resumeDraftToPayload(draft: ResumeDraft) {
  const title = draft.title.trim();
  if (!title) {
    throw new Error("Add a title for the resume entry.");
  }

  return {
    entry_type: draft.entry_type,
    title,
    organization: emptyToNull(draft.organization),
    description: emptyToNull(draft.description),
    start_date: normalizeDateInput(draft.start_date, "Start date"),
    end_date: draft.is_current ? null : normalizeDateInput(draft.end_date, "End date"),
    is_current: draft.is_current,
    url: emptyToNull(draft.url),
  };
}

function roleTone(role: string) {
  switch (role) {
    case "member":
      return "green" as const;
    case "mentor":
    case "teacher":
      return "violet" as const;
    case "employer":
      return "amber" as const;
    case "admin":
      return "red" as const;
    case "student":
    default:
      return "blue" as const;
  }
}

function opportunityTone(type: OpportunityType) {
  switch (type) {
    case "startup":
      return "violet" as const;
    case "research":
      return "blue" as const;
    case "internship":
      return "green" as const;
    case "job":
      return "amber" as const;
    case "project":
    default:
      return "slate" as const;
  }
}

function statusTone(status: string) {
  switch (status) {
    case "open":
    case "submitted":
    case "accepted":
      return "green" as const;
    case "draft":
    case "reviewing":
    case "pending":
      return "amber" as const;
    case "closed":
    case "archived":
    case "rejected":
    case "declined":
    case "canceled":
      return "red" as const;
    default:
      return "slate" as const;
  }
}

function canOwnerReviewApplication(status: string): boolean {
  return status === "submitted" || status === "reviewing";
}

function reviewStatusIcon(status: OwnerApplicationStatusUpdate): IconComponent {
  if (status === "accepted") {
    return CheckCircle2;
  }

  if (status === "rejected") {
    return X;
  }

  return Eye;
}

function InlineAction({
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onPress,
  secondary = false,
  wide = false,
}: {
  disabled?: boolean;
  icon: IconComponent;
  label: string;
  loading?: boolean;
  onPress?: () => void;
  secondary?: boolean;
  wide?: boolean;
}) {
  const { width } = useWindowDimensions();
  const locked = disabled && !loading;
  const color = locked ? "#746D62" : secondary ? palette.text : palette.surface;
  const shouldStretch = wide && width < 640;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={({ pressed }) => [
        networkStyles.inlineAction,
        secondary && networkStyles.inlineActionSecondary,
        shouldStretch && networkStyles.inlineActionWide,
        wide && !shouldStretch && networkStyles.inlineActionBalanced,
        loading && networkStyles.disabled,
        locked && networkStyles.inlineActionDisabled,
        locked && secondary && networkStyles.inlineActionDisabledSecondary,
        locked && !secondary && networkStyles.inlineActionDisabledPrimary,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <Icon color={color} size={16} strokeWidth={2.6} />
      )}
      <Text
        style={[
          networkStyles.inlineActionText,
          secondary && networkStyles.inlineActionTextSecondary,
          locked && networkStyles.inlineActionTextDisabled,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SkillPill({ label }: { label: string }) {
  return (
    <View style={networkStyles.skillPill}>
      <View style={networkStyles.skillPillEdge} />
      <Text style={networkStyles.skillPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SkillList({ emptyLabel, items }: { emptyLabel: string; items: string[] }) {
  if (!items.length) {
    return <Text style={styles.smallText}>{emptyLabel}</Text>;
  }

  const visibleItems = items.slice(0, 5);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <View style={networkStyles.pillWrap}>
      {visibleItems.map((item) => (
        <SkillPill key={item} label={item} />
      ))}
      {hiddenCount > 0 ? <SkillPill label={`+${hiddenCount}`} /> : null}
    </View>
  );
}

function FilterChip<T extends string>({
  active,
  label,
  onPress,
  value,
}: {
  active: boolean;
  label: string;
  onPress: (value: T) => void;
  value: T;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(value)}
      style={({ pressed }) => [networkStyles.filterChip, active && networkStyles.filterChipActive, pressed && styles.pressed]}
    >
      <Text style={[networkStyles.filterChipText, active && networkStyles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SearchBox({ onChangeText, value }: { onChangeText: (value: string) => void; value: string }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  return (
    <View style={[styles.searchRow, isCompact && networkStyles.searchRowCompact]}>
      <Search color={palette.faint} size={18} strokeWidth={2.4} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder="Search people, skills, roles, or university"
        placeholderTextColor={palette.faint}
        returnKeyType="search"
        style={styles.textInput}
        value={value}
      />
    </View>
  );
}

function DiscoverDashboard({ data, isCompact, isWide }: { data: DiscoverData; isCompact: boolean; isWide: boolean }) {
  const featuredProfiles = data.recommendedProfiles.slice(0, 3);
  const stats = [
    { label: "Profiles", value: String(data.profiles.length) },
    { label: "Recommended", value: String(data.recommendedProfiles.length) },
    { label: "Skills", value: String(data.myProfile.skills.length) },
  ];

  return (
    <View
      style={[
        networkStyles.discoverDashboard,
        isCompact && networkStyles.discoverDashboardCompact,
        isWide && networkStyles.discoverDashboardWide,
      ]}
    >
      <View style={[networkStyles.discoverDashboardMain, isCompact && networkStyles.discoverDashboardMainCompact]}>
        <View style={[networkStyles.discoverEyebrowRow, isCompact && networkStyles.discoverEyebrowRowCompact]}>
          <View style={[networkStyles.discoverEyebrowIcon, isCompact && networkStyles.discoverEyebrowIconCompact]}>
            <Search color={palette.surface} size={isCompact ? 15 : 16} strokeWidth={2.6} />
          </View>
          <Text style={networkStyles.discoverEyebrow}>Discover</Text>
        </View>
        <Text style={[networkStyles.discoverTitle, isCompact && networkStyles.discoverTitleCompact]}>
          {isCompact ? "Find collaborators, mentors, and opportunities." : "Turn campus work into collaborators, mentors, and opportunities."}
        </Text>
        <Text style={[networkStyles.discoverBody, isCompact && networkStyles.discoverBodyCompact]}>
          {isCompact
            ? "Browse role-aware profiles and match signals."
            : "Browse role-aware profiles, compare match signals, and start focused academic or professional connections."}
        </Text>
        <View style={[networkStyles.discoverStatsRow, isCompact && networkStyles.discoverStatsRowCompact]}>
          {stats.map((item) => (
            <View key={item.label} style={[networkStyles.discoverStat, isCompact && networkStyles.discoverStatCompact]}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.76}
                numberOfLines={1}
                style={[networkStyles.discoverStatValue, isCompact && networkStyles.discoverStatValueCompact]}
              >
                {item.value}
              </Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[networkStyles.discoverStatLabel, isCompact && networkStyles.discoverStatLabelCompact]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {!isCompact ? (
        <View style={networkStyles.discoverSnapshot}>
          <View style={networkStyles.snapshotHeader}>
            <Text style={networkStyles.snapshotTitle}>Recommended profiles</Text>
            <Text style={networkStyles.snapshotAction}>{featuredProfiles.length ? `${featuredProfiles.length} shown` : "Empty"}</Text>
          </View>
          {featuredProfiles.length ? (
            <View style={networkStyles.snapshotList}>
              {featuredProfiles.map((profile) => (
                <View key={profile.id} style={networkStyles.snapshotRow}>
                  <View style={[networkStyles.snapshotAvatar, profile.role === "teacher" && networkStyles.snapshotAvatarMentor]}>
                    <Users
                      color={profile.role === "teacher" ? palette.violet : palette.blue}
                      size={17}
                      strokeWidth={2.5}
                    />
                  </View>
                  <View style={networkStyles.cardTitleBlock}>
                    <Text style={networkStyles.snapshotName} numberOfLines={1}>
                      {profile.user.full_name}
                    </Text>
                    <Text style={networkStyles.snapshotMeta} numberOfLines={1}>
                      {profile.headline ?? profileMeta(profile)}
                    </Text>
                  </View>
                  <MatchSlip score={profile.match_score} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={networkStyles.snapshotEmpty}>Recommendations appear as your profile gains usable skills.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function FormField({
  children,
  label,
  style,
}: {
  children: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[networkStyles.formField, style]}>
      <Text style={networkStyles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

function LabeledInput({
  containerStyle,
  label,
  style: inputStyle,
  ...props
}: TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
}) {
  return (
    <FormField label={label} style={containerStyle}>
      <TextInput
        placeholderTextColor={palette.faint}
        style={[styles.textInput, networkStyles.formInput, inputStyle]}
        {...props}
      />
    </FormField>
  );
}

function ScreenIntro({ children }: { children: string }) {
  return (
    <View style={networkStyles.introPanel}>
      <Text style={networkStyles.introText}>{children}</Text>
    </View>
  );
}

function MatchSlip({ score }: { score: number }) {
  return (
    <View style={networkStyles.matchSlip}>
      <Text style={networkStyles.matchSlipText} numberOfLines={1}>
        {score}% Match
      </Text>
    </View>
  );
}

function MatchPreview({ reasons, score }: { reasons: string[]; score: number }) {
  const primaryReason = reasons[0] ?? "Based on profile fit";
  const secondaryReason = reasons[1];

  return (
    <View style={networkStyles.matchPanel}>
      <View style={networkStyles.matchHeader}>
        <MatchSlip score={score} />
        <Text style={networkStyles.matchSubcopy} numberOfLines={2}>
          {primaryReason}
        </Text>
      </View>
      {secondaryReason ? (
        <Text style={networkStyles.matchReason} numberOfLines={2}>
          {secondaryReason}
        </Text>
      ) : null}
    </View>
  );
}

function ProfileCard({
  actionDisabled,
  actionIcon,
  actionLabel,
  actionLoading,
  actionSecondary = false,
  matchReasons,
  matchScore,
  message,
  messageError = false,
  onAction,
  onOpen,
  profile,
}: {
  actionDisabled: boolean;
  actionIcon: IconComponent;
  actionLabel: string;
  actionLoading: boolean;
  actionSecondary?: boolean;
  matchReasons?: string[];
  matchScore?: number;
  message?: string;
  messageError?: boolean;
  onAction: () => void;
  onOpen: () => void;
  profile: ProfileRead;
}) {
  const { width } = useWindowDimensions();
  const isWideCard = width >= 760;

  return (
    <View
      style={[
        styles.card,
        styles.compactCard,
        networkStyles.networkCard,
        isWideCard && networkStyles.networkCardWide,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [networkStyles.cardOpenArea, pressed && styles.pressed]}
      >
        <View style={networkStyles.entityHeader}>
          <View style={[networkStyles.entityIcon, networkStyles.profileEntityIcon]}>
            <Users color={palette.blue} size={20} strokeWidth={2.5} />
          </View>
          <View style={networkStyles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={3}>
              {profile.user.full_name}
            </Text>
            {profile.headline ? (
              <Text style={styles.cardMeta} numberOfLines={4}>
                {profile.headline}
              </Text>
            ) : null}
          </View>
          <StatusChip label={titleCase(profile.role)} tone={roleTone(profile.role)} />
        </View>

        {matchScore !== undefined ? <MatchPreview reasons={matchReasons ?? []} score={matchScore} /> : null}

        <View style={networkStyles.metaRow}>
          <Building2 color={palette.faint} size={15} strokeWidth={2.4} />
          <Text style={networkStyles.metaText} numberOfLines={2}>
            {profileMeta(profile)}
          </Text>
        </View>

        <SkillList emptyLabel="No skills listed yet." items={profileSkills(profile)} />
      </Pressable>

      <InlineAction
        disabled={actionDisabled}
        icon={actionIcon}
        label={actionLabel}
        loading={actionLoading}
        onPress={onAction}
        secondary={actionSecondary}
        wide
      />
      {message ? (
        <Text style={[networkStyles.actionMessage, messageError && networkStyles.errorText]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function OpportunityCard({
  applyMessage,
  applyState,
  matchReasons,
  matchScore,
  onApply,
  onOpen,
  onSave,
  opportunity,
  saveMessage,
  saveState,
}: {
  applyMessage?: string;
  applyState: ActionState;
  matchReasons?: string[];
  matchScore?: number;
  onApply: () => void;
  onOpen: () => void;
  onSave: () => void;
  opportunity: OpportunityRead;
  saveMessage?: string;
  saveState: ActionState;
}) {
  const { width } = useWindowDimensions();
  const isWideCard = width >= 760;

  return (
    <View
      style={[
        styles.card,
        styles.compactCard,
        networkStyles.networkCard,
        isWideCard && networkStyles.networkCardWide,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [networkStyles.cardOpenArea, pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <View style={networkStyles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {opportunity.title}
            </Text>
          </View>
          <View style={networkStyles.statusStack}>
            <StatusChip label={titleCase(opportunity.type)} tone={opportunityTone(opportunity.type)} />
            <StatusChip label={titleCase(opportunity.status)} tone={statusTone(opportunity.status)} />
          </View>
        </View>

        {matchScore !== undefined ? <MatchPreview reasons={matchReasons ?? []} score={matchScore} /> : null}

        <Text style={styles.cardMeta} numberOfLines={5}>
          {opportunity.description}
        </Text>
        <View style={networkStyles.metaRow}>
          <Users color={palette.faint} size={15} strokeWidth={2.4} />
          <Text style={networkStyles.metaText} numberOfLines={3}>
            {opportunityOwner(opportunity)}
          </Text>
        </View>
        <SkillList emptyLabel="No required skills listed." items={opportunity.required_skills} />
      </Pressable>

      <View style={networkStyles.actionRow}>
        <InlineAction
          disabled={applyState === "sent"}
          icon={Send}
          label={applyState === "sent" ? "Applied" : "Apply"}
          loading={applyState === "sending"}
          onPress={onApply}
          wide
        />
        <InlineAction
          icon={Save}
          label={saveState === "sent" ? "Unsave" : "Save"}
          loading={saveState === "sending"}
          onPress={onSave}
          secondary
          wide
        />
      </View>
      {applyMessage ? (
        <Text style={[networkStyles.actionMessage, applyState === "error" && networkStyles.errorText]}>
          {applyMessage}
        </Text>
      ) : null}
      {saveMessage ? (
        <Text style={[networkStyles.actionMessage, saveState === "error" && networkStyles.errorText]}>
          {saveMessage}
        </Text>
      ) : null}
    </View>
  );
}

function PanelHeader({
  eyebrow,
  icon: Icon,
  onClose,
  title,
}: {
  eyebrow?: string;
  icon: IconComponent;
  onClose: () => void;
  title: string;
}) {
  return (
    <View style={styles.cardTop}>
      <View style={networkStyles.panelTitleRow}>
        <View style={networkStyles.panelIcon}>
          <Icon color={palette.teal} size={18} strokeWidth={2.5} />
        </View>
        <View style={networkStyles.cardTitleBlock}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={networkStyles.panelTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [networkStyles.closeButton, pressed && styles.pressed]}
      >
        <X color={palette.text} size={18} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function ProfileDetailPanel({ onClose, profile }: { onClose: () => void; profile: ProfileRead }) {
  return (
    <View style={networkStyles.detailPanel}>
      <PanelHeader eyebrow={titleCase(profile.role)} icon={Users} onClose={onClose} title={profile.user.full_name} />
      <Text style={styles.cardMeta}>{profile.headline ?? "Portfolio headline not added yet"}</Text>
      <Text style={networkStyles.bodyText}>{profile.bio ?? "Portfolio bio not added yet."}</Text>

      <View style={networkStyles.profileMetaGrid}>
        <View style={networkStyles.profileMetaItem}>
          <GraduationCap color={palette.teal} size={18} strokeWidth={2.4} />
          <Text style={networkStyles.metaText} numberOfLines={2}>
            {[profile.university, profile.faculty].filter(Boolean).join(" - ") || "University affiliation not set"}
          </Text>
        </View>
        <View style={networkStyles.profileMetaItem}>
          <MapPin color={palette.teal} size={18} strokeWidth={2.4} />
          <Text style={networkStyles.metaText} numberOfLines={1}>
            {profile.location ?? "Location not set"}
          </Text>
        </View>
      </View>

      <SectionHeader action={profile.skills.length ? `${profile.skills.length} skills` : "Empty"} icon={CheckCircle2} title="Skills" />
      <SkillList emptyLabel="No portfolio skills listed yet." items={profileSkills(profile)} />

      <SectionHeader
        action={profile.resume_entries.length ? `${profile.resume_entries.length} entries` : "Empty"}
        icon={FileText}
        title="Portfolio / Resume"
      />
      {profile.resume_entries.length ? (
        <View style={networkStyles.panelList}>
          {profile.resume_entries.map((entry) => (
            <View key={entry.id} style={styles.listRow}>
              <View style={networkStyles.resumeIcon}>
                <FileText color={palette.blue} size={18} strokeWidth={2.4} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {[titleCase(entry.entry_type), entry.organization, resumeDateRange(entry)].filter(Boolean).join(" - ")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.smallText}>No portfolio or resume entries yet.</Text>
      )}
    </View>
  );
}

function OpportunityDetailPanel({
  applyMessage,
  applyState,
  detail,
  error,
  loading,
  onApply,
  onClose,
  onOpenOwner,
  onRetry,
  onSave,
  saveMessage,
  saveState,
}: {
  applyMessage?: string;
  applyState: ActionState;
  detail: OpportunityDetailRead | null;
  error: string | null;
  loading: boolean;
  onApply: (opportunity: OpportunityDetailRead) => void;
  onClose: () => void;
  onOpenOwner?: (profile: ProfileSummary) => void;
  onRetry: () => void;
  onSave: (opportunity: OpportunityDetailRead) => void;
  saveMessage?: string;
  saveState: ActionState;
}) {
  const applied = detail ? detail.has_applied || applyState === "sent" : false;
  const saved = detail ? detail.has_saved || saveState === "sent" : false;

  return (
    <View style={networkStyles.detailPanel}>
      <PanelHeader
        eyebrow={detail ? titleCase(detail.type) : "Opportunity"}
        icon={Briefcase}
        onClose={onClose}
        title={detail?.title ?? "Opportunity detail"}
      />

      {loading ? (
        <View style={networkStyles.inlineState}>
          <ActivityIndicator color={palette.teal} size="small" />
          <Text style={styles.smallText}>Loading opportunity</Text>
        </View>
      ) : null}

      {error ? (
        <View style={networkStyles.panelList}>
          <Text style={networkStyles.errorText}>{error}</Text>
          <InlineAction icon={RefreshCw} label="Retry" onPress={onRetry} secondary />
        </View>
      ) : null}

      {detail ? (
        <>
          <View style={networkStyles.statusRow}>
            <StatusChip label={titleCase(detail.type)} tone={opportunityTone(detail.type)} />
            <StatusChip label={titleCase(detail.status)} tone={statusTone(detail.status)} />
            <StatusChip label={applied ? "Applied" : "Not applied"} tone={applied ? "green" : "slate"} />
            <StatusChip label={saved ? "Saved" : "Not saved"} tone={saved ? "green" : "slate"} />
          </View>

          <Text style={networkStyles.bodyText}>{detail.description}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={!onOpenOwner}
            onPress={() => onOpenOwner?.(detail.owner_profile)}
            style={({ pressed }) => [networkStyles.ownerPanel, pressed && Boolean(onOpenOwner) && styles.pressed]}
          >
            <Users color={palette.teal} size={18} strokeWidth={2.4} />
            <View style={networkStyles.cardTitleBlock}>
              <Text style={styles.eyebrow}>Posted by</Text>
              <Text style={networkStyles.ownerName} numberOfLines={1}>
                {opportunityOwner(detail)}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={2}>
                {profileMeta(detail.owner_profile)}
              </Text>
            </View>
          </Pressable>

          <SectionHeader
            action={detail.required_skills.length ? `${detail.required_skills.length} skills` : "Empty"}
            icon={CheckCircle2}
            title="Required Skills"
          />
          <SkillList emptyLabel="No required skills listed." items={detail.required_skills} />

          <View style={networkStyles.actionRow}>
            <InlineAction
              disabled={applied}
              icon={Send}
              label={applied ? "Applied" : "Apply"}
              loading={applyState === "sending"}
              onPress={() => onApply(detail)}
              wide
            />
            <InlineAction
              icon={Save}
              label={saved ? "Unsave" : "Save"}
              loading={saveState === "sending"}
              onPress={() => onSave(detail)}
              secondary
              wide
            />
          </View>
          {applyMessage ? (
            <Text style={[networkStyles.actionMessage, applyState === "error" && networkStyles.errorText]}>
              {applyMessage}
            </Text>
          ) : null}
          {saveMessage ? (
            <Text style={[networkStyles.actionMessage, saveState === "error" && networkStyles.errorText]}>
              {saveMessage}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function OwnerApplicationsPanel({
  applications,
  error,
  loading,
  messageErrors,
  messages,
  onClose,
  onRetry,
  onUpdateStatus,
  opportunity,
  savingStatuses,
}: {
  applications: OwnerOpportunityApplicationRead[];
  error: string | null;
  loading: boolean;
  messageErrors: Record<number, boolean | undefined>;
  messages: Record<number, string | undefined>;
  onClose: () => void;
  onRetry: () => void;
  onUpdateStatus: (application: OwnerOpportunityApplicationRead, status: OwnerApplicationStatusUpdate) => void;
  opportunity: OpportunityRead;
  savingStatuses: Record<number, OwnerApplicationStatusUpdate | undefined>;
}) {
  return (
    <View style={networkStyles.detailPanel}>
      <PanelHeader eyebrow="My Post" icon={FileText} onClose={onClose} title={opportunity.title} />

      <View style={networkStyles.statusRow}>
        <StatusChip label={titleCase(opportunity.type)} tone={opportunityTone(opportunity.type)} />
        <StatusChip label={titleCase(opportunity.status)} tone={statusTone(opportunity.status)} />
        <StatusChip label={`${applications.length} applicants`} tone={applications.length ? "green" : "slate"} />
      </View>

      <Text style={styles.cardMeta} numberOfLines={3}>
        {opportunity.description}
      </Text>

      {loading ? (
        <View style={networkStyles.inlineState}>
          <ActivityIndicator color={palette.teal} size="small" />
          <Text style={styles.smallText}>Loading applicants</Text>
        </View>
      ) : null}

      {error ? (
        <View style={networkStyles.panelList}>
          <Text style={networkStyles.errorText}>{error}</Text>
          <InlineAction icon={RefreshCw} label="Retry" onPress={onRetry} secondary />
        </View>
      ) : null}

      {!loading && !error && applications.length === 0 ? (
        <EmptyState
          body="Applicants will appear here after students apply to this opportunity."
          icon={Inbox}
          title="No applicants yet"
        />
      ) : null}

      {applications.length ? (
        <View style={networkStyles.panelList}>
          {applications.map((application) => {
            const savingStatus = savingStatuses[application.id];
            const canReview = canOwnerReviewApplication(application.status);
            const message = messages[application.id];
            const hasError = messageErrors[application.id];

            return (
              <View key={application.id} style={[styles.card, networkStyles.applicationCard]}>
                <View style={styles.cardTop}>
                  <View style={networkStyles.cardTitleBlock}>
                    <Text style={styles.eyebrow}>{application.applicant_profile.role}</Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {application.applicant_profile.user.full_name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={2}>
                      {application.applicant_profile.headline ?? "Portfolio headline not added yet"}
                    </Text>
                  </View>
                  <StatusChip label={titleCase(application.status)} tone={statusTone(application.status)} />
                </View>

                <View style={networkStyles.metaRow}>
                  <Building2 color={palette.faint} size={15} strokeWidth={2.4} />
                  <Text style={networkStyles.metaText} numberOfLines={2}>
                    {profileMeta(application.applicant_profile)}
                  </Text>
                </View>
                <View style={networkStyles.metaRow}>
                  <CalendarDays color={palette.faint} size={15} strokeWidth={2.4} />
                  <Text style={networkStyles.metaText} numberOfLines={1}>
                    Applied {formatFullDate(application.created_at)}
                  </Text>
                </View>

                {application.note ? (
                  <Text style={networkStyles.bodyText} numberOfLines={3}>
                    {application.note}
                  </Text>
                ) : null}

                <SectionHeader
                  action={application.applicant_skills.length ? `${application.applicant_skills.length} skills` : "Empty"}
                  icon={CheckCircle2}
                  title="Applicant Skills"
                />
                <SkillList
                  emptyLabel="Applicant has not listed portfolio skills."
                  items={application.applicant_skills.map((item) => item.skill.name)}
                />

                <SectionHeader
                  action={application.applicant_resume_entries.length ? `${application.applicant_resume_entries.length} shown` : "Empty"}
                  icon={FileText}
                  title="Resume Highlights"
                />
                {application.applicant_resume_entries.length ? (
                  <View style={networkStyles.highlightList}>
                    {application.applicant_resume_entries.map((entry) => (
                      <View key={entry.id} style={networkStyles.highlightItem}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {entry.title}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={2}>
                          {[titleCase(entry.entry_type), entry.organization, resumeDateRange(entry)].filter(Boolean).join(" - ")}
                        </Text>
                        {entry.description ? (
                          <Text style={styles.rowMeta} numberOfLines={2}>
                            {entry.description}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.smallText}>No project or resume highlights listed.</Text>
                )}

                <View style={networkStyles.actionRow}>
                  {ownerApplicationStatuses.map((status) => (
                    <InlineAction
                      disabled={!canReview || Boolean(savingStatus) || application.status === status}
                      icon={reviewStatusIcon(status)}
                      key={status}
                      label={titleCase(status)}
                      loading={savingStatus === status}
                      onPress={() => onUpdateStatus(application, status)}
                      secondary={status !== "accepted"}
                    />
                  ))}
                </View>

                {message ? (
                  <Text style={[networkStyles.actionMessage, hasError && networkStyles.errorText]}>
                    {message}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function DiscoverScreen({ token }: { token: string | null }) {
  const [query, setQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ProfileRead | null>(null);
  const [connectState, setConnectState] = useState<Record<number, ActionState>>({});
  const [connectMessages, setConnectMessages] = useState<Record<number, string>>({});
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isCompact = width < 520;
  const loadDiscover = useCallback(async (): Promise<DiscoverData> => {
    if (!token) {
      throw new Error("Missing authentication token");
    }

    const [myProfile, profiles, recommendedProfiles] = await Promise.all([
      getMyProfile(token),
      listProfiles(token),
      getRecommendedProfiles(token),
    ]);
    return { myProfile, profiles, recommendedProfiles };
  }, [token]);
  const discoverState = usePortalData(Boolean(token), loadDiscover);
  const data = discoverState.data;
  const filteredProfiles = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return data.profiles;
    }

    return data.profiles.filter((profile) => {
      const haystack = [
        profile.user.full_name,
        profile.role,
        profile.headline,
        profile.university,
        profile.faculty,
        profile.location,
        ...profileSkills(profile),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [data, query]);

  async function connect(profile: ProfileRead) {
    if (!token) {
      return;
    }

    setConnectState((current) => ({ ...current, [profile.id]: "sending" }));
    setConnectMessages((current) => ({ ...current, [profile.id]: "" }));

    try {
      await requestConnection(token, profile.id);
      setConnectState((current) => ({ ...current, [profile.id]: "sent" }));
      setConnectMessages((current) => ({ ...current, [profile.id]: "Request sent." }));
    } catch (error) {
      if (isConflict(error)) {
        setConnectState((current) => ({ ...current, [profile.id]: "sent" }));
        setConnectMessages((current) => ({ ...current, [profile.id]: "Request already sent." }));
        return;
      }

      setConnectState((current) => ({ ...current, [profile.id]: "error" }));
      setConnectMessages((current) => ({ ...current, [profile.id]: toErrorMessage(error) }));
    }
  }

  if (discoverState.loading && !data) {
    return <LoadingState body="Fetching recommended profiles and the public CampusConnect directory." label="Loading profiles" />;
  }

  if (!data) {
    return (
      <ErrorState
        message={discoverState.error?.message ?? "CampusConnect profiles are not available."}
        onRetry={discoverState.retry}
        title="Could not load Discover"
      />
    );
  }

  return (
    <View style={[styles.stack, isCompact && networkStyles.mobileStack]}>
      {discoverState.error ? (
        <ErrorState
          message={discoverState.error.message}
          onRetry={discoverState.retry}
          title="Could not refresh profiles"
        />
      ) : null}

      <DiscoverDashboard data={data} isCompact={isCompact} isWide={isWide} />

      <SearchBox onChangeText={setQuery} value={query} />

      {selectedProfile ? (
        <ProfileDetailPanel onClose={() => setSelectedProfile(null)} profile={selectedProfile} />
      ) : null}

      <SectionHeader
        action={data.recommendedProfiles.length ? `${data.recommendedProfiles.length} shown` : "Empty"}
        icon={CheckCircle2}
        title="Recommended"
      />

      {data.recommendedProfiles.length ? (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {data.recommendedProfiles.map((profile) => {
            const actionState = connectState[profile.id] ?? "idle";
            const message = connectMessages[profile.id];
            const hasConnection = Boolean(profile.connection_status);
            const disabled = hasConnection || actionState === "sent" || actionState === "sending";
            const connectionLabel =
              actionState === "sent"
                ? "Requested"
                : profile.connection_status === "pending"
                  ? "Requested"
                  : profile.connection_status === "accepted"
                    ? "Connected"
                    : profile.connection_status
                      ? titleCase(profile.connection_status)
                      : "Connect";

            return (
              <ProfileCard
                actionDisabled={disabled}
                actionIcon={profile.connection_status === "accepted" ? CheckCircle2 : UserPlus}
                actionLabel={connectionLabel}
                actionLoading={actionState === "sending"}
                actionSecondary={Boolean(profile.connection_status) || actionState === "sent"}
                key={profile.id}
                matchReasons={profile.match_reasons}
                matchScore={profile.match_score}
                message={message}
                messageError={actionState === "error"}
                onAction={() => connect(profile)}
                onOpen={() => setSelectedProfile(profile)}
                profile={profile}
              />
            );
          })}
        </View>
      ) : (
        <EmptyState
          body="Recommended profiles will appear as public profiles match your skills and profile."
          icon={Users}
          title="No recommended profiles"
        />
      )}

      <SectionHeader
        action={filteredProfiles.length ? `${filteredProfiles.length} shown` : "Empty"}
        icon={Users}
        title="Discover"
      />

      {filteredProfiles.length ? (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {filteredProfiles.map((profile) => {
            const isSelf = profile.id === data.myProfile.id;
            const actionState = connectState[profile.id] ?? "idle";
            const message = connectMessages[profile.id];
            const disabled = isSelf || actionState === "sent" || actionState === "sending";

            return (
              <ProfileCard
                actionDisabled={disabled}
                actionIcon={isSelf || actionState === "sent" ? CheckCircle2 : UserPlus}
                actionLabel={isSelf ? "Your Profile" : actionState === "sent" ? "Requested" : "Connect"}
                actionLoading={actionState === "sending"}
                actionSecondary={isSelf || actionState === "sent"}
                key={profile.id}
                message={message}
                messageError={actionState === "error"}
                onAction={() => connect(profile)}
                onOpen={() => setSelectedProfile(profile)}
                profile={profile}
              />
            );
          })}
        </View>
      ) : (
        <EmptyState
          body={
            query.trim()
              ? "No students, mentors, professors, or collaborators match this search."
              : "Student, mentor, professor, employer, and collaborator profiles will appear here."
          }
          icon={Inbox}
          title={query.trim() ? "No matching profiles" : "No CampusConnect profiles"}
        />
      )}
    </View>
  );
}

function OpportunitiesScreen({ token }: { token: string | null }) {
  const [filter, setFilter] = useState<OpportunityFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<OpportunityType>("startup");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSkills, setCreateSkills] = useState("");
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<Record<number, ActionState>>({});
  const [saveState, setSaveState] = useState<Record<number, ActionState>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});
  const [ownedStatusUpdating, setOwnedStatusUpdating] = useState<Record<number, boolean>>({});
  const [ownedStatusErrors, setOwnedStatusErrors] = useState<Record<number, boolean>>({});
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<number | null>(null);
  const [opportunityDetail, setOpportunityDetail] = useState<OpportunityDetailRead | null>(null);
  const [opportunityDetailLoading, setOpportunityDetailLoading] = useState(false);
  const [opportunityDetailError, setOpportunityDetailError] = useState<string | null>(null);
  const [selectedOwnerProfileId, setSelectedOwnerProfileId] = useState<number | null>(null);
  const [selectedOwnerProfile, setSelectedOwnerProfile] = useState<ProfileRead | null>(null);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(false);
  const [ownerProfileError, setOwnerProfileError] = useState<string | null>(null);
  const [selectedOwnedOpportunityId, setSelectedOwnedOpportunityId] = useState<number | null>(null);
  const [selectedOwnedOpportunity, setSelectedOwnedOpportunity] = useState<OpportunityRead | null>(null);
  const [ownerApplications, setOwnerApplications] = useState<OwnerOpportunityApplicationRead[]>([]);
  const [ownerApplicationsLoading, setOwnerApplicationsLoading] = useState(false);
  const [ownerApplicationsError, setOwnerApplicationsError] = useState<string | null>(null);
  const [ownerApplicationSavingStatuses, setOwnerApplicationSavingStatuses] = useState<
    Record<number, OwnerApplicationStatusUpdate | undefined>
  >({});
  const [ownerApplicationMessages, setOwnerApplicationMessages] = useState<Record<number, string | undefined>>({});
  const [ownerApplicationMessageErrors, setOwnerApplicationMessageErrors] = useState<
    Record<number, boolean | undefined>
  >({});
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const loadOpportunities = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return listOpportunities(token);
  }, [token]);
  const loadRecommendedOpportunities = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getRecommendedOpportunities(token);
  }, [token]);
  const loadOwnedOpportunities = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyOwnedOpportunities(token);
  }, [token]);
  const loadMyProfile = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyProfile(token);
  }, [token]);
  const opportunitiesState = usePortalData(Boolean(token), loadOpportunities);
  const recommendedOpportunitiesState = usePortalData(Boolean(token), loadRecommendedOpportunities);
  const ownedOpportunitiesState = usePortalData(Boolean(token), loadOwnedOpportunities);
  const myProfileState = usePortalData(Boolean(token), loadMyProfile);
  const opportunities = opportunitiesState.data ?? [];
  const recommendedOpportunities = recommendedOpportunitiesState.data ?? [];
  const ownedOpportunities = ownedOpportunitiesState.data ?? [];
  const myProfile = myProfileState.data;
  const allowedCreateTypes = useMemo(() => allowedOpportunityTypes(myProfile?.role), [myProfile?.role]);
  const canCreateOpportunity = allowedCreateTypes.length > 0;
  const canReviewApplicants = myProfile?.role === "teacher";
  const shouldShowOwnedSection = ownedOpportunities.length > 0 || canCreateOpportunity;
  const filteredOpportunities = useMemo(
    () => (filter === "all" ? opportunities : opportunities.filter((item) => item.type === filter)),
    [filter, opportunities],
  );

  useEffect(() => {
    if (!allowedCreateTypes.length || allowedCreateTypes.includes(createType)) {
      return;
    }

    setCreateType(allowedCreateTypes[0]);
  }, [allowedCreateTypes, createType]);

  useEffect(() => {
    if (selectedOwnedOpportunityId === null || !ownedOpportunitiesState.data) {
      return;
    }

    const updatedOpportunity = ownedOpportunitiesState.data.find((item) => item.id === selectedOwnedOpportunityId);
    if (updatedOpportunity) {
      setSelectedOwnedOpportunity(updatedOpportunity);
    }
  }, [ownedOpportunitiesState.data, selectedOwnedOpportunityId]);

  async function openOpportunityDetail(opportunityId: number) {
    if (!token) {
      return;
    }

    setSelectedOpportunityId(opportunityId);
    setSelectedOwnedOpportunityId(null);
    setSelectedOwnedOpportunity(null);
    setOpportunityDetail(null);
    setOpportunityDetailError(null);
    setOpportunityDetailLoading(true);

    try {
      setOpportunityDetail(await getOpportunityDetail(token, opportunityId));
    } catch (error) {
      setOpportunityDetailError(toErrorMessage(error));
    } finally {
      setOpportunityDetailLoading(false);
    }
  }

  function closeOpportunityDetail() {
    setSelectedOpportunityId(null);
    setOpportunityDetail(null);
    setOpportunityDetailError(null);
    setOpportunityDetailLoading(false);
  }

  function retryOpportunityDetail() {
    if (selectedOpportunityId !== null) {
      void openOpportunityDetail(selectedOpportunityId);
    }
  }

  async function loadOwnerApplications(opportunityId: number, showLoading = true) {
    if (!token) {
      return;
    }

    if (showLoading) {
      setOwnerApplicationsLoading(true);
    }
    setOwnerApplicationsError(null);

    try {
      setOwnerApplications(await getOpportunityApplications(token, opportunityId));
    } catch (error) {
      setOwnerApplicationsError(toErrorMessage(error));
    } finally {
      if (showLoading) {
        setOwnerApplicationsLoading(false);
      }
    }
  }

  function openOwnedOpportunityApplications(opportunity: OpportunityRead) {
    setSelectedOwnedOpportunityId(opportunity.id);
    setSelectedOwnedOpportunity(opportunity);
    setSelectedOpportunityId(null);
    setOpportunityDetail(null);
    setOpportunityDetailError(null);
    setOpportunityDetailLoading(false);
    setSelectedOwnerProfileId(null);
    setSelectedOwnerProfile(null);
    setOwnerProfileError(null);
    setOwnerApplications([]);
    setOwnerApplicationMessages({});
    setOwnerApplicationMessageErrors({});
    void loadOwnerApplications(opportunity.id);
  }

  function closeOwnedOpportunityApplications() {
    setSelectedOwnedOpportunityId(null);
    setSelectedOwnedOpportunity(null);
    setOwnerApplications([]);
    setOwnerApplicationsError(null);
    setOwnerApplicationsLoading(false);
    setOwnerApplicationSavingStatuses({});
    setOwnerApplicationMessages({});
    setOwnerApplicationMessageErrors({});
  }

  function retryOwnerApplications() {
    if (selectedOwnedOpportunityId !== null) {
      void loadOwnerApplications(selectedOwnedOpportunityId);
    }
  }

  async function updateOwnerApplicationStatus(
    application: OwnerOpportunityApplicationRead,
    status: OwnerApplicationStatusUpdate,
  ) {
    if (!token || selectedOwnedOpportunityId === null) {
      return;
    }

    setOwnerApplicationSavingStatuses((current) => ({ ...current, [application.id]: status }));
    setOwnerApplicationMessages((current) => ({ ...current, [application.id]: "" }));
    setOwnerApplicationMessageErrors((current) => ({ ...current, [application.id]: false }));

    try {
      await updateApplicationStatus(token, application.id, status);
      setOwnerApplicationMessages((current) => ({ ...current, [application.id]: "Application status saved." }));
      setOwnerApplicationMessageErrors((current) => ({ ...current, [application.id]: false }));
      await loadOwnerApplications(selectedOwnedOpportunityId, false);
    } catch (error) {
      setOwnerApplicationMessages((current) => ({ ...current, [application.id]: toErrorMessage(error) }));
      setOwnerApplicationMessageErrors((current) => ({ ...current, [application.id]: true }));
    } finally {
      setOwnerApplicationSavingStatuses((current) => ({ ...current, [application.id]: undefined }));
    }
  }

  async function loadOwnerProfile(profileId: number) {
    if (!token) {
      return;
    }

    setSelectedOwnerProfileId(profileId);
    setSelectedOwnerProfile(null);
    setOwnerProfileError(null);
    setOwnerProfileLoading(true);

    try {
      setSelectedOwnerProfile(await getProfileDetail(token, profileId));
    } catch (error) {
      setOwnerProfileError(toErrorMessage(error));
    } finally {
      setOwnerProfileLoading(false);
    }
  }

  function openOwnerProfile(profile: ProfileSummary) {
    void loadOwnerProfile(profile.id);
  }

  function closeOwnerProfile() {
    setSelectedOwnerProfileId(null);
    setSelectedOwnerProfile(null);
    setOwnerProfileError(null);
    setOwnerProfileLoading(false);
  }

  function retryOwnerProfile() {
    if (selectedOwnerProfileId !== null) {
      void loadOwnerProfile(selectedOwnerProfileId);
    }
  }

  async function apply(opportunity: OpportunityRead) {
    if (!token) {
      return;
    }

    const key = `${opportunity.id}:apply`;
    setApplyState((current) => ({ ...current, [opportunity.id]: "sending" }));
    setActionMessages((current) => ({ ...current, [key]: "" }));

    try {
      await applyToOpportunity(token, opportunity.id);
      setApplyState((current) => ({ ...current, [opportunity.id]: "sent" }));
      setActionMessages((current) => ({ ...current, [key]: "Application submitted." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_applied: true } : current));
    } catch (error) {
      if (isConflict(error)) {
        setApplyState((current) => ({ ...current, [opportunity.id]: "sent" }));
        setActionMessages((current) => ({ ...current, [key]: "Application already exists." }));
        setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_applied: true } : current));
        return;
      }

      setApplyState((current) => ({ ...current, [opportunity.id]: "error" }));
      setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
    }
  }

  async function save(opportunity: OpportunityRead, currentlySaved: boolean) {
    if (!token) {
      return;
    }

    const key = `${opportunity.id}:save`;
    setSaveState((current) => ({ ...current, [opportunity.id]: "sending" }));
    setActionMessages((current) => ({ ...current, [key]: "" }));

    if (currentlySaved) {
      try {
        await unsaveOpportunity(token, opportunity.id);
      } catch (error) {
        if (!isNotFound(error)) {
          setSaveState((current) => ({ ...current, [opportunity.id]: "error" }));
          setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
          return;
        }
      }

      setSaveState((current) => ({ ...current, [opportunity.id]: "idle" }));
      setActionMessages((current) => ({ ...current, [key]: "Removed from saved." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: false } : current));
      return;
    }

    try {
      await saveOpportunity(token, opportunity.id);
      setSaveState((current) => ({ ...current, [opportunity.id]: "sent" }));
      setActionMessages((current) => ({ ...current, [key]: "Opportunity saved." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: true } : current));
    } catch (error) {
      if (isConflict(error)) {
        setSaveState((current) => ({ ...current, [opportunity.id]: "sent" }));
        setActionMessages((current) => ({ ...current, [key]: "Opportunity already saved." }));
        setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: true } : current));
        return;
      }

      setSaveState((current) => ({ ...current, [opportunity.id]: "error" }));
      setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
    }
  }

  async function toggleOpportunityStatus(opportunity: OpportunityRead) {
    if (!token) {
      return;
    }

    const nextStatus = opportunity.status === "open" ? "closed" : "open";
    const key = `${opportunity.id}:status`;
    setOwnedStatusUpdating((current) => ({ ...current, [opportunity.id]: true }));
    setOwnedStatusErrors((current) => ({ ...current, [opportunity.id]: false }));
    setActionMessages((current) => ({ ...current, [key]: "" }));

    try {
      await updateOpportunity(token, opportunity.id, { status: nextStatus });
      setActionMessages((current) => ({
        ...current,
        [key]: nextStatus === "closed" ? "Post closed to new applicants." : "Post reopened.",
      }));
      ownedOpportunitiesState.retry();
      opportunitiesState.retry();
      recommendedOpportunitiesState.retry();
    } catch (error) {
      setOwnedStatusErrors((current) => ({ ...current, [opportunity.id]: true }));
      setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
    } finally {
      setOwnedStatusUpdating((current) => ({ ...current, [opportunity.id]: false }));
    }
  }

  async function submitCreate() {
    if (!token || createState === "saving") {
      return;
    }

    if (!allowedCreateTypes.includes(createType)) {
      setCreateState("error");
      setCreateMessage(opportunityAuthoringCopy(myProfile?.role));
      return;
    }

    const title = createTitle.trim();
    const description = createDescription.trim();

    if (!title || !description) {
      setCreateState("error");
      setCreateMessage("Add a title and description for the opportunity.");
      return;
    }

    setCreateState("saving");
    setCreateMessage(null);

    try {
      await createOpportunity(token, {
        type: createType,
        title,
        description,
        required_skills: createSkills
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "open",
      });
      setCreateState("saved");
      setCreateMessage("Opportunity posted.");
      setCreateTitle("");
      setCreateDescription("");
      setCreateSkills("");
      setCreateOpen(false);
      opportunitiesState.retry();
      ownedOpportunitiesState.retry();
    } catch (error) {
      setCreateState("error");
      setCreateMessage(toErrorMessage(error));
    }
  }

  if (opportunitiesState.loading && !opportunitiesState.data) {
    return (
      <LoadingState
        body="Fetching recommendations, open opportunities, and any posts you own."
        label="Loading posts and opportunities"
      />
    );
  }

  if (!opportunitiesState.data) {
    return (
      <ErrorState
        message={opportunitiesState.error?.message ?? "CampusConnect opportunities are not available."}
        onRetry={opportunitiesState.retry}
        title="Could not load opportunities"
      />
    );
  }

  return (
    <View style={styles.stack}>
      {opportunitiesState.error ? (
        <ErrorState
          message={opportunitiesState.error.message}
          onRetry={opportunitiesState.retry}
          title="Could not refresh opportunities"
        />
      ) : null}

      <View style={[networkStyles.toolbar, isWide && networkStyles.toolbarWide]}>
        <View style={networkStyles.filterRow}>
          {opportunityFilters.map((item) => (
            <FilterChip
              active={filter === item}
              key={item}
              label={item === "all" ? "All" : titleCase(item)}
              onPress={setFilter}
              value={item}
            />
          ))}
        </View>
        <InlineAction
          disabled={!canCreateOpportunity}
          icon={Plus}
          label={createOpen ? "Close" : "Post"}
          onPress={() => {
            if (!canCreateOpportunity) {
              return;
            }
            setCreateOpen((current) => !current);
            setCreateMessage(null);
            setCreateState("idle");
          }}
          secondary={createOpen}
        />
      </View>

      <Text style={networkStyles.permissionText}>
        {myProfileState.loading && !myProfile ? "Checking posting permissions." : opportunityAuthoringCopy(myProfile?.role)}
      </Text>

      {createOpen && canCreateOpportunity ? (
        <View style={networkStyles.formPanel}>
          <SectionHeader action="Network post" icon={Pencil} title="Post Opportunity" />
          <FormField label="Opportunity type">
            <View style={networkStyles.filterRow}>
              {allowedCreateTypes.map((item) => (
                <FilterChip
                  active={createType === item}
                  key={item}
                  label={titleCase(item)}
                  onPress={setCreateType}
                  value={item}
                />
              ))}
            </View>
          </FormField>
          <LabeledInput
            label="Title"
            onChangeText={setCreateTitle}
            placeholder="Opportunity title"
            value={createTitle}
          />
          <LabeledInput
            label="Description"
            multiline
            onChangeText={setCreateDescription}
            placeholder="Describe the role, project, research goal, or team need"
            style={networkStyles.textArea}
            textAlignVertical="top"
            value={createDescription}
          />
          <LabeledInput
            autoCapitalize="words"
            label="Useful skills"
            onChangeText={setCreateSkills}
            placeholder="Comma separated"
            value={createSkills}
          />
          {createMessage ? (
            <Text style={[networkStyles.actionMessage, createState === "error" && networkStyles.errorText]}>
              {createMessage}
            </Text>
          ) : null}
          <InlineAction
            icon={Send}
            label={createState === "saving" ? "Posting" : "Post Opportunity"}
            loading={createState === "saving"}
            onPress={submitCreate}
          />
        </View>
      ) : null}

      {shouldShowOwnedSection ? (
        <>
          {ownedOpportunitiesState.error ? (
            <ErrorState
              message={ownedOpportunitiesState.error.message}
              onRetry={ownedOpportunitiesState.retry}
              title="Could not refresh My Posts"
            />
          ) : null}

          <SectionHeader
            action={ownedOpportunities.length ? `${ownedOpportunities.length} owned` : "Empty"}
            icon={FileText}
            title="My Posts"
          />

          {ownedOpportunitiesState.loading && !ownedOpportunitiesState.data ? (
            <View style={networkStyles.inlineLoadingPanel}>
              <ActivityIndicator color={palette.teal} size="small" />
              <Text style={styles.smallText}>Loading My Posts</Text>
            </View>
          ) : null}

          {ownedOpportunities.length ? (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {ownedOpportunities.map((opportunity) => {
                const OwnedActionIcon = canReviewApplicants ? FileText : Eye;
                const openOwnedPost = () => {
                  if (canReviewApplicants) {
                    openOwnedOpportunityApplications(opportunity);
                    return;
                  }

                  void openOpportunityDetail(opportunity.id);
                };

                return (
                  <View
                    key={opportunity.id}
                    style={[
                      styles.card,
                      styles.compactCard,
                      networkStyles.networkCard,
                      isWide && networkStyles.networkCardWide,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={openOwnedPost}
                      style={({ pressed }) => [networkStyles.cardOpenArea, pressed && styles.pressed]}
                    >
                      <View style={styles.cardTop}>
                        <View style={networkStyles.cardTitleBlock}>
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {opportunity.title}
                          </Text>
                        </View>
                        <View style={networkStyles.statusStack}>
                          <StatusChip label={titleCase(opportunity.type)} tone={opportunityTone(opportunity.type)} />
                          <StatusChip label={titleCase(opportunity.status)} tone={statusTone(opportunity.status)} />
                        </View>
                      </View>

                      <Text style={styles.cardMeta} numberOfLines={4}>
                        {opportunity.description}
                      </Text>
                      <View style={networkStyles.metaRow}>
                        <CalendarDays color={palette.faint} size={15} strokeWidth={2.4} />
                        <Text style={networkStyles.metaText} numberOfLines={1}>
                          Posted {formatFullDate(opportunity.created_at)}
                        </Text>
                      </View>
                      <SkillList emptyLabel="No required skills listed." items={opportunity.required_skills} />
                    </Pressable>
                    <View style={networkStyles.actionRow}>
                      <InlineAction
                        icon={OwnedActionIcon}
                        label={canReviewApplicants ? "Review Applicants" : "View Post"}
                        onPress={openOwnedPost}
                        wide
                      />
                      {opportunity.status === "open" || opportunity.status === "closed" ? (
                        <InlineAction
                          icon={opportunity.status === "open" ? X : RefreshCw}
                          label={opportunity.status === "open" ? "Close Post" : "Reopen Post"}
                          loading={Boolean(ownedStatusUpdating[opportunity.id])}
                          onPress={() => void toggleOpportunityStatus(opportunity)}
                          secondary
                          wide
                        />
                      ) : null}
                    </View>
                    {actionMessages[`${opportunity.id}:status`] ? (
                      <Text
                        style={[
                          networkStyles.actionMessage,
                          ownedStatusErrors[opportunity.id] && networkStyles.errorText,
                        ]}
                      >
                        {actionMessages[`${opportunity.id}:status`]}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : !ownedOpportunitiesState.loading ? (
            <EmptyState
              body="Opportunities you create will appear here for applicant review."
              icon={FileText}
              title="No posts yet"
            />
          ) : null}
        </>
      ) : null}

      {selectedOwnedOpportunity ? (
        <OwnerApplicationsPanel
          applications={ownerApplications}
          error={ownerApplicationsError}
          loading={ownerApplicationsLoading}
          messageErrors={ownerApplicationMessageErrors}
          messages={ownerApplicationMessages}
          onClose={closeOwnedOpportunityApplications}
          onRetry={retryOwnerApplications}
          onUpdateStatus={updateOwnerApplicationStatus}
          opportunity={selectedOwnedOpportunity}
          savingStatuses={ownerApplicationSavingStatuses}
        />
      ) : null}

      {selectedOpportunityId !== null ? (
        <OpportunityDetailPanel
          applyMessage={opportunityDetail ? actionMessages[`${opportunityDetail.id}:apply`] : undefined}
          applyState={
            opportunityDetail
              ? applyState[opportunityDetail.id] ?? (opportunityDetail.has_applied ? "sent" : "idle")
              : "idle"
          }
          detail={opportunityDetail}
          error={opportunityDetailError}
          loading={opportunityDetailLoading}
          onApply={apply}
          onClose={closeOpportunityDetail}
          onOpenOwner={openOwnerProfile}
          onRetry={retryOpportunityDetail}
          onSave={(opportunity) =>
            void save(opportunity, (saveState[opportunity.id] ?? (opportunity.has_saved ? "sent" : "idle")) === "sent")
          }
          saveMessage={opportunityDetail ? actionMessages[`${opportunityDetail.id}:save`] : undefined}
          saveState={
            opportunityDetail
              ? saveState[opportunityDetail.id] ?? (opportunityDetail.has_saved ? "sent" : "idle")
              : "idle"
          }
        />
      ) : null}

      {selectedOwnerProfile ? (
        <ProfileDetailPanel onClose={closeOwnerProfile} profile={selectedOwnerProfile} />
      ) : ownerProfileLoading || ownerProfileError ? (
        <View style={networkStyles.detailPanel}>
          <PanelHeader icon={Users} onClose={closeOwnerProfile} title="Profile detail" />
          {ownerProfileLoading ? (
            <View style={networkStyles.inlineLoadingPanel}>
              <ActivityIndicator color={palette.teal} size="small" />
              <Text style={styles.smallText}>Loading profile</Text>
            </View>
          ) : null}
          {ownerProfileError ? (
            <View style={networkStyles.panelList}>
              <Text style={networkStyles.errorText}>{ownerProfileError}</Text>
              <InlineAction icon={RefreshCw} label="Retry" onPress={retryOwnerProfile} secondary />
            </View>
          ) : null}
        </View>
      ) : null}

      {recommendedOpportunitiesState.error ? (
        <ErrorState
          message={recommendedOpportunitiesState.error.message}
          onRetry={recommendedOpportunitiesState.retry}
          title="Could not refresh recommendations"
        />
      ) : null}

      <SectionHeader
        action={recommendedOpportunities.length ? `${recommendedOpportunities.length} shown` : "Empty"}
        icon={CheckCircle2}
        title="Recommended for you"
      />

      {recommendedOpportunitiesState.loading && !recommendedOpportunitiesState.data ? (
        <View style={networkStyles.inlineLoadingPanel}>
          <ActivityIndicator color={palette.teal} size="small" />
          <Text style={styles.smallText}>Loading recommendations</Text>
        </View>
      ) : null}

      {recommendedOpportunities.length ? (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {recommendedOpportunities.map((opportunity) => {
            const currentApplyState = applyState[opportunity.id] ?? (opportunity.has_applied ? "sent" : "idle");
            const currentSaveState = saveState[opportunity.id] ?? (opportunity.has_saved ? "sent" : "idle");
            const applyMessage = actionMessages[`${opportunity.id}:apply`];
            const saveMessage = actionMessages[`${opportunity.id}:save`];

            return (
              <OpportunityCard
                applyMessage={applyMessage}
                applyState={currentApplyState}
                key={opportunity.id}
                matchReasons={opportunity.match_reasons}
                matchScore={opportunity.match_score}
                onApply={() => apply(opportunity)}
                onOpen={() => void openOpportunityDetail(opportunity.id)}
                onSave={() => save(opportunity, currentSaveState === "sent")}
                opportunity={opportunity}
                saveMessage={saveMessage}
                saveState={currentSaveState}
              />
            );
          })}
        </View>
      ) : !recommendedOpportunitiesState.loading ? (
        <EmptyState
          body="Recommended opportunities will appear as open posts match your skills and profile."
          icon={Briefcase}
          title="No recommended opportunities"
        />
      ) : null}

      <SectionHeader
        action={filteredOpportunities.length ? `${filteredOpportunities.length} shown` : "Empty"}
        icon={Briefcase}
        title="Opportunities"
      />

      {filteredOpportunities.length ? (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {filteredOpportunities.map((opportunity) => {
            const currentApplyState = applyState[opportunity.id] ?? "idle";
            const currentSaveState = saveState[opportunity.id] ?? "idle";
            const applyMessage = actionMessages[`${opportunity.id}:apply`];
            const saveMessage = actionMessages[`${opportunity.id}:save`];

            return (
              <OpportunityCard
                applyMessage={applyMessage}
                applyState={currentApplyState}
                key={opportunity.id}
                onApply={() => apply(opportunity)}
                onOpen={() => void openOpportunityDetail(opportunity.id)}
                onSave={() => save(opportunity, currentSaveState === "sent")}
                opportunity={opportunity}
                saveMessage={saveMessage}
                saveState={currentSaveState}
              />
            );
          })}
        </View>
      ) : (
        <EmptyState
          body={
            filter === "all"
              ? "Startup cofounder, research, internship, job, project teammate, and hackathon team posts will appear here."
              : `No ${filter} opportunities are open right now.`
          }
          icon={Briefcase}
          title="No open opportunities"
        />
      )}
    </View>
  );
}

function ApplicationsScreen({ token }: { token: string | null }) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<number | null>(null);
  const [opportunityDetail, setOpportunityDetail] = useState<OpportunityDetailRead | null>(null);
  const [opportunityDetailLoading, setOpportunityDetailLoading] = useState(false);
  const [opportunityDetailError, setOpportunityDetailError] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<Record<number, ActionState>>({});
  const [saveState, setSaveState] = useState<Record<number, ActionState>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});
  const [withdrawState, setWithdrawState] = useState<Record<number, ActionState>>({});
  const [withdrawMessages, setWithdrawMessages] = useState<Record<number, string>>({});
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const loadApplications = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyApplications(token);
  }, [token]);
  const applicationsState = usePortalData(Boolean(token), loadApplications);
  const applications = applicationsState.data ?? [];

  async function openOpportunityDetail(opportunityId: number) {
    if (!token) {
      return;
    }

    setSelectedOpportunityId(opportunityId);
    setOpportunityDetail(null);
    setOpportunityDetailError(null);
    setOpportunityDetailLoading(true);

    try {
      setOpportunityDetail(await getOpportunityDetail(token, opportunityId));
    } catch (error) {
      setOpportunityDetailError(toErrorMessage(error));
    } finally {
      setOpportunityDetailLoading(false);
    }
  }

  function closeOpportunityDetail() {
    setSelectedOpportunityId(null);
    setOpportunityDetail(null);
    setOpportunityDetailError(null);
    setOpportunityDetailLoading(false);
  }

  function retryOpportunityDetail() {
    if (selectedOpportunityId !== null) {
      void openOpportunityDetail(selectedOpportunityId);
    }
  }

  async function apply(opportunity: OpportunityRead) {
    if (!token) {
      return;
    }

    const key = `${opportunity.id}:apply`;
    setApplyState((current) => ({ ...current, [opportunity.id]: "sending" }));
    setActionMessages((current) => ({ ...current, [key]: "" }));

    try {
      await applyToOpportunity(token, opportunity.id);
      setApplyState((current) => ({ ...current, [opportunity.id]: "sent" }));
      setActionMessages((current) => ({ ...current, [key]: "Application submitted." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_applied: true } : current));
      applicationsState.retry();
    } catch (error) {
      if (isConflict(error)) {
        setApplyState((current) => ({ ...current, [opportunity.id]: "sent" }));
        setActionMessages((current) => ({ ...current, [key]: "Application already exists." }));
        setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_applied: true } : current));
        applicationsState.retry();
        return;
      }

      setApplyState((current) => ({ ...current, [opportunity.id]: "error" }));
      setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
    }
  }

  async function save(opportunity: OpportunityRead, currentlySaved: boolean) {
    if (!token) {
      return;
    }

    const key = `${opportunity.id}:save`;
    setSaveState((current) => ({ ...current, [opportunity.id]: "sending" }));
    setActionMessages((current) => ({ ...current, [key]: "" }));

    if (currentlySaved) {
      try {
        await unsaveOpportunity(token, opportunity.id);
      } catch (error) {
        if (!isNotFound(error)) {
          setSaveState((current) => ({ ...current, [opportunity.id]: "error" }));
          setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
          return;
        }
      }

      setSaveState((current) => ({ ...current, [opportunity.id]: "idle" }));
      setActionMessages((current) => ({ ...current, [key]: "Removed from saved." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: false } : current));
      return;
    }

    try {
      await saveOpportunity(token, opportunity.id);
      setSaveState((current) => ({ ...current, [opportunity.id]: "sent" }));
      setActionMessages((current) => ({ ...current, [key]: "Opportunity saved." }));
      setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: true } : current));
    } catch (error) {
      if (isConflict(error)) {
        setSaveState((current) => ({ ...current, [opportunity.id]: "sent" }));
        setActionMessages((current) => ({ ...current, [key]: "Opportunity already saved." }));
        setOpportunityDetail((current) => (current?.id === opportunity.id ? { ...current, has_saved: true } : current));
        return;
      }

      setSaveState((current) => ({ ...current, [opportunity.id]: "error" }));
      setActionMessages((current) => ({ ...current, [key]: toErrorMessage(error) }));
    }
  }

  async function withdraw(application: MyOpportunityApplicationRead) {
    if (!token) {
      return;
    }

    setWithdrawState((current) => ({ ...current, [application.id]: "sending" }));
    setWithdrawMessages((current) => ({ ...current, [application.id]: "" }));

    try {
      await withdrawApplication(token, application.id);
      setWithdrawState((current) => ({ ...current, [application.id]: "sent" }));
      applicationsState.retry();
    } catch (error) {
      setWithdrawState((current) => ({ ...current, [application.id]: "error" }));
      setWithdrawMessages((current) => ({ ...current, [application.id]: toErrorMessage(error) }));
    }
  }

  if (applicationsState.loading && !applicationsState.data) {
    return <LoadingState label="Loading applications" />;
  }

  if (!applicationsState.data) {
    return (
      <ErrorState
        message={applicationsState.error?.message ?? "Your CampusConnect applications are not available."}
        onRetry={applicationsState.retry}
        title="Could not load applications"
      />
    );
  }

  return (
    <View style={styles.stack}>
      {applicationsState.error ? (
        <ErrorState
          message={applicationsState.error.message}
          onRetry={applicationsState.retry}
          title="Could not refresh applications"
        />
      ) : null}

      {selectedOpportunityId !== null ? (
        <OpportunityDetailPanel
          applyMessage={opportunityDetail ? actionMessages[`${opportunityDetail.id}:apply`] : undefined}
          applyState={
            opportunityDetail
              ? applyState[opportunityDetail.id] ?? (opportunityDetail.has_applied ? "sent" : "idle")
              : "idle"
          }
          detail={opportunityDetail}
          error={opportunityDetailError}
          loading={opportunityDetailLoading}
          onApply={apply}
          onClose={closeOpportunityDetail}
          onRetry={retryOpportunityDetail}
          onSave={(opportunity) =>
            void save(opportunity, (saveState[opportunity.id] ?? (opportunity.has_saved ? "sent" : "idle")) === "sent")
          }
          saveMessage={opportunityDetail ? actionMessages[`${opportunityDetail.id}:save`] : undefined}
          saveState={
            opportunityDetail
              ? saveState[opportunityDetail.id] ?? (opportunityDetail.has_saved ? "sent" : "idle")
              : "idle"
          }
        />
      ) : null}

      <SectionHeader
        action={applications.length ? `${applications.length} tracked` : "Empty"}
        icon={FileText}
        title="Applications"
      />

      {applications.length ? (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {applications.map((application) => (
            <Pressable
              accessibilityRole="button"
              key={application.id}
              onPress={() => void openOpportunityDetail(application.opportunity.id)}
              style={({ pressed }) => [
                styles.card,
                styles.compactCard,
                networkStyles.networkCard,
                isWide && networkStyles.networkCardWide,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={networkStyles.cardTitleBlock}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {application.opportunity.title}
                  </Text>
                </View>
                <View style={networkStyles.statusStack}>
                  <StatusChip label={titleCase(application.opportunity.type)} tone={opportunityTone(application.opportunity.type)} />
                  <StatusChip label={titleCase(application.status)} tone={statusTone(application.status)} />
                </View>
              </View>

              <View style={networkStyles.metaRow}>
                <Users color={palette.faint} size={15} strokeWidth={2.4} />
                <Text style={networkStyles.metaText} numberOfLines={1}>
                  {opportunityOwner(application.opportunity)}
                </Text>
              </View>
              <View style={networkStyles.metaRow}>
                <CalendarDays color={palette.faint} size={15} strokeWidth={2.4} />
                <Text style={networkStyles.metaText} numberOfLines={1}>
                  Applied {formatFullDate(application.created_at)}
                </Text>
              </View>
              {application.status === "submitted" || application.status === "reviewing" ? (
                <InlineAction
                  icon={Trash2}
                  label="Withdraw"
                  loading={withdrawState[application.id] === "sending"}
                  onPress={() => void withdraw(application)}
                  secondary
                  wide
                />
              ) : null}
              {withdrawMessages[application.id] ? (
                <Text
                  style={[
                    networkStyles.actionMessage,
                    withdrawState[application.id] === "error" && networkStyles.errorText,
                  ]}
                >
                  {withdrawMessages[application.id]}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          body="Research, startup, internship, job, and project applications will appear here after you apply."
          icon={FileText}
          title="No submitted applications"
        />
      )}
    </View>
  );
}

function ProfileScreen({ token }: { token: string | null }) {
  const [profile, setProfile] = useState<ProfileRead | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saveState, setSaveState] = useState<PortfolioSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(emptySkillDraft());
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [skillState, setSkillState] = useState<PortfolioSaveState>("idle");
  const [skillMessage, setSkillMessage] = useState<string | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<number | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft>(emptyResumeDraft());
  const [editingResumeEntryId, setEditingResumeEntryId] = useState<number | null>(null);
  const [resumeFormOpen, setResumeFormOpen] = useState(false);
  const [resumeState, setResumeState] = useState<PortfolioSaveState>("idle");
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [deletingResumeEntryId, setDeletingResumeEntryId] = useState<number | null>(null);
  const loadProfile = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyProfile(token);
  }, [token]);
  const profileState = usePortalData(Boolean(token), loadProfile);

  useEffect(() => {
    if (!profileState.data) {
      return;
    }

    setProfile(profileState.data);
    setDraft(profileToDraft(profileState.data));
    setSaveState("idle");
    setSaveMessage(null);
    setSkillDraft(emptySkillDraft());
    setEditingSkillId(null);
    setSkillState("idle");
    setSkillMessage(null);
    setDeletingSkillId(null);
    setResumeDraft(emptyResumeDraft());
    setEditingResumeEntryId(null);
    setResumeFormOpen(false);
    setResumeState("idle");
    setResumeMessage(null);
    setDeletingResumeEntryId(null);
  }, [profileState.data]);

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setSaveState("idle");
    setSaveMessage(null);
  }

  async function refreshPortfolioProfile(): Promise<ProfileRead> {
    if (!token) {
      throw new Error("Missing authentication token");
    }

    const updatedProfile = await getMyProfile(token);
    setProfile(updatedProfile);
    return updatedProfile;
  }

  function updateSkillDraft(field: keyof SkillDraft, value: string) {
    setSkillDraft((current) => ({ ...current, [field]: value }));
    setSkillState("idle");
    setSkillMessage(null);
  }

  function beginSkillEdit(userSkill: UserSkillRead) {
    setEditingSkillId(userSkill.id);
    setSkillDraft(skillToDraft(userSkill));
    setSkillState("idle");
    setSkillMessage(null);
  }

  function cancelSkillEdit() {
    setEditingSkillId(null);
    setSkillDraft(emptySkillDraft());
    setSkillState("idle");
    setSkillMessage(null);
  }

  async function saveSkill() {
    if (!token || skillState === "saving") {
      return;
    }

    const name = skillDraft.name.trim();
    const wasEditing = editingSkillId !== null;
    if (!wasEditing && !name) {
      setSkillState("error");
      setSkillMessage("Add a skill name.");
      return;
    }

    setSkillState("saving");
    setSkillMessage(null);

    try {
      if (wasEditing && editingSkillId !== null) {
        await updateMySkill(token, editingSkillId, { level: skillDraft.level });
      } else {
        await addMySkill(token, { name, level: skillDraft.level });
      }

      await refreshPortfolioProfile();
      setEditingSkillId(null);
      setSkillDraft(emptySkillDraft());
      setSkillState("saved");
      setSkillMessage(wasEditing ? "Skill level saved." : "Skill added.");
    } catch (error) {
      setSkillState("error");
      setSkillMessage(toErrorMessage(error));
    }
  }

  async function removeSkill(userSkill: UserSkillRead) {
    if (!token || deletingSkillId !== null) {
      return;
    }

    setDeletingSkillId(userSkill.id);
    setSkillState("idle");
    setSkillMessage(null);

    try {
      await deleteMySkill(token, userSkill.id);
      await refreshPortfolioProfile();
      if (editingSkillId === userSkill.id) {
        setEditingSkillId(null);
        setSkillDraft(emptySkillDraft());
      }
      setSkillState("saved");
      setSkillMessage("Skill deleted.");
    } catch (error) {
      setSkillState("error");
      setSkillMessage(toErrorMessage(error));
    } finally {
      setDeletingSkillId(null);
    }
  }

  function updateResumeDraft(field: keyof ResumeDraft, value: string | boolean) {
    setResumeDraft((current) => ({ ...current, [field]: value }));
    setResumeState("idle");
    setResumeMessage(null);
  }

  function openAddResumeForm() {
    setEditingResumeEntryId(null);
    setResumeDraft(emptyResumeDraft());
    setResumeFormOpen(true);
    setResumeState("idle");
    setResumeMessage(null);
  }

  function beginResumeEdit(entry: ResumeEntryRead) {
    setEditingResumeEntryId(entry.id);
    setResumeDraft(resumeToDraft(entry));
    setResumeFormOpen(true);
    setResumeState("idle");
    setResumeMessage(null);
  }

  function cancelResumeEdit() {
    setEditingResumeEntryId(null);
    setResumeDraft(emptyResumeDraft());
    setResumeFormOpen(false);
    setResumeState("idle");
    setResumeMessage(null);
  }

  async function saveResumeEntry() {
    if (!token || resumeState === "saving") {
      return;
    }

    let payload: ReturnType<typeof resumeDraftToPayload>;
    try {
      payload = resumeDraftToPayload(resumeDraft);
    } catch (error) {
      setResumeState("error");
      setResumeMessage(toErrorMessage(error));
      return;
    }

    const wasEditing = editingResumeEntryId !== null;
    setResumeState("saving");
    setResumeMessage(null);

    try {
      if (wasEditing && editingResumeEntryId !== null) {
        await updateResumeEntry(token, editingResumeEntryId, payload);
      } else {
        await addResumeEntry(token, payload);
      }

      await refreshPortfolioProfile();
      setEditingResumeEntryId(null);
      setResumeDraft(emptyResumeDraft());
      setResumeFormOpen(false);
      setResumeState("saved");
      setResumeMessage(wasEditing ? "Resume entry saved." : "Resume entry added.");
    } catch (error) {
      setResumeState("error");
      setResumeMessage(toErrorMessage(error));
    }
  }

  async function removeResumeEntry(entry: ResumeEntryRead) {
    if (!token || deletingResumeEntryId !== null) {
      return;
    }

    setDeletingResumeEntryId(entry.id);
    setResumeState("idle");
    setResumeMessage(null);

    try {
      await deleteResumeEntry(token, entry.id);
      await refreshPortfolioProfile();
      if (editingResumeEntryId === entry.id) {
        setEditingResumeEntryId(null);
        setResumeDraft(emptyResumeDraft());
        setResumeFormOpen(false);
      }
      setResumeState("saved");
      setResumeMessage("Resume entry deleted.");
    } catch (error) {
      setResumeState("error");
      setResumeMessage(toErrorMessage(error));
    } finally {
      setDeletingResumeEntryId(null);
    }
  }

  async function saveProfile() {
    if (!token || !draft || saveState === "saving") {
      return;
    }

    let graduationYear: number | null = null;
    const graduationYearText = draft.graduation_year.trim();
    if (graduationYearText) {
      const parsed = Number(graduationYearText);
      if (!Number.isInteger(parsed)) {
        setSaveState("error");
        setSaveMessage("Graduation year must be a whole number.");
        return;
      }
      graduationYear = parsed;
    }

    setSaveState("saving");
    setSaveMessage(null);

    try {
      const updatedProfile = await updateMyProfile(token, {
        headline: emptyToNull(draft.headline),
        bio: emptyToNull(draft.bio),
        university: emptyToNull(draft.university),
        faculty: emptyToNull(draft.faculty),
        graduation_year: graduationYear,
        location: emptyToNull(draft.location),
        visibility: draft.visibility,
      });
      setProfile(updatedProfile);
      setDraft(profileToDraft(updatedProfile));
      setSaveState("saved");
      setSaveMessage("Portfolio profile saved.");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(toErrorMessage(error));
    }
  }

  if (profileState.loading && !profile) {
    return <LoadingState label="Loading profile" />;
  }

  if (!profile || !draft) {
    return (
      <ErrorState
        message={profileState.error?.message ?? "Your CampusConnect portfolio is not available."}
        onRetry={profileState.retry}
        title="Could not load portfolio"
      />
    );
  }

  return (
    <View style={styles.stack}>
      {profileState.error ? (
        <ErrorState
          message={profileState.error.message}
          onRetry={profileState.retry}
          title="Could not refresh portfolio"
        />
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={networkStyles.cardTitleBlock}>
            <Text style={styles.eyebrow}>{profile.role}</Text>
            <Text style={networkStyles.profileName} numberOfLines={2}>
              {profile.user.full_name}
            </Text>
            <Text style={styles.cardMeta}>{profile.headline ?? "Add a portfolio headline for collaborators and mentors."}</Text>
          </View>
          <StatusChip label={titleCase(profile.visibility)} tone={statusTone(profile.visibility)} />
        </View>

        <Text style={networkStyles.bodyText}>{profile.bio ?? "Add a short portfolio bio with research interests, projects, and goals."}</Text>

        <View style={networkStyles.profileMetaGrid}>
          <View style={networkStyles.profileMetaItem}>
            <GraduationCap color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>
              {[profile.university, profile.faculty].filter(Boolean).join(" - ") || "University affiliation not set"}
            </Text>
          </View>
          <View style={networkStyles.profileMetaItem}>
            <MapPin color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>{profile.location ?? "Location not set"}</Text>
          </View>
          <View style={networkStyles.profileMetaItem}>
            <Eye color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>{titleCase(profile.visibility)}</Text>
          </View>
        </View>
      </View>

      <SectionHeader action={profile.skills.length ? `${profile.skills.length} skills` : "Empty"} icon={CheckCircle2} title="Portfolio Skills" />
      <View style={networkStyles.formPanel}>
        <SectionHeader action={editingSkillId === null ? "New skill" : "Editing"} icon={Pencil} title="Skill Editor" />
        {editingSkillId === null ? (
          <LabeledInput
            autoCapitalize="words"
            label="Skill name"
            onChangeText={(value) => updateSkillDraft("name", value)}
            placeholder="Example: Data analysis"
            value={skillDraft.name}
          />
        ) : (
          <View style={networkStyles.lockedField}>
            <Text style={styles.eyebrow}>Skill</Text>
            <Text style={networkStyles.lockedFieldText} numberOfLines={1}>
              {skillDraft.name}
            </Text>
          </View>
        )}
        <FormField label="Skill level">
          <View style={networkStyles.filterRow}>
            {skillLevels.map((item) => (
              <FilterChip
                active={skillDraft.level === item}
                key={item}
                label={titleCase(item)}
                onPress={(value) => updateSkillDraft("level", value)}
                value={item}
              />
            ))}
          </View>
        </FormField>
        {skillMessage ? (
          <Text style={[networkStyles.actionMessage, skillState === "error" && networkStyles.errorText]}>
            {skillMessage}
          </Text>
        ) : null}
        <View style={networkStyles.actionRow}>
          <InlineAction
            icon={Save}
            label={skillState === "saving" ? "Saving" : editingSkillId === null ? "Add Skill" : "Save Skill"}
            loading={skillState === "saving"}
            onPress={saveSkill}
          />
          {editingSkillId !== null ? (
            <InlineAction icon={X} label="Cancel" onPress={cancelSkillEdit} secondary />
          ) : null}
        </View>
      </View>
      {profile.skills.length ? (
        <View style={networkStyles.panelList}>
          {profile.skills.map((userSkill) => (
            <View key={userSkill.id} style={[styles.listRow, networkStyles.portfolioListRow]}>
              <View style={networkStyles.skillIcon}>
                <CheckCircle2 color={palette.green} size={18} strokeWidth={2.4} />
              </View>
              <View style={[styles.rowBody, networkStyles.portfolioRowBody]}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {userSkill.skill.name}
                </Text>
                <Text style={styles.rowMeta}>{titleCase(userSkill.level)}</Text>
              </View>
              <View style={networkStyles.rowActions}>
                <InlineAction icon={Pencil} label="Edit" onPress={() => beginSkillEdit(userSkill)} secondary />
                <InlineAction
                  icon={Trash2}
                  label="Delete"
                  loading={deletingSkillId === userSkill.id}
                  onPress={() => void removeSkill(userSkill)}
                  secondary
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState body="Skills will appear here after they are added." icon={CheckCircle2} title="No portfolio skills" />
      )}

      <SectionHeader
        action={profile.resume_entries.length ? `${profile.resume_entries.length} entries` : "Empty"}
        icon={FileText}
        title="Portfolio / Resume"
      />
      <View style={networkStyles.sectionActionsRow}>
        <InlineAction
          icon={Plus}
          label={resumeFormOpen ? "New Entry" : "Add Entry"}
          onPress={openAddResumeForm}
          secondary={resumeFormOpen}
        />
      </View>
      {resumeMessage ? (
        <Text style={[networkStyles.actionMessage, resumeState === "error" && networkStyles.errorText]}>
          {resumeMessage}
        </Text>
      ) : null}
      {resumeFormOpen ? (
        <View style={networkStyles.formPanel}>
          <SectionHeader action={editingResumeEntryId === null ? "New entry" : "Editing"} icon={Pencil} title="Resume Editor" />
          <FormField label="Entry type">
            <View style={networkStyles.filterRow}>
              {resumeEntryTypes.map((item) => (
                <FilterChip
                  active={resumeDraft.entry_type === item}
                  key={item}
                  label={titleCase(item)}
                  onPress={(value) => updateResumeDraft("entry_type", value)}
                  value={item}
                />
              ))}
            </View>
          </FormField>
          <LabeledInput
            label="Title"
            onChangeText={(value) => updateResumeDraft("title", value)}
            placeholder="Title"
            value={resumeDraft.title}
          />
          <LabeledInput
            label="Organization"
            onChangeText={(value) => updateResumeDraft("organization", value)}
            placeholder="Organization"
            value={resumeDraft.organization}
          />
          <LabeledInput
            label="Description"
            multiline
            onChangeText={(value) => updateResumeDraft("description", value)}
            placeholder="Description"
            style={networkStyles.textArea}
            textAlignVertical="top"
            value={resumeDraft.description}
          />
          <View style={networkStyles.twoColumn}>
            <LabeledInput
              containerStyle={networkStyles.flexField}
              label="Start date"
              onChangeText={(value) => updateResumeDraft("start_date", value)}
              placeholder="YYYY-MM-DD"
              value={resumeDraft.start_date}
            />
            <LabeledInput
              containerStyle={networkStyles.flexField}
              editable={!resumeDraft.is_current}
              label="End date"
              onChangeText={(value) => updateResumeDraft("end_date", value)}
              placeholder="YYYY-MM-DD"
              style={resumeDraft.is_current && networkStyles.disabledInput}
              value={resumeDraft.end_date}
            />
          </View>
          <FormField label="Timeline status">
            <View style={networkStyles.filterRow}>
              {(["completed", "current"] as const).map((item) => (
                <FilterChip
                  active={item === "current" ? resumeDraft.is_current : !resumeDraft.is_current}
                  key={item}
                  label={item === "current" ? "Current" : "Completed"}
                  onPress={(value) => updateResumeDraft("is_current", value === "current")}
                  value={item}
                />
              ))}
            </View>
          </FormField>
          <LabeledInput
            autoCapitalize="none"
            label="Link"
            onChangeText={(value) => updateResumeDraft("url", value)}
            placeholder="URL"
            value={resumeDraft.url}
          />
          <View style={networkStyles.actionRow}>
            <InlineAction
              icon={Save}
              label={resumeState === "saving" ? "Saving" : editingResumeEntryId === null ? "Add Entry" : "Save Entry"}
              loading={resumeState === "saving"}
              onPress={saveResumeEntry}
            />
            <InlineAction icon={X} label="Cancel" onPress={cancelResumeEdit} secondary />
          </View>
        </View>
      ) : null}
      {profile.resume_entries.length ? (
        <View style={networkStyles.panelList}>
          {profile.resume_entries.map((entry) => (
            <View key={entry.id} style={[styles.listRow, networkStyles.portfolioListRow]}>
              <View style={networkStyles.resumeIcon}>
                <FileText color={palette.blue} size={18} strokeWidth={2.4} />
              </View>
              <View style={[styles.rowBody, networkStyles.portfolioRowBody]}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {[titleCase(entry.entry_type), entry.organization, resumeDateRange(entry)].filter(Boolean).join(" - ")}
                </Text>
                {entry.description ? (
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {entry.description}
                  </Text>
                ) : null}
              </View>
              <View style={networkStyles.rowActions}>
                <InlineAction icon={Pencil} label="Edit" onPress={() => beginResumeEdit(entry)} secondary />
                <InlineAction
                  icon={Trash2}
                  label="Delete"
                  loading={deletingResumeEntryId === entry.id}
                  onPress={() => void removeResumeEntry(entry)}
                  secondary
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          body="Projects, research, work, awards, education, and certifications will appear here after they are added."
          icon={FileText}
          title="No portfolio entries"
        />
      )}

      <View style={networkStyles.formPanel}>
        <SectionHeader action="Basic fields" icon={Pencil} title="Edit Portfolio" />
        <LabeledInput
          label="Headline"
          onChangeText={(value) => updateDraft("headline", value)}
          placeholder="Portfolio headline"
          value={draft.headline}
        />
        <LabeledInput
          label="Bio"
          multiline
          onChangeText={(value) => updateDraft("bio", value)}
          placeholder="Portfolio bio, research interests, and goals"
          style={networkStyles.textArea}
          textAlignVertical="top"
          value={draft.bio}
        />
        <LabeledInput
          label="University"
          onChangeText={(value) => updateDraft("university", value)}
          placeholder="University"
          value={draft.university}
        />
        <LabeledInput
          label="Faculty"
          onChangeText={(value) => updateDraft("faculty", value)}
          placeholder="Faculty"
          value={draft.faculty}
        />
        <View style={networkStyles.twoColumn}>
          <LabeledInput
            containerStyle={networkStyles.flexField}
            keyboardType="number-pad"
            label="Graduation year"
            onChangeText={(value) => updateDraft("graduation_year", value)}
            placeholder="Graduation year"
            value={draft.graduation_year}
          />
          <LabeledInput
            containerStyle={networkStyles.flexField}
            label="Location"
            onChangeText={(value) => updateDraft("location", value)}
            placeholder="Location"
            value={draft.location}
          />
        </View>
        <FormField label="Visibility">
          <View style={networkStyles.filterRow}>
            {visibilityOptions.map((item) => (
              <FilterChip
                active={draft.visibility === item}
                key={item}
                label={titleCase(item)}
                onPress={(value) => updateDraft("visibility", value)}
                value={item}
              />
            ))}
          </View>
        </FormField>
        {saveMessage ? (
          <Text style={[networkStyles.actionMessage, saveState === "error" && networkStyles.errorText]}>
            {saveMessage}
          </Text>
        ) : null}
        <InlineAction
          icon={Save}
          label={saveState === "saving" ? "Saving" : "Save Portfolio"}
          loading={saveState === "saving"}
          onPress={saveProfile}
        />
      </View>
    </View>
  );
}

function ConnectionsScreen({ token }: { token: string | null }) {
  const [decisionPending, setDecisionPending] = useState<Record<number, ConnectionRequestDecision | undefined>>({});
  const [decisionMessages, setDecisionMessages] = useState<Record<number, string>>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<number, boolean>>({});
  const loadConnections = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyConnections(token);
  }, [token]);
  const connectionsState = usePortalData(Boolean(token), loadConnections);
  const connections = connectionsState.data;
  const sent = connections?.sent ?? [];
  const received = connections?.received ?? [];
  const hasConnections = sent.length > 0 || received.length > 0;

  async function decide(connection: ConnectionRequestRead, decision: ConnectionRequestDecision) {
    if (!token) {
      return;
    }

    setDecisionPending((current) => ({ ...current, [connection.id]: decision }));
    setDecisionMessages((current) => ({ ...current, [connection.id]: "" }));
    setDecisionErrors((current) => ({ ...current, [connection.id]: false }));

    try {
      await updateConnectionStatus(token, connection.id, decision);
      setDecisionMessages((current) => ({
        ...current,
        [connection.id]:
          decision === "accepted"
            ? "Connection accepted."
            : decision === "declined"
              ? "Request declined."
              : "Request canceled.",
      }));
      connectionsState.retry();
    } catch (error) {
      setDecisionErrors((current) => ({ ...current, [connection.id]: true }));
      setDecisionMessages((current) => ({ ...current, [connection.id]: toErrorMessage(error) }));
    } finally {
      setDecisionPending((current) => ({ ...current, [connection.id]: undefined }));
    }
  }

  if (connectionsState.loading && !connections) {
    return <LoadingState label="Loading connections" />;
  }

  if (!connections) {
    return (
      <ErrorState
        message={connectionsState.error?.message ?? "Your academic network is not available."}
        onRetry={connectionsState.retry}
        title="Could not load network"
      />
    );
  }

  return (
    <View style={styles.stack}>
      {connectionsState.error ? (
        <ErrorState
          message={connectionsState.error.message}
          onRetry={connectionsState.retry}
          title="Could not refresh network"
        />
      ) : null}

      {hasConnections ? (
        <>
          <SectionHeader action={sent.length ? `${sent.length} sent` : "Empty"} icon={Send} title="Sent Connections" />
          {sent.length ? (
            <View style={networkStyles.panelList}>
              {sent.map((connection) => (
                <View key={connection.id} style={styles.listRow}>
                  <View style={networkStyles.resumeIcon}>
                    <UserPlus color={palette.blue} size={18} strokeWidth={2.4} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {connection.receiver_profile.user.full_name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {[profileMeta(connection.receiver_profile), formatFullDate(connection.created_at)].join(" - ")}
                    </Text>
                    {connection.status === "pending" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={X}
                          label="Cancel Request"
                          loading={decisionPending[connection.id] === "canceled"}
                          onPress={() => void decide(connection, "canceled")}
                          secondary
                        />
                      </View>
                    ) : null}
                    {decisionMessages[connection.id] ? (
                      <Text
                        style={[
                          networkStyles.actionMessage,
                          decisionErrors[connection.id] && networkStyles.errorText,
                        ]}
                      >
                        {decisionMessages[connection.id]}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip label={titleCase(connection.status)} tone={statusTone(connection.status)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState body="Use Discover to connect with mentors, professors, collaborators, and employers." icon={Send} title="No sent connections" />
          )}

          <SectionHeader action={received.length ? `${received.length} received` : "Empty"} icon={Inbox} title="Received Connections" />
          {received.length ? (
            <View style={networkStyles.panelList}>
              {received.map((connection) => (
                <View key={connection.id} style={styles.listRow}>
                  <View style={networkStyles.resumeIcon}>
                    <Users color={palette.blue} size={18} strokeWidth={2.4} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {connection.requester_profile.user.full_name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {[profileMeta(connection.requester_profile), formatFullDate(connection.created_at)].join(" - ")}
                    </Text>
                    {connection.status === "pending" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={CheckCircle2}
                          label="Accept"
                          loading={decisionPending[connection.id] === "accepted"}
                          onPress={() => void decide(connection, "accepted")}
                        />
                        <InlineAction
                          icon={X}
                          label="Decline"
                          loading={decisionPending[connection.id] === "declined"}
                          onPress={() => void decide(connection, "declined")}
                          secondary
                        />
                      </View>
                    ) : null}
                    {decisionMessages[connection.id] ? (
                      <Text
                        style={[
                          networkStyles.actionMessage,
                          decisionErrors[connection.id] && networkStyles.errorText,
                        ]}
                      >
                        {decisionMessages[connection.id]}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip label={titleCase(connection.status)} tone={statusTone(connection.status)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState body="Incoming academic and professional requests will appear here." icon={Inbox} title="No received connections" />
          )}
        </>
      ) : (
        <EmptyState
          body="Use Discover to start building your academic and professional network."
          icon={Users}
          title="No connections yet"
        />
      )}
    </View>
  );
}

export function CampusConnectScreen({ activeTab, token }: CampusConnectScreenProps) {
  if (activeTab === "opportunities") {
    return <OpportunitiesScreen token={token} />;
  }

  if (activeTab === "applications") {
    return <ApplicationsScreen token={token} />;
  }

  if (activeTab === "profile") {
    return <ProfileScreen token={token} />;
  }

  if (activeTab === "connections") {
    return <ConnectionsScreen token={token} />;
  }

  return <DiscoverScreen token={token} />;
}

const networkStyles = StyleSheet.create({
  actionMessage: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  applicationCard: {
    minWidth: 0,
  },
  bodyText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardOpenArea: {
    gap: 10,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#FAF4EA",
    borderColor: "#D8CDC0",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
    ...paperShadow("sunken"),
  },
  discoverBody: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    maxWidth: 520,
  },
  discoverBodyCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  discoverDashboard: {
    backgroundColor: palette.paper,
    borderBottomColor: "#CFC1AF",
    borderBottomWidth: 3,
    borderColor: "#D9CCBA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
    padding: 16,
    ...paperTexture("sheet"),
    ...paperShadow("sheet"),
  },
  discoverDashboardCompact: {
    gap: 10,
    padding: 12,
  },
  discoverDashboardWide: {
    alignItems: "stretch",
    flexDirection: "row",
    padding: 20,
  },
  discoverDashboardMain: {
    flex: 1.25,
    gap: 12,
    minWidth: 0,
  },
  discoverDashboardMainCompact: {
    gap: 8,
  },
  discoverEyebrow: {
    color: palette.teal,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  discoverEyebrowIcon: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderBottomColor: "#075B55",
    borderBottomWidth: 3,
    borderColor: "#0A8A7A",
    borderWidth: 1,
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
    ...paperShadow("cutout"),
  },
  discoverEyebrowIconCompact: {
    height: 30,
    width: 30,
  },
  discoverEyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  discoverEyebrowRowCompact: {
    gap: 8,
  },
  discoverSnapshot: {
    backgroundColor: palette.bond,
    borderBottomColor: "#D6C9B8",
    borderBottomWidth: 3,
    borderColor: "#DCD0C0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minWidth: 280,
    padding: 12,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  discoverStat: {
    backgroundColor: palette.bond,
    borderBottomColor: "#D7C9B8",
    borderBottomWidth: 2,
    borderColor: "#DED2C1",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 112,
    paddingHorizontal: 11,
    paddingVertical: 10,
    ...paperTexture("sheet"),
  },
  discoverStatCompact: {
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  discoverStatLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    marginTop: 2,
    minWidth: 0,
  },
  discoverStatLabelCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  discoverStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 2,
  },
  discoverStatsRowCompact: {
    flexWrap: "nowrap",
    gap: 7,
    marginTop: 0,
  },
  discoverStatValue: {
    color: palette.charcoal,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
    minWidth: 0,
  },
  discoverStatValueCompact: {
    fontSize: 18,
    lineHeight: 21,
  },
  discoverTitle: {
    color: palette.charcoal,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    maxWidth: 560,
  },
  discoverTitleCompact: {
    fontSize: 22,
    lineHeight: 27,
  },
  detailPanel: {
    backgroundColor: palette.surface,
    borderBottomColor: "#D2C5B7",
    borderBottomWidth: 3,
    borderColor: "#D9CDC0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    ...paperTexture("sheet"),
    ...paperShadow("sheet"),
  },
  disabled: {
    opacity: 0.58,
  },
  disabledInput: {
    opacity: 0.55,
  },
  entityHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  entityIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  errorText: {
    color: palette.red,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#FBF6EE",
    borderColor: "#DCD1C3",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 11,
    ...paperShadow("sunken"),
  },
  filterChipActive: {
    backgroundColor: "#E8DECF",
    borderColor: "#C8B8A5",
    ...paperShadow("pressed"),
  },
  filterChipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  filterChipTextActive: {
    color: palette.charcoal,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  flexField: {
    flex: 1,
    minWidth: 150,
  },
  formInput: {
    backgroundColor: palette.bond,
    borderColor: "#D8CDC0",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 11,
    ...paperShadow("sunken"),
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  formPanel: {
    backgroundColor: palette.surface,
    borderBottomColor: "#D2C5B7",
    borderBottomWidth: 3,
    borderColor: "#D9CDC0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    ...paperTexture("sheet"),
    ...paperShadow("sheet"),
  },
  inlineAction: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderBottomColor: "#075B55",
    borderBottomWidth: 3,
    borderColor: "#0A8A7A",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    ...paperShadow("cutout"),
  },
  inlineActionBalanced: {
    alignSelf: "flex-start",
    minWidth: 104,
  },
  inlineActionSecondary: {
    backgroundColor: palette.bond,
    borderBottomColor: "#D6CABB",
    borderBottomWidth: 2,
    borderColor: "#D8CDC0",
    ...paperShadow("strip"),
  },
  inlineActionDisabled: {
    borderBottomWidth: 1,
    transform: [{ translateY: 1 }],
  },
  inlineActionDisabledPrimary: {
    backgroundColor: "#DFD7CB",
    borderColor: "#C8BAAA",
    ...paperShadow("sunken"),
  },
  inlineActionDisabledSecondary: {
    backgroundColor: "#EEE7DC",
    borderColor: "#D0C4B5",
    ...paperShadow("sunken"),
  },
  inlineActionWide: {
    alignSelf: "stretch",
    flexGrow: 1,
    minHeight: 44,
    minWidth: 132,
  },
  inlineActionText: {
    color: palette.surface,
    fontSize: 12,
    fontWeight: "900",
    ...webSafeTextShadow({
      color: "rgba(2, 6, 23, 0.2)",
      offset: { height: 1, width: 0 },
      radius: 0,
    }),
  },
  inlineActionTextSecondary: {
    color: palette.text,
    ...webSafeTextShadow({
      color: "rgba(255, 255, 255, 0.5)",
      offset: { height: 1, width: 0 },
      radius: 0,
    }),
  },
  inlineActionTextDisabled: {
    color: "#746D62",
    ...webSafeTextShadow({
      color: "rgba(255, 255, 255, 0.72)",
      offset: { height: 1, width: 0 },
      radius: 0,
    }),
  },
  inlineState: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  inlineLoadingPanel: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderBottomColor: "#D7CBBE",
    borderBottomWidth: 2,
    borderColor: "#DCD1C3",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  highlightItem: {
    gap: 2,
  },
  highlightList: {
    gap: 8,
  },
  lockedField: {
    backgroundColor: "#F0E8DC",
    borderColor: "#D2C6B7",
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...paperShadow("sunken"),
  },
  lockedFieldText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  matchHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  matchPanel: {
    backgroundColor: "#F4EFE6",
    borderColor: "#D9CDC0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 8,
    ...paperShadow("sunken"),
  },
  matchReason: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  matchReasons: {
    gap: 3,
  },
  matchSubcopy: {
    color: palette.text,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  matchSlip: {
    alignItems: "center",
    backgroundColor: palette.buff,
    borderColor: palette.buffBorder,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 29,
    minWidth: 74,
    paddingHorizontal: 9,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  matchSlipText: {
    color: palette.amber,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
  },
  mobileStack: {
    gap: 12,
  },
  introPanel: {
    backgroundColor: "#E7F2EE",
    borderColor: "#B9DCD4",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...paperTexture("sheet"),
  },
  introText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  metaRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  metaText: {
    color: palette.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  permissionText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  ownerName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  ownerPanel: {
    alignItems: "center",
    backgroundColor: "#F7F1E7",
    borderColor: "#D9CDC0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    padding: 10,
    ...paperShadow("sunken"),
  },
  panelIcon: {
    alignItems: "center",
    backgroundColor: "#E7F2EE",
    borderColor: "#B9DCD4",
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
    ...paperShadow("strip"),
  },
  panelList: {
    gap: 8,
  },
  panelTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
  },
  panelTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  profileMetaGrid: {
    gap: 8,
  },
  profileMetaItem: {
    alignItems: "center",
    backgroundColor: "#F7F1E7",
    borderColor: "#DCD1C3",
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 10,
    ...paperShadow("sunken"),
  },
  profileName: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 2,
  },
  profileEntityIcon: {
    backgroundColor: "#EAF2FF",
    borderColor: "#D2DDF1",
    borderWidth: 1,
    ...paperShadow("strip"),
  },
  portfolioListRow: {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  portfolioRowBody: {
    minWidth: 170,
  },
  resumeIcon: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderColor: "#D2DDF1",
    borderWidth: 1,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...paperShadow("strip"),
  },
  networkCard: {
    backgroundColor: palette.bond,
    borderBottomColor: "#D0C4B5",
    borderBottomWidth: 3,
    borderColor: "#D8CDC0",
    gap: 12,
    minWidth: 0,
    ...paperTexture("sheet"),
    ...paperShadow("sheet"),
  },
  networkCardWide: {
    flexBasis: 300,
    flexGrow: 0,
    maxWidth: 326,
    minWidth: 286,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  searchRowCompact: {
    minHeight: 46,
    paddingHorizontal: 12,
  },
  sectionActionsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillIcon: {
    alignItems: "center",
    backgroundColor: "#E9F2E7",
    borderColor: "#C7DDC2",
    borderWidth: 1,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...paperShadow("strip"),
  },
  skillPill: {
    alignItems: "center",
    backgroundColor: "#F4EBDC",
    borderColor: "#D8CAB7",
    borderRadius: 3,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 26,
    justifyContent: "center",
    paddingRight: 8,
    ...paperTexture("sheet"),
    ...paperShadow("strip"),
  },
  skillPillEdge: {
    alignSelf: "stretch",
    backgroundColor: "#D7C8B5",
    borderRightColor: "rgba(255, 255, 255, 0.54)",
    borderRightWidth: 1,
    width: 4,
  },
  skillPillText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: "900",
  },
  snapshotAction: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  snapshotAvatar: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderColor: "#D2DDF1",
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
    ...paperShadow("strip"),
  },
  snapshotAvatarMentor: {
    backgroundColor: "#F0E8FF",
    borderColor: "#D8C6FF",
  },
  snapshotEmpty: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  snapshotHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  snapshotList: {
    gap: 8,
  },
  snapshotMeta: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  snapshotName: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  snapshotRow: {
    alignItems: "center",
    backgroundColor: "#FBF6EE",
    borderBottomColor: "#D8CAB8",
    borderBottomWidth: 2,
    borderColor: "#E0D4C5",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 58,
    padding: 9,
    ...paperTexture("sheet"),
  },
  snapshotTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  statusStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  toolbar: {
    alignItems: "flex-start",
    gap: 10,
  },
  toolbarWide: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
