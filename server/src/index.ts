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
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        'https://beastleague-client.vercel.app',
        'https://beastleague-client-git-main-kimdohn18-afks-projects.vercel.app',
      ],
      credentials: true,
    },
  });

  app.locals.io = io;
  setupSocket(io);

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
  });

  const { sendPushToUnplacedUsers } = await import('./services/pushService');

  function scheduleReminder() {
    const now = new Date();
    const utcTarget = new Date(now);
    utcTarget.setUTCHours(7, 0, 0, 0);

    if (utcTarget.getTime() <= now.getTime()) {
      utcTarget.setUTCDate(utcTarget.getUTCDate() + 1);
    }

    const delay = utcTarget.getTime() - now.getTime();
    console.log(`[Reminder] Next push in ${Math.round(delay / 60000)}min (KST 16:00)`);

    setTimeout(async () => {
      try {
        const count = await sendPushToUnplacedUsers();
        console.log(`[Reminder] Sent ${count} reminders`);
      } catch (e) {
        console.error('[Reminder] Failed:', e);
      }
      scheduleReminder();
    }, delay);
  }

  scheduleReminder();
}

main().catch((err) => {
  console.error('[Startup] Failed:', err);
  process.exit(1);
});
