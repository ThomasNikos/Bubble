export enum MessageType {
  INPUT = 'INPUT',
  STATE_UPDATE = 'STATE_UPDATE',
  SYNC = 'SYNC',
  GAME_OVER = 'GAME_OVER',
  PLAYER_READY = 'PLAYER_READY',
  START_GAME = 'START_GAME'
}

export interface InputState {
  left: boolean;
  right: boolean;
  shoot: boolean;
}

export interface InputMessage {
  type: MessageType.INPUT;
  data: InputState;
  timestamp: number;
}

export interface PlayerState {
  x: number;
  y: number;
  score: number;
  lives: number;
}

export interface BubbleState {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
}

export interface ArrowState {
  x: number;
  y: number;
  isActive: boolean;
}

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  bubbles: BubbleState[];
  arrows: ArrowState[];
  score: number;
  timeRemaining: number;
  level: number;
}

export interface StateUpdateMessage {
  type: MessageType.STATE_UPDATE;
  data: GameState;
  timestamp: number;
}

export interface SyncMessage {
  type: MessageType.SYNC;
  timestamp: number;
}

export interface GameOverMessage {
  type: MessageType.GAME_OVER;
  won: boolean;
  finalScore: number;
  timestamp: number;
}

export interface PlayerReadyMessage {
  type: MessageType.PLAYER_READY;
  playerName: string;
  timestamp: number;
}

export interface StartGameMessage {
  type: MessageType.START_GAME;
  timestamp: number;
}

export type NetworkMessage =
  | InputMessage
  | StateUpdateMessage
  | SyncMessage
  | GameOverMessage
  | PlayerReadyMessage
  | StartGameMessage;

export function validateMessage(msg: any): msg is NetworkMessage {
  if (!msg || typeof msg !== 'object') return false;
  if (!msg.type || !Object.values(MessageType).includes(msg.type)) return false;
  if (typeof msg.timestamp !== 'number') return false;

  switch (msg.type) {
    case MessageType.INPUT:
      return (
        msg.data &&
        typeof msg.data.left === 'boolean' &&
        typeof msg.data.right === 'boolean' &&
        typeof msg.data.shoot === 'boolean'
      );

    case MessageType.STATE_UPDATE:
      return msg.data && typeof msg.data === 'object';

    case MessageType.SYNC:
      return true;

    case MessageType.GAME_OVER:
      return (
        typeof msg.won === 'boolean' &&
        typeof msg.finalScore === 'number'
      );

    case MessageType.PLAYER_READY:
      return typeof msg.playerName === 'string';

    case MessageType.START_GAME:
      return true;

    default:
      return false;
  }
}
