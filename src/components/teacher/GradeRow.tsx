import { Pressable, Text, TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import type { ClassStudent } from "../../types/portal";

export function GradeRow({
  maxScore,
  onAdjust,
  onChange,
  scoreValue,
  student,
}: {
  maxScore: number;
  onAdjust: (studentId: string, amount: number) => void;
  onChange: (studentId: string, nextScore: string) => void;
  scoreValue: string;
  student: ClassStudent;
}) {
  return (
    <View style={styles.studentRow}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {student.fullName}
        </Text>
        <Text style={styles.rowMeta}>
          {student.studentNumber} - Max {maxScore}
        </Text>
      </View>
      <View style={styles.scoreEditor}>
        <Pressable accessibilityRole="button" onPress={() => onAdjust(student.id, -1)} style={styles.scoreButton}>
          <Minus color={palette.text} size={16} strokeWidth={2.6} />
        </Pressable>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(text) => onChange(student.id, text)}
          selectTextOnFocus
          style={styles.scoreInput}
          value={scoreValue}
        />
        <Pressable accessibilityRole="button" onPress={() => onAdjust(student.id, 1)} style={styles.scoreButton}>
          <Plus color={palette.text} size={16} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}
