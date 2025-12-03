import { Injectable, Logger } from '@nestjs/common';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  nonstandard,
} from '@roamhq/wrtc';

const { RTCAudioSource, RTCVideoSource } = nonstandard;

export interface WebRTCSession {
  id: string;
  gameSessionId: string;
  peerConnection: RTCPeerConnection;
  videoSource: any;
  audioSource: any;
  videoTrack: any;
  audioTrack: any;
  dataChannel: any;
  isConnected: boolean;
  inputCallback?: (data: any) => void;
}

@Injectable()
export class WebRTCService {
  private readonly logger = new Logger(WebRTCService.name);
  private sessions = new Map<string, WebRTCSession>();

  // ICE servers configuration
  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  async createSession(
    gameSessionId: string,
    clientId: string,
  ): Promise<string> {
    const sessionId = `webrtc_${clientId}_${Date.now()}`;

    // Create peer connection
    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    // Create video source and track
    const videoSource = new RTCVideoSource();
    const videoTrack = videoSource.createTrack();

    // Create audio source and track
    const audioSource = new RTCAudioSource();
    const audioTrack = audioSource.createTrack();

    // Add tracks to peer connection
    peerConnection.addTrack(videoTrack);
    peerConnection.addTrack(audioTrack);

    // Create data channel for input (low latency, ordered)
    const dataChannel = peerConnection.createDataChannel('input', {
      ordered: true,
      maxRetransmits: 0, // Unreliable for lowest latency
    });

    const session: WebRTCSession = {
      id: sessionId,
      gameSessionId,
      peerConnection,
      videoSource,
      audioSource,
      videoTrack,
      audioTrack,
      dataChannel,
      isConnected: false,
    };

    // Setup event handlers
    this.setupPeerConnectionHandlers(session);
    this.setupDataChannelHandlers(session);

    this.sessions.set(sessionId, session);
    this.logger.log(
      `Created WebRTC session ${sessionId} for game session ${gameSessionId}`,
    );

    return sessionId;
  }

  private setupPeerConnectionHandlers(session: WebRTCSession): void {
    const { peerConnection, id } = session;

    peerConnection.oniceconnectionstatechange = () => {
      this.logger.log(
        `[${id}] ICE connection state: ${peerConnection.iceConnectionState}`,
      );

      if (peerConnection.iceConnectionState === 'connected') {
        session.isConnected = true;
        this.logger.log(`[${id}] WebRTC connection established`);
      } else if (
        peerConnection.iceConnectionState === 'disconnected' ||
        peerConnection.iceConnectionState === 'failed'
      ) {
        session.isConnected = false;
        this.logger.warn(`[${id}] WebRTC connection lost`);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      this.logger.log(
        `[${id}] Connection state: ${peerConnection.connectionState}`,
      );
    };
  }

  private setupDataChannelHandlers(session: WebRTCSession): void {
    const { dataChannel, id } = session;

    dataChannel.onopen = () => {
      this.logger.log(`[${id}] Data channel opened - ready for input`);
    };

    dataChannel.onclose = () => {
      this.logger.log(`[${id}] Data channel closed`);
    };

    dataChannel.onerror = (error: any) => {
      this.logger.error(`[${id}] Data channel error:`, error);
    };

    // Handle incoming messages on the data channel
    dataChannel.onmessage = (event: { data: any }) => {
      try {
        const data = JSON.parse(event.data);
        this.logger.log(
          `[${id}] Data channel message received: ${JSON.stringify(data)}`,
        );
        if (session.inputCallback) {
          session.inputCallback(data);
        } else {
          this.logger.warn(`[${id}] No input callback registered for session`);
        }
      } catch (error) {
        this.logger.error(
          `[${id}] Failed to parse data channel message:`,
          error,
        );
      }
    };
  }

  async createOffer(sessionId: string): Promise<RTCSessionDescription | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return null;
    }

    try {
      const offer = await session.peerConnection.createOffer();
      await session.peerConnection.setLocalDescription(offer);
      return session.peerConnection.localDescription;
    } catch (error) {
      this.logger.error(
        `Failed to create offer for session ${sessionId}:`,
        error,
      );
      return null;
    }
  }

  async handleAnswer(
    sessionId: string,
    answer: RTCSessionDescription,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return false;
    }

    try {
      await session.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
      this.logger.log(`[${sessionId}] Answer processed successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to handle answer for session ${sessionId}:`,
        error,
      );
      return false;
    }
  }

  async addIceCandidate(
    sessionId: string,
    candidate: RTCIceCandidate,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return false;
    }

    try {
      await session.peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate),
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add ICE candidate for session ${sessionId}:`,
        error,
      );
      return false;
    }
  }

  onIceCandidate(
    sessionId: string,
    callback: (candidate: RTCIceCandidate) => void,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callback(event.candidate);
      }
    };
  }

  onDataChannelMessage(sessionId: string, callback: (data: any) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Store the callback to be called when messages arrive
    session.inputCallback = callback;
    this.logger.log(`[${sessionId}] Input callback registered`);
  }

  /**
   * Send video frame through WebRTC
   * @param sessionId WebRTC session ID
   * @param frameData RGBA frame data
   * @param width Frame width
   * @param height Frame height
   */
  sendVideoFrame(
    sessionId: string,
    frameData: Buffer,
    width: number,
    height: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Log occasionally to avoid spam
      if (Math.random() < 0.01) {
        this.logger.warn(`[sendVideoFrame] Session ${sessionId} not found`);
      }
      return;
    }
    if (!session.isConnected) {
      if (Math.random() < 0.01) {
        this.logger.warn(
          `[sendVideoFrame] Session ${sessionId} not connected yet`,
        );
      }
      return;
    }

    try {
      // Convert RGBA to I420 format (YUV420)
      const i420Frame = this.rgbaToI420(frameData, width, height);

      // Send frame through video source
      session.videoSource.onFrame({
        width,
        height,
        data: i420Frame,
      });
    } catch (error) {
      this.logger.error(`Failed to send video frame:`, error);
    }
  }

  /**
   * Send audio samples through WebRTC
   * @param sessionId WebRTC session ID
   * @param audioData PCM audio samples (Int16)
   * @param sampleRate Sample rate (e.g., 32040)
   * @param channels Number of channels (1 or 2)
   */
  sendAudioSamples(
    sessionId: string,
    audioData: Buffer,
    sampleRate: number = 32040,
    channels: number = 2,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      if (Math.random() < 0.01) {
        this.logger.warn(`[sendAudioSamples] Session ${sessionId} not found`);
      }
      return;
    }
    if (!session.isConnected) {
      if (Math.random() < 0.01) {
        this.logger.warn(
          `[sendAudioSamples] Session ${sessionId} not connected yet`,
        );
      }
      return;
    }

    try {
      // Convert Buffer to Int16Array properly
      const int16Array = new Int16Array(audioData.length / 2);
      for (let i = 0; i < int16Array.length; i++) {
        int16Array[i] = audioData.readInt16LE(i * 2);
      }

      // Calculate number of samples per channel
      const samplesPerChannel = Math.floor(int16Array.length / channels);

      if (samplesPerChannel === 0) return;

      // Resample from 32040 Hz to 48000 Hz for WebRTC compatibility
      const targetSampleRate = 48000;
      const resampledData = this.resampleAudio(
        int16Array,
        sampleRate,
        targetSampleRate,
        channels,
      );

      const resampledSamplesPerChannel = Math.floor(
        resampledData.length / channels,
      );

      // RTCAudioSource.onData expects this format
      const audioFrame = {
        samples: resampledData,
        sampleRate: targetSampleRate,
        bitsPerSample: 16,
        channelCount: channels,
        numberOfFrames: resampledSamplesPerChannel,
      };

      session.audioSource.onData(audioFrame);
    } catch (error) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) {
        this.logger.error(`Failed to send audio samples:`, error);
      }
    }
  }

  /**
   * Simple linear interpolation resampling
   */
  private resampleAudio(
    input: Int16Array,
    fromRate: number,
    toRate: number,
    channels: number,
  ): Int16Array {
    if (fromRate === toRate) {
      return input;
    }

    const ratio = fromRate / toRate;
    const inputFrames = Math.floor(input.length / channels);
    const outputFrames = Math.floor(inputFrames / ratio);
    const output = new Int16Array(outputFrames * channels);

    for (let i = 0; i < outputFrames; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputFrames - 1);
      const fraction = srcIndex - srcIndexFloor;

      for (let ch = 0; ch < channels; ch++) {
        const sample1 = input[srcIndexFloor * channels + ch];
        const sample2 = input[srcIndexCeil * channels + ch];
        // Linear interpolation
        output[i * channels + ch] = Math.round(
          sample1 + (sample2 - sample1) * fraction,
        );
      }
    }

    return output;
  }

  /**
   * Convert RGBA to I420 (YUV420) format
   */
  private rgbaToI420(rgba: Buffer, width: number, height: number): Buffer {
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2);
    const i420 = Buffer.alloc(ySize + uvSize * 2);

    const yPlane = i420.subarray(0, ySize);
    const uPlane = i420.subarray(ySize, ySize + uvSize);
    const vPlane = i420.subarray(ySize + uvSize);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rgbaIndex = (y * width + x) * 4;
        const r = rgba[rgbaIndex];
        const g = rgba[rgbaIndex + 1];
        const b = rgba[rgbaIndex + 2];

        // Convert RGB to Y
        const yIndex = y * width + x;
        yPlane[yIndex] = Math.max(
          0,
          Math.min(255, ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16),
        );

        // Calculate U and V for every 2x2 block
        if (y % 2 === 0 && x % 2 === 0) {
          const uvIndex = (y / 2) * (width / 2) + x / 2;
          uPlane[uvIndex] = Math.max(
            0,
            Math.min(255, ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128),
          );
          vPlane[uvIndex] = Math.max(
            0,
            Math.min(255, ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128),
          );
        }
      }
    }

    return i420;
  }

  getSession(sessionId: string): WebRTCSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByGameId(gameSessionId: string): WebRTCSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.gameSessionId === gameSessionId) {
        return session;
      }
    }
    return undefined;
  }

  getAllSessionsForGame(gameSessionId: string): WebRTCSession[] {
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.gameSessionId === gameSessionId,
    );
    return sessions;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.videoTrack?.stop();
      session.audioTrack?.stop();
      session.dataChannel?.close();
      session.peerConnection?.close();
    } catch (error) {
      this.logger.error(`Error closing session ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
    this.logger.log(`Closed WebRTC session ${sessionId}`);
  }

  async closeAllSessionsForGame(gameSessionId: string): Promise<void> {
    const sessions = this.getAllSessionsForGame(gameSessionId);
    for (const session of sessions) {
      await this.closeSession(session.id);
    }
  }
}
