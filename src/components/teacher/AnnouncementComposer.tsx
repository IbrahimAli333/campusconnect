import { TextInput, View } from "react-native";
import { Megaphone, Search } from "lucide-react-native";

import { PrimaryAction } from "../common/PrimaryAction";
import { palette, styles } from "../../styles/theme";

export function AnnouncementComposer({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return (
    <View style={styles.composer}>
      <View style={styles.searchRow}>
        <Search color={palette.faint} size={18} strokeWidth={2.2} />
        <TextInput
          onChangeText={onChange}
          placeholder="Announcement title"
          placeholderTextColor={palette.faint}
          style={styles.textInput}
          value={value}
        />
      </View>
      <PrimaryAction icon={Megaphone} label="Post announcement" />
    </View>
  );
}
