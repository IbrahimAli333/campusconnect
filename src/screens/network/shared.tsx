import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Ban,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Flag,
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

import { EmptyState, ErrorState, LoadingState } from "../../components/common/PortalState";
import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusChip } from "../../components/common/StatusChip";
import type { IconComponent } from "../../components/common/types";
import { NetworkApiError, blockProfile, reportContent } from "../../lib/api/network";
import { useScrollIntoViewOnMount } from "../../lib/scroll-anchor";
import { palette, styles } from "../../styles/theme";
import type {
  ContentReportTargetType,
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
} from "../../types/network";

import { networkStyles } from "./styles";

export type ActionState = "idle" | "sending" | "sent" | "error";
export type OpportunityFilter = OpportunityType | "all";
export type PortfolioSaveState = "idle" | "saving" | "saved" | "error";

export interface CampusConnectScreenProps {
  activeTab: NetworkTab;
  token: string | null;
}

export interface DiscoverData {
  myProfile: ProfileRead;
  profiles: ProfileRead[];
  recommendedProfiles: ProfileRecommendationRead[];
}

export interface ProfileDraft {
  headline: string;
  bio: string;
  university: string;
  faculty: string;
  graduation_year: string;
  location: string;
  visibility: ProfileVisibility;
}

export interface SkillDraft {
  name: string;
  level: SkillLevel;
}

export interface ResumeDraft {
  entry_type: ResumeEntryType;
  title: string;
  organization: string;
  description: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  url: string;
}

export const opportunityTypes: OpportunityType[] = ["startup", "research", "internship", "job", "project"];
export const opportunityFilters: OpportunityFilter[] = ["all", ...opportunityTypes];
export const opportunityAuthorTypesByRole: Record<NetworkRole, OpportunityType[]> = {
  member: [],
  student: ["startup", "project"],
  teacher: ["research"],
  mentor: ["startup", "project", "research"],
  employer: ["internship", "job", "project"],
  admin: ["startup", "research", "internship", "job", "project"],
};
export const ownerApplicationStatuses: OwnerApplicationStatusUpdate[] = ["reviewing", "accepted", "rejected"];
export const visibilityOptions: ProfileVisibility[] = ["public", "university_only", "private"];
export const skillLevels: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];
export const resumeEntryTypes: ResumeEntryType[] = ["education", "work", "project", "research", "award", "certification"];

export function allowedOpportunityTypes(role: NetworkRole | undefined): OpportunityType[] {
  if (!role) {
    return [];
  }

  return opportunityAuthorTypesByRole[role] ?? [];
}

export function opportunityAuthoringCopy(role: NetworkRole | undefined): string {
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

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
}

export function isConflict(error: unknown): boolean {
  return error instanceof NetworkApiError && error.status === 409;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof NetworkApiError && error.status === 404;
}

export function profileSkills(profile: ProfileRead): string[] {
  return profile.skills.map((item) => item.skill.name);
}

export function opportunityOwner(opportunity: { owner_profile: ProfileSummary }): string {
  return opportunity.owner_profile.user.full_name;
}

export function profileMeta(profile: ProfileSummary): string {
  const parts = [profile.university, profile.faculty, profile.location].filter(Boolean);
  return parts.length ? parts.join(" - ") : "CampusConnect member";
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "Present";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatFullDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function resumeDateRange(entry: ResumeEntryRead): string {
  const start = formatDate(entry.start_date);
  const end = entry.is_current ? "Present" : formatDate(entry.end_date);
  return `${start} - ${end}`;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function profileToDraft(profile: ProfileRead): ProfileDraft {
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

export function emptySkillDraft(): SkillDraft {
  return {
    name: "",
    level: "intermediate",
  };
}

export function skillToDraft(userSkill: UserSkillRead): SkillDraft {
  return {
    name: userSkill.skill.name,
    level: userSkill.level,
  };
}

export function emptyResumeDraft(): ResumeDraft {
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

export function resumeToDraft(entry: ResumeEntryRead): ResumeDraft {
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

export function normalizeDateInput(value: string, label: string): string | null {
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

export function resumeDraftToPayload(draft: ResumeDraft) {
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

export function roleTone(role: string) {
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

export function opportunityTone(type: OpportunityType) {
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

export function statusTone(status: string) {
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

export function canOwnerReviewApplication(status: string): boolean {
  return status === "submitted" || status === "reviewing";
}

export function reviewStatusIcon(status: OwnerApplicationStatusUpdate): IconComponent {
  if (status === "accepted") {
    return CheckCircle2;
  }

  if (status === "rejected") {
    return X;
  }

  return Eye;
}

export function InlineAction({
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
  const color = locked ? "#6B7686" : secondary ? palette.text : palette.surface;
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

export function SkillPill({ label }: { label: string }) {
  return (
    <View style={networkStyles.skillPill}>
      <View style={networkStyles.skillPillEdge} />
      <Text style={networkStyles.skillPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SkillList({ emptyLabel, items }: { emptyLabel: string; items: string[] }) {
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

export function FilterChip<T extends string>({
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

export function SearchBox({ onChangeText, value }: { onChangeText: (value: string) => void; value: string }) {
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

export function DiscoverDashboard({ data, isCompact, isWide }: { data: DiscoverData; isCompact: boolean; isWide: boolean }) {
  const featuredProfiles = data.recommendedProfiles.slice(0, 3);

  // Phones skip the dashboard entirely: the tab bar already names the screen,
  // and the search box plus recommendations carry the content.
  if (isCompact) {
    return null;
  }

  return (
    <View
      style={[
        networkStyles.discoverDashboard,
        isCompact && networkStyles.discoverDashboardCompact,
        isWide && networkStyles.discoverDashboardWide,
      ]}
    >
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

export function FormField({
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

export function LabeledInput({
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

export function ScreenIntro({ children }: { children: string }) {
  return (
    <View style={networkStyles.introPanel}>
      <Text style={networkStyles.introText}>{children}</Text>
    </View>
  );
}

export function MatchSlip({ score }: { score: number }) {
  return (
    <View style={networkStyles.matchSlip}>
      <Text style={networkStyles.matchSlipText} numberOfLines={1}>
        {score}% Match
      </Text>
    </View>
  );
}

export function MatchPreview({ reasons, score }: { reasons: string[]; score: number }) {
  const reasonLine = (reasons.length ? reasons.slice(0, 2) : ["Based on profile fit"]).join(" · ");

  return (
    <View style={networkStyles.matchPanel}>
      <View style={networkStyles.matchHeader}>
        <MatchSlip score={score} />
        <Text style={networkStyles.matchSubcopy} numberOfLines={2}>
          {reasonLine}
        </Text>
      </View>
    </View>
  );
}

export function ProfileCard({
  actionDisabled,
  actionIcon,
  actionLabel,
  actionLoading,
  actionSecondary = false,
  footer,
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
  footer?: ReactNode;
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
      {footer}
      {message ? (
        <Text style={[networkStyles.actionMessage, messageError && networkStyles.errorText]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function OpportunityCard({
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

export function ModerationActions({
  blockProfileId,
  onBlocked,
  targetId,
  targetType,
  token,
}: {
  blockProfileId?: number;
  onBlocked?: () => void;
  targetId: number;
  targetType: ContentReportTargetType;
  token?: string | null;
}) {
  const [reportState, setReportState] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [blockSaving, setBlockSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!token) {
    return null;
  }

  async function report() {
    setReportState("saving");
    setMessage(null);
    try {
      await reportContent(token as string, { target_type: targetType, target_id: targetId });
      setReportState("sent");
      setIsError(false);
      setMessage("Reported. Our team will review this content.");
    } catch (error) {
      if (isConflict(error)) {
        setReportState("sent");
        setIsError(false);
        setMessage("You already reported this content.");
        return;
      }
      setReportState("error");
      setIsError(true);
      setMessage(toErrorMessage(error));
    }
  }

  async function block() {
    if (blockProfileId === undefined) {
      return;
    }
    setBlockSaving(true);
    setMessage(null);
    try {
      await blockProfile(token as string, blockProfileId);
      onBlocked?.();
    } catch (error) {
      setBlockSaving(false);
      setIsError(true);
      setMessage(toErrorMessage(error));
    }
  }

  return (
    <>
      <View style={networkStyles.actionRow}>
        <InlineAction
          disabled={reportState === "sent"}
          icon={Flag}
          label={reportState === "sent" ? "Reported" : "Report"}
          loading={reportState === "saving"}
          onPress={() => void report()}
          secondary
          wide
        />
        {blockProfileId !== undefined ? (
          <InlineAction
            icon={Ban}
            label="Block user"
            loading={blockSaving}
            onPress={() => void block()}
            secondary
            wide
          />
        ) : null}
      </View>
      {message ? (
        <Text style={[networkStyles.actionMessage, isError && networkStyles.errorText]}>{message}</Text>
      ) : null}
    </>
  );
}


export function PanelHeader({
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
  // Detail panels render below the fold in the shared ScrollView; without
  // this scroll the panel opens invisibly and the tap looks like a no-op.
  const anchorRef = useScrollIntoViewOnMount();

  return (
    <View ref={anchorRef} style={styles.cardTop}>
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

export function ProfileDetailPanel({
  onBlocked,
  onClose,
  profile,
  token,
}: {
  onBlocked?: () => void;
  onClose: () => void;
  profile: ProfileRead;
  token?: string | null;
}) {
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

      <ModerationActions
        blockProfileId={profile.id}
        onBlocked={onBlocked}
        targetId={profile.id}
        targetType="profile"
        token={token}
      />
    </View>
  );
}

export function OpportunityDetailPanel({
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
  token,
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
  token?: string | null;
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

          <ModerationActions targetId={detail.id} targetType="opportunity" token={token} />
        </>
      ) : null}
    </View>
  );
}

export function OwnerApplicationsPanel({
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
        <StatusChip
          label={applications.length === 1 ? "1 applicant" : `${applications.length} applicants`}
          tone={applications.length ? "green" : "slate"}
        />
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
