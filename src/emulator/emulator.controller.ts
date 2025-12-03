import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { EmulatorService } from './emulator.service';

@Controller('emulator')
export class EmulatorController {
  constructor(private readonly emulatorService: EmulatorService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body()
    body: {
      romPath: string;
      streamMode?: 'websocket' | 'webrtc' | 'both';
    },
  ) {
    const session = await this.emulatorService.createSession(
      body.romPath,
      body.streamMode || 'websocket',
    );
    return {
      sessionId: session.id,
      status: session.status,
      romPath: session.romPath,
      streamMode: session.streamMode,
    };
  }

  @Post('sessions/:id/start')
  async startSession(@Param('id') id: string) {
    await this.emulatorService.startSession(id);
    return { message: 'Session started', sessionId: id };
  }

  @Post('sessions/:id/input')
  async sendInput(@Param('id') id: string, @Body() input: any) {
    this.emulatorService.sendInput(id, input);
    return { message: 'Input received', sessionId: id };
  }

  @Patch('sessions/:id/stream-mode')
  async setStreamMode(
    @Param('id') id: string,
    @Body() body: { mode: 'websocket' | 'webrtc' | 'both' },
  ) {
    const success = this.emulatorService.setStreamMode(id, body.mode);
    if (!success) {
      return { error: 'Session not found', sessionId: id };
    }
    return {
      message: 'Stream mode updated',
      sessionId: id,
      streamMode: body.mode,
    };
  }

  @Get('sessions/:id/stream-mode')
  async getStreamMode(@Param('id') id: string) {
    const mode = this.emulatorService.getStreamMode(id);
    if (!mode) {
      return { error: 'Session not found', sessionId: id };
    }
    return { sessionId: id, streamMode: mode };
  }

  @Delete('sessions/:id')
  async stopSession(@Param('id') id: string) {
    await this.emulatorService.stopSession(id);
    return { message: 'Session stopped', sessionId: id };
  }

  @Get('sessions')
  async getAllSessions() {
    return this.emulatorService.getAllSessions();
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = this.emulatorService.getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    return session;
  }
}
