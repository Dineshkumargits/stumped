/**
 * Stumped Design System — v2 "Night Turf"
 * A refined dark theme: graphite-navy surfaces, emerald primary,
 * warm gold highlights, and soft depth instead of hard borders.
 */

import { Platform } from 'react-native';

export const colors = {
  // Backgrounds — layered graphite navy
  bgPrimary: '#0B0F1A',        // App canvas (near-black navy)
  bgSecondary: '#141A2A',      // Cards, sheets, elevated surfaces
  bgTertiary: '#1D2537',       // Inputs, chips, inactive controls
  bgElevated: '#232D44',       // Pressed / hovered surfaces
  bgOverlay: 'rgba(4, 6, 12, 0.72)', // Modal scrim

  // Accents
  accentPrimary: '#2BD576',    // Emerald — primary actions, success
  accentPrimaryDark: '#1FAB5E',
  accentPrimarySoft: 'rgba(43, 213, 118, 0.12)', // tints, active chips
  accentSecondary: '#F5C542',  // Gold — awards, ratings, highlights
  accentSecondarySoft: 'rgba(245, 197, 66, 0.12)',
  accentDanger: '#FF6B6B',     // Wickets, errors, destructive
  accentDangerDark: '#E04848',
  accentDangerSoft: 'rgba(255, 107, 107, 0.12)',

  // Text
  textPrimary: '#F4F7FB',
  textSecondary: '#9AA7BD',
  textTertiary: '#5F6C84',
  textInverse: '#0B0F1A',

  // Borders — hairlines, kept subtle
  border: '#232C41',
  borderLight: '#313D5C',

  // Score highlights
  scoreDot: '#5F6C84',
  scoreOne: '#9AA7BD',
  scoreTwo: '#B9C4D6',
  scoreThree: '#7BD88F',
  scoreFour: '#4DA3FF',
  scoreFourSoft: 'rgba(77, 163, 255, 0.14)',
  scoreSix: '#C77DFF',
  scoreSixSoft: 'rgba(199, 125, 255, 0.14)',

  // Extras
  extraWide: '#F5C542',
  extraNoBall: '#FF9F43',

  // Wicket
  wicket: '#FF6B6B',

  // Functional
  success: '#2BD576',
  warning: '#F5C542',
  error: '#FF6B6B',
  info: '#4DA3FF',
  infoSoft: 'rgba(77, 163, 255, 0.12)',

  // Transparent
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const typography = {
  fontFamily: {
    regular: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    medium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    semiBold: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    bold: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed-bold',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
    '5xl': 48,
    score: 56,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  round: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  }),
} as const;
