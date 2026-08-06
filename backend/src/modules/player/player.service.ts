import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClubService } from '../club/club.service';
import {
  PlayerCategory,
  AVATAR_COLORS,
  RATING_WEIGHTS,
  DEFAULT_RATING,
} from '@stumped/shared';

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubService: ClubService,
  ) {}

  /**
   * Create a new player in a club. Only admins can do this.
   */
  async createPlayer(
    userId: string,
    clubId: string,
    name: string,
    category: PlayerCategory,
  ) {
    await this.clubService.verifyAdmin(userId, clubId);

    const avatarColor =
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const weights = RATING_WEIGHTS[category];
    const overallRating =
      DEFAULT_RATING * weights.batting + DEFAULT_RATING * weights.bowling;

    const player = await this.prisma.player.create({
      data: {
        clubId,
        name,
        category,
        battingRating: DEFAULT_RATING,
        bowlingRating: DEFAULT_RATING,
        overallRating,
        avatarColor,
      },
    });

    return player;
  }

  /**
   * List all players in a club. Accessible by any club member.
   */
  async listPlayers(userId: string, clubId: string) {
    await this.clubService.verifyMembership(userId, clubId);

    return this.prisma.player.findMany({
      where: { clubId },
      orderBy: [{ overallRating: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * PUBLIC (no auth): players for the public leaderboard.
   */
  async listPlayersPublic(clubId: string) {
    return this.prisma.player.findMany({
      where: { clubId },
      orderBy: [{ overallRating: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a player's detail with career stats summary.
   */
  async getPlayerDetail(userId: string, playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    // Verify user has access to this player's club
    await this.clubService.verifyMembership(userId, player.clubId);

    // Get match count
    const matchCount = await this.prisma.matchPlayer.count({
      where: { playerId },
    });

    // Get career batting stats
    const battingStats = await this.prisma.battingInning.aggregate({
      where: { playerId },
      _sum: { runs: true, balls: true, fours: true, sixes: true },
      _count: true,
      _max: { runs: true },
    });

    const battingDismissals = await this.prisma.battingInning.count({
      where: { playerId, isOut: true },
    });

    // Get career bowling stats
    const bowlingStats = await this.prisma.bowlingInning.aggregate({
      where: { playerId },
      _sum: { overs: true, maidens: true, runs: true, wickets: true, wides: true, noBalls: true },
      _count: true,
    });

    const totalRuns = battingStats._sum.runs ?? 0;
    const totalBalls = battingStats._sum.balls ?? 0;
    const totalInnings = battingStats._count;
    const notOuts = totalInnings - battingDismissals;
    const battingAvg = battingDismissals > 0 ? totalRuns / battingDismissals : totalRuns;
    const strikeRate = totalBalls > 0 ? (totalRuns / totalBalls) * 100 : 0;

    const totalWickets = bowlingStats._sum.wickets ?? 0;
    const totalRunsConceded = bowlingStats._sum.runs ?? 0;
    const totalOvers = bowlingStats._sum.overs ?? 0;
    const bowlingAvg = totalWickets > 0 ? totalRunsConceded / totalWickets : 0;
    const economy = totalOvers > 0 ? totalRunsConceded / totalOvers : 0;

    return {
      ...player,
      career: {
        matchesPlayed: matchCount,
        totalRuns,
        totalBallsFaced: totalBalls,
        battingAverage: Math.round(battingAvg * 100) / 100,
        strikeRate: Math.round(strikeRate * 100) / 100,
        highestScore: battingStats._max.runs ?? 0,
        totalFours: battingStats._sum.fours ?? 0,
        totalSixes: battingStats._sum.sixes ?? 0,
        notOuts,
        totalWickets,
        totalOversBowled: totalOvers,
        bowlingAverage: Math.round(bowlingAvg * 100) / 100,
        economy: Math.round(economy * 100) / 100,
        totalMaidens: bowlingStats._sum.maidens ?? 0,
      },
    };
  }

  /**
   * Update player details. Only admins can do this.
   */
  async updatePlayer(
    userId: string,
    playerId: string,
    data: { name?: string; category?: PlayerCategory },
  ) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    await this.clubService.verifyAdmin(userId, player.clubId);

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.category) {
      updateData.category = data.category;
      // Recalculate overall rating with new category weights
      const weights = RATING_WEIGHTS[data.category];
      updateData.overallRating =
        player.battingRating * weights.batting +
        player.bowlingRating * weights.bowling;
    }

    return this.prisma.player.update({
      where: { id: playerId },
      data: updateData,
    });
  }

  /**
   * Override a player's rating. Only admins can do this.
   */
  async overrideRating(
    userId: string,
    playerId: string,
    battingRating: number,
    bowlingRating: number,
  ) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    await this.clubService.verifyAdmin(userId, player.clubId);

    const weights = RATING_WEIGHTS[player.category];
    const overallRating =
      battingRating * weights.batting + bowlingRating * weights.bowling;

    return this.prisma.player.update({
      where: { id: playerId },
      data: {
        battingRating,
        bowlingRating,
        overallRating,
        isRatingManual: true,
      },
    });
  }

  /**
   * Get career stats comparison of two players.
   */
  async getComparison(userId: string, playerAId: string, playerBId: string) {
    const playerA = await this.getPlayerDetail(userId, playerAId);
    const playerB = await this.getPlayerDetail(userId, playerBId);
    return { playerA, playerB };
  }

  /**
   * Get direct head-to-head face-off stats between two players.
   */
  async getH2H(userId: string, playerAId: string, playerBId: string) {
    const playerA = await this.prisma.player.findUnique({ where: { id: playerAId } });
    const playerB = await this.prisma.player.findUnique({ where: { id: playerBId } });

    if (!playerA || !playerB) {
      throw new NotFoundException('One or both players not found.');
    }

    await this.clubService.verifyMembership(userId, playerA.clubId);
    if (playerA.clubId !== playerB.clubId) {
      throw new BadRequestException('Players must belong to the same club.');
    }

    // Find matches where both players participated
    const matchPlayersA = await this.prisma.matchPlayer.findMany({
      where: { playerId: playerAId },
    });
    const matchPlayersB = await this.prisma.matchPlayer.findMany({
      where: { playerId: playerBId },
    });

    const matchAMap = new Map(matchPlayersA.map(m => [m.matchId, m.team]));
    const commonMatchIds: string[] = [];
    const relations: Array<{ matchId: string; teamA: string; teamB: string }> = [];

    for (const mb of matchPlayersB) {
      const teamA = matchAMap.get(mb.matchId);
      if (teamA) {
        commonMatchIds.push(mb.matchId);
        relations.push({
          matchId: mb.matchId,
          teamA,
          teamB: mb.team,
        });
      }
    }

    // Fetch details of common matches
    const commonMatches = await this.prisma.match.findMany({
      where: {
        id: { in: commonMatchIds },
        status: 'COMPLETED',
      },
    });

    const completedCommonMatchIds = commonMatches.map(m => m.id);

    // Fetch batting/bowling innings for both in these completed common matches
    const battingA = await this.prisma.battingInning.findMany({
      where: { playerId: playerAId, innings: { matchId: { in: completedCommonMatchIds } } },
    });
    const battingB = await this.prisma.battingInning.findMany({
      where: { playerId: playerBId, innings: { matchId: { in: completedCommonMatchIds } } },
    });
    const bowlingA = await this.prisma.bowlingInning.findMany({
      where: { playerId: playerAId, innings: { matchId: { in: completedCommonMatchIds } } },
    });
    const bowlingB = await this.prisma.bowlingInning.findMany({
      where: { playerId: playerBId, innings: { matchId: { in: completedCommonMatchIds } } },
    });

    let playedAsTeammates = 0;
    let playedAsOpponents = 0;
    let winsA = 0;
    let winsB = 0;

    for (const rel of relations) {
      const match = commonMatches.find(m => m.id === rel.matchId);
      if (!match) continue;

      const isSameTeam = rel.teamA === rel.teamB;
      if (isSameTeam) {
        playedAsTeammates++;
      } else {
        playedAsOpponents++;
      }

      if (match.winnerTeam) {
        const winningTeamEnum = match.winnerTeam;
        const isWinnerA = rel.teamA === winningTeamEnum;
        const isWinnerB = rel.teamB === winningTeamEnum;

        if (isWinnerA) winsA++;
        if (isWinnerB) winsB++;
      }
    }

    const runsA = battingA.reduce((sum, b) => sum + b.runs, 0);
    const runsB = battingB.reduce((sum, b) => sum + b.runs, 0);
    const wicketsA = bowlingA.reduce((sum, b) => sum + b.wickets, 0);
    const wicketsB = bowlingB.reduce((sum, b) => sum + b.wickets, 0);

    return {
      playerA: { id: playerA.id, name: playerA.name, avatarColor: playerA.avatarColor },
      playerB: { id: playerB.id, name: playerB.name, avatarColor: playerB.avatarColor },
      commonMatchesCount: completedCommonMatchIds.length,
      playedAsTeammates,
      playedAsOpponents,
      winsA,
      winsB,
      runsA,
      runsB,
      wicketsA,
      wicketsB,
    };
  }

  /**
   * Link a user account to a player profile in a club.
   */
  async linkPlayerToUser(userId: string, clubId: string, playerId: string | null) {
    // Verify membership
    await this.clubService.verifyMembership(userId, clubId);

    // If playerId is null, unlink
    if (playerId === null) {
      await this.prisma.player.updateMany({
        where: { clubId, linkedUserId: userId },
        data: { linkedUserId: null },
      });
      return { success: true };
    }

    // Check if player profile exists and belongs to the club
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player || player.clubId !== clubId) {
      throw new NotFoundException('Player not found in this club.');
    }

    // Check if player profile is already linked to another user
    if (player.linkedUserId && player.linkedUserId !== userId) {
      throw new BadRequestException('This player profile is already linked to another user.');
    }

    // Unlink user from any other player in this club
    await this.prisma.player.updateMany({
      where: { clubId, linkedUserId: userId },
      data: { linkedUserId: null },
    });

    // Link the user to the new player profile
    await this.prisma.player.update({
      where: { id: playerId },
      data: { linkedUserId: userId },
    });

    return { success: true };
  }

  /**
   * Get the player profile linked to the current user in a club.
   */
  async getLinkedPlayer(userId: string, clubId: string) {
    await this.clubService.verifyMembership(userId, clubId);

    const player = await this.prisma.player.findFirst({
      where: { clubId, linkedUserId: userId },
    });

    if (!player) return null;

    return this.getPlayerDetail(userId, player.id);
  }
}

