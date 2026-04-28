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

function isGameStarted(game: any): boolean {
  if (game.status !== 'scheduled') return true;

  if (game.startTime && game.date) {
    try {
      const [hour, minute] = game.startTime.split(':').map(Number);
      const now = nowKST();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const currentDate = now.toISOString().slice(0, 10);

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

async function updateStreak(character: any, today: string): Promise<void> {
  if (character.lastPlacementDate === today) return;

  const lastGameDay = await Game.findOne({
    date: { $lt: today },
    status: { $in: ['finished', 'scheduled', 'in_progress'] },
  })
    .sort({ date: -1 })
    .select('date')
    .lean();

  if (!lastGameDay) {
    character.streak = 1;
  } else if (character.lastPlacementDate === lastGameDay.date) {
    character.streak = (character.streak || 0) + 1;
  } else {
    character.streak = 1;
  }

  character.lastPlacementDate = today;
  await character.save();
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

      const existingGame = await Game.findOne({ gameId: existing.gameId });
      if (existingGame && isGameStarted(existingGame)) {
        return res.status(400).json({ error: '이미 시작된 경기의 배치는 수정할 수 없습니다' });
      }

      const newGame = await Game.findOne({ gameId });
      if (!newGame) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
      if (isGameStarted(newGame)) {
        return res.status(400).json({ error: '이미 시작된 경기입니다' });
      }

      if (predictedWinner !== newGame.homeTeam && predictedWinner !== newGame.awayTeam) {
        return res.status(400).json({ error: '승리 예측은 배치한 경기의 팀만 선택할 수 있습니다' });
      }

      existing.gameId = gameId;
      existing.team = team;
      existing.battingOrder = battingOrder;
      existing.predictedWinner = predictedWinner;
      await existing.save();

      await updateStreak(character, today);

      return res.status(200).json(existing);
    }

    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기입니다' });
    }

    if (predictedWinner !== game.homeTeam && predictedWinner !== game.awayTeam) {
      return res.status(400).json({ error: '승리 예측은 배치한 경기의 팀만 선택할 수 있습니다' });
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

    await updateStreak(character, today);

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

// GET /api/placements/tutorial/games
placementsRouter.get('/tutorial/games', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });
    if (character.tutorialCompleted) {
      return res.status(400).json({ error: '이미 튜토리얼을 완료했습니다' });
    }

    const latestGame = await Game.findOne({ status: 'finished' })
      .sort({ date: -1, gameId: -1 })
      .lean();

    if (!latestGame) {
      return res.status(404).json({ error: '완료된 경기가 없습니다' });
    }

    const games = await Game.find({ date: latestGame.date, status: 'finished' }).lean();
    return res.json(games);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/placements/tutorial
placementsRouter.post('/tutorial', authenticateUser, async (req: Request, res: Response) => {
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
    if (character.tutorialCompleted) {
      return res.status(400).json({ error: '이미 튜토리얼을 완료했습니다' });
    }

    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (game.status !== 'finished') {
      return res.status(400).json({ error: '완료된 경기만 튜토리얼에 사용할 수 있습니다' });
    }

    const breakdown = { total: 15 };

    const homeScore = game.homeScore ?? 0;
    const awayScore = game.awayScore ?? 0;
    let winner = '';
    if (homeScore > awayScore) winner = game.homeTeam;
    else if (awayScore > homeScore) winner = game.awayTeam;
    const isCorrect = winner !== '' && predictedWinner === winner;

    const xpFromPrediction = isCorrect ? 30 : 0;

    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: `tutorial-${game.date}`,
      status: 'settled',
      isCorrect,
      xpFromPlayer: breakdown.total,
      xpFromPrediction,
      xpBreakdown: { total: breakdown.total },
    });

    const TUTORIAL_XP = 15;
    character.xp = (character.xp || 0) + TUTORIAL_XP;
    character.totalXp = (character.totalXp || 0) + TUTORIAL_XP;
    character.currentXp = (character.currentXp || 0) + TUTORIAL_XP;
    character.totalPlacements = (character.totalPlacements || 0) + 1;
    character.tutorialCompleted = true;
    await character.save();

    return res.status(201).json({
      placement: {
        ...placement.toObject(),
        game: {
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          status: game.status,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
        },
      },
      tutorialXp: TUTORIAL_XP,
      actualXp: breakdown.total + xpFromPrediction,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/placements/:gameId — 배치 취소
placementsRouter.delete('/:gameId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId } = req.params;
    const today = todayKST();

    const placement = await Placement.findOne({ userId, gameId, date: today });
    if (!placement) {
      return res.status(404).json({ error: '배치를 찾을 수 없습니다' });
    }

    if (placement.status === 'settled') {
      return res.status(400).json({ error: '이미 정산된 배치는 취소할 수 없습니다' });
    }

    const game = await Game.findOne({ gameId });
    if (game && isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기의 배치는 취소할 수 없습니다' });
    }

    await Placement.findByIdAndDelete(placement._id);

    return res.json({ message: '배치가 취소되었습니다' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
