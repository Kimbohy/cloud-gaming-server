import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { LibretroCore } from './libretro-wrapper';

export interface GameSession {
  id: string;
  romPath: string;
  process?: ChildProcess;
  core?: LibretroCore;
  status: 'created' | 'running' | 'stopped';
  videoSocket?: string;
  audioSocket?: string;
  frameInterval?: NodeJS.Timeout;
  useNativeCore: boolean;
}

@Injectable()
export class EmulatorService {
  private readonly logger = new Logger(EmulatorService.name);
  private sessions = new Map<string, GameSession>();
  private readonly libretroCore =
    '/usr/lib/x86_64-linux-gnu/libretro/mgba_libretro.so';
  private gatewayCallback: ((sessionId: string, frame: any) => void) | null =
    null;

  setGatewayCallback(callback: (sessionId: string, frame: any) => void) {
    this.gatewayCallback = callback;
  }

  async createSession(romPath: string): Promise<GameSession> {
    const sessionId = this.generateSessionId();

    // Verify ROM exists
    if (!fs.existsSync(romPath)) {
      throw new Error(`ROM not found: ${romPath}`);
    }

    const session: GameSession = {
      id: sessionId,
      romPath,
      status: 'created',
      useNativeCore: true, // Use native libretro core by default
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Created session ${sessionId} for ROM: ${romPath}`);

    return session;
  }

  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === 'running') {
      this.logger.warn(`Session ${sessionId} is already running`);
      return;
    }

    if (session.useNativeCore) {
      // Use native libretro core
      try {
        const core = new LibretroCore();

        // Load the mGBA core
        if (!core.loadCore(this.libretroCore)) {
          throw new Error('Failed to load libretro core');
        }

        // Load the game ROM
        if (!core.loadGame(session.romPath)) {
          throw new Error('Failed to load game ROM');
        }

        session.core = core;
        session.status = 'running';

        // Start frame generation loop at 60fps
        this.startNativeCoreFrameStreaming(sessionId);

        this.logger.log(
          `Started session ${sessionId} with native libretro core`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to start native core for session ${sessionId}:`,
          error,
        );
        throw error;
      }
    } else {
      // Fallback to mock frames
      session.status = 'running';
      this.startFrameStreaming(sessionId);
      this.logger.log(`Started session ${sessionId} (mock mode)`);
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.frameInterval) {
      clearInterval(session.frameInterval);
      session.frameInterval = undefined;
    }

    if (session.process) {
      session.process.kill('SIGTERM');
      session.process = undefined;
    }

    session.status = 'stopped';
    this.sessions.delete(sessionId);

    this.logger.log(`Stopped session ${sessionId}`);
  }

  private startNativeCoreFrameStreaming(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.core) return;

    // Run emulator at 60fps and capture frames
    let frameCount = 0;
    session.frameInterval = setInterval(async () => {
      if (session.status === 'running' && session.core) {
        try {
          // Run one frame of emulation
          session.core.runFrame();

          // Get the frame that was just rendered
          const frame = await this.getFrameStream(sessionId);

          // Emit frame to gateway
          if (frame && this.gatewayCallback) {
            this.gatewayCallback(sessionId, frame);
            frameCount++;
            if (frameCount % 60 === 0) {
              this.logger.debug(
                `Emulated ${frameCount} frames for session ${sessionId}`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Error running frame for session ${sessionId}:`,
            error,
          );
        }
      }
    }, 1000 / 60); // 60 FPS
  }

  private startFrameStreaming(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Generate mock frames at 60fps (fallback mode)
    let frameCount = 0;
    session.frameInterval = setInterval(() => {
      if (session.status === 'running') {
        frameCount++;
      }
    }, 1000 / 60);
  }

  private generateMockFrame(frameCount: number): any {
    // Generate a mock frame (240x160 for GBA)
    // In production: this would be actual RGBA pixel data from libretro
    return {
      width: 240,
      height: 160,
      frame: frameCount,
      timestamp: Date.now(),
    };
  }

  async getFrameStream(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return null;
    }

    if (session.core) {
      // Get real frame from native core
      const frameBuffer = session.core.getFrameBuffer();
      if (!frameBuffer) {
        this.logger.warn(`No frame buffer available for session ${sessionId}`);
        return null;
      }

      const width = session.core.getFrameWidth();
      const height = session.core.getFrameHeight();

      try {
        // Encode RGBA buffer as PNG for efficient transmission
        const png = await sharp(frameBuffer, {
          raw: {
            width,
            height,
            channels: 4,
          },
        })
          .png()
          .toBuffer();

        return {
          width,
          height,
          data: png.toString('base64'),
          format: 'png',
          timestamp: Date.now(),
        };
      } catch (error) {
        this.logger.error('Error encoding frame:', error);
        return null;
      }
    } else {
      // Return mock frame
      return this.generateMockFrame(Date.now());
    }
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  sendInput(sessionId: string, input: any): void {
    const session = this.sessions.get(sessionId);
    this.logger.log(
      `[sendInput] sessionId=${sessionId}, exists=${!!session}, status=${session?.status}, hasCore=${!!session?.core}`,
    );

    if (!session) {
      this.logger.warn(`Cannot send input - session ${sessionId} not found`);
      this.logger.log(
        `Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`,
      );
      return;
    }

    if (session.status !== 'running') {
      this.logger.warn(
        `Cannot send input - session ${sessionId} status is ${session.status}`,
      );
      return;
    }

    if (session.core) {
      // Send input to native libretro core
      const { button, state } = input;
      this.logger.log(
        `Sending input to core: button=${button}, state=${state}`,
      );
      session.core.setInput(button, state === 'down');
    } else {
      this.logger.debug(`Mock input for session ${sessionId}:`, input);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
