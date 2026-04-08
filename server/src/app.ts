import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { charactersRouter } from './routes/characters';
import { placementsRouter } from './routes/placements';
import { trainingsRouter } from './routes/trainings';
import { battlesRouter } from './routes/battles';
import { rankingsRouter } from './routes/rankings';
import { internalRouter } from './routes/internal';
import { pushRouter } from './routes/push';

export function createApp(): express.Application {
  const app = express();

  const allowedOrigins = [
    'https://beastleague-client.vercel.app',
    'https://beastleague-client-git-main-kimdohn18-afks-projects.vercel.app',
  ];

  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000');
  }

  app.use(cors({
    origin(origin, callback) {
      // 서버 간 호출(origin 없음)은 허용 (내부 API, 수집기 등)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(o => origin === o || origin.endsWith('.vercel.app'))) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/characters', charactersRouter);
  app.use('/api/placements', placementsRouter);
  app.use('/api/trainings', trainingsRouter);
  app.use('/api/battles', battlesRouter);
  app.use('/api/rankings', rankingsRouter);
  app.use('/api/internal', internalRouter);
  app.use('/api/push', pushRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Error]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
