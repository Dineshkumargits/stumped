import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [ClubModule],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
