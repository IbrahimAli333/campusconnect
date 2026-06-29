import { Text, View } from "react-native";

import { StatusChip } from "../common/StatusChip";
import { styles } from "../../styles/theme";
import type { ScheduleItem, ScheduleType } from "../../types/portal";

function scheduleTone(type: ScheduleType) {
  switch (type) {
    case "lab":
      return "violet" as const;
    case "seminar":
    case "practice":
      return "amber" as const;
    case "exam":
      return "red" as const;
    case "lecture":
    default:
      return "blue" as const;
  }
}

export function ScheduleRow({ compact = false, item }: { compact?: boolean; item: ScheduleItem }) {
  return (
    <View style={[styles.listRow, compact && styles.listRowCompact]}>
      <View style={styles.timeBox}>
        <Text style={styles.timeText}>{item.time}</Text>
        <Text style={styles.timeDay}>{item.day}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.room} - {item.teacher}
        </Text>
      </View>
      <StatusChip label={item.type} tone={scheduleTone(item.type)} />
    </View>
  );
}
