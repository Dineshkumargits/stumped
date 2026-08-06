import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClubModule } from './modules/club/club.module';
import { PlayerModule } from './modules/player/player.module';
import { MatchModule } from './modules/match/match.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { SeriesModule } from './modules/series/series.module';
import { AwardsModule } from './modules/awards/awards.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ClubModule,
    PlayerModule,
    MatchModule,
    ScoringModule,
    SeriesModule,
    AwardsModule,
    TrpcModule,
  ],
})
export class AppModule {}
