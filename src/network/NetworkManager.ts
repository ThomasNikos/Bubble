import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage, validateMessage } from './MessageTypes';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class NetworkManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost: boolean = false;
  private roomCode: string = '';
  private status: ConnectionStatus = 'disconnected';
  private latency: number = 0;
  private lastPingTime: number = 0;

  // Callbacks
  private onMessageCallback?: (message: NetworkMessage) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;
  private onRoomCreatedCallback?: (roomCode: string) => void;
  private onConnectionEstablishedCallback?: () => void;

  constructor() {}

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLatency(): number {
    return this.latency;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public isHostPlayer(): boolean {
    return this.isHost;
  }

  public setOnMessage(callback: (message: NetworkMessage) => void): void {
    this.onMessageCallback = callback;
  }

  public setOnStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public setOnRoomCreated(callback: (roomCode: string) => void): void {
    this.onRoomCreatedCallback = callback;
  }

  public setOnConnectionEstablished(callback: () => void): void {
    this.onConnectionEstablishedCallback = callback;
  }

  private updateStatus(newStatus: ConnectionStatus): void {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus);
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(): void {
    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    this.updateStatus('connecting');

    try {
      // Create peer with generated room code as ID
      this.peer = new Peer(this.roomCode, {
        debug: 2
      });

      this.peer.on('open', (id) => {
        console.log('Room created with code:', id);
        if (this.onRoomCreatedCallback) {
          this.onRoomCreatedCallback(id);
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        this.connection = conn;
        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.updateStatus('error');
      });
    } catch (error) {
      console.error('Failed to create room:', error);
      this.updateStatus('error');
    }
  }

  public joinRoom(roomCode: string): void {
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.updateStatus('connecting');

    try {
      // Create peer with random ID
      this.peer = new Peer({
        debug: 2
      });

      this.peer.on('open', (id) => {
        console.log('My peer ID:', id);
        console.log('Connecting to room:', this.roomCode);

        // Connect to the host
        this.connection = this.peer!.connect(this.roomCode, {
          reliable: true
        });

        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.updateStatus('error');
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      this.updateStatus('error');
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('open', () => {
      console.log('Connection established');
      this.updateStatus('connected');
      if (this.onConnectionEstablishedCallback) {
        this.onConnectionEstablishedCallback();
      }
      this.startPingInterval();
    });

    this.connection.on('data', (data) => {
      try {
        const message = data as any;
        if (validateMessage(message)) {
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } else {
          console.warn('Received invalid message:', message);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    this.connection.on('close', () => {
      console.log('Connection closed');
      this.updateStatus('disconnected');
      this.stopPingInterval();
    });

    this.connection.on('error', (err) => {
      console.error('Connection error:', err);
      this.updateStatus('error');
    });
  }

  private pingIntervalId?: number;

  private startPingInterval(): void {
    this.pingIntervalId = window.setInterval(() => {
      if (this.connection && this.connection.open) {
        this.lastPingTime = Date.now();
        this.send({
          type: 'SYNC' as any,
          timestamp: this.lastPingTime
        });
      }
    }, 1000);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
  }

  public send(message: NetworkMessage): void {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(message);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    } else {
      console.warn('Cannot send message: connection not open');
    }
  }

  public disconnect(): void {
    this.stopPingInterval();

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.updateStatus('disconnected');
    this.isHost = false;
    this.roomCode = '';
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.connection !== null && this.connection.open;
  }
}
