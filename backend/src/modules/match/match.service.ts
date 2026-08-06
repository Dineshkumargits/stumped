import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClubService } from '../club/club.service';
import {
  Team,
  TossDecision,
  MatchStatus,
  PlayerCategory,
  MAX_TEAM_RATING_DIFF_PERCENT,
} from '@stumped/shared';

interface PlayerForBalance {
  id: string;
  name: string;
  category: PlayerCategory;
  battingRating: number;
  bowlingRating: number;
  overallRating: number;
}

@Injectable()
export class MatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubService: ClubService,
  ) {}

  /**
   * Auto-balance players into two teams using category-based serpentine draft.
   * `reshuffle` randomizes tie-breaking so repeated calls vary the pairing
   * while staying within the fairness threshold.
   */
  async autoBalance(
    userId: string,
    clubId: string,
    playerIds: string[],
    reshuffle = false,
  ) {
    await this.clubService.verifyMembership(userId, clubId);

    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds }, clubId },
    });

    if (players.length !== playerIds.length) {
      throw new BadRequestException('Some players not found in this club.');
    }

    return this.balanceTeams(players as PlayerForBalance[], reshuffle);
  }

  /**
   * Fisher-Yates shuffle. Used to randomize tie-break order before the
   * stable rating sort, so equal/near-equal rated players are reshuffled.
   */
  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Category-based serpentine draft algorithm.
   * 1. Group by category
   * 2. Sort each group by rating (desc), randomizing ties when reshuffling
   * 3. Serpentine draft within each category
   * 4. Post-balance swap if needed
   */
  private balanceTeams(players: PlayerForBalance[], reshuffle = false) {
    const prepare = (group: PlayerForBalance[]) => {
      // Stable sort preserves shuffle order among equal ratings.
      const source = reshuffle ? this.shuffle(group) : group;
      return source.sort((a, b) => b.overallRating - a.overallRating);
    };

    const batsmen = prepare(players.filter((p) => p.category === PlayerCategory.BATSMAN));
    const bowlers = prepare(players.filter((p) => p.category === PlayerCategory.BOWLER));
    const allRounders = prepare(players.filter((p) => p.category === PlayerCategory.ALL_ROUNDER));

    const teamA: PlayerForBalance[] = [];
    const teamB: PlayerForBalance[] = [];

    // Global serpentine draft across all categories to keep team counts balanced
    let globalIndex = 0;
    for (const group of [batsmen, bowlers, allRounders]) {
      group.forEach((player) => {
        const round = Math.floor(globalIndex / 2);
        const isEvenRound = round % 2 === 0;

        if (globalIndex % 2 === 0) {
          (isEvenRound ? teamA : teamB).push(player);
        } else {
          (isEvenRound ? teamB : teamA).push(player);
        }
        globalIndex++;
      });
    }

    // Post-balance: check rating difference and swap if needed
    this.postBalanceSwap(teamA, teamB);

    return {
      teamA: teamA.map((p) => ({
        playerId: p.id,
        name: p.name,
        category: p.category,
        overallRating: p.overallRating,
      })),
      teamB: teamB.map((p) => ({
        playerId: p.id,
        name: p.name,
        category: p.category,
        overallRating: p.overallRating,
      })),
      teamATotalRating: teamA.reduce((sum, p) => sum + p.overallRating, 0),
      teamBTotalRating: teamB.reduce((sum, p) => sum + p.overallRating, 0),
    };
  }

  /**
   * If team rating difference exceeds threshold, find closest-rated pair and swap.
   */
  private postBalanceSwap(
    teamA: PlayerForBalance[],
    teamB: PlayerForBalance[],
  ) {
    const totalA = teamA.reduce((sum, p) => sum + p.overallRating, 0);
    const totalB = teamB.reduce((sum, p) => sum + p.overallRating, 0);
    const avg = (totalA + totalB) / 2;

    if (avg === 0) return;

    const diffPercent = (Math.abs(totalA - totalB) / avg) * 100;

    if (diffPercent <= MAX_TEAM_RATING_DIFF_PERCENT) return;

    // Find the best swap: try swapping each pair and find minimum diff
    let bestSwap = { i: -1, j: -1, diff: diffPercent };

    for (let i = 0; i < teamA.length; i++) {
      for (let j = 0; j < teamB.length; j++) {
        // Same category only for swaps
        if (teamA[i].category !== teamB[j].category) continue;

        const newTotalA =
          totalA - teamA[i].overallRating + teamB[j].overallRating;
        const newTotalB =
          totalB - teamB[j].overallRating + teamA[i].overallRating;
        const newDiff = (Math.abs(newTotalA - newTotalB) / avg) * 100;

        if (newDiff < bestSwap.diff) {
          bestSwap = { i, j, diff: newDiff };
        }
      }
    }

    if (bestSwap.i >= 0 && bestSwap.j >= 0) {
      const temp = teamA[bestSwap.i];
      teamA[bestSwap.i] = teamB[bestSwap.j];
      teamB[bestSwap.j] = temp;
    }
  }

  /**
   * Create a match with player assignments.
   */
  async createMatch(
    userId: string,
    data: {
      clubId: string;
      totalOvers: number;
      teamAName: string;
      teamBName: string;
      seriesId?: string;
      players: Array<{
        playerId: string;
        team: Team;
        battingOrder?: number;
        isDoubleSided?: boolean;
      }>;
    },
  ) {
    await this.clubService.verifyScorerOrAdmin(userId, data.clubId);

    // Restrict creating the match if any match in the club is not completed
    const activeMatch = await this.prisma.match.findFirst({
      where: {
        clubId: data.clubId,
        status: {
          not: MatchStatus.COMPLETED,
        },
      },
    });

    if (activeMatch) {
      throw new BadRequestException(
        'An active match is already in progress in this club. Please complete the active match before starting a new one.',
      );
    }

    const teamAPlayers = data.players.filter((p) => p.team === Team.TEAM_A);
    const teamBPlayers = data.players.filter((p) => p.team === Team.TEAM_B);

    if (teamAPlayers.length < 2) {
      throw new BadRequestException('Team A must have at least 2 players.');
    }
    if (teamBPlayers.length < 2) {
      throw new BadRequestException('Team B must have at least 2 players.');
    }

    const playerIds = data.players.map((p) => p.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new BadRequestException('Duplicate players in match lineup.');
    }

    const clubPlayerCount = await this.prisma.player.count({
      where: { id: { in: playerIds }, clubId: data.clubId },
    });
    if (clubPlayerCount !== playerIds.length) {
      throw new BadRequestException('Some players do not belong to this club.');
    }

    if (data.seriesId) {
      const series = await this.prisma.series.findUnique({
        where: { id: data.seriesId },
      });
      if (!series || series.clubId !== data.clubId) {
        throw new BadRequestException('Series not found in this club.');
      }
    }

    const match = await this.prisma.match.create({
      data: {
        clubId: data.clubId,
        totalOvers: data.totalOvers,
        teamAName: data.teamAName,
        teamBName: data.teamBName,
        seriesId: data.seriesId,
        status: MatchStatus.SETUP,
        matchPlayers: {
          create: data.players.map((p) => ({
            playerId: p.playerId,
            team: p.team,
            battingOrder: p.battingOrder,
            isDoubleSided: p.isDoubleSided ?? false,
          })),
        },
      },
      include: {
        matchPlayers: {
          include: { player: true },
        },
      },
    });

    return match;
  }

  /**
   * Record toss result. Transitions match from SETUP → TOSS.
   */
  async recordToss(
    userId: string,
    matchId: string,
    winner: Team,
    decision: TossDecision,
  ) {
    const match = await this.getMatchWithAuth(userId, matchId);

    if (match.status !== MatchStatus.SETUP && match.status !== MatchStatus.TOSS) {
      throw new BadRequestException('Toss can only be recorded during setup.');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: winner,
        tossDecision: decision,
        status: MatchStatus.TOSS,
      },
    });
  }

  /**
   * Start the first innings. Creates the Innings record.
   * Determines which team bats based on toss.
   */
  async startInnings(userId: string, matchId: string) {
    const match = await this.getMatchWithAuth(userId, matchId);

    if (
      match.status !== MatchStatus.TOSS &&
      match.status !== MatchStatus.FIRST_INNINGS
    ) {
      throw new BadRequestException('Cannot start innings at this stage.');
    }

    // Determine innings number
    const existingInnings = await this.prisma.innings.count({
      where: { matchId },
    });

    if (existingInnings >= 2) {
      throw new BadRequestException('Both innings already exist.');
    }

    // The second innings can only start once the first is completed
    if (existingInnings === 1) {
      const firstInnings = await this.prisma.innings.findFirst({
        where: { matchId, inningsNumber: 1 },
      });
      if (firstInnings && !firstInnings.isCompleted) {
        throw new BadRequestException(
          'First innings must be completed before starting the second innings.',
        );
      }
    }

    const inningsNumber = existingInnings + 1;

    // Determine batting/bowling teams
    let battingTeam: Team;
    let bowlingTeam: Team;

    if (inningsNumber === 1) {
      if (match.tossDecision === TossDecision.BAT) {
        battingTeam = match.tossWinner as Team;
        bowlingTeam =
          match.tossWinner === Team.TEAM_A ? Team.TEAM_B : Team.TEAM_A;
      } else {
        bowlingTeam = match.tossWinner as Team;
        battingTeam =
          match.tossWinner === Team.TEAM_A ? Team.TEAM_B : Team.TEAM_A;
      }
    } else {
      // Second innings: swap teams
      const firstInnings = await this.prisma.innings.findFirst({
        where: { matchId, inningsNumber: 1 },
      });
      battingTeam = firstInnings!.bowlingTeam as Team;
      bowlingTeam = firstInnings!.battingTeam as Team;
    }

    const innings = await this.prisma.innings.create({
      data: {
        matchId,
        inningsNumber,
        battingTeam,
        bowlingTeam,
      },
    });

    // Update match status
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status:
          inningsNumber === 1
            ? MatchStatus.FIRST_INNINGS
            : MatchStatus.SECOND_INNINGS,
      },
    });

    return innings;
  }

  /**
   * Get match details with full scorecard.
   */
  async getMatchDetails(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: {
          include: { player: true },
        },
        innings: {
          include: {
            battingInnings: {
              include: { player: true },
              orderBy: { balls: 'desc' },
            },
            bowlingInnings: {
              include: { player: true },
              orderBy: { overs: 'desc' },
            },
          },
          orderBy: { inningsNumber: 'asc' },
        },
        series: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    // Verify user has access
    await this.clubService.verifyMembership(userId, match.clubId);

    return match;
  }

  /**
   * Set Man of the Match. Only after match is completed.
   */
  async setMom(userId: string, matchId: string, playerId: string) {
    const match = await this.getMatchWithAuth(userId, matchId);

    if (match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException('Match must be completed first.');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: { momPlayerId: playerId },
    });
  }

  /**
   * List all matches in a club.
   */
  async listMatches(userId: string, clubId: string) {
    await this.clubService.verifyMembership(userId, clubId);

    return this.prisma.match.findMany({
      where: { clubId },
      include: {
        innings: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PUBLIC (no auth): list matches for the public scores site.
   */
  async listMatchesPublic(clubId: string) {
    return this.prisma.match.findMany({
      where: { clubId },
      include: { innings: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PUBLIC (no auth): full scorecard for one match, fetched by its
   * (unguessable) UUID. Same shape as getMatchDetails, without the
   * membership check.
   */
  async getMatchDetailsPublic(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: { include: { player: true } },
        innings: {
          include: {
            battingInnings: {
              include: { player: true },
              orderBy: { balls: 'desc' },
            },
            bowlingInnings: {
              include: { player: true },
              orderBy: { overs: 'desc' },
            },
          },
          orderBy: { inningsNumber: 'asc' },
        },
        series: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    return match;
  }

  /**
   * Helper: Get match and verify user authorization.
   */
  private async getMatchWithAuth(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    await this.clubService.verifyScorerOrAdmin(userId, match.clubId);

    return match;
  }
}
