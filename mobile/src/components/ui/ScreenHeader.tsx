import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, typography, spacing, borderRadius } from "../../theme";
import { Icon, IconBadge, IconName } from "./Icon";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onBack?: () => void;
  right?: React.ReactNode;
}

/**
 * Consistent screen header.
 * - Tab roots: pass `icon` for a soft icon badge.
 * - Pushed screens: pass `onBack` for a circular back button instead.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  icon,
  onBack,
  right,
}) => (
  <View style={styles.container}>
    {onBack ? (
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="chevron-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
    ) : (
      icon && <IconBadge name={icon} size={20} style={styles.badge} />
    )}
    <View style={styles.textWrap}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
    </View>
    {right && <View>{right}</View>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  badge: {
    marginRight: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.round,
    backgroundColor: colors.bgTertiary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize["2xl"],
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
