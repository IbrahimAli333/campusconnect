import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react-native";

import { palette, styles } from "../../styles/theme";
import type { IconComponent } from "./types";

export function LoadingState({
  body,
  label = "Loading CampusConnect data",
}: {
  body?: string;
  label?: string;
}) {
  return (
    <View style={styles.statePanel}>
      <View style={styles.stateIcon}>
        <ActivityIndicator color={palette.teal} size="small" />
      </View>
      <View style={styles.stateBody}>
        <Text style={styles.stateTitle}>{label}</Text>
        {body ? <Text style={styles.stateText}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = "Could not load CampusConnect data",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <View style={[styles.statePanel, styles.errorPanel]}>
      <View style={[styles.stateIcon, styles.errorIcon]}>
        <AlertCircle color={palette.red} size={22} strokeWidth={2.4} />
      </View>
      <View style={styles.stateBody}>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateText}>{message}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <RefreshCw color={palette.surface} size={16} strokeWidth={2.6} />
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  body,
  icon: Icon = Inbox,
  title,
}: {
  body?: string;
  icon?: IconComponent;
  title: string;
}) {
  return (
    <View style={styles.statePanel}>
      <View style={styles.stateIcon}>
        <Icon color={palette.faint} size={22} strokeWidth={2.4} />
      </View>
      <View style={styles.stateBody}>
        <Text style={styles.stateTitle}>{title}</Text>
        {body ? <Text style={styles.stateText}>{body}</Text> : null}
      </View>
    </View>
  );
}
