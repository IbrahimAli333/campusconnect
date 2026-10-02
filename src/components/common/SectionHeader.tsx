import { Text, View } from "react-native";

import { palette, styles } from "../../styles/theme";
import { headingProps } from "./a11y";
import type { IconComponent } from "./types";

// The action text is a count/status label, not a link, so it is shown as a
// quiet pill without a chevron that would suggest it can be tapped.
export function SectionHeader({ action, icon: Icon, title }: { action: string; icon: IconComponent; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Icon color={palette.caspian} size={19} strokeWidth={2.4} />
        <Text {...headingProps(2)} style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      <View style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{action}</Text>
      </View>
    </View>
  );
}
