import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringGateway } from './scoring.gateway';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [ClubModule],
  providers: [ScoringService, ScoringGateway],
  exports: [ScoringService, ScoringGateway],
})
export class ScoringModule {}
