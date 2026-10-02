import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { decorativeProps } from "../common/a11y";
import type { IconComponent } from "../common/types";
import { fonts, palette, radii, webInputReset } from "../../styles/theme";

/**
 * Labelled text field for the auth forms: 52pt frame with a 3:1
 * `fieldBorder` boundary that turns into a 2px Caspian ring while focused
 * (the browser outline on the inner input is reset in favour of it).
 */
export function AuthField({
  icon: Icon,
  label,
  onBlur,
  onFocus,
  style,
  trailing,
  ...inputProps
}: TextInputProps & {
  icon?: IconComponent;
  label: string;
  trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.frame, focused && fieldStyles.frameFocused]}>
        {Icon ? (
          <View {...decorativeProps} style={fieldStyles.leadingIcon}>
            <Icon color={focused ? palette.caspian : palette.muted} size={18} strokeWidth={2.2} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={palette.faint}
          {...inputProps}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          style={[fieldStyles.input, style]}
        />
        {trailing}
      </View>
    </View>
  );
}

/** Show/hide password button with a 44x44 target inside the field frame. */
export function PasswordVisibilityToggle({
  hideLabel,
  onToggle,
  showLabel,
  visible,
}: {
  hideLabel: string;
  onToggle: () => void;
  showLabel: string;
  visible: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={visible ? hideLabel : showLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onToggle}
      style={({ pressed }) => [fieldStyles.toggle, pressed && fieldStyles.togglePressed]}
    >
      {visible ? (
        <EyeOff color={palette.muted} size={19} strokeWidth={2.2} />
      ) : (
        <Eye color={palette.muted} size={19} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

const fieldStyles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    color: palette.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  frame: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    minWidth: 0,
    paddingLeft: 15,
    paddingRight: 4,
  },
  frameFocused: {
    borderColor: palette.caspian,
    borderWidth: 2,
    // Keeps the content from shifting when the border thickens.
    paddingLeft: 14,
    paddingRight: 3,
  },
  leadingIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 48,
    minWidth: 0,
    paddingRight: 10,
    ...webInputReset(),
  },
  toggle: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  togglePressed: {
    backgroundColor: palette.surfaceAlt,
  },
});
