import { GameManager } from './GameManager';
import { NetworkManager } from './network/NetworkManager';
import { LobbyUI } from './ui/LobbyUI';
import { ConnectionStatus } from './ui/ConnectionStatus';
import { GameStateSync } from './network/GameStateSync';
import { MessageType, InputState, NetworkMessage } from './network/MessageTypes';
import { Movement } from './utils/enum';

export class MultiplayerGameManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private networkManager: NetworkManager;
  private lobbyUI: LobbyUI;
  private connectionStatus: ConnectionStatus;
  private gameManager: GameManager | null = null;
  private inLobby: boolean = true;
  private isHost: boolean = false;
  private lastSyncTime: number = 0;
  private syncInterval: number = 50; // 20Hz
  private remoteInput: InputState = { left: false, right: false, shoot: false };
  private localInput: InputState = { left: false, right: false, shoot: false };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.networkManager = new NetworkManager();
    this.lobbyUI = new LobbyUI(this.ctx, this.canvas, this.networkManager);
    this.connectionStatus = new ConnectionStatus(this.ctx, this.networkManager);

    this.setupLobbyCallbacks();
    this.setupNetworkCallbacks();
    this.setupInputHandlers();

    this.run();
  }

  private setupLobbyCallbacks(): void {
    this.lobbyUI.onGameStart = () => {
      this.startGame();
    };
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.setOnMessage((message: NetworkMessage) => {
      this.handleNetworkMessage(message);
    });

    this.networkManager.setOnStatusChange((status) => {
      if (status === 'disconnected' && !this.inLobby) {
        // Handle disconnection during game
        console.log('Player disconnected during game');
      }
    });
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    switch (message.type) {
      case MessageType.INPUT:
        // Receive remote player input
        this.remoteInput = message.data;
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

  private setupInputHandlers(): void {
    const keyState: { [key: string]: boolean } = {};

    document.addEventListener('keydown', (event) => {
      keyState[event.code] = true;

      // Lobby input handling
      if (this.inLobby) {
        this.lobbyUI.handleInput(event.key);
        return;
      }

      // Game input handling
      if (!this.gameManager) return;

      // Determine which player this client controls
      const playerIndex = this.isHost ? 0 : 1;
      const player = this.gameManager.players[playerIndex];

      if (!player || !player.controls) return;

      // Update local input state
      if (event.code === player.controls.left) {
        this.localInput.left = true;
      }
      if (event.code === player.controls.right) {
        this.localInput.right = true;
      }
      if (event.code === player.controls.shoot) {
        this.localInput.shoot = true;
      }

      // Send input to host (if client)
      if (!this.isHost && this.networkManager.isConnected()) {
        this.networkManager.send({
          type: MessageType.INPUT,
          data: this.localInput,
          timestamp: Date.now()
        });
      }
    });

    document.addEventListener('keyup', (event) => {
      keyState[event.code] = false;

      if (this.inLobby || !this.gameManager) return;

      const playerIndex = this.isHost ? 0 : 1;
      const player = this.gameManager.players[playerIndex];

      if (!player || !player.controls) return;

      // Update local input state
      if (event.code === player.controls.left) {
        this.localInput.left = false;
      }
      if (event.code === player.controls.right) {
        this.localInput.right = false;
      }
      if (event.code === player.controls.shoot) {
        this.localInput.shoot = false;
      }

      // Send input to host (if client)
      if (!this.isHost && this.networkManager.isConnected()) {
        this.networkManager.send({
          type: MessageType.INPUT,
          data: this.localInput,
          timestamp: Date.now()
        });
      }
    });
  }

  private startGame(): void {
    this.inLobby = false;
    this.isHost = this.networkManager.isHostPlayer();

    // Create game with 2 players
    this.gameManager = new GameManager(this.canvas, 2);

    // Override the game's normal input handling since we handle it via network
    // We'll manually apply inputs in the update loop
  }

  private applyInputToPlayer(playerIndex: number, input: InputState): void {
    if (!this.gameManager || !this.gameManager.players[playerIndex]) return;

    const player = this.gameManager.players[playerIndex];

    // Apply movement
    if (input.left) {
      player.movement = Movement.LEFT;
    } else if (input.right) {
      player.movement = Movement.RIGHT;
    } else {
      player.movement = Movement.STATIONARY;
    }

    // Handle shooting
    if (input.shoot && !player.arrow?.isActive) {
      // Create arrow for player
      const arrow = player.arrow;
      if (arrow) {
        arrow.isActive = true;
        arrow.isHittable = true;
      }
    }
  }

  private updateMultiplayer(): void {
    if (!this.gameManager || !this.networkManager.isConnected()) return;

    if (this.isHost) {
      // HOST: Apply both local and remote inputs
      this.applyInputToPlayer(0, this.localInput); // Host is player 1
      this.applyInputToPlayer(1, this.remoteInput); // Client is player 2

      // Send game state to client at specified interval
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
    } else {
      // CLIENT: Only apply local input (prediction)
      this.applyInputToPlayer(1, this.localInput); // Client is player 2

      // Inputs are already being sent on keydown/keyup
      // State updates are received and applied in handleNetworkMessage
    }
  }

  private run(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.inLobby) {
      // Render lobby
      this.lobbyUI.render();
    } else if (this.gameManager) {
      // Update multiplayer state
      this.updateMultiplayer();

      // Render game (GameManager handles its own rendering via start())
      // We just need to overlay connection status
      this.connectionStatus.render();
    }

    requestAnimationFrame(() => this.run());
  }

  public disconnect(): void {
    this.networkManager.disconnect();
    this.inLobby = true;
    this.gameManager = null;
  }
}
