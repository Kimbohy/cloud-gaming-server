import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EmulatorService } from './emulator.service';

interface InputMessage {
  sessionId: string;
  button: string;
  state: 'down' | 'up';
}

// Main gateway for control/signaling
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EmulatorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmulatorGateway.name);

  constructor(private readonly emulatorService: EmulatorService) {}

  handleConnection(client: Socket) {
    this.logger.log(`[Control] Client connected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[Control] Client ${client.id} subscribed to session ${data.sessionId}`,
    );
    client.join(`session-${data.sessionId}`);
    return { success: true, sessionId: data.sessionId };
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Control] Client disconnected: ${client.id}`);
  }
}

// Video stream gateway - optimized for large data frames
@WebSocketGateway({
  namespace: '/video',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'], // Force WebSocket (no polling)
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideoGateway.name);

  constructor(private readonly emulatorService: EmulatorService) {
    // Set up callback for service to push frames
    this.emulatorService.setGatewayCallback((sessionId, frame) => {
      this.broadcastFrame(sessionId, frame);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`[Video] Client connected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[Video] Client ${client.id} subscribed to session ${data.sessionId}`,
    );
    client.join(`session-${data.sessionId}`);
    return { success: true };
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Video] Client disconnected: ${client.id}`);
  }

  // Broadcast frame with volatile flag to drop old frames if client is slow
  broadcastFrame(sessionId: string, frameData: any) {
    this.server.to(`session-${sessionId}`).volatile.emit('frame', frameData);
  }
}

// Audio stream gateway - optimized for low latency
@WebSocketGateway({
  namespace: '/audio',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class AudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AudioGateway.name);

  constructor(private readonly emulatorService: EmulatorService) {
    // Set up callback for service to push audio
    this.emulatorService.setAudioGatewayCallback((sessionId, audio) => {
      this.broadcastAudio(sessionId, audio);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`[Audio] Client connected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[Audio] Client ${client.id} subscribed to session ${data.sessionId}`,
    );
    client.join(`session-${data.sessionId}`);
    return { success: true };
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Audio] Client disconnected: ${client.id}`);
  }

  // Broadcast audio with volatile flag for low latency
  broadcastAudio(sessionId: string, audioData: any) {
    this.server.to(`session-${sessionId}`).volatile.emit('audio', audioData);
  }
}

// Input gateway - optimized for minimal latency, reliable delivery
@WebSocketGateway({
  namespace: '/input',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class InputGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InputGateway.name);

  constructor(private readonly emulatorService: EmulatorService) {}

  handleConnection(client: Socket) {
    this.logger.log(`[Input] Client connected: ${client.id}`);
  }

  @SubscribeMessage('input')
  handleInput(
    @MessageBody() data: InputMessage,
    @ConnectedSocket() client: Socket,
  ) {
    if (data.sessionId) {
      this.emulatorService.sendInput(data.sessionId, {
        button: data.button,
        state: data.state,
      });
    }
    return { success: true };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[Input] Client ${client.id} subscribed to session ${data.sessionId}`,
    );
    client.join(`session-${data.sessionId}`);
    return { success: true };
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Input] Client disconnected: ${client.id}`);
  }
}
