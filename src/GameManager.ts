import { Player } from "./components/Player";
import { Bubble } from "./components/Bubble";
import { GroundWalls } from "./components/Ground";
import { Arrow } from "./components/Arrow";
import { Wall } from "./components/Wall";
import { Score } from "./components/Score";
import { PowerUp } from "./components/Power-ups";
import { Lives } from "./Lives";
import { LevelLoader } from "./LevelLoader";
import { CANVAS_DIMENSIONS, WALL_WIDTH } from "./constants";
import { Movement } from "./utils/enum";
import { GameState } from "./utils/enum";
import { getRandomInt } from "./utils/utils";
import { checkCollision } from "./utils/utils";
import playerCollideAudioSrc from "/punch-audio.mp3";
import arrowAudioSrc from "/Harpoon-audio.mp3";
import splitAudioSrc from "/pop-audio.mp3";
import wallSlideAudioSrc from "/Sliding-audio.mp3";
import gameOverImgSrc from "/game-over.png";

/* The `GameManager` class in TypeScript manages the game state, player interactions, level loading,
timer, collisions, power-ups, and rendering for a game. */
export class GameManager {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  player?: Player;
  x: number;
  y: number;
  bgImage: CanvasImageSource;
  bubble?: Bubble;
  ground?: GroundWalls;
  gameState: GameState;
  bubblePlayerDx?: number;
  bubblePlayerDy?: number;
  bubblePlayerDistance?: number;
  bubbleArrowDx?: number;
  bubbleArrowDy?: number;
  bubbleArrowDistance?: number;
  arrow?: Arrow;
  arrowActive: boolean;
  numberOfBubbles: number;
  bubbleRadius?: number;
  tempMovement?: Movement;
  isBubbleArrowCollisionTrue?: boolean[];
  static bubbleArray: Bubble[] = [];
  levelLoader: LevelLoader;
  timeLimit: number;
  elapsedTime: number;
  startTime: number;
  timeRemaining: number;
  adjustedTime: number;
  level: number = 1;
  wall?: Wall;
  isWallPresent: boolean = false;
  customLevelConfig: any;
  powerUp?: PowerUp | null;
  powerUpOption?: number;
  isCollisionPlayerPowerUp: boolean = false;
  score?: Score;
  powerUpArray: PowerUp[] = [];
  static wallSlidingSound: HTMLAudioElement;
  static punchAudio: HTMLAudioElement;
  life?: Lives;
  isPlayerHit: boolean = false;
  players: Player[] = [];
  static walls: Wall[] = [];
  gameOverImg: HTMLImageElement;
  localPlayerIndex?: number; // Which player this client controls (0 for host/P1, 1 for guest/P2)
  isMultiplayer: boolean = false;
  onInputChange?: (input: { left: boolean; right: boolean; shoot: boolean }) => void;

  constructor(
    canvas: HTMLCanvasElement,
    numberOfPlayers: number,
    customLevelConfig?: any,
    autoStart: boolean = true,
    localPlayerIndex?: number
  ) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d")!;
    this.canvas.width = CANVAS_DIMENSIONS.CANVAS_WIDTH;
    this.canvas.height = CANVAS_DIMENSIONS.CANVAS_HEIGHT;

    this.levelLoader = new LevelLoader(this);

    this.x = 0;
    this.y = 0;

    this.gameState = GameState.RUNNING;
    this.bgImage = new Image();

    this.numberOfBubbles = 1;

    this.arrowActive = false;

    this.tempMovement = Movement.STATIONARY;

    this.timeLimit = 40 * 1000;
    this.startTime = Date.now();
    this.timeRemaining = this.timeLimit;
    this.elapsedTime = 0;
    this.adjustedTime = 0;

    this.customLevelConfig = customLevelConfig;
    this.localPlayerIndex = localPlayerIndex;
    this.isMultiplayer = numberOfPlayers > 1 && localPlayerIndex !== undefined;

    GameManager.wallSlidingSound = new Audio(wallSlideAudioSrc);
    GameManager.wallSlidingSound.loop = false;
    GameManager.punchAudio = new Audio(playerCollideAudioSrc);
    GameManager.punchAudio.loop = false;

    for (let i = 0; i < numberOfPlayers; i++) {
      this.player = new Player(this.ctx, i, 3, 0);
      this.players.push(this.player);
    }

    if (this.customLevelConfig) {
      this.levelLoader.levels.push(this.customLevelConfig);
      this.levelLoader.loadLevel(this.levelLoader.levels.length - 1);
    }

    this.gameOverImg = new Image();
    this.gameOverImg.src = gameOverImgSrc;

    this.start = this.start.bind(this);

    this.initialSetup();
    if (autoStart) {
      this.start();
    }

    this.players.forEach((player)=>{
      player.tempMovement = Movement.STATIONARY;
    })

    const keyState: { [key: string]: boolean } = {};

    document.addEventListener("keydown", (event) => {
      keyState[event.code] = true;

      // In multiplayer, only control the local player
      const playersToControl = this.isMultiplayer && this.localPlayerIndex !== undefined
        ? [this.players[this.localPlayerIndex]]
        : this.players;

      playersToControl.forEach((player) => {
        if (!player) return;

        // In multiplayer, guest doesn't execute actions locally - only sends input
        if (this.isMultiplayer && this.localPlayerIndex === 1) {
          // Guest: Don't execute anything, just send input via callback below
          return;
        }

        // Host or single player: Execute actions locally
        if (keyState[player.controls!.left]) {
          player.movement = Movement.LEFT;
          player.tempMovement = Movement.LEFT;
        }
        if (keyState[player.controls!.right]) {
          player.movement = Movement.RIGHT;
          player.tempMovement = Movement.RIGHT;
        }
        if (keyState[player.controls!.shoot]) {
          const arrowSound = new Audio(arrowAudioSrc);
          arrowSound.play();
          player.shootArrow();
          if (player.arrow) {
            player.arrow.isHittable = true;
          }
          player.movement = Movement.STATIONARY;
        }
      });

      // Send input to network if guest
      if (this.isMultiplayer && this.localPlayerIndex === 1 && this.onInputChange) {
        const localPlayer = this.players[this.localPlayerIndex];
        if (localPlayer) {
          this.onInputChange({
            left: keyState[localPlayer.controls!.left] || false,
            right: keyState[localPlayer.controls!.right] || false,
            shoot: keyState[localPlayer.controls!.shoot] || false
          });
        }
      }
    });

    document.addEventListener("keyup", (event) => {
      keyState[event.code] = false;

      // In multiplayer, only control the local player
      const playersToControl = this.isMultiplayer && this.localPlayerIndex !== undefined
        ? [this.players[this.localPlayerIndex]]
        : this.players;

      playersToControl.forEach((player) => {
        if (!player) return;

        // In multiplayer, guest doesn't execute actions locally - only sends input
        if (this.isMultiplayer && this.localPlayerIndex === 1) {
          // Guest: Don't execute anything, just send input via callback below
          return;
        }

        // Host or single player: Execute actions locally
        if (
          event.code === player.controls!.left ||
          event.code === player.controls!.right
        ) {
          player.movement = Movement.STATIONARY;
          player.tempMovement = Movement.STATIONARY;
        }
        if (event.code === player.controls!.shoot) {
          player.movement = player.tempMovement;
        }
      });

      // Send input to network if guest
      if (this.isMultiplayer && this.localPlayerIndex === 1 && this.onInputChange) {
        const localPlayer = this.players[this.localPlayerIndex];
        if (localPlayer) {
          this.onInputChange({
            left: keyState[localPlayer.controls!.left] || false,
            right: keyState[localPlayer.controls!.right] || false,
            shoot: keyState[localPlayer.controls!.shoot] || false
          });
        }
      }
});

  }

  initialSetup() {
    this.ground = new GroundWalls(this.ctx, this.level!);

    this.wall = new Wall(
      this.ctx,
      (CANVAS_DIMENSIONS.CANVAS_WIDTH - WALL_WIDTH) / 2
    );

    this.score = new Score(this.ctx);
    this.life = new Lives(this.ctx);

  }

  draw() {
    switch (this.gameState) {
      case GameState.RUNNING:
        this.runningStateRender();
        break;
      case GameState.END:
        this.endGameStateRender();
        break;
    }
  }

  /**
   * The `runningStateRender` function in TypeScript clears the canvas, draws background image, arrows,
   * players, power-ups, bubbles, walls, ground, timer, and updates scores and lives for players.
   */
  runningStateRender() {
    this.ctx.clearRect(
      this.x,
      this.y,
      CANVAS_DIMENSIONS.CANVAS_WIDTH,
      CANVAS_DIMENSIONS.CANVAS_HEIGHT
    );

    this.ctx.drawImage(
      this.bgImage,
      this.x,
      this.y,
      this.canvas.width,
      this.canvas.height
    );

    //draw arrows for each player
    this.players.forEach((player) => {
      player.arrow?.draw();
    });

    //draw player
    this.players.forEach((player) => player.draw());

    //draw power-ups
    this.powerUpArray.forEach((powerUp) => powerUp.draw());

    //draw bubbles
    GameManager.bubbleArray!.forEach((bubble) => {
      bubble.draw(bubble.centerX, bubble.centerY);
    });

    //draw default walls
    this.wall?.drawDefaultWalls();

    //draw ground
    this.ground!.draw();

    GameManager.walls.forEach((wall) => {
      wall.drawExtraWalls();
    });

    this.drawTimer();

    if (GameManager.bubbleArray?.length == 0) {
      this.levelLoader.loadNextLevel();
    }

    this.players.forEach((player, index) => {
      this.score?.draw(player.score, index);
      this.life?.draw(player.life, index);
    });
  }
  drawTimer() {
    const minutes = Math.floor(this.timeRemaining / 60000);
    const seconds = Math.floor((this.timeRemaining % 60000) / 1000);
    const timeString = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    this.ctx.font = "24px Arial";
    this.ctx.fillStyle = "white";
    this.ctx.fillText(timeString, this.canvas.width - 100, 50);
  }
  resetTimer() {
    this.adjustedTime = 0;
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.timeRemaining = this.timeLimit;
  }

  checkCollision() {
    if (this.gameState !== GameState.RUNNING) return;
    //check collision between player and bubble
    GameManager.bubbleArray!.forEach((bubble) => {
      this.players.forEach((player) => {
        //closest X-coordinate of player to the bubble
        const closestX = Math.max(
          player.posX,
          Math.min(bubble.x, player.posX + player.width)
        );
        //closest Y-coordinate of player to the bubble
        const closestY = Math.max(
          player.posY,
          Math.min(bubble.y, player.posY + player.height)
        );

        //distance between player and bubble
        const distanceX = bubble.x - closestX;
        const distanceY = bubble.y - closestY;
        const distance = Math.sqrt(
          distanceX * distanceX + distanceY * distanceY
        );

        if (distance <= bubble.r) {
          GameManager.punchAudio.play();

          this.resetGame(player);
        }
      });
    });

    //check collision between bubble and arrow (check all player arrows)
    GameManager.bubbleArray!.forEach((bubble) => {
      bubble.isBubbleArrowCollisionTrue = false;

      this.players.forEach((player) => {
        if (player.arrow && player.arrow.isActive) {
          const collision = player.arrow.checkCollision(
            bubble.centerX,
            bubble.centerY,
            bubble.radius
          );
          if (collision) {
            bubble.isBubbleArrowCollisionTrue = true;
          }
        }
      });
    });

    //check collision between player and power-ups
    this.powerUpArray.forEach((powerUp, index) => {
      this.players.forEach((player) => {
        if (
          checkCollision(
            player.posX,
            player.posY,
            player.width,
            player.height,
            powerUp.posX,
            powerUp.posY,
            powerUp.width,
            powerUp.height
          )
        ) {
          this.isCollisionPlayerPowerUp = true;
          this.handlePowerUpCollision(powerUp, index, player);
        }
      });
    });
  }
  handlePowerUpCollision(powerUp: PowerUp, index: number, player: Player) {
    if (powerUp.powerUpOption == 1) {
      player.incrementScore();
    } else if (powerUp.powerUpOption == 2) {
      player.activateStickyArrow();
    } else {
      this.adjustedTime -= 3000;  
    }
    // Remove the power-up from the array
    this.powerUpArray.splice(index, 1);
  }

  endGameStateRender() {
    this.gameState = GameState.END;
    this.ctx.drawImage(
      this.gameOverImg,
      CANVAS_DIMENSIONS.CANVAS_WIDTH / 2 - 100,
      CANVAS_DIMENSIONS.CANVAS_HEIGHT / 2 - 200
    );
    setTimeout(() => {
      location.reload();
    }, 3000);
  }

  update() {
    if (this.gameState !== GameState.RUNNING) return;

    this.powerUpArray.forEach((powerUp) => powerUp.update());

    this.elapsedTime = Date.now() - this.startTime;
    this.timeRemaining = this.timeLimit - this.elapsedTime - this.adjustedTime;

    if (this.timeRemaining <= 0) {
      this.gameState = GameState.END;
    }

    GameManager.walls.forEach((wall) => {
      if (wall.height <= 0) {
        this.isWallPresent = false; //
      }
    });

    this.players.forEach((player) => player.update());

    //arrow splits bubbles - check all player arrows
    GameManager.bubbleArray!.forEach((bubble, index) => {
      if (bubble.isBubbleArrowCollisionTrue) {
        // Find which player's arrow hit the bubble
        this.players.forEach((player) => {
          if (player.arrow && player.arrow.isActive && player.arrow.isHittable) {
            const collision = player.arrow.checkCollision(
              bubble.centerX,
              bubble.centerY,
              bubble.radius
            );

            if (collision) {
              const bubblePopSound = new Audio(splitAudioSrc);
              bubblePopSound.play();

              if (bubble.radius < 10) {
                GameManager.bubbleArray?.splice(index, 1);
              } else {
                this.powerUpOption = getRandomInt(0, 3);
                bubble.splitBubbles()!;
                this.powerUpArray.push(
                  new PowerUp(
                    this.ctx,
                    bubble.centerX,
                    bubble.centerY,
                    this.powerUpOption
                  )
                );
              }

              player.arrow.isActive = false;
              player.arrow.isHittable = false;
              player.incrementScore();

              // Reset sticky flag after arrow hits something in multiplayer
              if (this.isMultiplayer && Arrow.isSticky) {
                Arrow.isSticky = false;
              }
            }
          }
        });
      }
    });

    GameManager.bubbleArray!.forEach((bubble) => {
      //change the direction of bubbble bouncing

      bubble.update();
    });

    // Update all player arrows
    this.players.forEach((player) => {
      player.arrow?.update();
    });

    this.checkBubblesOnPlayerSide();

    GameManager.walls.forEach((wall) => {
      wall.update();
    });
  }
  //to restart the game when a player loses life
  resetGame(player: Player) {
    GameManager.bubbleArray = [];
    this.players.forEach((player) => {
      player.posX = player.initialPosX;
    });

    this.powerUpArray = [];

    this.wall = new Wall(
      this.ctx,
      (CANVAS_DIMENSIONS.CANVAS_WIDTH - WALL_WIDTH) / 2
    );

    player.updateLives();

    // Check if any player has run out of lives
    const hasPlayerWithNoLives = this.players.some((p) => p.life === 0);

    if (hasPlayerWithNoLives) {
      if (this.isMultiplayer) {
        // In multiplayer, restart from level 1 and give all players back 3 lives
        console.log('Player lost all lives - restarting from level 1');
        this.level = 1;
        this.players.forEach((p) => {
          p.life = 3;
          p.score = 0;
        });
        this.levelLoader.loadLevel(0); // Level 1 is at index 0
      } else {
        // In single player, remove players with no lives
        this.players = this.players.filter((p) => p.life > 0);

        if (this.players.length === 0) {
          this.gameState = GameState.END;
          this.endGameStateRender();
          return;
        }
      }
    } else {
      // No one died completely, just reload current level
      this.levelLoader.loadLevel(this.level! - 1);
    }

    this.resetTimer();
  }
  /**
   * The function checks if all bubbles on the player's side of the wall have been popped and triggers
   * wall disappearance if they have.
   * @returns If all bubbles on the player side have been popped and the height of the wall at index 0 is
   * less than or equal to 0, then nothing is returned. Otherwise, the `wallSlidingSound` is played, the
   * wall at index 0 starts disappearing, and then it is removed from the `walls` array using `shift()`.
   */
  checkBubblesOnPlayerSide() {
    var allBubblesPopped = true;
    for (let bubble of GameManager.bubbleArray) {
      //check if bubbles are present on the left side of the wall

      if (GameManager.walls[0] && bubble.centerX <= GameManager.walls[0].posX) {
        allBubblesPopped = false;
        break;
      }
    }
    if (allBubblesPopped && GameManager.walls[0]) {
      if (GameManager.walls[0].height <= 0) {
        return;
      }
      GameManager.wallSlidingSound.play();
      GameManager.walls[0].startDisappearing();
      GameManager.walls.shift();
    }
  }

  start() {
    if (!(this.gameState == GameState.RUNNING)) {
      return;
    }
    this.checkCollision();
    this.update();
    this.draw();
    requestAnimationFrame(this.start);
  }
}
