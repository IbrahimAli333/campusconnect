import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import { headingProps } from "./a11y";
import type { IconComponent } from "./types";

export function SectionHeader({ action, icon: Icon, title }: { action: string; icon: IconComponent; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Icon color={palette.teal} size={18} strokeWidth={2.4} />
        <Text {...headingProps(2)} style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      <View style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{action}</Text>
        <ChevronRight color={palette.faint} size={16} strokeWidth={2.6} />
      </View>
    </View>
  );
}
