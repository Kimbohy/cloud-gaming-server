import { Module } from '@nestjs/common';
import { EmulatorService } from './emulator.service';
import { EmulatorController } from './emulator.controller';
import {
  EmulatorGateway,
  VideoGateway,
  AudioGateway,
  InputGateway,
} from './emulator.gateway';
import { WebRTCService } from './webrtc.service';
import { WebRTCGateway } from './webrtc.gateway';

@Module({
  providers: [
    EmulatorService,
    EmulatorGateway,
    VideoGateway,
    AudioGateway,
    InputGateway,
    WebRTCService,
    WebRTCGateway,
  ],
  controllers: [EmulatorController],
  exports: [EmulatorService, WebRTCService],
})
export class EmulatorModule {}
