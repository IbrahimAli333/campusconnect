import { Text, View } from "react-native";

import { StatusChip } from "../common/StatusChip";
import { priorityTone } from "../common/tone";
import { styles } from "../../styles/theme";
import type { Announcement } from "../../types/portal";

export function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const tone = priorityTone(announcement.priority);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {announcement.title}
        </Text>
        <StatusChip label={announcement.priority} tone={tone} />
      </View>
      <Text style={styles.cardMeta}>{announcement.body}</Text>
      <View style={styles.footerRow}>
        <Text style={styles.smallText}>{announcement.target}</Text>
        <Text style={styles.smallText}>{announcement.dateLabel}</Text>
      </View>
    </View>
  );
}
