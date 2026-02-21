import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

import { BatchProgressEventDto } from "./dto/batch-status.dto";

@Injectable()
@WebSocketGateway({
  namespace: "batch",
  cors: {
    origin: "*",
  },
})
export class BatchEventsService {
  private readonly logger = new Logger(BatchEventsService.name);

  @WebSocketServer()
  server!: Server;

  /**
   * Handle batch progress events and emit via WebSocket
   */
  @OnEvent("batch.progress")
  handleBatchProgress(event: BatchProgressEventDto): void {
    this.logger.debug(`Emitting progress for batch ${event.batchId}: ${event.progress}%`);
    
    // Emit to specific batch room
    this.server.to(`batch:${event.batchId}`).emit("progress", event);
    
    // Emit to user's batch updates (if user context is available)
    this.server.emit("batch:update", event);
  }

  /**
   * Handle batch completion events
   */
  @OnEvent("batch.completed")
  handleBatchCompleted(event: BatchProgressEventDto): void {
    this.logger.log(`Batch ${event.batchId} completed`);
    
    this.server.to(`batch:${event.batchId}`).emit("completed", event);
    this.server.emit("batch:completed", event);
  }

  /**
   * Handle batch failure events
   */
  @OnEvent("batch.failed")
  handleBatchFailed(event: BatchProgressEventDto & { error?: string }): void {
    this.logger.warn(`Batch ${event.batchId} failed: ${event.error}`);
    
    this.server.to(`batch:${event.batchId}`).emit("failed", event);
    this.server.emit("batch:failed", event);
  }

  /**
   * Subscribe a client to batch updates
   */
  subscribeToBatch(clientId: string, batchId: string): void {
    const client = this.server.sockets.sockets.get(clientId);
    if (client) {
      client.join(`batch:${batchId}`);
      this.logger.debug(`Client ${clientId} subscribed to batch ${batchId}`);
    }
  }

  /**
   * Unsubscribe a client from batch updates
   */
  unsubscribeFromBatch(clientId: string, batchId: string): void {
    const client = this.server.sockets.sockets.get(clientId);
    if (client) {
      client.leave(`batch:${batchId}`);
      this.logger.debug(`Client ${clientId} unsubscribed from batch ${batchId}`);
    }
  }
}
