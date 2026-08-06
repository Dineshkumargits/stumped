import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, typography, spacing } from "../../theme";
import { IconBadge, IconName } from "./Icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

/** Friendly empty/zero-data state with icon, copy, and optional CTA. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  style,
}) => (
  <View style={[styles.container, style]}>
    <IconBadge
      name={icon}
      size={30}
      color={colors.textTertiary}
      background={colors.bgTertiary}
      style={styles.icon}
    />
    <Text style={styles.title}>{title}</Text>
    {!!description && <Text style={styles.description}>{description}</Text>}
    {action && <View style={styles.action}>{action}</View>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  icon: {
    marginBottom: spacing.base,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 280,
  },
});
