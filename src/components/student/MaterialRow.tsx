import { Text, View } from "react-native";
import { Download, FileText } from "lucide-react-native";

import { IconButton } from "../common/IconButton";
import { palette, styles } from "../../styles/theme";
import type { MaterialItem } from "../../types/portal";

export function MaterialRow({ item }: { item: MaterialItem }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.documentIcon}>
        <FileText color={palette.blue} size={20} strokeWidth={2.4} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta}>
          {item.courseCode} - {item.kind}
          {item.dueLabel ? ` - ${item.dueLabel}` : ""}
        </Text>
      </View>
      <IconButton accessibilityLabel="Download material" icon={Download} />
    </View>
  );
}
