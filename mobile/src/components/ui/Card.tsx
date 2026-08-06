import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import {
  colors,
  typography,
  borderRadius,
  spacing,
  shadows,
} from "../../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated = false,
}) => (
  <View style={[styles.card, elevated && shadows.elevated, style]}>
    {children}
  </View>
);

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  right,
}) => (
  <View style={styles.header}>
    <View style={styles.headerText}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {right && <View>{right}</View>}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
});
