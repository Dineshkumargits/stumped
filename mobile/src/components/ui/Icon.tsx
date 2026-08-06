import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/** Thin wrapper over Ionicons so screens never import the icon lib directly. */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = colors.textPrimary,
  style,
}) => <Ionicons name={name} size={size} color={color} style={style as any} />;

interface IconBadgeProps {
  name: IconName;
  size?: number;
  color?: string;
  background?: string;
  style?: ViewStyle;
}

/** Icon inside a soft rounded badge — used for headers, empty states, list rows. */
export const IconBadge: React.FC<IconBadgeProps> = ({
  name,
  size = 22,
  color = colors.accentPrimary,
  background = colors.accentPrimarySoft,
  style,
}) => (
  <View
    style={[
      styles.badge,
      {
        width: size * 2,
        height: size * 2,
        borderRadius: size,
        backgroundColor: background,
      },
      style,
    ]}
  >
    <Ionicons name={name} size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  badge: {
    justifyContent: "center",
    alignItems: "center",
  },
});
