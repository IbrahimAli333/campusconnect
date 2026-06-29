import { Text, View } from "react-native";

import { styles } from "../../styles/theme";
import { getTone, type StatTone } from "./tone";
import type { IconComponent } from "./types";

export function StatCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: IconComponent;
  label: string;
  tone: StatTone;
  value: string;
}) {
  const toneStyle = getTone(tone);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: toneStyle.soft }]}>
        <Icon color={toneStyle.strong} size={20} strokeWidth={2.4} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
