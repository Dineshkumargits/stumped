// ============================
// SCORING CONSTANTS
// ============================

/** Valid run values off the bat */
export const VALID_RUNS = [0, 1, 2, 3, 4, 6] as const;

/** Extra run added for wide */
export const WIDE_EXTRA_RUN = 1;

/** Extra run added for no-ball */
export const NO_BALL_EXTRA_RUN = 1;

/** Maximum balls in a legal over */
export const BALLS_PER_OVER = 6;

// ============================
// RATING CONSTANTS
// ============================

/** Default rating for new players (0-100 scale) */
export const DEFAULT_RATING = 50.0;

/** Rating weights by category for overall rating */
export const RATING_WEIGHTS = {
  BATSMAN: { batting: 0.8, bowling: 0.2 },
  BOWLER: { batting: 0.2, bowling: 0.8 },
  ALL_ROUNDER: { batting: 0.5, bowling: 0.5 },
} as const;

/** Rating computation weights */
export const BATTING_RATING_WEIGHTS = {
  average: 0.3,
  strikeRate: 0.25,
  consistency: 0.2,
  form: 0.25,
} as const;

export const BOWLING_RATING_WEIGHTS = {
  average: 0.3,
  economy: 0.25,
  wicketRate: 0.25,
  form: 0.2,
} as const;

/** Number of recent matches to consider for rating */
export const RATING_MATCH_WINDOW = 10;

/** Number of recent matches for form calculation */
export const FORM_MATCH_WINDOW = 5;

// ============================
// AUTO-BALANCE CONSTANTS
// ============================

/** Maximum allowed rating difference between teams (percentage) */
export const MAX_TEAM_RATING_DIFF_PERCENT = 10;

// ============================
// CLUB CONSTANTS
// ============================

/** Length of invite code */
export const INVITE_CODE_LENGTH = 6;

/** Characters used for invite code generation */
export const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusable chars I,O,0,1

// ============================
// AVATAR COLORS
// ============================

/** Pre-defined avatar background colors for initial-based avatars */
export const AVATAR_COLORS = [
  '#E53935', // Red
  '#D81B60', // Pink
  '#8E24AA', // Purple
  '#5E35B1', // Deep Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#039BE5', // Light Blue
  '#00ACC1', // Cyan
  '#00897B', // Teal
  '#43A047', // Green
  '#7CB342', // Light Green
  '#C0CA33', // Lime
  '#FDD835', // Yellow
  '#FFB300', // Amber
  '#FB8C00', // Orange
  '#F4511E', // Deep Orange
] as const;
