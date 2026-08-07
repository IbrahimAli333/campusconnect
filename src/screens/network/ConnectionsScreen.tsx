import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
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
  GraduationCap,
  Inbox,
  MapPin,
  MessageCircle,
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
  listMyBlocks,
  listOpportunities,
  listProfiles,
  requestConnection,
  saveOpportunity,
  unblockProfile,
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
import { useI18n } from "../../lib/i18n";
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
  InitialsAvatar,
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
import { MessagesSection } from "./MessagesSection";
import { networkStyles } from "./styles";

export function ConnectionsScreen({ token }: { token: string | null }) {
  const { t } = useI18n();
  const [openThreadProfile, setOpenThreadProfile] = useState<ProfileSummary | null>(null);
  const [decisionPending, setDecisionPending] = useState<Record<number, ConnectionRequestDecision | undefined>>({});
  const [decisionMessages, setDecisionMessages] = useState<Record<number, string>>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<number, boolean>>({});
  const loadConnections = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getMyConnections(token);
  }, [token]);
  const connectionsState = usePortalData(Boolean(token), loadConnections, "connections");
  const connections = connectionsState.data;
  const sent = connections?.sent ?? [];
  const received = connections?.received ?? [];
  const hasConnections = sent.length > 0 || received.length > 0;
  const loadBlocks = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return listMyBlocks(token);
  }, [token]);
  const blocksState = usePortalData(Boolean(token), loadBlocks, "blocks");
  const blockedProfiles = blocksState.data ?? [];
  const [unblockingProfileId, setUnblockingProfileId] = useState<number | null>(null);
  const [unblockError, setUnblockError] = useState<string | null>(null);

  async function unblock(profileId: number) {
    if (!token) {
      return;
    }

    setUnblockingProfileId(profileId);
    setUnblockError(null);

    try {
      await unblockProfile(token, profileId);
      blocksState.retry();
      connectionsState.retry();
    } catch (error) {
      setUnblockError(toErrorMessage(error));
    } finally {
      setUnblockingProfileId(null);
    }
  }

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
            ? t("Connection accepted.")
            : decision === "declined"
              ? t("Request declined.")
              : t("Request canceled."),
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
    return <LoadingState label={t("Loading connections")} />;
  }

  if (!connections) {
    return (
      <ErrorState
        message={connectionsState.error?.message ?? t("Your academic network is not available.")}
        onRetry={connectionsState.retry}
        title={t("Could not load network")}
      />
    );
  }

  return (
    <View style={styles.stack}>
      {connectionsState.error ? (
        <ErrorState
          message={connectionsState.error.message}
          onRetry={connectionsState.retry}
          title={t("Could not refresh network")}
        />
      ) : null}

      <MessagesSection onOpenThread={setOpenThreadProfile} openThreadProfile={openThreadProfile} token={token} />

      {hasConnections ? (
        <>
          <SectionHeader action={sent.length ? t("{n} sent", { n: sent.length }) : t("Empty")} icon={Send} title={t("Sent Connections")} />
          {sent.length ? (
            <View style={networkStyles.panelList}>
              {sent.map((connection) => (
                <View key={connection.id} style={styles.listRow}>
                  <InitialsAvatar name={connection.receiver_profile.user.full_name} size={38} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {connection.receiver_profile.user.full_name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {[profileMeta(connection.receiver_profile, t), formatFullDate(connection.created_at)].join(" - ")}
                    </Text>
                    {connection.message ? (
                      <View style={networkStyles.requestNote}>
                        <Text style={networkStyles.requestNoteText}>{`"${connection.message}"`}</Text>
                      </View>
                    ) : null}
                    {connection.status === "pending" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={X}
                          label={t("Cancel Request")}
                          loading={decisionPending[connection.id] === "canceled"}
                          onPress={() => void decide(connection, "canceled")}
                          secondary
                        />
                      </View>
                    ) : null}
                    {connection.status === "accepted" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={MessageCircle}
                          label={t("Message")}
                          onPress={() => setOpenThreadProfile(connection.receiver_profile)}
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
                  <StatusChip label={t(titleCase(connection.status))} tone={statusTone(connection.status)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState body={t("Use Discover to connect with mentors, professors, collaborators, and employers.")} icon={Send} title={t("No sent connections")} />
          )}

          <SectionHeader action={received.length ? t("{n} received", { n: received.length }) : t("Empty")} icon={Inbox} title={t("Received Connections")} />
          {received.length ? (
            <View style={networkStyles.panelList}>
              {received.map((connection) => (
                <View key={connection.id} style={styles.listRow}>
                  <InitialsAvatar name={connection.requester_profile.user.full_name} size={38} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {connection.requester_profile.user.full_name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {[profileMeta(connection.requester_profile, t), formatFullDate(connection.created_at)].join(" - ")}
                    </Text>
                    {connection.message ? (
                      <View style={networkStyles.requestNote}>
                        <Text style={networkStyles.requestNoteText}>{`"${connection.message}"`}</Text>
                      </View>
                    ) : null}
                    {connection.status === "pending" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={CheckCircle2}
                          label={t("Accept")}
                          loading={decisionPending[connection.id] === "accepted"}
                          onPress={() => void decide(connection, "accepted")}
                        />
                        <InlineAction
                          icon={X}
                          label={t("Decline")}
                          loading={decisionPending[connection.id] === "declined"}
                          onPress={() => void decide(connection, "declined")}
                          secondary
                        />
                      </View>
                    ) : null}
                    {connection.status === "accepted" ? (
                      <View style={networkStyles.actionRow}>
                        <InlineAction
                          icon={MessageCircle}
                          label={t("Message")}
                          onPress={() => setOpenThreadProfile(connection.requester_profile)}
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
                  <StatusChip label={t(titleCase(connection.status))} tone={statusTone(connection.status)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState body={t("Incoming academic and professional requests will appear here.")} icon={Inbox} title={t("No received connections")} />
          )}
        </>
      ) : (
        <EmptyState
          body={t("Use Discover to start building your academic and professional network.")}
          icon={Users}
          title={t("No connections yet")}
        />
      )}

      {blockedProfiles.length ? (
        <>
          <SectionHeader action={t("{n} blocked", { n: blockedProfiles.length })} icon={Ban} title={t("Blocked Users")} />
          <View style={networkStyles.panelList}>
            {blockedProfiles.map((profile) => (
              <View key={profile.id} style={styles.listRow}>
                <View style={networkStyles.resumeIcon}>
                  <Ban color={palette.red} size={18} strokeWidth={2.4} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {profile.user.full_name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {profileMeta(profile, t)}
                  </Text>
                </View>
                <InlineAction
                  icon={X}
                  label={t("Unblock")}
                  loading={unblockingProfileId === profile.id}
                  onPress={() => void unblock(profile.id)}
                  secondary
                />
              </View>
            ))}
          </View>
          {unblockError ? (
            <Text style={[networkStyles.actionMessage, networkStyles.errorText]}>{unblockError}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
