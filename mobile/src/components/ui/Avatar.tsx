import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, typography, borderRadius } from "../../theme";

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  style?: ViewStyle;
}

/**
 * Initial-based avatar (like Google's colored circles).
 * Displays the first letter of the name on a colored background.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 40,
  style,
}) => {
  const initial = name.charAt(0).toUpperCase();
  const fontSize = size * 0.42;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: Math.max(1.5, size * 0.04),
          borderColor: 'rgba(255,255,255,0.18)',
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  initial: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
});
