import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Placement } from '../models/Placement';

export const placementsRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function nowKST(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

/**
 * 경기 시작 시간이 지났는지 확인
 * game.startTime = "18:30" 형식, game.date = "2026-04-07" 형식
 */
function isGameStarted(game: any): boolean {
  // DB status로 먼저 체크
  if (game.status !== 'scheduled') return true;

  // startTime이 있으면 시간 기반 체크
  if (game.startTime && game.date) {
    try {
      const [hour, minute] = game.startTime.split(':').map(Number);
      const now = nowKST();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const currentDate = now.toISOString().slice(0, 10);

      // 같은 날짜이고, 현재 시간이 시작 시간 이후이면 시작된 것으로 판단
      if (currentDate === game.date) {
        if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
          return true;
        }
      }
    } catch (e) {
      // startTime 파싱 실패시 status에만 의존
    }
  }

  return false;
}

// POST /api/placements
placementsRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId, team, battingOrder, predictedWinner } = req.body as {
      gameId: string;
      team: string;
      battingOrder: number;
      predictedWinner: string;
    };

    if (!gameId || !team || !battingOrder || !predictedWinner) {
      return res.status(400).json({ error: '모든 항목을 선택해주세요' });
    }

    if (battingOrder < 1 || battingOrder > 9) {
      return res.status(400).json({ error: '타순은 1~9번입니다' });
    }

    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });

    const today = todayKST();
    const existing = await Placement.findOne({ userId, date: today });

    if (existing) {
      if (existing.status === 'settled') {
        return res.status(400).json({ error: '이미 정산된 배치는 수정할 수 없습니다' });
      }

      // 기존 배치의 경기가 이미 시작됐는지 확인
      const existingGame = await Game.findOne({ gameId: existing.gameId });
      if (existingGame && isGameStarted(existingGame)) {
        return res.status(400).json({ error: '이미 시작된 경기의 배치는 수정할 수 없습니다' });
      }

      // 새로 선택한 경기도 시작 전인지 확인
      const newGame = await Game.findOne({ gameId });
      if (!newGame) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
      if (isGameStarted(newGame)) {
        return res.status(400).json({ error: '이미 시작된 경기입니다' });
      }

      existing.gameId = gameId;
      existing.team = team;
      existing.battingOrder = battingOrder;
      existing.predictedWinner = predictedWinner;
      await existing.save();
      return res.status(200).json(existing);
    }

    // 새 배치
    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기입니다' });
    }

    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: today,
    });

    return res.status(201).json(placement);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/placements/today
placementsRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const today = todayKST();
    const placement = await Placement.findOne({ userId: req.user!.userId, date: today }).lean();
    return res.json(placement ?? null);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/placements/history
placementsRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userObjectId = new Types.ObjectId(req.user!.userId);
    const list = await Placement.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: 'games',
          localField: 'gameId',
          foreignField: 'gameId',
          as: '_game',
        },
      },
      {
        $addFields: {
          game: {
            homeTeam: { $arrayElemAt: ['$_game.homeTeam', 0] },
            awayTeam: { $arrayElemAt: ['$_game.awayTeam', 0] },
            status: { $arrayElemAt: ['$_game.status', 0] },
            homeScore: { $arrayElemAt: ['$_game.homeScore', 0] },
            awayScore: { $arrayElemAt: ['$_game.awayScore', 0] },
            batterRecords: { $arrayElemAt: ['$_game.batterRecords', 0] },
          },
        },
      },
      { $project: { _game: 0 } },
    ]);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
