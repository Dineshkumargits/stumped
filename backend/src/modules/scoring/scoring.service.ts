import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClubService } from '../club/club.service';
import {
  MatchStatus,
  WicketType,
  BALLS_PER_OVER,
  WIDE_EXTRA_RUN,
  NO_BALL_EXTRA_RUN,
  Team,
} from '@stumped/shared';
import type { RecordBallInput, LiveScoreState } from '@stumped/shared';

type Db = Prisma.TransactionClient;

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubService: ClubService,
  ) {}

  /**
   * Record a ball delivery. This is the core scoring logic.
   * Updates: Ball record, batting innings, bowling innings, innings totals.
   * All writes run inside a single transaction so a partial failure cannot
   * leave the aggregates out of sync with the ball-by-ball log.
   * Returns updated live score state for WebSocket broadcast.
   */
  async recordBall(userId: string, input: RecordBallInput): Promise<LiveScoreState> {
    const innings = await this.prisma.innings.findUnique({
      where: { id: input.inningsId },
      include: { match: true },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found.');
    }

    if (innings.isCompleted) {
      throw new BadRequestException('This innings is already completed.');
    }

    // Verify scorer authorization
    await this.clubService.verifyScorerOrAdmin(userId, innings.match.clubId);

    // Validate that the participants belong to this match and the right teams
    if (input.batsmanId === input.nonStrikerId) {
      throw new BadRequestException('Striker and non-striker must be different players.');
    }
    // A double-sided player is eligible for either team, but still can't
    // bat and bowl the same delivery — this can only happen for them, since
    // a regular player only ever belongs to one side of a given innings.
    if (input.bowlerId === input.batsmanId || input.bowlerId === input.nonStrikerId) {
      throw new BadRequestException('The bowler cannot also be a batsman on strike for this delivery.');
    }
    if (
      input.dismissedPlayerId &&
      input.dismissedPlayerId !== input.batsmanId &&
      input.dismissedPlayerId !== input.nonStrikerId
    ) {
      throw new BadRequestException('Dismissed player must be one of the two batsmen at the crease.');
    }

    const matchPlayers = await this.prisma.matchPlayer.findMany({
      where: { matchId: innings.matchId },
    });
    const teamOf = new Map(matchPlayers.map((mp) => [mp.playerId, mp.team]));
    // Double-sided players (odd-count matches) are eligible for either team.
    const isDoubleSidedOf = new Map(
      matchPlayers.map((mp) => [mp.playerId, mp.isDoubleSided]),
    );
    const isEligibleForTeam = (playerId: string, team: string) =>
      teamOf.get(playerId) === team || isDoubleSidedOf.get(playerId) === true;

    if (
      !isEligibleForTeam(input.batsmanId, innings.battingTeam) ||
      !isEligibleForTeam(input.nonStrikerId, innings.battingTeam)
    ) {
      throw new BadRequestException('Batsmen must belong to the batting team of this match.');
    }
    if (!isEligibleForTeam(input.bowlerId, innings.bowlingTeam)) {
      throw new BadRequestException('Bowler must belong to the bowling team of this match.');
    }

    await this.prisma.$transaction(async (db) => {
      // Get the current ball sequence
      const lastBall = await db.ball.findFirst({
        where: { inningsId: input.inningsId },
        orderBy: { sequenceNumber: 'desc' },
      });

      const sequenceNumber = (lastBall?.sequenceNumber ?? 0) + 1;

      // Calculate over and ball number
      // Wides and no-balls don't count as legal deliveries
      const isLegalDelivery = !input.isWide && !input.isNoBall;

      const legalBalls = await db.ball.count({
        where: {
          inningsId: input.inningsId,
          isWide: false,
          isNoBall: false,
        },
      });

      const overNumber = Math.floor(legalBalls / BALLS_PER_OVER);
      const ballNumber = isLegalDelivery
        ? (legalBalls % BALLS_PER_OVER) + 1
        : legalBalls % BALLS_PER_OVER; // extras don't advance ball count

      // Calculate total runs for this delivery
      let totalDeliveryRuns = input.runs;
      if (input.isWide) totalDeliveryRuns += WIDE_EXTRA_RUN;
      if (input.isNoBall) totalDeliveryRuns += NO_BALL_EXTRA_RUN;

      // Create the ball record
      await db.ball.create({
        data: {
          inningsId: input.inningsId,
          overNumber,
          ballNumber,
          sequenceNumber,
          batsmanId: input.batsmanId,
          bowlerId: input.bowlerId,
          nonStrikerId: input.nonStrikerId,
          runs: input.runs,
          isWide: input.isWide,
          isNoBall: input.isNoBall,
          isWicket: input.isWicket,
          wicketType: input.wicketType ?? null,
          dismissedPlayerId: input.dismissedPlayerId ?? null,
        },
      });

      const strikerDismissed =
        input.isWicket && input.dismissedPlayerId === input.batsmanId;

      // Update batting innings for the batsman (a wide is not a ball faced)
      if (!input.isWide) {
        await this.upsertBattingInning(
          db,
          input.inningsId,
          input.batsmanId,
          input.runs,
          true, // counts as a ball faced
          strikerDismissed,
          strikerDismissed ? (input.wicketType ?? null) : null,
        );
      } else if (strikerDismissed) {
        // Striker dismissed off a wide (e.g. run out / stumped): record the
        // dismissal without adding a ball faced or runs.
        await this.upsertBattingInning(
          db,
          input.inningsId,
          input.batsmanId,
          0,
          false,
          true,
          input.wicketType ?? null,
        );
      }

      // If the non-striker was dismissed (run out), update their record
      // without charging them a ball faced.
      if (input.isWicket && input.dismissedPlayerId === input.nonStrikerId) {
        await this.upsertBattingInning(
          db,
          input.inningsId,
          input.nonStrikerId,
          0,
          false,
          true,
          input.wicketType ?? null,
        );
      }

      // Update bowling innings for the bowler
      await this.upsertBowlingInning(
        db,
        input.inningsId,
        input.bowlerId,
        isLegalDelivery,
        totalDeliveryRuns - input.runs, // extras only
        input.runs, // runs off bat
        input.isWide,
        input.isNoBall,
        input.isWicket &&
          input.wicketType !== WicketType.RUN_OUT &&
          input.wicketType !== WicketType.RETIRED,
      );

      // Update innings totals
      const newLegalBalls = legalBalls + (isLegalDelivery ? 1 : 0);
      const newOvers =
        Math.floor(newLegalBalls / BALLS_PER_OVER) +
        (newLegalBalls % BALLS_PER_OVER) / 10; // Display format: 5.3 means 5 overs 3 balls

      const updatedInnings = await db.innings.update({
        where: { id: input.inningsId },
        data: {
          totalRuns: { increment: totalDeliveryRuns },
          totalExtras: {
            increment: input.isWide
              ? WIDE_EXTRA_RUN
              : input.isNoBall
                ? NO_BALL_EXTRA_RUN
                : 0,
          },
          totalWickets: { increment: input.isWicket ? 1 : 0 },
          totalOvers: newOvers,
        },
      });

      // Check if innings should end
      const teamPlayerCount = matchPlayers.filter(
        (mp) => mp.team === innings.battingTeam,
      ).length;

      const allOut = updatedInnings.totalWickets >= teamPlayerCount - 1;
      const oversComplete =
        newLegalBalls >= innings.match.totalOvers * BALLS_PER_OVER;

      // Second innings: check if target is chased
      let targetChased = false;
      if (innings.inningsNumber === 2) {
        const firstInnings = await db.innings.findFirst({
          where: { matchId: innings.matchId, inningsNumber: 1 },
        });
        if (firstInnings && updatedInnings.totalRuns > firstInnings.totalRuns) {
          targetChased = true;
        }
      }

      if (allOut || oversComplete || targetChased) {
        await this.endInnings(
          db,
          innings.matchId,
          input.inningsId,
          innings.inningsNumber,
        );
      }
    });

    // Build and return live score state
    return this.buildLiveScoreState(innings.matchId, input.inningsId);
  }

  /**
   * Undo the last ball. Reverses all aggregated updates atomically.
   */
  async undoLastBall(userId: string, inningsId: string): Promise<LiveScoreState> {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: { match: true },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found.');
    }

    await this.clubService.verifyScorerOrAdmin(userId, innings.match.clubId);

    await this.prisma.$transaction(async (db) => {
      // Get the last ball
      const lastBall = await db.ball.findFirst({
        where: { inningsId },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!lastBall) {
        throw new BadRequestException('No balls to undo.');
      }

      // If innings was completed, reopen it
      if (innings.isCompleted) {
        await db.innings.update({
          where: { id: inningsId },
          data: { isCompleted: false },
        });

        // If match was completed, revert to appropriate status
        if (innings.match.status === MatchStatus.COMPLETED) {
          await db.match.update({
            where: { id: innings.matchId },
            data: {
              status:
                innings.inningsNumber === 1
                  ? MatchStatus.FIRST_INNINGS
                  : MatchStatus.SECOND_INNINGS,
              winnerTeam: null,
              winMargin: null,
            },
          });
        }
      }

      // Calculate run deductions
      let totalRunsToDeduct = lastBall.runs;
      if (lastBall.isWide) totalRunsToDeduct += WIDE_EXTRA_RUN;
      if (lastBall.isNoBall) totalRunsToDeduct += NO_BALL_EXTRA_RUN;

      const isLegal = !lastBall.isWide && !lastBall.isNoBall;

      const strikerWasDismissed =
        lastBall.isWicket && lastBall.dismissedPlayerId === lastBall.batsmanId;

      // Reverse batting innings
      if (!lastBall.isWide) {
        await this.reverseBattingInning(
          db,
          inningsId,
          lastBall.batsmanId,
          lastBall.runs,
          true,
          strikerWasDismissed,
        );
      } else if (strikerWasDismissed) {
        // Striker dismissal off a wide: reverse dismissal only
        await this.reverseBattingInning(
          db,
          inningsId,
          lastBall.batsmanId,
          0,
          false,
          true,
        );
      }

      // Reverse non-striker dismissal (no ball faced was recorded)
      if (lastBall.isWicket && lastBall.dismissedPlayerId === lastBall.nonStrikerId) {
        await this.reverseBattingInning(
          db,
          inningsId,
          lastBall.nonStrikerId,
          0,
          false,
          true,
        );
      }

      // Reverse bowling innings
      await this.reverseBowlingInning(
        db,
        inningsId,
        lastBall.bowlerId,
        isLegal,
        lastBall.isWide ? WIDE_EXTRA_RUN : lastBall.isNoBall ? NO_BALL_EXTRA_RUN : 0,
        lastBall.runs,
        lastBall.isWide,
        lastBall.isNoBall,
        lastBall.isWicket &&
          lastBall.wicketType !== WicketType.RUN_OUT &&
          lastBall.wicketType !== WicketType.RETIRED,
      );

      // Recalculate overs
      const legalBallsAfterUndo = await db.ball.count({
        where: {
          inningsId,
          isWide: false,
          isNoBall: false,
          sequenceNumber: { lt: lastBall.sequenceNumber },
        },
      });

      const newOvers =
        Math.floor(legalBallsAfterUndo / BALLS_PER_OVER) +
        (legalBallsAfterUndo % BALLS_PER_OVER) / 10;

      // Update innings totals
      await db.innings.update({
        where: { id: inningsId },
        data: {
          totalRuns: { decrement: totalRunsToDeduct },
          totalExtras: {
            decrement: lastBall.isWide
              ? WIDE_EXTRA_RUN
              : lastBall.isNoBall
                ? NO_BALL_EXTRA_RUN
                : 0,
          },
          totalWickets: { decrement: lastBall.isWicket ? 1 : 0 },
          totalOvers: newOvers,
        },
      });

      // Delete the ball
      await db.ball.delete({ where: { id: lastBall.id } });
    });

    return this.buildLiveScoreState(innings.matchId, inningsId);
  }

  /**
   * End the current innings and potentially complete the match.
   */
  private async endInnings(
    db: Db,
    matchId: string,
    inningsId: string,
    inningsNumber: number,
  ) {
    await db.innings.update({
      where: { id: inningsId },
      data: { isCompleted: true },
    });

    // Recompute maiden overs (idempotent)
    await this.recomputeMaidenOvers(db, inningsId);

    if (inningsNumber === 2) {
      // Match complete — determine winner
      await this.completeMatch(db, matchId);
    }
  }

  /**
   * Complete the match and determine the winner.
   */
  private async completeMatch(db: Db, matchId: string) {
    const innings = await db.innings.findMany({
      where: { matchId },
      orderBy: { inningsNumber: 'asc' },
    });

    if (innings.length !== 2) return;

    const [first, second] = innings;
    let winnerTeam = null;
    let winMargin = '';

    if (second.totalRuns > first.totalRuns) {
      // Chasing team won
      winnerTeam = second.battingTeam;
      const teamPlayers = await db.matchPlayer.count({
        where: { matchId, team: second.battingTeam },
      });
      const wicketsRemaining = teamPlayers - 1 - second.totalWickets;
      winMargin = `${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
    } else if (first.totalRuns > second.totalRuns) {
      // Batting first team won
      winnerTeam = first.battingTeam;
      const runDiff = first.totalRuns - second.totalRuns;
      winMargin = `${runDiff} run${runDiff !== 1 ? 's' : ''}`;
    } else {
      // Tie
      winMargin = 'Match tied';
    }

    await db.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        winnerTeam,
        winMargin,
      },
    });
  }

  /**
   * Recompute and store maiden-over counts for every bowler in an innings.
   * Sets absolute values (rather than incrementing), so calling it multiple
   * times — e.g. when an innings is re-completed after an undo — is safe.
   */
  private async recomputeMaidenOvers(db: Db, inningsId: string) {
    const balls = await db.ball.findMany({
      where: { inningsId },
      orderBy: { sequenceNumber: 'asc' },
    });

    const overBalls: Map<number, typeof balls> = new Map();
    for (const ball of balls) {
      if (!overBalls.has(ball.overNumber)) {
        overBalls.set(ball.overNumber, []);
      }
      overBalls.get(ball.overNumber)!.push(ball);
    }

    // An over is a maiden if: 6 legal deliveries, 0 runs (including no wides/no-balls)
    const maidensByBowler = new Map<string, number>();
    for (const [, overBallList] of overBalls) {
      const legalBalls = overBallList.filter((b) => !b.isWide && !b.isNoBall);
      if (legalBalls.length !== BALLS_PER_OVER) continue;

      const totalRuns = overBallList.reduce((sum, b) => sum + b.runs, 0);
      const hasExtras = overBallList.some((b) => b.isWide || b.isNoBall);

      if (totalRuns === 0 && !hasExtras) {
        const bowlerId = legalBalls[0].bowlerId;
        maidensByBowler.set(bowlerId, (maidensByBowler.get(bowlerId) ?? 0) + 1);
      }
    }

    const bowlingInnings = await db.bowlingInning.findMany({
      where: { inningsId },
    });
    for (const bi of bowlingInnings) {
      const maidens = maidensByBowler.get(bi.playerId) ?? 0;
      if (bi.maidens !== maidens) {
        await db.bowlingInning.update({
          where: { id: bi.id },
          data: { maidens },
        });
      }
    }
  }

  /**
   * Upsert batting innings aggregate for a player.
   * `countsBall` is false for dismissals that don't consume a ball faced
   * (non-striker run-outs, dismissals off wides).
   */
  private async upsertBattingInning(
    db: Db,
    inningsId: string,
    playerId: string,
    runs: number,
    countsBall: boolean,
    isOut: boolean,
    dismissalType: WicketType | null,
  ) {
    const existing = await db.battingInning.findUnique({
      where: { inningsId_playerId: { inningsId, playerId } },
    });

    if (existing) {
      const newRuns = existing.runs + runs;
      const newBalls = existing.balls + (countsBall ? 1 : 0);
      const strikeRate = newBalls > 0 ? (newRuns / newBalls) * 100 : 0;

      await db.battingInning.update({
        where: { id: existing.id },
        data: {
          runs: newRuns,
          balls: newBalls,
          fours: runs === 4 ? { increment: 1 } : undefined,
          sixes: runs === 6 ? { increment: 1 } : undefined,
          isOut: isOut || existing.isOut,
          dismissalType: isOut ? dismissalType : existing.dismissalType,
          strikeRate,
        },
      });
    } else {
      const balls = countsBall ? 1 : 0;
      const strikeRate = balls > 0 ? runs * 100 : 0;
      await db.battingInning.create({
        data: {
          inningsId,
          playerId,
          runs,
          balls,
          fours: runs === 4 ? 1 : 0,
          sixes: runs === 6 ? 1 : 0,
          isOut,
          dismissalType,
          strikeRate,
        },
      });
    }
  }

  /**
   * Upsert bowling innings aggregate for a bowler.
   */
  private async upsertBowlingInning(
    db: Db,
    inningsId: string,
    bowlerId: string,
    isLegalDelivery: boolean,
    extraRuns: number,
    runsOffBat: number,
    isWide: boolean,
    isNoBall: boolean,
    isWicket: boolean,
  ) {
    const existing = await db.bowlingInning.findUnique({
      where: { inningsId_playerId: { inningsId, playerId: bowlerId } },
    });

    const totalBowlerRuns = runsOffBat + extraRuns;

    if (existing) {
      // Calculate new overs display value
      const currentLegalBalls =
        Math.floor(existing.overs) * BALLS_PER_OVER +
        Math.round((existing.overs % 1) * 10);
      const newLegalBalls = currentLegalBalls + (isLegalDelivery ? 1 : 0);
      const newOvers =
        Math.floor(newLegalBalls / BALLS_PER_OVER) +
        (newLegalBalls % BALLS_PER_OVER) / 10;

      const newTotalRuns = existing.runs + totalBowlerRuns;
      const actualOvers = newLegalBalls / BALLS_PER_OVER;
      const economy = actualOvers > 0 ? newTotalRuns / actualOvers : 0;

      await db.bowlingInning.update({
        where: { id: existing.id },
        data: {
          overs: newOvers,
          runs: newTotalRuns,
          wickets: isWicket ? { increment: 1 } : undefined,
          wides: isWide ? { increment: 1 } : undefined,
          noBalls: isNoBall ? { increment: 1 } : undefined,
          economy: Math.round(economy * 100) / 100,
        },
      });
    } else {
      const overs = isLegalDelivery ? 0.1 : 0;
      const actualOvers = isLegalDelivery ? 1 / BALLS_PER_OVER : 0;
      const economy =
        actualOvers > 0 ? totalBowlerRuns / actualOvers : 0;

      await db.bowlingInning.create({
        data: {
          inningsId,
          playerId: bowlerId,
          overs,
          runs: totalBowlerRuns,
          wickets: isWicket ? 1 : 0,
          wides: isWide ? 1 : 0,
          noBalls: isNoBall ? 1 : 0,
          economy: Math.round(economy * 100) / 100,
        },
      });
    }
  }

  /**
   * Reverse a batting inning entry (for undo).
   */
  private async reverseBattingInning(
    db: Db,
    inningsId: string,
    playerId: string,
    runs: number,
    countsBall: boolean,
    wasOut: boolean,
  ) {
    const existing = await db.battingInning.findUnique({
      where: { inningsId_playerId: { inningsId, playerId } },
    });

    if (!existing) return;

    const newRuns = existing.runs - runs;
    const newBalls = existing.balls - (countsBall ? 1 : 0);
    const strikeRate = newBalls > 0 ? (newRuns / newBalls) * 100 : 0;
    const effectiveOut = wasOut ? false : existing.isOut;

    if (newBalls <= 0 && newRuns <= 0 && !effectiveOut) {
      // Remove the record entirely
      await db.battingInning.delete({ where: { id: existing.id } });
    } else {
      await db.battingInning.update({
        where: { id: existing.id },
        data: {
          runs: Math.max(0, newRuns),
          balls: Math.max(0, newBalls),
          fours: runs === 4 ? { decrement: 1 } : undefined,
          sixes: runs === 6 ? { decrement: 1 } : undefined,
          isOut: effectiveOut,
          dismissalType: wasOut ? null : existing.dismissalType,
          strikeRate: Math.max(0, strikeRate),
        },
      });
    }
  }

  /**
   * Reverse a bowling inning entry (for undo).
   */
  private async reverseBowlingInning(
    db: Db,
    inningsId: string,
    bowlerId: string,
    wasLegalDelivery: boolean,
    extraRuns: number,
    runsOffBat: number,
    wasWide: boolean,
    wasNoBall: boolean,
    wasWicket: boolean,
  ) {
    const existing = await db.bowlingInning.findUnique({
      where: { inningsId_playerId: { inningsId, playerId: bowlerId } },
    });

    if (!existing) return;

    const totalBowlerRuns = runsOffBat + extraRuns;
    const currentLegalBalls =
      Math.floor(existing.overs) * BALLS_PER_OVER +
      Math.round((existing.overs % 1) * 10);
    const newLegalBalls = currentLegalBalls - (wasLegalDelivery ? 1 : 0);

    if (newLegalBalls <= 0 && existing.runs - totalBowlerRuns <= 0) {
      await db.bowlingInning.delete({ where: { id: existing.id } });
    } else {
      const newOvers =
        Math.floor(newLegalBalls / BALLS_PER_OVER) +
        (newLegalBalls % BALLS_PER_OVER) / 10;
      const newTotalRuns = existing.runs - totalBowlerRuns;
      const actualOvers = newLegalBalls / BALLS_PER_OVER;
      const economy = actualOvers > 0 ? newTotalRuns / actualOvers : 0;

      await db.bowlingInning.update({
        where: { id: existing.id },
        data: {
          overs: Math.max(0, newOvers),
          runs: Math.max(0, newTotalRuns),
          wickets: wasWicket ? { decrement: 1 } : undefined,
          wides: wasWide ? { decrement: 1 } : undefined,
          noBalls: wasNoBall ? { decrement: 1 } : undefined,
          economy: Math.max(0, Math.round(economy * 100) / 100),
        },
      });
    }
  }

  /**
   * Build the full live score state for WebSocket broadcast.
   */
  async buildLiveScoreState(
    matchId: string,
    inningsId: string,
  ): Promise<LiveScoreState> {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      include: { match: true },
    });

    if (!innings) {
      throw new NotFoundException('Innings not found.');
    }

    // Get current batsmen (last two non-out batsmen)
    const activeBatsmen = await this.prisma.battingInning.findMany({
      where: { inningsId, isOut: false },
      include: { player: true },
      orderBy: { balls: 'desc' },
      take: 2,
    });

    // Get current bowler (last ball's bowler)
    const lastBall = await this.prisma.ball.findFirst({
      where: { inningsId },
      orderBy: { sequenceNumber: 'desc' },
    });

    let currentBowlerStats = null;
    if (lastBall) {
      currentBowlerStats = await this.prisma.bowlingInning.findUnique({
        where: { inningsId_playerId: { inningsId, playerId: lastBall.bowlerId } },
        include: { player: true },
      });
    }

    // Get current over balls
    const currentOverNumber = lastBall
      ? lastBall.overNumber
      : 0;
    const currentOverBalls = await this.prisma.ball.findMany({
      where: { inningsId, overNumber: currentOverNumber },
      orderBy: { sequenceNumber: 'asc' },
    });

    // Calculate target (if second innings)
    let target: number | null = null;
    let requiredRunRate: number | null = null;
    if (innings.inningsNumber === 2) {
      const firstInnings = await this.prisma.innings.findFirst({
        where: { matchId, inningsNumber: 1 },
      });
      if (firstInnings) {
        target = firstInnings.totalRuns + 1;
        const runsNeeded = target - innings.totalRuns;
        const legalBallsRemaining =
          innings.match.totalOvers * BALLS_PER_OVER -
          Math.floor(innings.totalOvers) * BALLS_PER_OVER -
          Math.round((innings.totalOvers % 1) * 10);
        const oversRemaining = legalBallsRemaining / BALLS_PER_OVER;
        requiredRunRate =
          oversRemaining > 0
            ? Math.round((runsNeeded / oversRemaining) * 100) / 100
            : 0;
      }
    }

    // Current run rate
    const legalBalls =
      Math.floor(innings.totalOvers) * BALLS_PER_OVER +
      Math.round((innings.totalOvers % 1) * 10);
    const actualOvers = legalBalls / BALLS_PER_OVER;
    const currentRunRate =
      actualOvers > 0
        ? Math.round((innings.totalRuns / actualOvers) * 100) / 100
        : 0;

    // Partnership
    const partnership = await this.calculatePartnership(inningsId);

    const defaultPlayer = {
      playerId: '',
      name: 'TBD',
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
    };

    return {
      matchId,
      innings: {
        id: innings.id,
        matchId: innings.matchId,
        inningsNumber: innings.inningsNumber,
        battingTeam: innings.battingTeam as Team,
        bowlingTeam: innings.bowlingTeam as Team,
        totalRuns: innings.totalRuns,
        totalWickets: innings.totalWickets,
        totalOvers: innings.totalOvers,
        totalExtras: innings.totalExtras,
        isCompleted: innings.isCompleted,
      },
      currentBatsman: activeBatsmen[0]
        ? {
            playerId: activeBatsmen[0].playerId,
            name: activeBatsmen[0].player.name,
            runs: activeBatsmen[0].runs,
            balls: activeBatsmen[0].balls,
            fours: activeBatsmen[0].fours,
            sixes: activeBatsmen[0].sixes,
            strikeRate: activeBatsmen[0].strikeRate,
          }
        : defaultPlayer,
      nonStriker: activeBatsmen[1]
        ? {
            playerId: activeBatsmen[1].playerId,
            name: activeBatsmen[1].player.name,
            runs: activeBatsmen[1].runs,
            balls: activeBatsmen[1].balls,
            fours: activeBatsmen[1].fours,
            sixes: activeBatsmen[1].sixes,
            strikeRate: activeBatsmen[1].strikeRate,
          }
        : defaultPlayer,
      currentBowler: currentBowlerStats
        ? {
            playerId: currentBowlerStats.playerId,
            name: currentBowlerStats.player.name,
            overs: currentBowlerStats.overs,
            maidens: currentBowlerStats.maidens,
            runs: currentBowlerStats.runs,
            wickets: currentBowlerStats.wickets,
            economy: currentBowlerStats.economy,
          }
        : {
            playerId: '',
            name: 'TBD',
            overs: 0,
            maidens: 0,
            runs: 0,
            wickets: 0,
            economy: 0,
          },
      currentOver: currentOverBalls.map((b) => {
        if (b.isWide) return -1; // Convention: -1 = wide
        if (b.isNoBall) return -2; // Convention: -2 = no-ball
        if (b.isWicket) return -3; // Convention: -3 = wicket
        return b.runs;
      }),
      target,
      requiredRunRate,
      currentRunRate,
      partnership,
    };
  }

  /**
   * Calculate current partnership (runs and balls since last wicket).
   */
  private async calculatePartnership(inningsId: string) {
    // Find the last wicket ball
    const lastWicketBall = await this.prisma.ball.findFirst({
      where: { inningsId, isWicket: true },
      orderBy: { sequenceNumber: 'desc' },
    });

    const partnershipBalls = await this.prisma.ball.findMany({
      where: {
        inningsId,
        ...(lastWicketBall
          ? { sequenceNumber: { gt: lastWicketBall.sequenceNumber } }
          : {}),
      },
    });

    const runs = partnershipBalls.reduce((sum, b) => {
      let r = b.runs;
      if (b.isWide) r += WIDE_EXTRA_RUN;
      if (b.isNoBall) r += NO_BALL_EXTRA_RUN;
      return sum + r;
    }, 0);

    const balls = partnershipBalls.filter(
      (b) => !b.isWide && !b.isNoBall,
    ).length;

    return { runs, balls };
  }
}
