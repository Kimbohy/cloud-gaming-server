import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmulatorModule } from './emulator/emulator.module';
import { PrismaService } from './prisma/prisma.service';
import { RomsModule } from './roms/roms.module';

@Module({
  imports: [EmulatorModule, RomsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
