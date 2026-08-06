import React, { useRef } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors, typography, borderRadius, spacing } from "../../theme";
import { Icon, IconName } from "./Icon";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "gold";
  size?: "sm" | "md" | "lg" | "xl";
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const bgColor = {
    primary: colors.accentPrimary,
    secondary: colors.bgTertiary,
    danger: colors.accentDanger,
    ghost: colors.transparent,
    gold: colors.accentSecondary,
  }[variant];

  const textColor = {
    primary: colors.textInverse,
    secondary: colors.textPrimary,
    danger: colors.white,
    ghost: colors.accentPrimary,
    gold: colors.textInverse,
  }[variant];

  const height = {
    sm: 38,
    md: 48,
    lg: 54,
    xl: 58,
  }[size];

  const fontSize = {
    sm: typography.fontSize.sm,
    md: typography.fontSize.base,
    lg: typography.fontSize.md,
    xl: typography.fontSize.lg,
  }[size];

  const finalTextColor = (textStyle?.color as string) || textColor;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: bgColor,
            height,
            opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
            borderWidth: variant === "ghost" ? 1 : 0,
            borderColor: variant === "ghost" ? colors.borderLight : undefined,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={finalTextColor} size="small" />
        ) : (
          <>
            {icon && (
              <Icon
                name={icon}
                size={fontSize + 3}
                color={finalTextColor}
                style={{ marginRight: spacing.sm } as any}
              />
            )}
            <Text style={[styles.text, { color: textColor, fontSize }, textStyle]}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  fullWidth: {
    width: "100%",
  },
  text: {
    fontFamily: typography.fontFamily.semiBold,
    letterSpacing: 0.4,
  },
});
