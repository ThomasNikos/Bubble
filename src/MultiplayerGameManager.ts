import { GameManager } from './GameManager';
import { NetworkManager } from './network/NetworkManager';
import { LobbyUI } from './ui/LobbyUI';
import { GameStateSync } from './network/GameStateSync';
import { MessageType, NetworkMessage } from './network/MessageTypes';
import { Movement } from './utils/enum';

export class MultiplayerGameManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private networkManager: NetworkManager;
  private lobbyUI: LobbyUI;
  private gameManager: GameManager | null = null;
  private inLobby: boolean = true;
  private isHost: boolean = false;
  private lastSyncTime: number = 0;
  private syncInterval: number = 50; // 20Hz
  private animationId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.networkManager = new NetworkManager();
    this.lobbyUI = new LobbyUI(this.ctx, this.canvas, this.networkManager);

    this.setupLobbyCallbacks();
    this.setupNetworkCallbacks();

    this.runLobby();
  }

  private setupLobbyCallbacks(): void {
    this.lobbyUI.onGameStart = () => {
      console.log('Starting multiplayer game!');
      this.startGame();
    };
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.setOnMessage((message: NetworkMessage) => {
      this.handleNetworkMessage(message);
    });

    this.networkManager.setOnStatusChange((status) => {
      console.log('Network status changed:', status);
      if (status === 'disconnected' && !this.inLobby) {
        console.log('Player disconnected during game');
      }
    });
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    // If we're in the lobby, route messages to LobbyUI
    if (this.inLobby) {
      this.lobbyUI.handleMessage(message);
      return;
    }

    // In-game message handling
    switch (message.type) {
      case MessageType.INPUT:
        // Host receives input from guest and applies it to player 2
        if (this.isHost && this.gameManager) {
          this.applyGuestInput(message.data);
        }
        break;

      case MessageType.STATE_UPDATE:
        // Receive full game state from host
        if (!this.isHost && this.gameManager) {
          GameStateSync.applyGameState(this.gameManager, message.data);
        }
        break;

      case MessageType.GAME_OVER:
        console.log('Game over:', message.won ? 'Won!' : 'Lost');
        break;
    }
  }

  private startGame(): void {
    console.log('Transitioning from lobby to game...');
    this.inLobby = false;
    this.isHost = this.networkManager.isHostPlayer();

    // Stop lobby loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    console.log('Creating GameManager with 2 players, isHost:', this.isHost);

    // Create game with 2 players
    // Host controls player 0, Guest controls player 1
    const localPlayerIndex = this.isHost ? 0 : 1;

    // Host: auto-start the game loop (authoritative)
    // Guest: don't auto-start (will only render received state)
    this.gameManager = new GameManager(this.canvas, 2, undefined, this.isHost, localPlayerIndex);

    // Set up input callback for guest to send input to host
    if (!this.isHost) {
      this.gameManager.onInputChange = (input) => {
        this.networkManager.send({
          type: MessageType.INPUT,
          data: input,
          timestamp: Date.now()
        });
      };

      this.startGuestRenderLoop();
    }

    // Start multiplayer sync
    this.startMultiplayerSync();
  }

  private applyGuestInput(input: { left: boolean; right: boolean; shoot: boolean }): void {
    if (!this.gameManager || this.gameManager.players.length < 2) return;

    const guestPlayer = this.gameManager.players[1]; // Guest is player 2 (index 1)
    if (!guestPlayer) return;

    // Apply movement
    if (input.left) {
      guestPlayer.movement = Movement.LEFT;
      guestPlayer.tempMovement = Movement.LEFT;
    } else if (input.right) {
      guestPlayer.movement = Movement.RIGHT;
      guestPlayer.tempMovement = Movement.RIGHT;
    } else if (!input.shoot) {
      guestPlayer.movement = Movement.STATIONARY;
      guestPlayer.tempMovement = Movement.STATIONARY;
    }

    // Apply shoot
    if (input.shoot && (!guestPlayer.arrow || !guestPlayer.arrow.isActive)) {
      guestPlayer.shootArrow();
    }
  }

  private startGuestRenderLoop(): void {
    console.log('Starting guest render loop...');

    const renderLoop = () => {
      if (!this.gameManager) return;

      // Guest only renders, doesn't run game logic
      this.gameManager.draw();

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  private startMultiplayerSync(): void {
    console.log('Starting multiplayer synchronization...');

    // Send game state periodically if host
    const syncLoop = () => {
      if (!this.gameManager || !this.networkManager.isConnected()) return;

      if (this.isHost) {
        const now = Date.now();
        if (now - this.lastSyncTime >= this.syncInterval) {
          const gameState = GameStateSync.serializeGameState(this.gameManager);
          this.networkManager.send({
            type: MessageType.STATE_UPDATE,
            data: gameState,
            timestamp: now
          });
          this.lastSyncTime = now;
        }
      }

      // Continue sync loop
      requestAnimationFrame(syncLoop);
    };

    syncLoop();
  }

  private runLobby(): void {
    if (!this.inLobby) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.lobbyUI.render();

    this.animationId = requestAnimationFrame(() => this.runLobby());
  }

  public disconnect(): void {
    this.networkManager.disconnect();
    this.inLobby = true;
    this.gameManager = null;
  }
}
