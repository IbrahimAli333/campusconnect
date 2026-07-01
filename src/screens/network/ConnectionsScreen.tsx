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

export function ConnectionsScreen({ token }: { token: string | null }) {
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
