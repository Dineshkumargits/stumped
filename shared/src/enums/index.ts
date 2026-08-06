// ============================
// ENUMS - Used across mobile & backend
// ============================

export enum MemberRole {
  ADMIN = 'ADMIN',
  SCORER = 'SCORER',
  PLAYER = 'PLAYER',
}

export enum PlayerCategory {
  BATSMAN = 'BATSMAN',
  BOWLER = 'BOWLER',
  ALL_ROUNDER = 'ALL_ROUNDER',
}

export enum Team {
  TEAM_A = 'TEAM_A',
  TEAM_B = 'TEAM_B',
}

export enum TossDecision {
  BAT = 'BAT',
  BOWL = 'BOWL',
}

export enum MatchStatus {
  SETUP = 'SETUP',
  TOSS = 'TOSS',
  FIRST_INNINGS = 'FIRST_INNINGS',
  SECOND_INNINGS = 'SECOND_INNINGS',
  COMPLETED = 'COMPLETED',
}

export enum WicketType {
  BOWLED = 'BOWLED',
  CAUGHT = 'CAUGHT',
  RUN_OUT = 'RUN_OUT',
  STUMPED = 'STUMPED',
  HIT_WICKET = 'HIT_WICKET',
  RETIRED = 'RETIRED',
}

export enum AwardType {
  MOM = 'MOM',
  TOP_SCORER = 'TOP_SCORER',
  TOP_WICKET_TAKER = 'TOP_WICKET_TAKER',
  BEST_BATTING_AVG = 'BEST_BATTING_AVG',
  BEST_BOWLING_AVG = 'BEST_BOWLING_AVG',
}
