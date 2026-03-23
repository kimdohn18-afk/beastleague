import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupSocket(io: SocketIOServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('join:game', (gameId: string) => {
      socket.join(`game:${gameId}`);
    });

    socket.on('leave:game', (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });
}
