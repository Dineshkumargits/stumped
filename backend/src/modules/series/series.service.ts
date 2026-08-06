import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClubService } from '../club/club.service';

export interface TeamStats {
  name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  nrr: number;
}

@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubService: ClubService,
  ) {}

  /**
   * Create a new series.
   */
  async createSeries(
    userId: string,
    clubId: string,
    name: string,
    date: Date,
  ) {
    await this.clubService.verifyScorerOrAdmin(userId, clubId);

    return this.prisma.series.create({
      data: {
        clubId,
        name,
        date,
      },
    });
  }

  /**
   * List all series in a club.
   */
  async listSeries(userId: string, clubId: string) {
    await this.clubService.verifyMembership(userId, clubId);

    return this.prisma.series.findMany({
      where: { clubId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * PUBLIC (no auth): list series for the public scores site.
   */
  async listSeriesPublic(clubId: string) {
    return this.prisma.series.findMany({
      where: { clubId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * PUBLIC (no auth): points table for a series.
   */
  async getPointsTablePublic(seriesId: string) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
    });
    if (!series) {
      throw new NotFoundException('Series not found.');
    }
    return this.computePointsTable(seriesId);
  }

  /**
   * Compute points table for a series.
   */
  async getPointsTable(userId: string, seriesId: string) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
    });

    if (!series) {
      throw new NotFoundException('Series not found.');
    }

    await this.clubService.verifyMembership(userId, series.clubId);

    return this.computePointsTable(seriesId);
  }

  /**
   * Shared points-table computation (no auth) used by both the authed and
   * public entry points.
   */
  private async computePointsTable(seriesId: string) {
    // Get all matches in the series
    const allMatches = await this.prisma.match.findMany({
      where: { seriesId },
      include: {
        innings: true,
        matchPlayers: true,
      },
    });

    // Extract unique team names
    const teamNames = new Set<string>();
    for (const m of allMatches) {
      if (m.teamAName) teamNames.add(m.teamAName);
      if (m.teamBName) teamNames.add(m.teamBName);
    }

    const table: Record<string, TeamStats> = {};
    for (const name of teamNames) {
      table[name] = {
        name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        runsScored: 0,
        oversFaced: 0,
        runsConceded: 0,
        oversBowled: 0,
        nrr: 0,
      };
    }

    const completedMatches = allMatches.filter(m => m.status === 'COMPLETED');

    for (const match of completedMatches) {
      const teamA = match.teamAName;
      const teamB = match.teamBName;

      table[teamA].played++;
      table[teamB].played++;

      if (match.winnerTeam === 'TEAM_A') {
        table[teamA].won++;
        table[teamA].points += 2;
        table[teamB].lost++;
      } else if (match.winnerTeam === 'TEAM_B') {
        table[teamB].won++;
        table[teamB].points += 2;
        table[teamA].lost++;
      } else {
        table[teamA].tied++;
        table[teamA].points += 1;
        table[teamB].tied++;
        table[teamB].points += 1;
      }

      // Aggregate innings runs and calculate overs for NRR
      for (const innings of match.innings) {
        const battingTeamName = innings.battingTeam === 'TEAM_A' ? teamA : teamB;
        const bowlingTeamName = innings.bowlingTeam === 'TEAM_A' ? teamA : teamB;

        const runsScored = innings.totalRuns;
        const runsConceded = innings.totalRuns;

        // Convert totalOvers (float representation like 5.3) to balls
        const legalBalls =
          Math.floor(innings.totalOvers) * 6 +
          Math.round((innings.totalOvers % 1) * 10);
        
        let oversFaced = legalBalls / 6;
        let oversBowled = legalBalls / 6;

        // Standard NRR rule: if all out, team is deemed to have faced full quota
        const battingPlayersCount = match.matchPlayers.filter(
          p => p.team === innings.battingTeam,
        ).length;
        const isAllOut = innings.totalWickets >= battingPlayersCount - 1;

        if (isAllOut) {
          oversFaced = match.totalOvers;
          oversBowled = match.totalOvers;
        }

        table[battingTeamName].runsScored += runsScored;
        table[battingTeamName].oversFaced += oversFaced;

        table[bowlingTeamName].runsConceded += runsConceded;
        table[bowlingTeamName].oversBowled += oversBowled;
      }
    }

    // Finalize NRR computation
    for (const name of teamNames) {
      const team = table[name];
      const nrr =
        (team.oversFaced > 0 ? team.runsScored / team.oversFaced : 0) -
        (team.oversBowled > 0 ? team.runsConceded / team.oversBowled : 0);
      team.nrr = Math.round(nrr * 1000) / 1000;
    }

    // Sort table: points DESC, nrr DESC, won DESC, name ASC
    return Object.values(table).sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.nrr !== a.nrr) {
        return b.nrr - a.nrr;
      }
      if (b.won !== a.won) {
        return b.won - a.won;
      }
      return a.name.localeCompare(b.name);
    });
  }
}
