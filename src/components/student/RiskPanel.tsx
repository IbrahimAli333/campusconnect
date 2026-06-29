import { Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import type { Course } from "../../types/portal";

export function RiskPanel({ courses }: { courses: Course[] }) {
  const riskCourse = courses.find((course) => course.status === "at_risk");
  return (
    <View style={styles.alertPanel}>
      <View style={styles.alertIcon}>
        <ShieldCheck color={palette.amber} size={20} strokeWidth={2.4} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{riskCourse?.title ?? "No active risks"}</Text>
        <Text style={styles.rowMeta}>Attendance {riskCourse?.attendancePercent ?? 100}% - latest portal data</Text>
      </View>
    </View>
  );
}
