import { z } from 'zod';
import { MemberRole, PlayerCategory, Team, TossDecision, WicketType } from '../enums/index.js';

// ============================
// AUTH VALIDATORS
// ============================

export const googleSignInSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

// ============================
// CLUB VALIDATORS
// ============================

export const createClubSchema = z.object({
  name: z.string().min(2, 'Club name must be at least 2 characters').max(50, 'Club name too long').trim(),
});

export const joinClubSchema = z.object({
  inviteCode: z.string().length(6, 'Invite code must be 6 characters').toUpperCase(),
});

export const updateMemberRoleSchema = z.object({
  clubId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(MemberRole),
});

export const removeMemberSchema = z.object({
  clubId: z.string().uuid(),
  userId: z.string().uuid(),
});

// ============================
// PLAYER VALIDATORS
// ============================

export const createPlayerSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(1, 'Player name is required').max(50, 'Player name too long').trim(),
  category: z.nativeEnum(PlayerCategory),
});

export const updatePlayerSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  category: z.nativeEnum(PlayerCategory).optional(),
});

export const overrideRatingSchema = z.object({
  battingRating: z.number().min(0).max(100),
  bowlingRating: z.number().min(0).max(100),
});

// ============================
// MATCH VALIDATORS
// ============================

export const createMatchSchema = z.object({
  clubId: z.string().uuid(),
  totalOvers: z.number().int().min(1, 'At least 1 over').max(50, 'Maximum 50 overs'),
  teamAName: z.string().min(1).max(30).trim().default('Team A'),
  teamBName: z.string().min(1).max(30).trim().default('Team B'),
  seriesId: z.string().uuid().optional(),
  players: z.array(z.object({
    playerId: z.string().uuid(),
    team: z.nativeEnum(Team),
    battingOrder: z.number().int().min(1).optional(),
    // Player is also eligible to bat/bowl for the opposite team (odd-count matches).
    isDoubleSided: z.boolean().optional().default(false),
  })).min(2, 'At least 2 players required')
    .refine(
      (players) => players.filter((p) => p.isDoubleSided).length <= 1,
      { message: 'Only one player can be marked as double-sided per match.' },
    ),
});

export const autoBalanceSchema = z.object({
  clubId: z.string().uuid(),
  playerIds: z.array(z.string().uuid()).min(2, 'At least 2 players required'),
  // When true, randomizes tie-breaking within each rating group so repeated
  // calls produce different (but still balanced) pairings.
  reshuffle: z.boolean().optional().default(false),
});

export const recordTossSchema = z.object({
  matchId: z.string().uuid(),
  winner: z.nativeEnum(Team),
  decision: z.nativeEnum(TossDecision),
});

// ============================
// SCORING VALIDATORS
// ============================

export const recordBallSchema = z.object({
  inningsId: z.string().uuid(),
  batsmanId: z.string().uuid(),
  bowlerId: z.string().uuid(),
  nonStrikerId: z.string().uuid(),
  runs: z.number().int().min(0).max(6),
  isWide: z.boolean().default(false),
  isNoBall: z.boolean().default(false),
  isWicket: z.boolean().default(false),
  wicketType: z.nativeEnum(WicketType).optional(),
  dismissedPlayerId: z.string().uuid().optional(),
}).refine(
  (data) => !data.isWicket || (data.wicketType !== undefined && data.dismissedPlayerId !== undefined),
  { message: 'Wicket type and dismissed player are required when isWicket is true' }
);

export const selectBowlerSchema = z.object({
  inningsId: z.string().uuid(),
  bowlerId: z.string().uuid(),
});

export const undoBallSchema = z.object({
  inningsId: z.string().uuid(),
});

// ============================
// SERIES VALIDATORS
// ============================

export const createSeriesSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(1).max(100).trim(),
  date: z.string().datetime(),
});

// ============================
// STATS VALIDATORS
// ============================

export const leaderboardQuerySchema = z.object({
  clubId: z.string().uuid(),
  metric: z.enum(['runs', 'wickets', 'battingAvg', 'bowlingAvg', 'strikeRate', 'economy']),
  limit: z.number().int().min(1).max(50).default(10),
});

export const playerFormSchema = z.object({
  playerId: z.string().uuid(),
  lastN: z.number().int().min(1).max(20).default(5),
});

export const headToHeadSchema = z.object({
  playerAId: z.string().uuid(),
  playerBId: z.string().uuid(),
});

// Export types inferred from schemas
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type JoinClubInput = z.infer<typeof joinClubSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
export type OverrideRatingInput = z.infer<typeof overrideRatingSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type AutoBalanceInput = z.infer<typeof autoBalanceSchema>;
export type RecordTossInput = z.infer<typeof recordTossSchema>;
export type RecordBallInput = z.infer<typeof recordBallSchema>;
export type SelectBowlerInput = z.infer<typeof selectBowlerSchema>;
export type UndoBallInput = z.infer<typeof undoBallSchema>;
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
export type PlayerFormInput = z.infer<typeof playerFormSchema>;
export type HeadToHeadInput = z.infer<typeof headToHeadSchema>;
