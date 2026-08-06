import { Module } from '@nestjs/common';
import { TrpcRouter } from './trpc.router';
import { AuthModule } from '../modules/auth/auth.module';
import { ClubModule } from '../modules/club/club.module';
import { PlayerModule } from '../modules/player/player.module';
import { MatchModule } from '../modules/match/match.module';
import { ScoringModule } from '../modules/scoring/scoring.module';
import { SeriesModule } from '../modules/series/series.module';
import { AwardsModule } from '../modules/awards/awards.module';
import { ScoringGateway } from '../modules/scoring/scoring.gateway';

@Module({
  imports: [
    AuthModule,
    ClubModule,
    PlayerModule,
    MatchModule,
    ScoringModule,
    SeriesModule,
    AwardsModule,
  ],
  providers: [
    TrpcRouter,
    {
      provide: 'ScoringGateway',
      useExisting: ScoringGateway,
    },
  ],
  exports: [TrpcRouter],
})
export class TrpcModule {}
