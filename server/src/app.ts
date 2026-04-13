import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { generalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { charactersRouter } from './routes/characters';
import { placementsRouter } from './routes/placements';
import { trainingsRouter } from './routes/trainings';
import { battlesRouter } from './routes/battles';
import { rankingsRouter } from './routes/rankings';
import { internalRouter } from './routes/internal';
import { pushRouter } from './routes/push';
import { leaguesRouter } from './routes/leagues';

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

  // 서버 헬스체크 (인증 불필요 - 크론잡 서버 깨우기용)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/characters', charactersRouter);
  app.use('/api/placements', placementsRouter);
  app.use('/api/trainings', trainingsRouter);
  app.use('/api/battles', battlesRouter);
  app.use('/api/rankings', rankingsRouter);
  app.use('/api/internal', internalRouter);
  app.use('/api/push', pushRouter);
  app.use('/api/leagues', leaguesRouter);

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
