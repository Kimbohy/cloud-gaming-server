import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WebRTCService } from './webrtc.service';
import { EmulatorService } from './emulator.service';

interface SignalingMessage {
  sessionId?: string;
  gameSessionId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

// WebRTC signaling gateway
@WebSocketGateway({
  namespace: '/webrtc',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class WebRTCGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRTCGateway.name);
  private clientSessions = new Map<string, string>(); // clientId -> webrtcSessionId

  constructor(
    private readonly webrtcService: WebRTCService,
    private readonly emulatorService: EmulatorService,
  ) {}

  afterInit() {
    // Inject WebRTC service into emulator service
    this.emulatorService.setWebRTCService(this.webrtcService);
    this.logger.log('WebRTC Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`[WebRTC] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WebRTC] Client disconnected: ${client.id}`);

    // Clean up WebRTC session for this client
    const webrtcSessionId = this.clientSessions.get(client.id);
    if (webrtcSessionId) {
      this.webrtcService.closeSession(webrtcSessionId);
      this.clientSessions.delete(client.id);
    }
  }

  @SubscribeMessage('create-session')
  async handleCreateSession(
    @MessageBody() data: { gameSessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[WebRTC] Creating session for game ${data.gameSessionId}, client ${client.id}`,
    );

    try {
      // Create WebRTC session
      const webrtcSessionId = await this.webrtcService.createSession(
        data.gameSessionId,
        client.id,
      );

      this.clientSessions.set(client.id, webrtcSessionId);

      // Set up ICE candidate callback
      this.webrtcService.onIceCandidate(webrtcSessionId, (candidate) => {
        client.emit('ice-candidate', {
          sessionId: webrtcSessionId,
          candidate,
        });
      });

      // Set up data channel message handler for input
      this.webrtcService.onDataChannelMessage(webrtcSessionId, (inputData) => {
        this.handleInputFromDataChannel(data.gameSessionId, inputData);
      });

      // Create and send offer
      const offer = await this.webrtcService.createOffer(webrtcSessionId);
      if (!offer) {
        throw new Error('Failed to create offer');
      }

      return {
        success: true,
        sessionId: webrtcSessionId,
        offer,
      };
    } catch (error) {
      this.logger.error(`Failed to create WebRTC session:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('answer')
  async handleAnswer(
    @MessageBody() data: { sessionId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`[WebRTC] Received answer for session ${data.sessionId}`);

    try {
      const success = await this.webrtcService.handleAnswer(
        data.sessionId,
        data.answer,
      );

      return { success };
    } catch (error) {
      this.logger.error(`Failed to handle answer:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @MessageBody() data: { sessionId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const success = await this.webrtcService.addIceCandidate(
        data.sessionId,
        data.candidate,
      );

      return { success };
    } catch (error) {
      this.logger.error(`Failed to add ICE candidate:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @SubscribeMessage('close-session')
  async handleCloseSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`[WebRTC] Closing session ${data.sessionId}`);

    await this.webrtcService.closeSession(data.sessionId);
    this.clientSessions.delete(client.id);

    return { success: true };
  }

  private handleInputFromDataChannel(
    gameSessionId: string,
    inputData: any,
  ): void {
    if (inputData.type === 'input') {
      this.emulatorService.sendInput(gameSessionId, {
        button: inputData.button,
        state: inputData.state,
      });
    }
  }

  // Method to broadcast connection status
  broadcastConnectionStatus(
    gameSessionId: string,
    status: 'connected' | 'disconnected',
  ): void {
    this.server.to(`game-${gameSessionId}`).emit('connection-status', {
      status,
      gameSessionId,
    });
  }
}
