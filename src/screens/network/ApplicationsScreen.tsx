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

export function ApplicationsScreen({ token }: { token: string | null }) {
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
