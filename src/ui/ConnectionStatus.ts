import { NetworkManager } from '../network/NetworkManager';

export class ConnectionStatus {
  private ctx: CanvasRenderingContext2D;
  private networkManager: NetworkManager;
  private x: number;
  private y: number;

  constructor(ctx: CanvasRenderingContext2D, networkManager: NetworkManager, x: number = 10, y: number = 30) {
    this.ctx = ctx;
    this.networkManager = networkManager;
    this.x = x;
    this.y = y;
  }

  public render(): void {
    if (!this.networkManager.isConnected()) {
      return;
    }

    const ctx = this.ctx;
    const latency = this.networkManager.getLatency();

    // Determine connection quality color
    let qualityColor: string;
    let qualityText: string;

    if (latency < 100) {
      qualityColor = '#27ae60'; // Green - Excellent
      qualityText = '●';
    } else if (latency < 200) {
      qualityColor = '#f39c12'; // Yellow - Good
      qualityText = '●';
    } else if (latency < 300) {
      qualityColor = '#e67e22'; // Orange - Fair
      qualityText = '●';
    } else {
      qualityColor = '#e74c3c'; // Red - Poor
      qualityText = '●';
    }

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(this.x, this.y - 20, 150, 30);

    // Draw connection indicator
    ctx.fillStyle = qualityColor;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(qualityText, this.x + 5, this.y);

    // Draw latency text
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '16px Arial';
    ctx.fillText(`Ping: ${latency}ms`, this.x + 25, this.y);

    // Draw role indicator
    const role = this.networkManager.isHostPlayer() ? 'Host' : 'Client';
    ctx.fillStyle = '#95a5a6';
    ctx.font = '12px Arial';
    ctx.fillText(role, this.x + 110, this.y);

    // Draw warning if latency is too high
    if (latency > 300) {
      this.drawWarning();
    }
  }

  private drawWarning(): void {
    const ctx = this.ctx;
    const canvasWidth = ctx.canvas.width;

    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.fillRect(canvasWidth / 2 - 150, 10, 300, 40);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ High Latency', canvasWidth / 2, 25);
    ctx.font = '12px Arial';
    ctx.fillText('Connection may be unstable', canvasWidth / 2, 40);
  }

  public renderDisconnected(message: string = 'Connection Lost'): void {
    const ctx = this.ctx;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw disconnection message
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvasWidth / 2, canvasHeight / 2 - 40);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '20px Arial';
    ctx.fillText('Waiting for reconnection...', canvasWidth / 2, canvasHeight / 2);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText('Press ESC to return to lobby', canvasWidth / 2, canvasHeight / 2 + 40);
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}
