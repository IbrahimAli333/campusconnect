import { Pressable, Text, View } from "react-native";

import { attendanceLabels } from "./attendanceLabels";
import { styles } from "../../styles/theme";
import type { AttendanceStatus, ClassStudent } from "../../types/portal";

export function AttendanceRow({
  onChange,
  statusValue,
  student,
}: {
  onChange: (studentId: string, nextStatus: AttendanceStatus) => void;
  statusValue: AttendanceStatus;
  student: ClassStudent;
}) {
  return (
    <View style={styles.studentRow}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {student.fullName}
        </Text>
        <Text style={styles.rowMeta}>{student.studentNumber}</Text>
      </View>
      <View style={styles.attendanceButtons}>
        {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((status) => {
          const active = status === statusValue;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={attendanceLabels[status]}
              key={status}
              onPress={() => onChange(student.id, status)}
              style={({ pressed }) => [
                styles.attendanceButton,
                active && styles.attendanceButtonActive,
                status === "late" && active && styles.attendanceButtonLate,
                status === "absent" && active && styles.attendanceButtonAbsent,
                status === "excused" && active && styles.attendanceButtonExcused,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.attendanceButtonText, active && styles.attendanceButtonTextActive]}>
                {attendanceLabels[status][0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
