import { Text, View } from "react-native";

import { Metric } from "../common/Metric";
import { StatusChip } from "../common/StatusChip";
import { courseStatus } from "../common/tone";
import { styles } from "../../styles/theme";
import type { Course } from "../../types/portal";

export function CourseCard({ course }: { course: Course }) {
  const status = courseStatus(course.status);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.eyebrow}>{course.code}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {course.title}
          </Text>
        </View>
        <StatusChip label={status.label} tone={status.tone} />
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {course.teacher}
      </Text>
      <View style={styles.metricRow}>
        <Metric label="Credits" value={`${course.credits}`} />
        <Metric label="Grade" value={`${course.currentGrade}`} />
        <Metric label="Attend" value={`${course.attendancePercent}%`} />
      </View>
    </View>
  );
}
