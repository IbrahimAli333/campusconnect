import { Text, View } from "react-native";

import { styles } from "../../styles/theme";
import { chipTone, type ChipTone } from "./tone";

export function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
  const colors = chipTone(tone);
  return (
    <View style={[styles.chip, { backgroundColor: colors.soft, borderColor: colors.border }]}>
      <Text style={[styles.chipText, { color: colors.strong }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
