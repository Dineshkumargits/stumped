import {
  MemberRole,
  PlayerCategory,
  Team,
  TossDecision,
  MatchStatus,
  WicketType,
  AwardType,
} from '../enums/index.js';

// ============================
// USER & AUTH
// ============================

export interface User {
  id: string;
  email: string;
  name: string;
  googleId: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// ============================
// CLUB & MEMBERSHIP
// ============================

export interface Club {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface ClubMember {
  id: string;
  userId: string;
  clubId: string;
  role: MemberRole;
  joinedAt: string;
  user?: User;
}

// ============================
// PLAYER
// ============================

export interface Player {
  id: string;
  clubId: string;
  name: string;
  category: PlayerCategory;
  battingRating: number;
  bowlingRating: number;
  overallRating: number;
  isRatingManual: boolean;
  linkedUserId: string | null;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

// ============================
// MATCH
// ============================

export interface Match {
  id: string;
  clubId: string;
  seriesId: string | null;
  totalOvers: number;
  teamAName: string;
  teamBName: string;
  tossWinner: Team | null;
  tossDecision: TossDecision | null;
  status: MatchStatus;
  winnerTeam: Team | null;
  winMargin: string | null;
  momPlayerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  team: Team;
  battingOrder: number | null;
  player?: Player;
}

// ============================
// INNINGS
// ============================

export interface Innings {
  id: string;
  matchId: string;
  inningsNumber: number;
  battingTeam: Team;
  bowlingTeam: Team;
  totalRuns: number;
  totalWickets: number;
  totalOvers: number;
  totalExtras: number;
  isCompleted: boolean;
}

// ============================
// BALL-BY-BALL
// ============================

export interface Ball {
  id: string;
  inningsId: string;
  overNumber: number;
  ballNumber: number;
  sequenceNumber: number;
  batsmanId: string;
  bowlerId: string;
  nonStrikerId: string;
  runs: number;
  isWide: boolean;
  isNoBall: boolean;
  isWicket: boolean;
  wicketType: WicketType | null;
  dismissedPlayerId: string | null;
  isMaiden: boolean;
  timestamp: string;
}

// ============================
// AGGREGATED STATS
// ============================

export interface BattingInning {
  id: string;
  inningsId: string;
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: WicketType | null;
  strikeRate: number;
  player?: Player;
}

export interface BowlingInning {
  id: string;
  inningsId: string;
  playerId: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
  player?: Player;
}

// ============================
// SERIES
// ============================

export interface Series {
  id: string;
  clubId: string;
  name: string;
  date: string;
  createdAt: string;
  matches?: Match[];
}

// ============================
// AWARDS
// ============================

export interface Award {
  id: string;
  playerId: string;
  clubId: string;
  type: AwardType;
  period: string | null;
  matchId: string | null;
  value: string | null;
  awardedAt: string;
  player?: Player;
}

// ============================
// STATISTICS
// ============================

export interface CareerStats {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  // Batting
  totalRuns: number;
  totalBallsFaced: number;
  battingAverage: number;
  strikeRate: number;
  highestScore: number;
  fifties: number;
  thirties: number;
  totalFours: number;
  totalSixes: number;
  notOuts: number;
  // Bowling
  totalWickets: number;
  totalOversBowled: number;
  bowlingAverage: number;
  economy: number;
  bestBowling: string; // e.g., "3/15"
  totalMaidens: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerCategory: PlayerCategory;
  avatarColor: string;
  value: number;
  label: string; // e.g., "342 runs", "15 wickets"
}

export interface MatchCard {
  id: string;
  date: string;
  teamAName: string;
  teamBName: string;
  teamAScore: string; // e.g., "125/6 (15)"
  teamBScore: string;
  result: string; // e.g., "Team A won by 5 wickets"
  momPlayerName: string | null;
  seriesName: string | null;
}

// ============================
// SCORING LIVE STATE
// ============================

export interface LiveScoreState {
  matchId: string;
  innings: Innings;
  currentBatsman: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  };
  nonStriker: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  };
  currentBowler: {
    playerId: string;
    name: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
  };
  currentOver: number[];
  target: number | null;
  requiredRunRate: number | null;
  currentRunRate: number;
  partnership: {
    runs: number;
    balls: number;
  };
}
