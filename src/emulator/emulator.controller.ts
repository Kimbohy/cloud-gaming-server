import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmulatorService } from './emulator.service';

@Controller('api/emulator')
export class EmulatorController {
  constructor(private readonly emulatorService: EmulatorService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() body: { romPath: string }) {
    const session = await this.emulatorService.createSession(body.romPath);
    return {
      sessionId: session.id,
      status: session.status,
      romPath: session.romPath,
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
