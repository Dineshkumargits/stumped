import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { create } from "zustand";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, borderRadius, spacing, shadows } from "../../theme";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

type AlertTone = "success" | "error" | "warning" | "info" | "question";

interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  tone: AlertTone;
}

interface AlertState {
  queue: AlertRequest[];
  push: (req: AlertRequest) => void;
  shift: () => void;
}

const useAlertStore = create<AlertState>((set) => ({
  queue: [],
  push: (req) => set((s) => ({ queue: [...s.queue, req] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

let nextId = 1;

/** Infer a visual tone from the alert content so existing call sites
 *  get a fitting icon without any changes. */
function inferTone(title: string, buttons: AlertButton[]): AlertTone {
  if (buttons.some((b) => b.style === "destructive")) return "question";
  if (/success|recorded|created|joined|linked|unlinked|started/i.test(title)) return "success";
  if (/error|fail|invalid/i.test(title)) return "error";
  if (/required|validation|warning|selection|active match/i.test(title)) return "warning";
  if (/confirm|undo|sure|\?/i.test(title)) return "question";
  return "info";
}

const TONE_META: Record<AlertTone, { icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }> = {
  success: { icon: "checkmark-circle", color: colors.success, soft: colors.accentPrimarySoft },
  error: { icon: "close-circle", color: colors.error, soft: colors.accentDangerSoft },
  warning: { icon: "alert-circle", color: colors.warning, soft: colors.accentSecondarySoft },
  info: { icon: "information-circle", color: colors.info, soft: colors.infoSoft },
  question: { icon: "help-circle", color: colors.warning, soft: colors.accentSecondarySoft },
};

/**
 * Drop-in replacement for React Native's Alert with a themed modal.
 * Same call signature: Alert.alert(title, message?, buttons?)
 * Requires <AlertHost /> to be mounted once at the app root.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const finalButtons: AlertButton[] =
      buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
    useAlertStore.getState().push({
      id: nextId++,
      title,
      message,
      buttons: finalButtons,
      tone: inferTone(title, finalButtons),
    });
  },
};

export const AlertHost: React.FC = () => {
  const current = useAlertStore((s) => s.queue[0]);
  const shift = useAlertStore((s) => s.shift);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (current) {
      scale.setValue(0.9);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 24,
          bounciness: 6,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [current?.id]);

  if (!current) return null;

  const meta = TONE_META[current.tone];

  const dismissWith = (btn?: AlertButton) => {
    shift();
    if (btn?.onPress) btn.onPress();
  };

  const handleBackdrop = () => {
    // Single-button alerts behave like tapping the button;
    // otherwise fall back to the cancel action (or plain dismiss).
    if (current.buttons.length === 1) {
      dismissWith(current.buttons[0]);
    } else {
      dismissWith(current.buttons.find((b) => b.style === "cancel"));
    }
  };

  const stacked =
    current.buttons.length > 2 ||
    current.buttons.some((b) => b.text.length > 14);

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={handleBackdrop}>
      <Pressable style={styles.backdrop} onPress={handleBackdrop}>
        <Animated.View style={{ transform: [{ scale }], opacity, width: "100%", alignItems: "center" }}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={[styles.iconBadge, { backgroundColor: meta.soft }]}>
              <Ionicons name={meta.icon} size={34} color={meta.color} />
            </View>

            <Text style={styles.title}>{current.title}</Text>
            {!!current.message && (
              <Text style={styles.message}>{current.message}</Text>
            )}

            <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
              {current.buttons.map((btn, idx) => {
                const isDestructive = btn.style === "destructive";
                const isCancel = btn.style === "cancel";
                return (
                  <Pressable
                    key={idx}
                    onPress={() => dismissWith(btn)}
                    style={({ pressed }) => [
                      styles.button,
                      stacked ? styles.buttonStacked : styles.buttonFlex,
                      isDestructive && styles.buttonDestructive,
                      isCancel && styles.buttonCancel,
                      !isDestructive && !isCancel && styles.buttonPrimary,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && { color: colors.white },
                        isCancel && { color: colors.textSecondary },
                        !isDestructive && !isCancel && { color: colors.textInverse },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.elevated,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  message: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: "100%",
  },
  buttonColumn: {
    flexDirection: "column",
  },
  button: {
    minHeight: 46,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonStacked: {
    width: "100%",
  },
  buttonPrimary: {
    backgroundColor: colors.accentPrimary,
  },
  buttonDestructive: {
    backgroundColor: colors.accentDanger,
  },
  buttonCancel: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.base,
    letterSpacing: 0.3,
  },
});
