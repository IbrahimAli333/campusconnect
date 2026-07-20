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
import { universityFilterOptions, universityKey } from "../../lib/universities";
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

export function OpportunitiesScreen({ token }: { token: string | null }) {
  const [filter, setFilter] = useState<OpportunityFilter>("all");
  const [universityFilter, setUniversityFilter] = useState("all");
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
  const universityOptions = useMemo(
    () => universityFilterOptions(opportunities.map((item) => item.owner_profile.university)),
    [opportunities],
  );
  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter(
        (item) =>
          (filter === "all" || item.type === filter) &&
          (universityFilter === "all" || universityKey(item.owner_profile.university) === universityFilter),
      ),
    [filter, opportunities, universityFilter],
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
        message={opportunitiesState.error?.message ?? "Unibridge opportunities are not available."}
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

      {universityOptions.length > 0 ? (
        <View style={networkStyles.filterRow}>
          <FilterChip
            active={universityFilter === "all"}
            label="All Universities"
            onPress={setUniversityFilter}
            value="all"
          />
          {universityOptions.map((option) => (
            <FilterChip
              active={universityFilter === option.value}
              key={option.value}
              label={option.label}
              onPress={setUniversityFilter}
              value={option.value}
            />
          ))}
        </View>
      ) : null}

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
          token={token}
        />
      ) : null}

      {selectedOwnerProfile ? (
        <ProfileDetailPanel
          onBlocked={() => {
            closeOwnerProfile();
            closeOpportunityDetail();
            opportunitiesState.retry();
          }}
          onClose={closeOwnerProfile}
          profile={selectedOwnerProfile}
          token={token}
        />
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
            filter === "all" && universityFilter === "all"
              ? "Startup cofounder, research, internship, job, project teammate, and hackathon team posts will appear here."
              : "No open posts match the selected filters right now."
          }
          icon={Briefcase}
          title="No open opportunities"
        />
      )}
    </View>
  );
}
