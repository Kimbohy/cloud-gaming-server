import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmulatorModule } from './emulator/emulator.module';
import { PrismaService } from './prisma/prisma.service';
import { RomsModule } from './roms/roms.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [EmulatorModule, RomsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
