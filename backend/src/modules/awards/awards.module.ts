import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClubModule } from '../club/club.module';
import { AwardsService } from './awards.service';

@Module({
  imports: [PrismaModule, ClubModule],
  providers: [AwardsService],
  exports: [AwardsService],
})
export class AwardsModule {}
