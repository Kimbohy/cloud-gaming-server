import { Module } from '@nestjs/common';
import { EmulatorService } from './emulator.service';
import { EmulatorController } from './emulator.controller';
import {
  EmulatorGateway,
  VideoGateway,
  AudioGateway,
  InputGateway,
} from './emulator.gateway';

@Module({
  providers: [
    EmulatorService,
    EmulatorGateway,
    VideoGateway,
    AudioGateway,
    InputGateway,
  ],
  controllers: [EmulatorController],
  exports: [EmulatorService],
})
export class EmulatorModule {}
