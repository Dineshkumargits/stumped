import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { colors, typography } from "../../theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export type CelebrationType = "four" | "six";

interface CelebrationProps {
  type: CelebrationType;
  onDone: () => void;
}

/**
 * Per-tier config so a SIX celebrates harder than a FOUR ("weightage"):
 * more particles, richer palette, a screen flash, a bigger banner and a
 * longer runtime.
 */
const CONFIG = {
  four: {
    label: "FOUR!",
    sublabel: "Cracking boundary",
    accent: colors.scoreFour,
    particleCount: 18,
    emojis: ["🏏", "💥", "⚡", "👏"],
    confettiColors: [colors.scoreFour, colors.accentPrimary, colors.white],
    duration: 1150,
    reach: SCREEN_H * 0.34,
    flash: false,
    bannerSize: 52,
  },
  six: {
    label: "SIX!",
    sublabel: "Maximum over the turf",
    accent: colors.scoreSix,
    particleCount: 34,
    emojis: ["🚀", "🔥", "💥", "🎉", "⭐", "🙌"],
    confettiColors: [
      colors.scoreSix,
      colors.accentSecondary,
      colors.white,
      colors.accentPrimary,
    ],
    duration: 1650,
    reach: SCREEN_H * 0.48,
    flash: true,
    bannerSize: 70,
  },
} as const;

const ORIGIN_X = SCREEN_W / 2;
const ORIGIN_Y = SCREEN_H * 0.4;

export const Celebration: React.FC<CelebrationProps> = ({ type, onDone }) => {
  const cfg = CONFIG[type];

  // Each particle gets a randomized angle, distance, spin and start delay so
  // the burst never looks mechanical.
  const particles = useMemo(
    () =>
      Array.from({ length: cfg.particleCount }).map((_, i) => {
        const angle =
          (Math.PI * 2 * i) / cfg.particleCount + (Math.random() - 0.5) * 0.6;
        const distance = cfg.reach * (0.45 + Math.random() * 0.55);
        const useEmoji = Math.random() < 0.55;
        return {
          angle,
          distance,
          emoji: useEmoji
            ? cfg.emojis[Math.floor(Math.random() * cfg.emojis.length)]
            : null,
          color:
            cfg.confettiColors[
              Math.floor(Math.random() * cfg.confettiColors.length)
            ],
          size: 14 + Math.random() * 16,
          rotateTo: (Math.random() - 0.5) * 720,
          delay: Math.random() * 130,
          // slight upward bias so particles arc up as they fly out
          rise: 40 + Math.random() * 90,
        };
      }),
    // cfg is stable for this mount (component is remounted per burst via key)
    [],
  );

  const progressValues = useRef(particles.map(() => new Animated.Value(0)))
    .current;
  const banner = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const particleAnims = progressValues.map((v, i) =>
      Animated.sequence([
        Animated.delay(particles[i].delay),
        Animated.timing(v, {
          toValue: 1,
          duration: cfg.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    const bannerAnim = Animated.sequence([
      Animated.spring(banner, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
      }),
      Animated.delay(cfg.duration - 550),
      Animated.timing(banner, {
        toValue: 2,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const flashAnim = cfg.flash
      ? Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(flash, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      : Animated.delay(0);

    Animated.parallel([...particleAnims, bannerAnim, flashAnim]).start(
      ({ finished }) => {
        if (finished) onDone();
      },
    );
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Banner: 0 -> pop in (1) -> fade/scale out (2)
  const bannerScale = banner.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.5, 1, 1.15],
  });
  const bannerOpacity = banner.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 0],
  });
  const glowScale = banner.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.3, 1.1, 1.4],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cfg.flash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: cfg.accent,
              opacity: flash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.22],
              }),
            },
          ]}
        />
      )}

      {/* Particle burst */}
      {particles.map((p, i) => {
        const v = progressValues[i];
        const translateX = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.distance],
        });
        const translateY = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.distance - p.rise],
        });
        const scale = v.interpolate({
          inputRange: [0, 0.16, 1],
          outputRange: [0.3, 1, 0.85],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.14, 0.72, 1],
          outputRange: [0, 1, 1, 0],
        });
        const rotate = v.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${p.rotateTo}deg`],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: ORIGIN_X,
              top: ORIGIN_Y,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }, { rotate }],
            }}
          >
            {p.emoji ? (
              <Text style={{ fontSize: p.size }}>{p.emoji}</Text>
            ) : (
              <View
                style={{
                  width: p.size * 0.7,
                  height: p.size * 0.7,
                  borderRadius: 3,
                  backgroundColor: p.color,
                }}
              />
            )}
          </Animated.View>
        );
      })}

      {/* Center banner */}
      <View style={styles.bannerWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: cfg.accent,
              opacity: bannerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.35],
              }),
              transform: [{ scale: glowScale }],
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.bannerText,
            {
              color: cfg.accent,
              fontSize: cfg.bannerSize,
              opacity: bannerOpacity,
              transform: [{ scale: bannerScale }],
            },
          ]}
        >
          {cfg.label}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.bannerSub,
            { opacity: bannerOpacity, transform: [{ scale: bannerScale }] },
          ]}
        >
          {cfg.sublabel}
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: SCREEN_H * 0.32,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  bannerText: {
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bannerSub: {
    marginTop: 4,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
});
