import { NetworkManager, ConnectionStatus } from '../network/NetworkManager';

export class LobbyUI {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private networkManager: NetworkManager;
  private mode: 'menu' | 'create' | 'join' = 'menu';
  private roomCodeInput: string = '';
  private status: string = '';
  private isReady: boolean = false;
  private remoteReady: boolean = false;

  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, networkManager: NetworkManager) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.networkManager = networkManager;

    this.setupNetworkCallbacks();
    this.setupInputHandlers();
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.setOnStatusChange((status: ConnectionStatus) => {
      this.updateStatusMessage(status);
    });

    this.networkManager.setOnRoomCreated((roomCode: string) => {
      this.status = `Room Code: ${roomCode}\nWaiting for player to join...`;
    });

    this.networkManager.setOnConnectionEstablished(() => {
      this.status = 'Connected! Press R when ready.';
    });

    this.networkManager.setOnMessage((message) => {
      if (message.type === 'PLAYER_READY') {
        this.remoteReady = true;
        this.status = 'Other player is ready!';
        this.checkBothReady();
      } else if (message.type === 'START_GAME') {
        this.startGame();
      }
    });
  }

  private updateStatusMessage(status: ConnectionStatus): void {
    switch (status) {
      case 'connecting':
        this.status = 'Connecting...';
        break;
      case 'connected':
        this.status = 'Connected! Press R when ready.';
        break;
      case 'disconnected':
        this.status = 'Disconnected';
        break;
      case 'error':
        this.status = 'Connection error. Please try again.';
        break;
    }
  }

  private setupInputHandlers(): void {
    document.addEventListener('keydown', (e) => {
      // Handle menu keys (C for create, J for join)
      if (this.mode === 'menu') {
        if (e.key.toLowerCase() === 'c') {
          this.mode = 'create';
          this.networkManager.createRoom();
        } else if (e.key.toLowerCase() === 'j') {
          this.mode = 'join';
          this.roomCodeInput = '';
        }
      }
      // Handle join room input
      else if (this.mode === 'join') {
        if (e.key.length === 1 && /[A-Z0-9]/i.test(e.key)) {
          if (this.roomCodeInput.length < 6) {
            this.roomCodeInput += e.key.toUpperCase();
          }
        } else if (e.key === 'Backspace') {
          this.roomCodeInput = this.roomCodeInput.slice(0, -1);
        } else if (e.key === 'Enter' && this.roomCodeInput.length === 6) {
          this.networkManager.joinRoom(this.roomCodeInput);
          this.mode = 'create'; // Switch to waiting mode
        }
      }
      // Handle ready state
      else if (this.networkManager.isConnected()) {
        if (e.key.toLowerCase() === 'r' && !this.isReady) {
          this.isReady = true;
          this.networkManager.send({
            type: 'PLAYER_READY' as any,
            playerName: this.networkManager.isHostPlayer() ? 'Player 1' : 'Player 2',
            timestamp: Date.now()
          });
          this.status = 'You are ready! Waiting for other player...';
          this.checkBothReady();
        }
      }

      // Handle ESC key
      if (e.key === 'Escape') {
        if (this.mode !== 'menu') {
          this.networkManager.disconnect();
          this.mode = 'menu';
          this.roomCodeInput = '';
          this.status = '';
          this.isReady = false;
          this.remoteReady = false;
        }
      }
    });
  }

  private checkBothReady(): void {
    if (this.isReady && this.remoteReady) {
      if (this.networkManager.isHostPlayer()) {
        // Host starts the game
        this.networkManager.send({
          type: 'START_GAME' as any,
          timestamp: Date.now()
        });
        this.startGame();
      }
    }
  }

  private startGame(): void {
    // This will be called by GameManager to start the actual game
    console.log('Starting game!');
    this.onGameStart?.();
  }

  public onGameStart?: () => void;

  public render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, width, height);

    // Draw title
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Bubble Trouble', width / 2, 80);
    ctx.font = '24px Arial';
    ctx.fillText('Online Multiplayer', width / 2, 120);

    if (this.mode === 'menu') {
      this.renderMenu();
    } else if (this.mode === 'create') {
      this.renderLobby();
    } else if (this.mode === 'join') {
      this.renderJoinScreen();
    }
  }

  private renderMenu(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw buttons
    const buttonWidth = 300;
    const buttonHeight = 60;
    const buttonX = (width - buttonWidth) / 2;
    const createButtonY = height / 2 - 50;
    const joinButtonY = height / 2 + 50;

    // Create Room button
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(buttonX, createButtonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(buttonX, createButtonY, buttonWidth, buttonHeight);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Create Room (Press C)', width / 2, createButtonY + 40);

    // Join Room button
    ctx.fillStyle = '#3498db';
    ctx.fillRect(buttonX, joinButtonY, buttonWidth, buttonHeight);
    ctx.strokeRect(buttonX, joinButtonY, buttonWidth, buttonHeight);

    ctx.fillStyle = '#ecf0f1';
    ctx.fillText('Join Room (Press J)', width / 2, joinButtonY + 40);

    // Instructions
    ctx.font = '18px Arial';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText('Press C to create a room or J to join a room', width / 2, height - 50);
  }

  private renderLobby(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw room code box
    if (this.networkManager.getRoomCode()) {
      ctx.fillStyle = '#34495e';
      ctx.fillRect(width / 2 - 200, height / 2 - 100, 400, 80);
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 3;
      ctx.strokeRect(width / 2 - 200, height / 2 - 100, 400, 80);

      ctx.fillStyle = '#ecf0f1';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Room Code:', width / 2, height / 2 - 65);

      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#3498db';
      ctx.fillText(this.networkManager.getRoomCode(), width / 2, height / 2 - 25);
    }

    // Draw status
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ecf0f1';
    ctx.textAlign = 'center';
    const lines = this.status.split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, height / 2 + 40 + index * 30);
    });

    // Draw latency if connected
    if (this.networkManager.isConnected()) {
      ctx.font = '16px Arial';
      ctx.fillStyle = '#95a5a6';
      ctx.textAlign = 'right';
      ctx.fillText(`Ping: ${this.networkManager.getLatency()}ms`, width - 20, 30);

      // Ready status
      ctx.textAlign = 'center';
      if (this.isReady) {
        ctx.fillStyle = '#27ae60';
        ctx.fillText('✓ You are ready', width / 2, height - 80);
      }
      if (this.remoteReady) {
        ctx.fillStyle = '#27ae60';
        ctx.fillText('✓ Other player is ready', width / 2, height - 50);
      }
    }

    // Back button
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(20, height - 60, 120, 40);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('ESC to cancel', 30, height - 32);
  }

  private renderJoinScreen(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw input box
    ctx.fillStyle = '#34495e';
    ctx.fillRect(width / 2 - 200, height / 2 - 50, 400, 80);
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 3;
    ctx.strokeRect(width / 2 - 200, height / 2 - 50, 400, 80);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Enter Room Code:', width / 2, height / 2 - 70);

    // Draw input text
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#3498db';
    ctx.fillText(this.roomCodeInput + '_', width / 2, height / 2 + 10);

    // Instructions
    ctx.font = '18px Arial';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText('Type the 6-character room code', width / 2, height / 2 + 60);
    ctx.fillText('Press ENTER to join', width / 2, height / 2 + 90);

    // Back button
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(20, height - 60, 120, 40);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('ESC to cancel', 30, height - 32);
  }

  public handleInput(key: string): void {
    if (this.mode === 'menu') {
      if (key.toLowerCase() === 'c') {
        this.mode = 'create';
        this.networkManager.createRoom();
      } else if (key.toLowerCase() === 'j') {
        this.mode = 'join';
        this.roomCodeInput = '';
      }
    }

    if (key === 'Escape') {
      if (this.mode !== 'menu') {
        this.networkManager.disconnect();
        this.mode = 'menu';
        this.roomCodeInput = '';
        this.status = '';
        this.isReady = false;
        this.remoteReady = false;
      }
    }
  }
}
