import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClubService } from '../club/club.service';
import { AwardType } from '@prisma/client';

@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubService: ClubService,
  ) {}

  /**
   * PUBLIC (no auth): match awards for the public scorecard page.
   */
  async getMatchAwardsPublic(matchId: string) {
    return this.computeMatchAwards(matchId);
  }

  /**
   * Get match awards: Man of the Match, top batsman, and top bowler.
   */
  async getMatchAwards(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { clubId: true },
    });
    if (!match) {
      throw new NotFoundException('Match not found.');
    }
    await this.clubService.verifyMembership(userId, match.clubId);
    return this.computeMatchAwards(matchId);
  }

  /**
   * Shared awards computation (no auth), used by both entry points.
   */
  private async computeMatchAwards(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          include: {
            battingInnings: { include: { player: true } },
            bowlingInnings: { include: { player: true } },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found.');
    }

    // Get MoM player if assigned
    let mom = null;
    if (match.momPlayerId) {
      mom = await this.prisma.player.findUnique({
        where: { id: match.momPlayerId },
      });
    }

    // Flatten batting innings
    const allBatting = match.innings.flatMap(i => i.battingInnings);
    // Flatten bowling innings
    const allBowling = match.innings.flatMap(i => i.bowlingInnings);

    // Find top batsman in match
    const topBatsmanInning = allBatting.length > 0
      ? allBatting.reduce((prev, curr) => (curr.runs > prev.runs ? curr : prev))
      : null;

    // Find top bowler in match
    let topBowlerInning = null;
    if (allBowling.length > 0) {
      topBowlerInning = allBowling.sort((a, b) => {
        if (b.wickets !== a.wickets) return b.wickets - a.wickets;
        if (a.runs !== b.runs) return a.runs - b.runs;
        return a.economy - b.economy;
      })[0];
    }

    return {
      mom: mom ? {
        id: mom.id,
        name: mom.name,
        avatarColor: mom.avatarColor,
      } : null,
      topBatsman: topBatsmanInning ? {
        player: {
          id: topBatsmanInning.player.id,
          name: topBatsmanInning.player.name,
          avatarColor: topBatsmanInning.player.avatarColor,
        },
        runs: topBatsmanInning.runs,
        balls: topBatsmanInning.balls,
        fours: topBatsmanInning.fours,
        sixes: topBatsmanInning.sixes,
      } : null,
      topBowler: topBowlerInning ? {
        player: {
          id: topBowlerInning.player.id,
          name: topBowlerInning.player.name,
          avatarColor: topBowlerInning.player.avatarColor,
        },
        wickets: topBowlerInning.wickets,
        overs: topBowlerInning.overs,
        runs: topBowlerInning.runs,
        economy: topBowlerInning.economy,
      } : null,
    };
  }

  /**
   * Compute seasonal awards for a club.
   */
  async computeSeasonalAwards(userId: string, clubId: string, period = 'All Time') {
    await this.clubService.verifyMembership(userId, clubId);

    // Fetch all completed matches in this club
    const completedMatches = await this.prisma.match.findMany({
      where: { clubId, status: 'COMPLETED' },
      include: {
        innings: {
          include: {
            battingInnings: { include: { player: true } },
            bowlingInnings: { include: { player: true } },
          },
        },
      },
    });

    const batsmenStats: Record<string, {
      player: any;
      runs: number;
      balls: number;
      innings: number;
      dismissals: number;
    }> = {};

    const bowlersStats: Record<string, {
      player: any;
      wickets: number;
      runsConceded: number;
      overs: number;
    }> = {};

    for (const match of completedMatches) {
      for (const innings of match.innings) {
        // Process Batting
        for (const batting of innings.battingInnings) {
          const pid = batting.playerId;
          if (!batsmenStats[pid]) {
            batsmenStats[pid] = {
              player: batting.player,
              runs: 0,
              balls: 0,
              innings: 0,
              dismissals: 0,
            };
          }
          batsmenStats[pid].runs += batting.runs;
          batsmenStats[pid].balls += batting.balls;
          batsmenStats[pid].innings += 1;
          if (batting.isOut) {
            batsmenStats[pid].dismissals += 1;
          }
        }

        // Process Bowling
        for (const bowling of innings.bowlingInnings) {
          const pid = bowling.playerId;
          if (!bowlersStats[pid]) {
            bowlersStats[pid] = {
              player: bowling.player,
              wickets: 0,
              runsConceded: 0,
              overs: 0,
            };
          }
          bowlersStats[pid].wickets += bowling.wickets;
          bowlersStats[pid].runsConceded += bowling.runs;
          // Convert overs (e.g. 5.3) to balls and aggregate
          const balls = Math.floor(bowling.overs) * 6 + Math.round((bowling.overs % 1) * 10);
          bowlersStats[pid].overs += balls / 6;
        }
      }
    }

    const playersList = Object.values(batsmenStats);
    const bowlersList = Object.values(bowlersStats);

    // Compute award winners
    // 1. Top Scorer
    const topScorer = playersList.length > 0
      ? playersList.reduce((prev, curr) => (curr.runs > prev.runs ? curr : prev))
      : null;

    // 2. Top Wicket Taker
    const topWicketTaker = bowlersList.length > 0
      ? bowlersList.reduce((prev, curr) => (curr.wickets > prev.wickets ? curr : prev))
      : null;

    // 3. Best Batting Average (Min 3 innings)
    const qualifyingBatters = playersList.filter(p => p.innings >= 3);
    let bestBattingAvg = null;
    if (qualifyingBatters.length > 0) {
      bestBattingAvg = qualifyingBatters.reduce((prev, curr) => {
        const prevAvg = prev.dismissals > 0 ? prev.runs / prev.dismissals : prev.runs;
        const currAvg = curr.dismissals > 0 ? curr.runs / curr.dismissals : curr.runs;
        return currAvg > prevAvg ? curr : prev;
      });
    }

    // 4. Best Bowling Average (Min 5 overs bowled)
    const qualifyingBowlers = bowlersList.filter(b => b.overs >= 5 && b.wickets > 0);
    let bestBowlingAvg = null;
    if (qualifyingBowlers.length > 0) {
      bestBowlingAvg = qualifyingBowlers.reduce((prev, curr) => {
        const prevAvg = prev.runsConceded / prev.wickets;
        const currAvg = curr.runsConceded / curr.wickets;
        return currAvg < prevAvg ? curr : prev;
      });
    }

    const awardsToReturn = [];

    if (topScorer) {
      awardsToReturn.push({
        type: AwardType.TOP_SCORER,
        period,
        player: {
          id: topScorer.player.id,
          name: topScorer.player.name,
          avatarColor: topScorer.player.avatarColor,
        },
        value: `${topScorer.runs} runs`,
      });
    }

    if (topWicketTaker) {
      awardsToReturn.push({
        type: AwardType.TOP_WICKET_TAKER,
        period,
        player: {
          id: topWicketTaker.player.id,
          name: topWicketTaker.player.name,
          avatarColor: topWicketTaker.player.avatarColor,
        },
        value: `${topWicketTaker.wickets} wickets`,
      });
    }

    if (bestBattingAvg) {
      const avg = bestBattingAvg.dismissals > 0
        ? bestBattingAvg.runs / bestBattingAvg.dismissals
        : bestBattingAvg.runs;
      awardsToReturn.push({
        type: AwardType.BEST_BATTING_AVG,
        period,
        player: {
          id: bestBattingAvg.player.id,
          name: bestBattingAvg.player.name,
          avatarColor: bestBattingAvg.player.avatarColor,
        },
        value: `Avg: ${Math.round(avg * 100) / 100}`,
      });
    }

    if (bestBowlingAvg) {
      const avg = bestBowlingAvg.runsConceded / bestBowlingAvg.wickets;
      awardsToReturn.push({
        type: AwardType.BEST_BOWLING_AVG,
        period,
        player: {
          id: bestBowlingAvg.player.id,
          name: bestBowlingAvg.player.name,
          avatarColor: bestBowlingAvg.player.avatarColor,
        },
        value: `Avg: ${Math.round(avg * 100) / 100}`,
      });
    }

    return awardsToReturn;
  }
}
