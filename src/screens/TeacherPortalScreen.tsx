import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { CalendarDays, CheckCircle2, ClipboardCheck, FileText, GraduationCap, Megaphone, Save, Users } from "lucide-react-native";

import { AnnouncementRow } from "../components/student/AnnouncementRow";
import { EmptyState, ErrorState, LoadingState } from "../components/common/PortalState";
import { MaterialRow } from "../components/student/MaterialRow";
import { PrimaryAction } from "../components/common/PrimaryAction";
import { ScheduleRow } from "../components/student/ScheduleRow";
import { SectionHeader } from "../components/common/SectionHeader";
import { StatCard } from "../components/common/StatCard";
import { AnnouncementComposer } from "../components/teacher/AnnouncementComposer";
import { AttendanceRow } from "../components/teacher/AttendanceRow";
import { GradeRow } from "../components/teacher/GradeRow";
import { TeacherClassCard } from "../components/teacher/TeacherClassCard";
import {
  announcements as mockAnnouncements,
  classStudents,
  materials as mockMaterials,
  teacherClasses as mockTeacherClasses,
  teacherProfile as mockTeacherProfile,
} from "../data/mockPortal";
import { submitLessonAttendance, type SubmitLessonAttendanceRecord } from "../lib/api/attendance";
import { submitGradeRecords, type SubmitGradeRecord } from "../lib/api/grades";
import { getTeacherPortal, mapTeacherPortal, type PortalTeacherGradeItem, type TeacherPortalView } from "../lib/api/portal";
import { usePortalData } from "../lib/api/usePortalData";
import { palette, styles } from "../styles/theme";
import type { AttendanceStatus, ClassStudent, TeacherTab } from "../types/portal";

const canUseDevelopmentFallback = typeof __DEV__ !== "undefined" && __DEV__;

const fallbackTeacherPortal: TeacherPortalView = {
  profileName: mockTeacherProfile.fullName,
  profileMeta: `${mockTeacherProfile.department} - ${mockTeacherProfile.title}`,
  assignedCourses: [],
  classes: mockTeacherClasses,
  upcomingLessons: mockTeacherClasses.slice(0, 2).map((item) => {
    const [day = "TBD", time = "--:--"] = item.nextLesson.split(" ");
    return {
      id: item.id,
      day,
      time,
      title: item.title,
      room: item.room,
      teacher: mockTeacherProfile.fullName,
      type: "lecture",
    };
  }),
  pendingGradeItems: [],
  pendingGradeCount: mockTeacherClasses.reduce((sum, item) => sum + item.pendingGrades, 0),
  totalStudents: mockTeacherClasses.reduce((sum, item) => sum + item.studentsCount, 0),
  attendanceLessons: [],
  materials: mockMaterials,
  announcements: mockAnnouncements,
  gradeItems: [],
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not save changes";
}

function scoreToDraft(score: number | null): string {
  return typeof score === "number" ? String(score) : "";
}

function parseDraftScore(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function finiteDraftScore(value: string): number {
  const parsed = parseDraftScore(value);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function gradeItemLabel(item: PortalTeacherGradeItem): string {
  return `${item.course_code} - ${item.title}`;
}

export function TeacherPortalScreen({
  activeTab,
  canLoadPortal = true,
  onProfileLoaded,
  token,
  visible = true,
}: {
  activeTab: TeacherTab;
  canLoadPortal?: boolean;
  onProfileLoaded?: (profile: { profileName: string; profileMeta: string }) => void;
  token: string | null;
  visible?: boolean;
}) {
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceStatus>>(() =>
    classStudents.reduce<Record<string, AttendanceStatus>>((acc, student) => {
      acc[student.id] = student.attendanceStatus;
      return acc;
    }, {}),
  );
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>(() =>
    classStudents.reduce<Record<string, string>>((acc, student) => {
      acc[student.id] = String(student.currentScore);
      return acc;
    }, {}),
  );
  const [attendanceSaveState, setAttendanceSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const [selectedGradeItemId, setSelectedGradeItemId] = useState<number | null>(null);
  const [gradeSaveState, setGradeSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [gradeMessage, setGradeMessage] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const loadPortal = useCallback(() => {
    if (!token) {
      return Promise.reject(new Error("Missing authentication token"));
    }

    return getTeacherPortal(token);
  }, [token]);
  const portalState = usePortalData(visible && canLoadPortal && Boolean(token), loadPortal);
  const loadedPortal = useMemo(
    () => (portalState.data ? mapTeacherPortal(portalState.data) : null),
    [portalState.data],
  );
  const portal =
    loadedPortal ??
    (canUseDevelopmentFallback && (portalState.error || !canLoadPortal) ? fallbackTeacherPortal : null);
  const attendanceLesson = loadedPortal?.attendanceLessons[0] ?? null;
  const attendanceDraftKey = useMemo(() => {
    if (!attendanceLesson) {
      return "";
    }

    return `${attendanceLesson.id}:${attendanceLesson.roster
      .map((student) => `${student.student_profile_id}:${student.attendance_status ?? "present"}`)
      .join("|")}`;
  }, [attendanceLesson]);
  const gradeItems = portal?.gradeItems ?? [];
  const selectedGradeItem =
    gradeItems.find((item) => item.id === selectedGradeItemId) ?? gradeItems[0] ?? null;
  const gradeItemsKey = useMemo(
    () => gradeItems.map((item) => `${item.id}:${item.graded_count}:${item.pending_count}`).join("|"),
    [gradeItems],
  );
  const gradeDraftKey = useMemo(() => {
    if (!selectedGradeItem) {
      return "";
    }

    return `${selectedGradeItem.id}:${selectedGradeItem.roster
      .map((student) => `${student.student_profile_id}:${student.score ?? ""}:${student.comment ?? ""}`)
      .join("|")}`;
  }, [selectedGradeItem]);

  useEffect(() => {
    if (visible && loadedPortal) {
      onProfileLoaded?.({
        profileName: loadedPortal.profileName,
        profileMeta: loadedPortal.profileMeta,
      });
    }
  }, [loadedPortal, onProfileLoaded, visible]);

  useEffect(() => {
    if (!attendanceLesson) {
      return;
    }

    setAttendanceDraft(
      attendanceLesson.roster.reduce<Record<string, AttendanceStatus>>((acc, student) => {
        acc[String(student.student_profile_id)] = student.attendance_status ?? "present";
        return acc;
      }, {}),
    );
    setAttendanceSaveState("idle");
    setAttendanceMessage(null);
  }, [attendanceDraftKey, attendanceLesson]);

  useEffect(() => {
    if (!gradeItems.length) {
      setSelectedGradeItemId(null);
      return;
    }

    if (!selectedGradeItemId || !gradeItems.some((item) => item.id === selectedGradeItemId)) {
      setSelectedGradeItemId(gradeItems[0].id);
    }
  }, [gradeItems, gradeItemsKey, selectedGradeItemId]);

  useEffect(() => {
    if (!selectedGradeItem) {
      return;
    }

    setScoreDraft(
      selectedGradeItem.roster.reduce<Record<string, string>>((acc, student) => {
        acc[String(student.student_profile_id)] = scoreToDraft(student.score);
        return acc;
      }, {}),
    );
    setGradeSaveState("idle");
    setGradeMessage(null);
  }, [gradeDraftKey, selectedGradeItem]);

  function updateAttendance(studentId: string, nextStatus: AttendanceStatus) {
    setAttendanceDraft((current) => ({ ...current, [studentId]: nextStatus }));
    setAttendanceSaveState("idle");
    setAttendanceMessage(null);
  }

  async function saveAttendance() {
    if (attendanceSaveState === "saving") {
      return;
    }

    if (!attendanceLesson || !token) {
      setAttendanceSaveState("saved");
      setAttendanceMessage("Local attendance draft saved.");
      return;
    }

    const records: SubmitLessonAttendanceRecord[] = attendanceLesson.roster.map((student) => ({
      student_profile_id: student.student_profile_id,
      status: attendanceDraft[String(student.student_profile_id)] ?? student.attendance_status ?? "present",
    }));

    if (!records.length) {
      return;
    }

    setAttendanceSaveState("saving");
    setAttendanceMessage(null);

    try {
      await submitLessonAttendance(token, attendanceLesson.id, records);
      setAttendanceSaveState("saved");
      setAttendanceMessage("Attendance saved.");
      portalState.retry();
    } catch (error) {
      setAttendanceSaveState("error");
      setAttendanceMessage(toErrorMessage(error));
    }
  }

  function selectGradeItem(itemId: number) {
    setSelectedGradeItemId(itemId);
    setGradeSaveState("idle");
    setGradeMessage(null);
  }

  function updateScore(studentId: string, nextScore: string) {
    setScoreDraft((current) => ({ ...current, [studentId]: nextScore }));
    setGradeSaveState("idle");
    setGradeMessage(null);
  }

  function adjustScore(studentId: string, amount: number) {
    const maxScore = selectedGradeItem?.max_score ?? 100;
    setScoreDraft((current) => ({
      ...current,
      [studentId]: String(
        Math.min(
          maxScore,
          Math.max(
            0,
            Math.round((finiteDraftScore(current[studentId] ?? "") + amount) * 100) / 100,
          ),
        ),
      ),
    }));
    setGradeSaveState("idle");
    setGradeMessage(null);
  }

  async function saveGrades() {
    if (gradeSaveState === "saving") {
      return;
    }

    if (!selectedGradeItem || !token) {
      setGradeSaveState("saved");
      setGradeMessage("Local grade draft saved.");
      return;
    }

    const records: SubmitGradeRecord[] = [];
    for (const student of selectedGradeItem.roster) {
      const score = parseDraftScore(scoreDraft[String(student.student_profile_id)] ?? "");
      if (score === null) {
        continue;
      }

      if (Number.isNaN(score)) {
        setGradeSaveState("error");
        setGradeMessage(`Invalid score for ${student.full_name}.`);
        return;
      }

      if (score < 0 || score > selectedGradeItem.max_score) {
        setGradeSaveState("error");
        setGradeMessage(`Scores must be between 0 and ${selectedGradeItem.max_score}.`);
        return;
      }

      records.push({
        student_profile_id: student.student_profile_id,
        score,
        comment: student.comment,
      });
    }

    if (!records.length) {
      setGradeSaveState("error");
      setGradeMessage("Enter at least one score before saving.");
      return;
    }

    setGradeSaveState("saving");
    setGradeMessage(null);

    try {
      await submitGradeRecords(token, selectedGradeItem.id, records);
      setGradeSaveState("saved");
      setGradeMessage("Grades saved.");
      portalState.retry();
    } catch (error) {
      setGradeSaveState("error");
      setGradeMessage(toErrorMessage(error));
    }
  }

  if (!visible) {
    return null;
  }

  if (portalState.loading && !portal) {
    return <LoadingState />;
  }

  if (!portal) {
    return (
      <ErrorState
        message={
          portalState.error?.message ??
          "No authenticated teacher portal data is available for this account."
        }
        onRetry={portalState.retry}
      />
    );
  }

  const errorPanel = portalState.error ? (
    <ErrorState
      message={`${portalState.error.message}${canUseDevelopmentFallback ? " Showing development fallback data below." : ""}`}
      onRetry={portalState.retry}
      title="Backend teacher portal unavailable"
    />
  ) : null;
  const activeClassLabel = portal.classes[0] ? `${portal.classes[0].code} ${portal.classes[0].group}` : "No class";
  const activeGradeLabel = selectedGradeItem
    ? `${selectedGradeItem.graded_count}/${selectedGradeItem.enrolled_count} graded`
    : portal.pendingGradeItems[0]?.title ?? portal.classes[0]?.code ?? "No course";
  const activeAttendanceLabel = attendanceLesson
    ? `${attendanceLesson.course_code} ${attendanceLesson.group_name}`
    : activeClassLabel;

  if (activeTab === "classes") {
    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="Assigned classes" action={portal.classes.length ? `${portal.classes.length} groups` : "Empty"} icon={Users} />
        {portal.classes.length ? (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {portal.classes.map((item) => (
              <TeacherClassCard key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <EmptyState title="No courses" body="Assigned courses and class groups will appear here." icon={Users} />
        )}
      </View>
    );
  }

  if (activeTab === "attendance") {
    const attendanceStudents: ClassStudent[] = attendanceLesson
      ? attendanceLesson.roster.map((student) => ({
          id: String(student.student_profile_id),
          fullName: student.full_name,
          studentNumber: student.student_number,
          attendanceStatus: student.attendance_status ?? "present",
          currentScore: 0,
        }))
      : canUseDevelopmentFallback && (portalState.error || !canLoadPortal)
        ? classStudents
        : [];

    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="Attendance" action={activeAttendanceLabel} icon={ClipboardCheck} />
        {attendanceMessage && attendanceSaveState === "error" ? (
          <ErrorState
            message={attendanceMessage}
            onRetry={saveAttendance}
            title="Attendance save failed"
          />
        ) : null}
        {attendanceMessage && attendanceSaveState === "saved" ? (
          <View style={styles.statePanel}>
            <View style={styles.stateIcon}>
              <CheckCircle2 color={palette.green} size={22} strokeWidth={2.4} />
            </View>
            <View style={styles.stateBody}>
              <Text style={styles.stateTitle}>Attendance saved</Text>
              <Text style={styles.stateText}>{attendanceMessage}</Text>
            </View>
          </View>
        ) : null}
        {attendanceStudents.length ? (
          <>
            {attendanceStudents.map((student) => (
              <AttendanceRow
                key={student.id}
                statusValue={attendanceDraft[student.id] ?? student.attendanceStatus}
                student={student}
                onChange={updateAttendance}
              />
            ))}
            <PrimaryAction
              disabled={attendanceSaveState === "saving"}
              icon={Save}
              label={attendanceSaveState === "saving" ? "Saving attendance" : "Save attendance"}
              onPress={saveAttendance}
            />
          </>
        ) : (
          <EmptyState title="No roster" body="Attendance needs an assigned lesson with active students." icon={ClipboardCheck} />
        )}
      </View>
    );
  }

  if (activeTab === "grades") {
    const gradeStudents: ClassStudent[] = selectedGradeItem
      ? selectedGradeItem.roster.map((student) => ({
          id: String(student.student_profile_id),
          fullName: student.full_name,
          studentNumber: student.student_number,
          attendanceStatus: "present",
          currentScore: student.score ?? 0,
        }))
      : canUseDevelopmentFallback && (portalState.error || !canLoadPortal)
        ? classStudents
        : [];
    const maxScore = selectedGradeItem?.max_score ?? 100;

    return (
      <View style={styles.stack}>
        {errorPanel}
        <SectionHeader title="Grade entry" action={activeGradeLabel} icon={GraduationCap} />
        {gradeItems.length > 1 ? (
          <View style={styles.gradeItemSelector}>
            {gradeItems.map((item) => {
              const active = item.id === selectedGradeItem?.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => selectGradeItem(item.id)}
                  style={({ pressed }) => [
                    styles.gradeItemOption,
                    active && styles.gradeItemOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.gradeItemOptionText, active && styles.gradeItemOptionTextActive]} numberOfLines={1}>
                    {gradeItemLabel(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {gradeMessage && gradeSaveState === "error" ? (
          <ErrorState
            message={gradeMessage}
            onRetry={saveGrades}
            title="Grade save failed"
          />
        ) : null}
        {gradeMessage && gradeSaveState === "saved" ? (
          <View style={styles.statePanel}>
            <View style={styles.stateIcon}>
              <CheckCircle2 color={palette.green} size={22} strokeWidth={2.4} />
            </View>
            <View style={styles.stateBody}>
              <Text style={styles.stateTitle}>Grades saved</Text>
              <Text style={styles.stateText}>{gradeMessage}</Text>
            </View>
          </View>
        ) : null}
        {gradeStudents.length ? (
          <>
            {gradeStudents.map((student) => (
              <GradeRow
                key={student.id}
                maxScore={maxScore}
                scoreValue={scoreDraft[student.id] ?? String(student.currentScore)}
                student={student}
                onAdjust={adjustScore}
                onChange={updateScore}
              />
            ))}
            <PrimaryAction
              disabled={gradeSaveState === "saving"}
              icon={Save}
              label={gradeSaveState === "saving" ? "Saving grades" : "Publish grades"}
              onPress={saveGrades}
            />
          </>
        ) : (
          <EmptyState title="No courses" body="Grade drafts need an assigned course." icon={GraduationCap} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {errorPanel}
      <View style={[styles.grid, isWide && styles.gridWide]}>
        <StatCard icon={Users} label="Classes" value={`${portal.classes.length}`} tone="blue" />
        <StatCard icon={ClipboardCheck} label="Students" value={`${portal.totalStudents}`} tone="green" />
        <StatCard icon={FileText} label="Pending grades" value={`${portal.pendingGradeCount}`} tone="amber" />
      </View>

      <View style={[styles.split, isWide && styles.splitWide]}>
        <View style={styles.splitColumn}>
          <SectionHeader title="Next sessions" action={portal.upcomingLessons.length ? `${Math.min(portal.upcomingLessons.length, 2)} shown` : "Empty"} icon={CalendarDays} />
          {portal.upcomingLessons.length ? (
            portal.upcomingLessons.slice(0, 2).map((item) => <ScheduleRow key={item.id} item={item} compact />)
          ) : (
            <EmptyState title="No lessons" body="Upcoming lessons will appear here." icon={CalendarDays} />
          )}
        </View>
        <View style={styles.splitColumn}>
          <SectionHeader title="Announcement" action="Draft" icon={Megaphone} />
          <AnnouncementComposer value={announcementDraft} onChange={setAnnouncementDraft} />
        </View>
      </View>

      <SectionHeader title="Materials" action={portal.materials.length ? "Latest" : "Empty"} icon={FileText} />
      {portal.materials.length ? (
        portal.materials.map((item) => <MaterialRow key={item.id} item={item} />)
      ) : (
        <EmptyState title="No materials" body="Published materials for your courses will appear here." icon={FileText} />
      )}

      <SectionHeader title="Announcements" action={portal.announcements.length ? "Campus" : "Empty"} icon={Megaphone} />
      {portal.announcements.length ? (
        portal.announcements.map((announcement) => <AnnouncementRow key={announcement.id} announcement={announcement} />)
      ) : (
        <EmptyState title="No announcements" body="Teacher announcements will appear here." icon={Megaphone} />
      )}
    </View>
  );
}
