import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClubModule } from '../club/club.module';
import { SeriesService } from './series.service';

@Module({
  imports: [PrismaModule, ClubModule],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
