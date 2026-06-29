export type NetworkTab = "discover" | "opportunities" | "applications" | "profile" | "connections";

export type NetworkRole = "member" | "student" | "teacher" | "mentor" | "employer" | "admin";

export type ProfileVisibility = "public" | "university_only" | "private";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type ResumeEntryType = "education" | "work" | "project" | "research" | "award" | "certification";

export type OpportunityType = "startup" | "research" | "internship" | "job" | "project";

export type OpportunityStatus = "draft" | "open" | "closed" | "archived";

export type ApplicationStatus = "submitted" | "reviewing" | "accepted" | "rejected" | "withdrawn";

export type OwnerApplicationStatusUpdate = "reviewing" | "accepted" | "rejected";

export type ConnectionRequestStatus = "pending" | "accepted" | "declined" | "canceled";

export interface NetworkUserSummary {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface SkillRead {
  id: number;
  name: string;
  created_at: string;
}

export interface UserSkillRead {
  id: number;
  skill: SkillRead;
  level: SkillLevel;
  created_at: string;
}

export interface ResumeEntryRead {
  id: number;
  entry_type: ResumeEntryType;
  title: string;
  organization: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileSummary {
  id: number;
  user: NetworkUserSummary;
  role: NetworkRole;
  headline: string | null;
  university: string | null;
  faculty: string | null;
  graduation_year: number | null;
  location: string | null;
  visibility: ProfileVisibility;
}

export interface ProfileRead extends ProfileSummary {
  bio: string | null;
  skills: UserSkillRead[];
  resume_entries: ResumeEntryRead[];
  created_at: string;
  updated_at: string;
}

export interface ProfileRecommendationRead extends ProfileRead {
  connection_status: ConnectionRequestStatus | null;
  match_score: number;
  match_reasons: string[];
}

export interface ProfileUpdatePayload {
  role?: NetworkRole;
  headline?: string | null;
  bio?: string | null;
  university?: string | null;
  faculty?: string | null;
  graduation_year?: number | null;
  location?: string | null;
  visibility?: ProfileVisibility;
}

export interface UserSkillCreatePayload {
  name: string;
  level: SkillLevel;
}

export interface UserSkillUpdatePayload {
  level?: SkillLevel;
}

export interface ResumeEntryCreatePayload {
  entry_type: ResumeEntryType;
  title: string;
  organization?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  url?: string | null;
}

export interface ResumeEntryUpdatePayload {
  entry_type?: ResumeEntryType;
  title?: string;
  organization?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  url?: string | null;
}

export interface OpportunityRead {
  id: number;
  owner_profile: ProfileSummary;
  type: OpportunityType;
  title: string;
  description: string;
  required_skills: string[];
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface OpportunitySummary {
  id: number;
  owner_profile: ProfileSummary;
  type: OpportunityType;
  title: string;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface OpportunityDetailRead extends OpportunityRead {
  has_applied: boolean;
  has_saved: boolean;
}

export interface OpportunityRecommendationRead extends OpportunityDetailRead {
  match_score: number;
  match_reasons: string[];
}

export interface OpportunityCreatePayload {
  type: OpportunityType;
  title: string;
  description: string;
  required_skills: string[];
  status?: OpportunityStatus;
}

export interface OpportunityApplicationRead {
  id: number;
  opportunity_id: number;
  applicant_profile: ProfileSummary;
  status: ApplicationStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MyOpportunityApplicationRead {
  id: number;
  opportunity: OpportunitySummary;
  status: ApplicationStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerOpportunityApplicationRead {
  id: number;
  opportunity: OpportunitySummary;
  applicant_profile: ProfileSummary;
  applicant_skills: UserSkillRead[];
  applicant_resume_entries: ResumeEntryRead[];
  status: ApplicationStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRequestRead {
  id: number;
  requester_profile: ProfileSummary;
  receiver_profile: ProfileSummary;
  status: ConnectionRequestStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MyConnectionsRead {
  sent: ConnectionRequestRead[];
  received: ConnectionRequestRead[];
}

export interface SavedOpportunityRead {
  id: number;
  profile_id: number;
  opportunity_id: number;
  created_at: string;
}
