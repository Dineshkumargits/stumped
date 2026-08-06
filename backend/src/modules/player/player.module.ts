import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [ClubModule],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
