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

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
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

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // 글로벌 에러 핸들러
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Error]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
