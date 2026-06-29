import { Text, View } from "react-native";

import { StatusChip } from "../common/StatusChip";
import { attendanceLabels } from "./attendanceLabels";
import { styles } from "../../styles/theme";
import type { AttendanceStatus, ClassStudent } from "../../types/portal";

export function StudentWatchRow({ statusValue, student }: { statusValue: AttendanceStatus; student: ClassStudent }) {
  const tone = statusValue === "absent" ? "red" : statusValue === "late" ? "amber" : student.currentScore < 70 ? "red" : "amber";
  return (
    <View style={styles.listRow}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {student.fullName}
        </Text>
        <Text style={styles.rowMeta}>
          Score {student.currentScore} - {attendanceLabels[statusValue]}
        </Text>
      </View>
      <StatusChip label={tone === "red" ? "High" : "Watch"} tone={tone} />
    </View>
  );
}
