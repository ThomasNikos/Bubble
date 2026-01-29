import { GameState, PlayerState, BubbleState, ArrowState } from './MessageTypes';
import { Bubble } from '../components/Bubble';

export class GameStateSync {
  // Serialize the game state for network transmission
  public static serializeGameState(gameManager: any): GameState {
    const players = gameManager.players || [];
    // Access static bubbleArray from GameManager class
    const GameManagerClass = gameManager.constructor;

    return {
      player1: this.serializePlayer(players[0]),
      player2: this.serializePlayer(players[1]),
      bubbles: this.serializeBubbles(GameManagerClass.bubbleArray || []),
      arrows: this.serializeArrows(gameManager),
      score: gameManager.score?.score || 0,
      timeRemaining: gameManager.timeRemaining || 0,
      level: gameManager.level || 1
    };
  }

  private static serializePlayer(player: any): PlayerState {
    if (!player) {
      return { x: 0, y: 0, score: 0, lives: 0 };
    }

    return {
      x: player.posX || 0,
      y: player.posY || 0,
      score: player.score || 0,
      lives: player.life || 3
    };
  }

  private static serializeBubbles(bubbles: any[]): BubbleState[] {
    return bubbles.map(bubble => ({
      x: bubble.centerX || 0,
      y: bubble.centerY || 0,
      radius: bubble.radius || 0,
      dx: bubble.dx || 0,
      dy: bubble.dy || 0
    }));
  }

  private static serializeArrows(gameManager: any): ArrowState[] {
    const arrows: ArrowState[] = [];

    // Serialize arrows from both players
    if (gameManager.players) {
      gameManager.players.forEach((player: any) => {
        if (player.arrow && player.arrow.isActive) {
          arrows.push({
            x: player.arrow.posX || 0,
            y: player.arrow.posY || 0,
            isActive: true
          });
        }
      });
    }

    return arrows;
  }

  // Apply received game state to the local game manager
  public static applyGameState(gameManager: any, state: GameState): void {
    const players = gameManager.players || [];

    // Update players
    if (players[0] && state.player1) {
      this.applyPlayerState(players[0], state.player1);
    }
    if (players[1] && state.player2) {
      this.applyPlayerState(players[1], state.player2);
    }

    // Update bubbles
    this.applyBubbles(gameManager, state.bubbles);

    // Update arrows
    this.applyArrows(gameManager, state.arrows);

    // Update game properties
    if (gameManager.score) {
      gameManager.score.score = state.score;
    }
    gameManager.timeRemaining = state.timeRemaining;
    gameManager.currentLevel = state.level;
  }

  private static applyPlayerState(player: any, state: PlayerState): void {
    player.posX = state.x;
    player.posY = state.y;
    player.score = state.score;
    player.life = state.lives;
  }

  private static applyBubbles(gameManager: any, bubbles: BubbleState[]): void {
    // Access static bubbleArray from GameManager class
    const GameManagerClass = gameManager.constructor;

    // Clear existing bubbles
    GameManagerClass.bubbleArray = [];

    // Recreate bubbles from state
    bubbles.forEach(bubbleState => {
      // Create proper Bubble instance
      const bubble = new Bubble(
        gameManager.ctx,
        1, // numberOfBubbles - doesn't affect rendering
        bubbleState.radius,
        bubbleState.x,
        bubbleState.y
      );
      // Update velocity from state
      bubble.dx = bubbleState.dx;
      bubble.dy = bubbleState.dy;

      GameManagerClass.bubbleArray.push(bubble);
    });
  }

  private static applyArrows(gameManager: any, arrows: ArrowState[]): void {
    const players = gameManager.players || [];

    // Reset all arrows
    players.forEach((player: any) => {
      if (player.arrow) {
        player.arrow.isActive = false;
      }
    });

    // Apply active arrows
    arrows.forEach((arrowState, index) => {
      if (index < players.length && players[index].arrow) {
        players[index].arrow.posX = arrowState.x;
        players[index].arrow.posY = arrowState.y;
        players[index].arrow.isActive = arrowState.isActive;
      }
    });
  }

  // Calculate the size of the serialized state for bandwidth monitoring
  public static getStateSize(state: GameState): number {
    return JSON.stringify(state).length;
  }

  // Create a delta between two states (only differences)
  public static createDelta(oldState: GameState, newState: GameState): Partial<GameState> {
    const delta: any = {};

    // Check player differences
    if (JSON.stringify(oldState.player1) !== JSON.stringify(newState.player1)) {
      delta.player1 = newState.player1;
    }
    if (JSON.stringify(oldState.player2) !== JSON.stringify(newState.player2)) {
      delta.player2 = newState.player2;
    }

    // Always send bubbles and arrows as they change frequently
    delta.bubbles = newState.bubbles;
    delta.arrows = newState.arrows;

    // Check simple properties
    if (oldState.score !== newState.score) {
      delta.score = newState.score;
    }
    if (oldState.timeRemaining !== newState.timeRemaining) {
      delta.timeRemaining = newState.timeRemaining;
    }
    if (oldState.level !== newState.level) {
      delta.level = newState.level;
    }

    return delta;
  }
}
