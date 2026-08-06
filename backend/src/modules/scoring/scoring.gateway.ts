import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import type { RecordBallInput } from '@stumped/shared';

/**
 * WebSocket gateway for real-time live scoring.
 * Scorers emit ball events, spectators receive live updates.
 * 
 * Security: CORS restricted to allowed origins.
 * TODO(security): Add WebSocket authentication via JWT handshake.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8081',
    credentials: true,
  },
  namespace: '/scoring',
})
export class ScoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly scoringService: ScoringService) {}

  handleConnection(client: Socket) {
    // Connection logging - no sensitive data
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a match room to receive live updates.
   */
  @SubscribeMessage('match:join')
  async handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    if (!data?.matchId) return;
    await client.join(`match:${data.matchId}`);
    console.log(`Client ${client.id} joined match room: ${data.matchId}`);
    return { event: 'match:joined', data: { matchId: data.matchId } };
  }

  /**
   * Leave a match room.
   */
  @SubscribeMessage('match:leave')
  async handleLeaveMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    if (!data?.matchId) return;
    await client.leave(`match:${data.matchId}`);
    return { event: 'match:left', data: { matchId: data.matchId } };
  }

  /**
   * Broadcast a ball update to all spectators in the match room.
   * Called by the scoring service after recording a ball.
   */
  broadcastBallUpdate(matchId: string, liveScoreState: unknown) {
    this.server.to(`match:${matchId}`).emit('match:ballUpdate', liveScoreState);
  }

  /**
   * Broadcast match completion.
   */
  broadcastMatchComplete(matchId: string, result: unknown) {
    this.server.to(`match:${matchId}`).emit('match:matchComplete', result);
  }

  /**
   * Broadcast innings completion.
   */
  broadcastInningsComplete(matchId: string, summary: unknown) {
    this.server
      .to(`match:${matchId}`)
      .emit('match:inningsComplete', summary);
  }
}
