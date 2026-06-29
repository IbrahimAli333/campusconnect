import { useCallback, useEffect, useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { BookOpen, CalendarDays, CheckCircle2, FileText, GraduationCap, Megaphone, ShieldCheck } from "lucide-react-native";

import { AnnouncementRow } from "../components/student/AnnouncementRow";
import { CourseCard } from "../components/student/CourseCard";
import { MaterialRow } from "../components/student/MaterialRow";
import { EmptyState, ErrorState, LoadingState } from "../components/common/PortalState";
import { RiskPanel } from "../components/student/RiskPanel";
import { ScheduleRow } from "../components/student/ScheduleRow";
import { SectionHeader } from "../components/common/SectionHeader";
import { StatCard } from "../components/common/StatCard";
import { StatusChip } from "../components/common/StatusChip";
import { attendanceLabels } from "../components/teacher/attendanceLabels";
import {
  announcements as mockAnnouncements,
  courses as mockCourses,
  materials as mockMaterials,
  schedule as mockSchedule,
  studentProfile as mockStudentProfile,
} from "../data/mockPortal";
import { getStudentPortal, mapStudentPortal, type StudentPortalView } from "../lib/api/portal";
import { usePortalData } from "../lib/api/usePortalData";
import { styles } from "../styles/theme";
import type { AttendanceStatus, StudentTab } from "../types/portal";

const canUseDevelopmentFallback = typeof __DEV__ !== "undefined" && __DEV__;

function attendanceTone(status: AttendanceStatus) {
  switch (status) {
    case "present":
      return "green" as const;
    case "late":
      return "amber" as const;
    case "absent":
      return "red" as const;
    case "excused":
    default:
      return "blue" as const;
  }
}

function formatAttendanceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatGradeDate(value: string | null): string {
  if (!value) {
    return "Saved";
  }

  return formatAttendanceDate(value);
}

function gradeTone(score: number, maxScore: number) {
  if (maxScore <= 0) {
    return "blue" as const;
  }

  const percent = (score / maxScore) * 100;
  if (percent >= 85) {
    return "green" as const;
  }

  if (percent >= 70) {
    return "amber" as const;
  }

  return "red" as const;
}

const fallbackStudentPortal: StudentPortalView = {
  profileName: mockStudentProfile.fullName,
  profileMeta: `${mockStudentProfile.faculty} - ${mockStudentProfile.group}`,
  attendanceRate: Math.round(mockCourses.reduce((sum, course) => sum + course.attendancePercent, 0) / mockCourses.length),
  attendanceRecords: [],
  averageGrade: Math.round(mockCourses.reduce((sum, course) => sum + course.currentGrade, 0) / mockCourses.length),
  gradeSummaries: [],
  gradeRecords: [],
  courses: mockCourses,
  schedule: mockSchedule,
  materials: mockMaterials,
  announcements: mockAnnouncements,
};

export function StudentPortalScreen({
  activeTab,
  onProfileLoaded,
  token,
  visible = true,
}: {
  activeTab: StudentTab;
  onProfileLoaded?: (profile: { profileName: string; profileMeta: string }) => void;
  token: string | null;
  visible?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const loadPortal = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getStudentPortal(token);
  }, [token]);
  const portalState = usePortalData(visible && Boolean(token), loadPortal);
  const loadedPortal = useMemo(
    () => (portalState.data ? mapStudentPortal(portalState.data) : null),
    [portalState.data],
  );
  const portal = loadedPortal ?? (portalState.error && canUseDevelopmentFallback ? fallbackStudentPortal : null);

  useEffect(() => {
    if (visible && loadedPortal) {
      onProfileLoaded?.({
        profileName: loadedPortal.profileName,
        profileMeta: loadedPortal.profileMeta,
      });
    }
  }, [loadedPortal, onProfileLoaded, visible]);

  if (!visible) {
    return null;
  }

  if (portalState.loading && !portal) {
    return <LoadingState />;
  }

  if (!portal) {
    return (
      <ErrorState
        message={portalState.error?.message ?? "No authenticated student portal data is available."}
        onRetry={portalState.retry}
      />
    );
  }

  const errorPanel = portalState.error ? (
    <ErrorState
      message={`${portalState.error.message}${canUseDevelopmentFallback ? " Showing development fallback data below." : ""}`}
      onRetry={portalState.retry}
      title="Backend student portal unavailable"
    />
  ) : null;
  const riskCount = portal.courses.filter((course) => course.status === "at_risk").length;

  if (activeTab === "courses") {
    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="My courses" action={portal.courses.length ? `${portal.courses.length} active` : "Empty"} icon={BookOpen} />
        {portal.courses.length ? (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {portal.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </View>
        ) : (
          <EmptyState title="No courses" body="Your active enrollments will appear here." icon={BookOpen} />
        )}
      </View>
    );
  }

  if (activeTab === "schedule") {
    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="Schedule" action={portal.schedule.length ? `${portal.schedule.length} lessons` : "Empty"} icon={CalendarDays} />
        {portal.schedule.length ? (
          portal.schedule.map((item) => <ScheduleRow key={item.id} item={item} />)
        ) : (
          <EmptyState title="No lessons" body="Scheduled lessons will appear here." icon={CalendarDays} />
        )}
      </View>
    );
  }

  if (activeTab === "materials") {
    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="Materials" action={portal.materials.length ? "Latest" : "Empty"} icon={FileText} />
        {portal.materials.length ? (
          portal.materials.map((item) => <MaterialRow key={item.id} item={item} />)
        ) : (
          <EmptyState title="No materials" body="Course materials will appear here." icon={FileText} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {errorPanel}
      <View style={[styles.grid, isWide && styles.gridWide]}>
        <StatCard icon={CheckCircle2} label="Attendance" value={`${portal.attendanceRate}%`} tone="green" />
        <StatCard icon={GraduationCap} label="Average grade" value={portal.averageGrade === null ? "--" : `${portal.averageGrade}`} tone="blue" />
        <StatCard icon={CalendarDays} label="Next class" value={portal.schedule[0]?.time ?? "None"} tone="violet" />
      </View>

      <View style={[styles.split, isWide && styles.splitWide]}>
        <View style={styles.splitColumn}>
          <SectionHeader title="Upcoming" action={portal.schedule.length ? `${Math.min(portal.schedule.length, 2)} shown` : "Empty"} icon={CalendarDays} />
          {portal.schedule.length ? (
            portal.schedule.slice(0, 2).map((item) => <ScheduleRow key={item.id} item={item} compact />)
          ) : (
            <EmptyState title="No lessons" body="Upcoming lessons will appear here." icon={CalendarDays} />
          )}
        </View>
        <View style={styles.splitColumn}>
          <SectionHeader title="Alerts" action={riskCount ? `${riskCount} risk` : "Clear"} icon={ShieldCheck} />
          <RiskPanel courses={portal.courses} />
        </View>
      </View>

      <SectionHeader
        title="Recent attendance"
        action={portal.attendanceRecords.length ? `${portal.attendanceRecords.length} records` : "Empty"}
        icon={CheckCircle2}
      />
      {portal.attendanceRecords.length ? (
        portal.attendanceRecords.slice(0, 4).map((record) => (
          <View key={record.id} style={styles.listRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeText}>{formatAttendanceDate(record.starts_at)}</Text>
              <Text style={styles.timeDay}>{record.course_code}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {record.course_title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {record.room ?? "TBD"} - {record.teacher_name}
              </Text>
            </View>
            <StatusChip label={attendanceLabels[record.status]} tone={attendanceTone(record.status)} />
          </View>
        ))
      ) : (
        <EmptyState title="No attendance yet" body="Saved lesson attendance will appear here." icon={CheckCircle2} />
      )}

      <SectionHeader
        title="Recent grades"
        action={portal.gradeRecords.length ? `${portal.gradeRecords.length} records` : "Empty"}
        icon={GraduationCap}
      />
      {portal.gradeRecords.length ? (
        portal.gradeRecords.slice(0, 4).map((record) => (
          <View key={`${record.grade_item_id}-${record.course_id}`} style={styles.listRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeText}>{record.score}</Text>
              <Text style={styles.timeDay}>/{record.max_score}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {record.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {record.course_code} - {formatGradeDate(record.graded_at)}
              </Text>
            </View>
            <StatusChip
              label={`${Math.round(record.max_score > 0 ? (record.score / record.max_score) * 100 : 0)}%`}
              tone={gradeTone(record.score, record.max_score)}
            />
          </View>
        ))
      ) : (
        <EmptyState title="No grades yet" body="Saved teacher grades will appear here." icon={GraduationCap} />
      )}

      <SectionHeader title="Announcements" action={portal.announcements.length ? "Campus" : "Empty"} icon={Megaphone} />
      {portal.announcements.length ? (
        portal.announcements.map((announcement) => <AnnouncementRow key={announcement.id} announcement={announcement} />)
      ) : (
        <EmptyState title="No announcements" body="Campus announcements will appear here." icon={Megaphone} />
      )}
    </View>
  );
}
