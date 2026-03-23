import 'dotenv/config';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { setupSocket } from './socket';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const MONGODB_URI = process.env.MONGODB_URI ?? '';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('[DB] MongoDB connected');

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  app.locals.io = io;
  setupSocket(io);

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[Startup] Failed:', err);
  process.exit(1);
});
