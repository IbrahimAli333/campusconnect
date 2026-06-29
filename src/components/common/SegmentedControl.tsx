import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Briefcase, FileText, Search, UserRound, Users } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import type { IconComponent } from "./types";

const tabLabels: Record<string, string> = {
  overview: "Overview",
  courses: "Courses",
  schedule: "Schedule",
  materials: "Materials",
  classes: "Classes",
  attendance: "Attendance",
  grades: "Grades",
  discover: "Discover",
  opportunities: "Opportunities",
  applications: "Applications",
  profile: "Profile",
  connections: "Connections",
};

const compactLabels: Record<string, string> = {
  opportunities: "Posts",
  applications: "Applied",
  profile: "Me",
  connections: "Network",
};

const tabIcons: Partial<Record<string, IconComponent>> = {
  discover: Search,
  opportunities: Briefcase,
  applications: FileText,
  profile: UserRound,
  connections: Users,
};

export function SegmentedControl<T extends string>({
  active,
  items,
  labels,
  onChange,
}: {
  active: T;
  items: T[];
  labels?: Partial<Record<T, string>>;
  onChange: (item: T) => void;
}) {
  const { width } = useWindowDimensions();
  const isPhone = width < 520;
  const isCompactNetworkNav =
    items.length === 5 && items.every((item) => ["discover", "opportunities", "applications", "profile", "connections"].includes(item));

  if (isCompactNetworkNav) {
    return (
      <View style={[styles.segmentedWrap, isPhone && styles.segmentedWrapCompact]}>
        <View style={[styles.segmentedGrid, isPhone && styles.segmentedGridCompact]}>
          {items.map((item) => {
            const isActive = item === active;
            const label = labels?.[item] ?? compactLabels[item] ?? tabLabels[item] ?? item;
            const Icon = tabIcons[item];

            return (
              <Pressable
                accessibilityRole="tab"
                key={item}
                onPress={() => onChange(item)}
                style={({ pressed }) => [
                  styles.segmentedItem,
                  styles.segmentedItemCompact,
                  isPhone && styles.segmentedItemPhone,
                  isActive && styles.segmentedItemActive,
                  pressed && styles.pressed,
                ]}
              >
                {Icon ? (
                  <Icon
                    color={isActive ? palette.charcoal : palette.muted}
                    size={isPhone ? 14 : 15}
                    strokeWidth={2.5}
                  />
                ) : null}
                <Text
                  style={[
                    styles.segmentedText,
                    styles.segmentedTextCompact,
                    isPhone && styles.segmentedTextPhone,
                    isActive && styles.segmentedTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentedWrap}>
      {items.map((item) => {
        const isActive = item === active;
        const label = labels?.[item] ?? tabLabels[item] ?? item;
        return (
          <Pressable
            accessibilityRole="tab"
            key={item}
            onPress={() => onChange(item)}
            style={({ pressed }) => [styles.segmentedItem, isActive && styles.segmentedItemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentedText, isActive && styles.segmentedTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
