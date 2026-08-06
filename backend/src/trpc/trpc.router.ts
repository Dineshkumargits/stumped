import { INestApplication, Injectable, Inject } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import { AuthService } from '../modules/auth/auth.service';
import { ClubService } from '../modules/club/club.service';
import { PlayerService } from '../modules/player/player.service';
import { MatchService } from '../modules/match/match.service';
import { ScoringService } from '../modules/scoring/scoring.service';
import { SeriesService } from '../modules/series/series.service';
import { AwardsService } from '../modules/awards/awards.service';
import { JwtService } from '@nestjs/jwt';
import {
  googleSignInSchema,
  createClubSchema,
  joinClubSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  createPlayerSchema,
  updatePlayerSchema,
  overrideRatingSchema,
  createMatchSchema,
  autoBalanceSchema,
  recordTossSchema,
  recordBallSchema,
  undoBallSchema,
  createSeriesSchema,
  headToHeadSchema,
} from '@stumped/shared';
import { z } from 'zod';

export interface TrpcContext {
  userId: string | null;
}

const t = initTRPC.context<TrpcContext>().create();

const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { userId: ctx.userId } });
});

const protectedProcedure = t.procedure.use(isAuthed);

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly authService: AuthService,
    private readonly clubService: ClubService,
    private readonly playerService: PlayerService,
    private readonly matchService: MatchService,
    private readonly scoringService: ScoringService,
    private readonly seriesService: SeriesService,
    private readonly awardsService: AwardsService,
    @Inject('ScoringGateway') private readonly scoringGateway: any,
    private readonly jwtService: JwtService,
  ) {}

  get router() {
    return t.router({
      // ============================
      // AUTH
      // ============================
      auth: t.router({
        googleSignIn: publicProcedure
          .input(googleSignInSchema)
          .mutation(async ({ input }) => {
            return this.authService.googleSignIn(input.idToken);
          }),

        getMe: protectedProcedure.query(async ({ ctx }) => {
          return this.authService.getProfile(ctx.userId);
        }),
      }),

      // ============================
      // CLUB
      // ============================
      club: t.router({
        create: protectedProcedure
          .input(createClubSchema)
          .mutation(async ({ ctx, input }) => {
            return this.clubService.createClub(ctx.userId, input.name);
          }),

        join: protectedProcedure
          .input(joinClubSchema)
          .mutation(async ({ ctx, input }) => {
            return this.clubService.joinClub(ctx.userId, input.inviteCode);
          }),

        getMyClubs: protectedProcedure.query(async ({ ctx }) => {
          return this.clubService.getMyClubs(ctx.userId);
        }),

        getDetails: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.clubService.getClubDetails(ctx.userId, input.clubId);
          }),

        updateMemberRole: protectedProcedure
          .input(updateMemberRoleSchema)
          .mutation(async ({ ctx, input }) => {
            return this.clubService.updateMemberRole(
              ctx.userId,
              input.clubId,
              input.userId,
              input.role,
            );
          }),

        removeMember: protectedProcedure
          .input(removeMemberSchema)
          .mutation(async ({ ctx, input }) => {
            return this.clubService.removeMember(
              ctx.userId,
              input.clubId,
              input.userId,
            );
          }),

        regenerateInviteCode: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .mutation(async ({ ctx, input }) => {
            return this.clubService.regenerateInviteCode(
              ctx.userId,
              input.clubId,
            );
          }),
      }),

      // ============================
      // PLAYER
      // ============================
      player: t.router({
        create: protectedProcedure
          .input(createPlayerSchema)
          .mutation(async ({ ctx, input }) => {
            return this.playerService.createPlayer(
              ctx.userId,
              input.clubId,
              input.name,
              input.category,
            );
          }),

        list: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.playerService.listPlayers(ctx.userId, input.clubId);
          }),

        getDetail: protectedProcedure
          .input(z.object({ playerId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.playerService.getPlayerDetail(
              ctx.userId,
              input.playerId,
            );
          }),

        update: protectedProcedure
          .input(
            z.object({
              playerId: z.string().uuid(),
              data: updatePlayerSchema,
            }),
          )
          .mutation(async ({ ctx, input }) => {
            return this.playerService.updatePlayer(
              ctx.userId,
              input.playerId,
              input.data,
            );
          }),

        overrideRating: protectedProcedure
          .input(
            z.object({
              playerId: z.string().uuid(),
              ...overrideRatingSchema.shape,
            }),
          )
          .mutation(async ({ ctx, input }) => {
            return this.playerService.overrideRating(
              ctx.userId,
              input.playerId,
              input.battingRating,
              input.bowlingRating,
            );
          }),

        linkToUser: protectedProcedure
          .input(
            z.object({
              clubId: z.string().uuid(),
              playerId: z.string().uuid().nullable(),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            return this.playerService.linkPlayerToUser(
              ctx.userId,
              input.clubId,
              input.playerId,
            );
          }),

        getLinkedPlayer: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.playerService.getLinkedPlayer(
              ctx.userId,
              input.clubId,
            );
          }),
      }),

      // ============================
      // MATCH
      // ============================
      match: t.router({
        create: protectedProcedure
          .input(createMatchSchema)
          .mutation(async ({ ctx, input }) => {
            return this.matchService.createMatch(ctx.userId, input);
          }),

        autoBalance: protectedProcedure
          .input(autoBalanceSchema)
          .mutation(async ({ ctx, input }) => {
            return this.matchService.autoBalance(
              ctx.userId,
              input.clubId,
              input.playerIds,
              input.reshuffle,
            );
          }),

        recordToss: protectedProcedure
          .input(recordTossSchema)
          .mutation(async ({ ctx, input }) => {
            return this.matchService.recordToss(
              ctx.userId,
              input.matchId,
              input.winner,
              input.decision,
            );
          }),

        startInnings: protectedProcedure
          .input(z.object({ matchId: z.string().uuid() }))
          .mutation(async ({ ctx, input }) => {
            return this.matchService.startInnings(ctx.userId, input.matchId);
          }),

        getDetails: protectedProcedure
          .input(z.object({ matchId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.matchService.getMatchDetails(ctx.userId, input.matchId);
          }),

        setMom: protectedProcedure
          .input(
            z.object({
              matchId: z.string().uuid(),
              playerId: z.string().uuid(),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            return this.matchService.setMom(
              ctx.userId,
              input.matchId,
              input.playerId,
            );
          }),

        list: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.matchService.listMatches(ctx.userId, input.clubId);
          }),
      }),

      // ============================
      // SCORING (via tRPC for non-realtime operations)
      // ============================
      scoring: t.router({
        recordBall: protectedProcedure
          .input(recordBallSchema)
          .mutation(async ({ ctx, input }) => {
            const liveState = await this.scoringService.recordBall(
              ctx.userId,
              input,
            );
            // Broadcast via WebSocket
            this.scoringGateway.broadcastBallUpdate(
              liveState.matchId,
              liveState,
            );
            return liveState;
          }),

        undoLastBall: protectedProcedure
          .input(undoBallSchema)
          .mutation(async ({ ctx, input }) => {
            const liveState = await this.scoringService.undoLastBall(
              ctx.userId,
              input.inningsId,
            );
            this.scoringGateway.broadcastBallUpdate(
              liveState.matchId,
              liveState,
            );
            return liveState;
          }),

        getLiveState: protectedProcedure
          .input(
            z.object({
              matchId: z.string().uuid(),
              inningsId: z.string().uuid(),
            }),
          )
          .query(async ({ input }) => {
            return this.scoringService.buildLiveScoreState(
              input.matchId,
              input.inningsId,
            );
          }),
      }),

      // ============================
      // SERIES
      // ============================
      series: t.router({
        create: protectedProcedure
          .input(createSeriesSchema)
          .mutation(async ({ ctx, input }) => {
            return this.seriesService.createSeries(
              ctx.userId,
              input.clubId,
              input.name,
              new Date(input.date),
            );
          }),

        list: protectedProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.seriesService.listSeries(ctx.userId, input.clubId);
          }),

        getPointsTable: protectedProcedure
          .input(z.object({ seriesId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.seriesService.getPointsTable(ctx.userId, input.seriesId);
          }),
      }),

      // ============================
      // AWARDS
      // ============================
      awards: t.router({
        getMatchAwards: protectedProcedure
          .input(z.object({ matchId: z.string().uuid() }))
          .query(async ({ ctx, input }) => {
            return this.awardsService.getMatchAwards(ctx.userId, input.matchId);
          }),

        computeSeasonalAwards: protectedProcedure
          .input(
            z.object({
              clubId: z.string().uuid(),
              period: z.string().optional(),
            }),
          )
          .query(async ({ ctx, input }) => {
            return this.awardsService.computeSeasonalAwards(
              ctx.userId,
              input.clubId,
              input.period,
            );
          }),
      }),

      // ============================
      // STATS
      // ============================
      stats: t.router({
        getH2H: protectedProcedure
          .input(headToHeadSchema)
          .query(async ({ ctx, input }) => {
            return this.playerService.getH2H(
              ctx.userId,
              input.playerAId,
              input.playerBId,
            );
          }),

        getComparison: protectedProcedure
          .input(headToHeadSchema)
          .query(async ({ ctx, input }) => {
            return this.playerService.getComparison(
              ctx.userId,
              input.playerAId,
              input.playerBId,
            );
          }),
      }),

      // ============================
      // PUBLIC (no auth) — read-only endpoints for the public scores site.
      // Entry point is a club invite code; everything else is by id.
      // ============================
      public: t.router({
        getClub: publicProcedure
          .input(z.object({ code: z.string().min(1).max(12) }))
          .query(async ({ input }) => {
            return this.clubService.getPublicClubByCode(input.code);
          }),

        listMatches: publicProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.matchService.listMatchesPublic(input.clubId);
          }),

        getMatch: publicProcedure
          .input(z.object({ matchId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.matchService.getMatchDetailsPublic(input.matchId);
          }),

        getLiveState: publicProcedure
          .input(
            z.object({
              matchId: z.string().uuid(),
              inningsId: z.string().uuid(),
            }),
          )
          .query(async ({ input }) => {
            return this.scoringService.buildLiveScoreState(
              input.matchId,
              input.inningsId,
            );
          }),

        getLeaderboard: publicProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.playerService.listPlayersPublic(input.clubId);
          }),

        getMatchAwards: publicProcedure
          .input(z.object({ matchId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.awardsService.getMatchAwardsPublic(input.matchId);
          }),

        listSeries: publicProcedure
          .input(z.object({ clubId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.seriesService.listSeriesPublic(input.clubId);
          }),

        getPointsTable: publicProcedure
          .input(z.object({ seriesId: z.string().uuid() }))
          .query(async ({ input }) => {
            return this.seriesService.getPointsTablePublic(input.seriesId);
          }),
      }),
    });
  }

  /**
   * Create tRPC context from Express request.
   * Extracts JWT from Authorization header.
   */
  createContext() {
    return async ({
      req,
    }: trpcExpress.CreateExpressContextOptions): Promise<TrpcContext> => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return { userId: null };
      }

      const token = authHeader.substring(7);
      try {
        const payload = this.jwtService.verify(token, {
          algorithms: ['HS256'],
        });
        return { userId: payload.sub };
      } catch {
        return { userId: null };
      }
    };
  }

  /**
   * Apply tRPC middleware to the NestJS Express app.
   */
  applyMiddleware(app: INestApplication) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      '/trpc',
      trpcExpress.createExpressMiddleware({
        router: this.router,
        createContext: this.createContext(),
      }),
    );
  }
}

export type AppRouter = TrpcRouter['router'];
