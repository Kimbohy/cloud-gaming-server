import { Module } from '@nestjs/common';
import { EmulatorService } from './emulator.service';
import { EmulatorController } from './emulator.controller';
import { EmulatorGateway } from './emulator.gateway';

@Module({
  providers: [EmulatorService, EmulatorGateway],
  controllers: [EmulatorController],
  exports: [EmulatorService],
})
export class EmulatorModule {}
