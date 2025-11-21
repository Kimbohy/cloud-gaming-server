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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EmulatorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmulatorGateway.name);
  private streamIntervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly emulatorService: EmulatorService) {
    // Set up callback for service to push frames
    this.emulatorService.setGatewayCallback((sessionId, frame) => {
      this.broadcastFrame(sessionId, frame);
    });

    // Set up callback for service to push audio
    this.emulatorService.setAudioGatewayCallback((sessionId, audio) => {
      this.broadcastAudio(sessionId, audio);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('input')
  handleInput(
    @MessageBody() data: InputMessage,
    @ConnectedSocket() client: Socket,
  ) {
    // this.logger.debug(`Input from ${client.id}:`, data);

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
      `Client ${client.id} subscribed to session ${data.sessionId}`,
    );
    client.join(`session-${data.sessionId}`);

    return { success: true, sessionId: data.sessionId };
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Method to broadcast frame updates to subscribed clients
  broadcastFrame(sessionId: string, frameData: any) {
    this.server.to(`session-${sessionId}`).emit('frame', frameData);
  }

  // Method to broadcast audio to subscribed clients
  broadcastAudio(sessionId: string, audioData: any) {
    this.server.to(`session-${sessionId}`).emit('audio', audioData);
  }
}
