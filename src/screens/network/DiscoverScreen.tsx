import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
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

import { EmptyState, ErrorState, LoadingState } from "../../components/common/PortalState";
import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusChip } from "../../components/common/StatusChip";
import {
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
} from "../../lib/api/network";
import { usePortalData } from "../../lib/api/usePortalData";
import { palette, styles } from "../../styles/theme";
import type {
  ConnectionRequestDecision,
  ConnectionRequestRead,
  MyOpportunityApplicationRead,
  OwnerApplicationStatusUpdate,
  OwnerOpportunityApplicationRead,
  OpportunityDetailRead,
  OpportunityRead,
  OpportunityType,
  ProfileRead,
  ProfileSummary,
  ProfileVisibility,
  ResumeEntryRead,
  ResumeEntryType,
  SkillLevel,
  UserSkillRead,
} from "../../types/network";

import {
  DiscoverDashboard,
  FilterChip,
  FormField,
  InlineAction,
  LabeledInput,
  MatchPreview,
  MatchSlip,
  OpportunityCard,
  OpportunityDetailPanel,
  OwnerApplicationsPanel,
  PanelHeader,
  ProfileCard,
  ProfileDetailPanel,
  ScreenIntro,
  SearchBox,
  SkillList,
  SkillPill,
  allowedOpportunityTypes,
  canOwnerReviewApplication,
  emptyResumeDraft,
  emptySkillDraft,
  emptyToNull,
  formatDate,
  formatFullDate,
  isConflict,
  isNotFound,
  normalizeDateInput,
  opportunityAuthoringCopy,
  opportunityFilters,
  opportunityOwner,
  opportunityTone,
  opportunityTypes,
  ownerApplicationStatuses,
  profileMeta,
  profileSkills,
  profileToDraft,
  resumeDateRange,
  resumeDraftToPayload,
  resumeEntryTypes,
  resumeToDraft,
  reviewStatusIcon,
  roleTone,
  skillLevels,
  skillToDraft,
  statusTone,
  titleCase,
  toErrorMessage,
  visibilityOptions,
} from "./shared";
import type {
  ActionState,
  DiscoverData,
  OpportunityFilter,
  PortfolioSaveState,
  ProfileDraft,
  ResumeDraft,
  SkillDraft,
} from "./shared";
import { networkStyles } from "./styles";

export function DiscoverScreen({ token }: { token: string | null }) {
  const [query, setQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ProfileRead | null>(null);
  const [connectState, setConnectState] = useState<Record<number, ActionState>>({});
  const [connectMessages, setConnectMessages] = useState<Record<number, string>>({});
  const [composeKey, setComposeKey] = useState<string | null>(null);
  const [composeMessage, setComposeMessage] = useState("");
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

  function openConnectComposer(listId: string, profile: ProfileRead) {
    setComposeKey(`${listId}:${profile.id}`);
    setComposeMessage("");
    setConnectMessages((current) => ({ ...current, [profile.id]: "" }));
  }

  async function connect(profile: ProfileRead) {
    if (!token) {
      return;
    }

    setConnectState((current) => ({ ...current, [profile.id]: "sending" }));
    setConnectMessages((current) => ({ ...current, [profile.id]: "" }));

    try {
      await requestConnection(token, profile.id, composeMessage);
      setComposeKey(null);
      setComposeMessage("");
      setConnectState((current) => ({ ...current, [profile.id]: "sent" }));
      setConnectMessages((current) => ({ ...current, [profile.id]: "Request sent." }));
    } catch (error) {
      if (isConflict(error)) {
        setComposeKey(null);
        setConnectState((current) => ({ ...current, [profile.id]: "sent" }));
        setConnectMessages((current) => ({ ...current, [profile.id]: "Request already sent." }));
        return;
      }

      setConnectState((current) => ({ ...current, [profile.id]: "error" }));
      setConnectMessages((current) => ({ ...current, [profile.id]: toErrorMessage(error) }));
    }
  }

  function connectComposer(listId: string, profile: ProfileRead) {
    if (composeKey !== `${listId}:${profile.id}`) {
      return undefined;
    }

    const sending = (connectState[profile.id] ?? "idle") === "sending";
    return (
      <View style={networkStyles.formField}>
        <LabeledInput
          label="Message (Optional)"
          maxLength={500}
          multiline
          onChangeText={setComposeMessage}
          placeholder="Add a short note to introduce yourself"
          value={composeMessage}
        />
        <View style={networkStyles.actionRow}>
          <InlineAction
            icon={Send}
            label="Send Request"
            loading={sending}
            onPress={() => void connect(profile)}
          />
          <InlineAction
            disabled={sending}
            icon={X}
            label="Cancel"
            onPress={() => setComposeKey(null)}
            secondary
          />
        </View>
      </View>
    );
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
        <ProfileDetailPanel
          onBlocked={() => {
            setSelectedProfile(null);
            discoverState.retry();
          }}
          onClose={() => setSelectedProfile(null)}
          profile={selectedProfile}
          token={token}
        />
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
            const disabled =
              hasConnection ||
              actionState === "sent" ||
              actionState === "sending" ||
              composeKey === `recommended:${profile.id}`;
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
                footer={connectComposer("recommended", profile)}
                key={profile.id}
                matchReasons={profile.match_reasons}
                matchScore={profile.match_score}
                message={message}
                messageError={actionState === "error"}
                onAction={() => openConnectComposer("recommended", profile)}
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
            const disabled =
              isSelf || actionState === "sent" || actionState === "sending" || composeKey === `directory:${profile.id}`;

            return (
              <ProfileCard
                actionDisabled={disabled}
                actionIcon={isSelf || actionState === "sent" ? CheckCircle2 : UserPlus}
                actionLabel={isSelf ? "Your Profile" : actionState === "sent" ? "Requested" : "Connect"}
                actionLoading={actionState === "sending"}
                actionSecondary={isSelf || actionState === "sent"}
                footer={connectComposer("directory", profile)}
                key={profile.id}
                message={message}
                messageError={actionState === "error"}
                onAction={() => openConnectComposer("directory", profile)}
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
