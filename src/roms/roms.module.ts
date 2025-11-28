import { Module } from '@nestjs/common';
import { RomsService } from './roms.service';
import { RomsController } from './roms.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [RomsController],
  providers: [RomsService, PrismaService],
})
export class RomsModule {}
