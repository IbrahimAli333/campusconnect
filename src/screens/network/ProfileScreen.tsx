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
import { deleteAccount } from "../../lib/api/auth";
import { GOOGLE_OAUTH_CLIENT_ID } from "../../lib/google-oauth";
import { GoogleIdTokenGate } from "../../components/common/GoogleIdTokenGate";
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

export function ProfileScreen({
  onAccountDeleted,
  token,
}: {
  onAccountDeleted?: () => void;
  token: string | null;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<ProfileRead | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteState, setDeleteState] = useState<PortfolioSaveState>("idle");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
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
      return Promise.reject(new Error(t("Missing authentication token")));
    }

    return getMyProfile(token);
  }, [token]);
  const profileState = usePortalData(Boolean(token), loadProfile, "profile");

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
      throw new Error(t("Missing authentication token"));
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
      setSkillMessage(t("Add a skill name."));
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
      setSkillMessage(wasEditing ? t("Skill level saved.") : t("Skill added."));
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
      setSkillMessage(t("Skill deleted."));
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
      setResumeMessage(wasEditing ? t("Resume entry saved.") : t("Resume entry added."));
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
      setResumeMessage(t("Resume entry deleted."));
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
        setSaveMessage(t("Graduation year must be a whole number."));
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
      setSaveMessage(t("Portfolio profile saved."));
    } catch (error) {
      setSaveState("error");
      setSaveMessage(toErrorMessage(error));
    }
  }

  async function confirmAccountDeletion() {
    if (!token || deleteState === "saving") {
      return;
    }
    if (!deletePassword) {
      setDeleteState("error");
      setDeleteMessage(t("Enter your password to confirm deletion."));
      return;
    }

    await runAccountDeletion({ password: deletePassword });
  }

  // Google-created accounts have no usable password, so a fresh Google
  // sign-in for the same email confirms deletion instead.
  async function confirmAccountDeletionWithGoogle(idToken: string) {
    if (!token || deleteState === "saving") {
      return;
    }

    await runAccountDeletion({ googleIdToken: idToken });
  }

  async function runAccountDeletion(credential: Parameters<typeof deleteAccount>[1]) {
    if (!token) {
      return;
    }

    setDeleteState("saving");
    setDeleteMessage(null);

    try {
      await deleteAccount(token, credential);
      onAccountDeleted?.();
    } catch (error) {
      setDeleteState("error");
      setDeleteMessage(error instanceof Error ? error.message : t("Could not delete the account."));
    }
  }

  if (profileState.loading && !profile) {
    return <LoadingState label={t("Loading profile")} />;
  }

  if (!profile || !draft) {
    return (
      <ErrorState
        message={profileState.error?.message ?? t("Your Unibridge portfolio is not available.")}
        onRetry={profileState.retry}
        title={t("Could not load portfolio")}
      />
    );
  }

  return (
    <View style={styles.stack}>
      {profileState.error ? (
        <ErrorState
          message={profileState.error.message}
          onRetry={profileState.retry}
          title={t("Could not refresh portfolio")}
        />
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={networkStyles.cardTitleBlock}>
            <Text style={styles.eyebrow}>{t(titleCase(profile.role))}</Text>
            <Text style={networkStyles.profileName} numberOfLines={2}>
              {profile.user.full_name}
            </Text>
            <Text style={styles.cardMeta}>{profile.headline ?? t("Add a portfolio headline for collaborators and mentors.")}</Text>
          </View>
          <StatusChip label={t(titleCase(profile.visibility))} tone={statusTone(profile.visibility)} />
        </View>

        <Text style={networkStyles.bodyText}>{profile.bio ?? t("Add a short portfolio bio with research interests, projects, and goals.")}</Text>

        <View style={networkStyles.profileMetaGrid}>
          <View style={networkStyles.profileMetaItem}>
            <GraduationCap color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>
              {[profile.university, profile.faculty].filter(Boolean).join(" - ") || t("University affiliation not set")}
            </Text>
          </View>
          <View style={networkStyles.profileMetaItem}>
            <MapPin color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>{profile.location ?? t("Location not set")}</Text>
          </View>
          <View style={networkStyles.profileMetaItem}>
            <Eye color={palette.teal} size={18} strokeWidth={2.4} />
            <Text style={networkStyles.metaText}>{t(titleCase(profile.visibility))}</Text>
          </View>
        </View>
      </View>

      <SectionHeader action={profile.skills.length ? t("{n} skills", { n: profile.skills.length }) : t("Empty")} icon={CheckCircle2} title={t("Portfolio Skills")} />
      <View style={networkStyles.formPanel}>
        <SectionHeader action={editingSkillId === null ? t("New skill") : t("Editing")} icon={Pencil} title={t("Skill Editor")} />
        {editingSkillId === null ? (
          <LabeledInput
            autoCapitalize="words"
            label={t("Skill name")}
            onChangeText={(value) => updateSkillDraft("name", value)}
            placeholder={t("Example: Data analysis")}
            value={skillDraft.name}
          />
        ) : (
          <View style={networkStyles.lockedField}>
            <Text style={styles.eyebrow}>{t("Skill")}</Text>
            <Text style={networkStyles.lockedFieldText} numberOfLines={1}>
              {skillDraft.name}
            </Text>
          </View>
        )}
        <FormField label={t("Skill level")}>
          <View style={networkStyles.filterRow}>
            {skillLevels.map((item) => (
              <FilterChip
                active={skillDraft.level === item}
                key={item}
                label={t(titleCase(item))}
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
            label={skillState === "saving" ? t("Saving") : editingSkillId === null ? t("Add Skill") : t("Save Skill")}
            loading={skillState === "saving"}
            onPress={saveSkill}
          />
          {editingSkillId !== null ? (
            <InlineAction icon={X} label={t("Cancel")} onPress={cancelSkillEdit} secondary />
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
                <Text style={styles.rowMeta}>{t(titleCase(userSkill.level))}</Text>
              </View>
              <View style={networkStyles.rowActions}>
                <InlineAction icon={Pencil} label={t("Edit")} onPress={() => beginSkillEdit(userSkill)} secondary />
                <InlineAction
                  icon={Trash2}
                  label={t("Delete")}
                  loading={deletingSkillId === userSkill.id}
                  onPress={() => void removeSkill(userSkill)}
                  secondary
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState body={t("Skills will appear here after they are added.")} icon={CheckCircle2} title={t("No portfolio skills")} />
      )}

      <SectionHeader
        action={profile.resume_entries.length ? t("{n} entries", { n: profile.resume_entries.length }) : t("Empty")}
        icon={FileText}
        title={t("Portfolio / Resume")}
      />
      <View style={networkStyles.sectionActionsRow}>
        <InlineAction
          icon={Plus}
          label={resumeFormOpen ? t("New Entry") : t("Add Entry")}
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
          <SectionHeader action={editingResumeEntryId === null ? t("New entry") : t("Editing")} icon={Pencil} title={t("Resume Editor")} />
          <FormField label={t("Entry type")}>
            <View style={networkStyles.filterRow}>
              {resumeEntryTypes.map((item) => (
                <FilterChip
                  active={resumeDraft.entry_type === item}
                  key={item}
                  label={t(titleCase(item))}
                  onPress={(value) => updateResumeDraft("entry_type", value)}
                  value={item}
                />
              ))}
            </View>
          </FormField>
          <LabeledInput
            label={t("Title")}
            onChangeText={(value) => updateResumeDraft("title", value)}
            placeholder={t("Title")}
            value={resumeDraft.title}
          />
          <LabeledInput
            label={t("Organization")}
            onChangeText={(value) => updateResumeDraft("organization", value)}
            placeholder={t("Organization")}
            value={resumeDraft.organization}
          />
          <LabeledInput
            label={t("Description")}
            multiline
            onChangeText={(value) => updateResumeDraft("description", value)}
            placeholder={t("Description")}
            style={networkStyles.textArea}
            textAlignVertical="top"
            value={resumeDraft.description}
          />
          <View style={networkStyles.twoColumn}>
            <LabeledInput
              containerStyle={networkStyles.flexField}
              label={t("Start date")}
              onChangeText={(value) => updateResumeDraft("start_date", value)}
              placeholder={t("YYYY-MM-DD")}
              value={resumeDraft.start_date}
            />
            <LabeledInput
              containerStyle={networkStyles.flexField}
              editable={!resumeDraft.is_current}
              label={t("End date")}
              onChangeText={(value) => updateResumeDraft("end_date", value)}
              placeholder={t("YYYY-MM-DD")}
              style={resumeDraft.is_current && networkStyles.disabledInput}
              value={resumeDraft.end_date}
            />
          </View>
          <FormField label={t("Timeline status")}>
            <View style={networkStyles.filterRow}>
              {(["completed", "current"] as const).map((item) => (
                <FilterChip
                  active={item === "current" ? resumeDraft.is_current : !resumeDraft.is_current}
                  key={item}
                  label={item === "current" ? t("Current") : t("Completed")}
                  onPress={(value) => updateResumeDraft("is_current", value === "current")}
                  value={item}
                />
              ))}
            </View>
          </FormField>
          <LabeledInput
            autoCapitalize="none"
            label={t("Link")}
            onChangeText={(value) => updateResumeDraft("url", value)}
            placeholder={t("URL")}
            value={resumeDraft.url}
          />
          <View style={networkStyles.actionRow}>
            <InlineAction
              icon={Save}
              label={resumeState === "saving" ? t("Saving") : editingResumeEntryId === null ? t("Add Entry") : t("Save Entry")}
              loading={resumeState === "saving"}
              onPress={saveResumeEntry}
            />
            <InlineAction icon={X} label={t("Cancel")} onPress={cancelResumeEdit} secondary />
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
                  {[t(titleCase(entry.entry_type)), entry.organization, resumeDateRange(entry, t)].filter(Boolean).join(" - ")}
                </Text>
                {entry.description ? (
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {entry.description}
                  </Text>
                ) : null}
              </View>
              <View style={networkStyles.rowActions}>
                <InlineAction icon={Pencil} label={t("Edit")} onPress={() => beginResumeEdit(entry)} secondary />
                <InlineAction
                  icon={Trash2}
                  label={t("Delete")}
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
          body={t("Projects, research, work, awards, education, and certifications will appear here after they are added.")}
          icon={FileText}
          title={t("No portfolio entries")}
        />
      )}

      <View style={networkStyles.formPanel}>
        <SectionHeader action={t("Basic fields")} icon={Pencil} title={t("Edit Portfolio")} />
        <LabeledInput
          label={t("Headline")}
          onChangeText={(value) => updateDraft("headline", value)}
          placeholder={t("Portfolio headline")}
          value={draft.headline}
        />
        <LabeledInput
          label={t("Bio")}
          multiline
          onChangeText={(value) => updateDraft("bio", value)}
          placeholder={t("Portfolio bio, research interests, and goals")}
          style={networkStyles.textArea}
          textAlignVertical="top"
          value={draft.bio}
        />
        <LabeledInput
          label={t("University")}
          onChangeText={(value) => updateDraft("university", value)}
          placeholder={t("University")}
          value={draft.university}
        />
        <LabeledInput
          label={t("Faculty")}
          onChangeText={(value) => updateDraft("faculty", value)}
          placeholder={t("Faculty")}
          value={draft.faculty}
        />
        <View style={networkStyles.twoColumn}>
          <LabeledInput
            containerStyle={networkStyles.flexField}
            keyboardType="number-pad"
            label={t("Graduation year")}
            onChangeText={(value) => updateDraft("graduation_year", value)}
            placeholder={t("Graduation year")}
            value={draft.graduation_year}
          />
          <LabeledInput
            containerStyle={networkStyles.flexField}
            label={t("Location")}
            onChangeText={(value) => updateDraft("location", value)}
            placeholder={t("Location")}
            value={draft.location}
          />
        </View>
        <FormField label={t("Visibility")}>
          <View style={networkStyles.filterRow}>
            {visibilityOptions.map((item) => (
              <FilterChip
                active={draft.visibility === item}
                key={item}
                label={t(titleCase(item))}
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
          label={saveState === "saving" ? t("Saving") : t("Save Portfolio")}
          loading={saveState === "saving"}
          onPress={saveProfile}
        />
      </View>

      <View style={[styles.card, styles.compactCard]}>
        <SectionHeader action={t("Irreversible")} icon={Trash2} title={t("Delete Account")} />
        <Text style={styles.smallText}>
          {t("Permanently removes your account, portfolio, posts, applications, and connections. This cannot be undone.")}
        </Text>
        {!deleteConfirmOpen ? (
          <InlineAction
            icon={Trash2}
            label={t("Delete account")}
            onPress={() => {
              setDeleteConfirmOpen(true);
              setDeleteMessage(null);
            }}
            secondary
          />
        ) : (
          <>
            <LabeledInput
              autoCapitalize="none"
              label={t("Confirm your password to delete this account")}
              onChangeText={setDeletePassword}
              placeholder={t("Password")}
              secureTextEntry
              value={deletePassword}
            />
            <View style={networkStyles.actionRow}>
              <InlineAction
                icon={Trash2}
                label={deleteState === "saving" ? t("Deleting") : t("Permanently delete")}
                loading={deleteState === "saving"}
                onPress={() => void confirmAccountDeletion()}
                wide
              />
              <InlineAction
                icon={X}
                label={t("Cancel")}
                onPress={() => {
                  setDeleteConfirmOpen(false);
                  setDeletePassword("");
                  setDeleteMessage(null);
                  setDeleteState("idle");
                }}
                secondary
                wide
              />
            </View>
            {GOOGLE_OAUTH_CLIENT_ID ? (
              <>
                <Text style={styles.smallText}>
                  {t("Signed in with your university Google account? Verify with Google instead of a password.")}
                </Text>
                <GoogleIdTokenGate
                  clientId={GOOGLE_OAUTH_CLIENT_ID}
                  onError={(message) => {
                    setDeleteState("error");
                    setDeleteMessage(message);
                  }}
                  onIdToken={(idToken) => void confirmAccountDeletionWithGoogle(idToken)}
                >
                  {(promptGoogleSignIn, ready) => (
                    <InlineAction
                      disabled={!ready || deleteState === "saving"}
                      icon={GraduationCap}
                      label={t("Verify with Google and delete")}
                      onPress={promptGoogleSignIn}
                      secondary
                      wide
                    />
                  )}
                </GoogleIdTokenGate>
              </>
            ) : null}
            {deleteMessage ? (
              <Text style={[networkStyles.actionMessage, deleteState === "error" && networkStyles.errorText]}>
                {deleteMessage}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
