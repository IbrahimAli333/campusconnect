import { Text, View } from "react-native";

import { Metric } from "../common/Metric";
import { StatusChip } from "../common/StatusChip";
import { styles } from "../../styles/theme";
import type { TeacherClass } from "../../types/portal";

export function TeacherClassCard({ compact = false, item }: { compact?: boolean; item: TeacherClass }) {
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.eyebrow}>
            {item.code} - {item.group}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <StatusChip label={item.attendanceOpen ? "Open" : "Closed"} tone={item.attendanceOpen ? "green" : "slate"} />
      </View>
      <View style={styles.metricRow}>
        <Metric label="Students" value={`${item.studentsCount}`} />
        <Metric label="Room" value={item.room} />
        <Metric label="Grades" value={`${item.pendingGrades}`} />
      </View>
      <Text style={styles.cardMeta}>{item.nextLesson}</Text>
    </View>
  );
}
