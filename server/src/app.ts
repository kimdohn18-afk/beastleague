import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { generalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { charactersRouter } from './routes/characters';
import { placementsRouter } from './routes/placements';
import { internalRouter } from './routes/internal';
import { pushRouter } from './routes/push';
import { rankingsRouter } from './routes/rankings';
import { statsRouter } from './routes/stats';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));

  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(generalLimiter);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/characters', charactersRouter);
  app.use('/api/placements', placementsRouter);
  app.use('/api/rankings', rankingsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/internal', internalRouter);
  app.use('/api/push', pushRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Error]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
