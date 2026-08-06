import { Module } from '@nestjs/common';
import { ClubService } from './club.service';

@Module({
  providers: [ClubService],
  exports: [ClubService],
})
export class ClubModule {}
