import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';

const router = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function nowKST(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

function isGameStarted(game: any): boolean {
  if (game.status === 'in_progress' || game.status === 'finished') return true;
  if (game.startTime) {
    const now = nowKST();
    const [h, m] = game.startTime.split(':').map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    if (now >= start) return true;
  }
  return false;
}

async function updateStreak(character: any, today: string) {
  const lastDate = character.lastPlacementDate;
  if (lastDate === today) return;

  const yesterday = new Date(Date.now() + 9 * 3600 * 1000);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastDate === yesterdayStr) {
    character.streak = (character.streak || 0) + 1;
  } else {
    character.streak = 1;
  }
  character.lastPlacementDate = today;
  await character.save();
}

/* ───── POST / — 배치 생성 ───── */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId, team, battingOrder, predictedWinner } = req.body;

    if (!gameId || !team || !battingOrder || !predictedWinner) {
      return res.status(400).json({ error: '필수 값이 누락되었습니다' });
    }

    const today = todayKST();

    const existing = await Placement.findOne({ userId, date: today });
    if (existing) {
      return res.status(400).json({ error: '오늘 이미 배치했습니다', code: 'alreadyPlaced' });
    }

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    }

    if (game.status === 'settled') {
      return res.status(400).json({ error: '이미 정산된 경기입니다' });
    }

    if (isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기입니다', code: 'gameStarted' });
    }

    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: today,
      status: 'active',
    });

    await updateStreak(character, today);

    res.status(201).json(placement);
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '오늘 이미 배치했습니다', code: 'alreadyPlaced' });
    }
    console.error('Placement create error:', err);
    res.status(500).json({ error: '배치 생성 실패' });
  }
});

/* ───── GET /today — 오늘 내 배치 ───── */
router.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    const placement = await Placement.findOne({ userId, date: today }).lean();
    res.json(placement || null);
  } catch (err) {
    console.error('Today placement error:', err);
    res.status(500).json({ error: '오늘 배치 조회 실패' });
  }
});

/* ───── GET /history — 내 배치 기록 ───── */
router.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const placements = await Placement.aggregate([
      { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: 'games',
          localField: 'gameId',
          foreignField: 'gameId',
          as: 'gameInfo',
        },
      },
      { $unwind: { path: '$gameInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: 1,
          gameId: 1,
          team: 1,
          battingOrder: 1,
          predictedWinner: 1,
          date: 1,
          status: 1,
          isCorrect: 1,
          xpFromPlayer: 1,
          xpFromPrediction: 1,
          xpBreakdown: 1,
          createdAt: 1,
          'gameInfo.homeTeam': 1,
          'gameInfo.awayTeam': 1,
          'gameInfo.status': 1,
          'gameInfo.homeScore': 1,
          'gameInfo.awayScore': 1,
        },
      },
    ]);

    res.json(placements);
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: '기록 조회 실패' });
  }
});

/* ───── GET /tutorial/games — 튜토리얼용 경기 ───── */
router.get('/tutorial/games', authenticateUser, async (req: Request, res: Response) => {
  try {
    const latestGame = await Game.findOne({ status: 'finished' }).sort({ date: -1 }).lean();
    if (!latestGame) {
      return res.json([]);
    }

    const games = await Game.find({ date: latestGame.date, status: 'finished' }).lean();
    res.json(games);
  } catch (err) {
    console.error('Tutorial games error:', err);
    res.status(500).json({ error: '튜토리얼 경기 조회 실패' });
  }
});

/* ───── POST /tutorial — 튜토리얼 배치 ───── */
router.post('/tutorial', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId, team, battingOrder, predictedWinner } = req.body;

    if (!gameId || !team || !battingOrder || !predictedWinner) {
      return res.status(400).json({ error: '필수 값이 누락되었습니다' });
    }

    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    if (character.tutorialCompleted) {
      return res.status(400).json({ error: '이미 튜토리얼을 완료했습니다' });
    }

    const game = await Game.findOne({ gameId });
    if (!game) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    }

    if (game.status !== 'finished') {
      return res.status(400).json({ error: '완료된 경기만 사용할 수 있습니다' });
    }

    // XP 계산
    const TUTORIAL_XP = 15;
    const breakdown: any = { total: TUTORIAL_XP };

    const homeScore = game.homeScore ?? 0;
    const awayScore = game.awayScore ?? 0;
    let actualWinner = '';
    if (homeScore > awayScore) actualWinner = game.homeTeam;
    else if (awayScore > homeScore) actualWinner = game.awayTeam;

    let xpFromPrediction = 0;
    if (actualWinner && predictedWinner === actualWinner) {
      xpFromPrediction = 30;
    }

    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: game.date,
      status: 'settled',
      isCorrect: actualWinner ? predictedWinner === actualWinner : false,
      xpFromPlayer: TUTORIAL_XP,
      xpFromPrediction,
      xpBreakdown: breakdown,
    });

    // XP 지급 — 세 필드 동일하게 증가
    const totalGained = TUTORIAL_XP + xpFromPrediction;
    character.xp = (character.xp || 0) + totalGained;
    character.totalXp = (character.totalXp || 0) + totalGained;
    character.currentXp = (character.currentXp || 0) + totalGained;
    character.totalPlacements = (character.totalPlacements || 0) + 1;
    character.tutorialCompleted = true;
    await character.save();

    const populatedPlacement = await Placement.findById(placement._id).lean();

    res.status(201).json({
      placement: populatedPlacement,
      game: {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore,
        awayScore,
      },
      tutorialXp: TUTORIAL_XP,
      actualXp: breakdown.total + xpFromPrediction,
    });
  } catch (err) {
    console.error('Tutorial placement error:', err);
    res.status(500).json({ error: '튜토리얼 배치 실패' });
  }
});

/* ───── DELETE /:gameId — 배치 취소 ───── */
router.delete('/:gameId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId } = req.params;
    const today = todayKST();

    const placement = await Placement.findOne({ userId, gameId, date: today });
    if (!placement) {
      return res.status(404).json({ error: '오늘 해당 경기 배치를 찾을 수 없습니다' });
    }

    if (placement.status === 'settled') {
      return res.status(400).json({ error: '이미 정산된 배치는 취소할 수 없습니다' });
    }

    const game = await Game.findOne({ gameId });
    if (game && isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기의 배치는 취소할 수 없습니다', code: 'gameStarted' });
    }

    await Placement.findByIdAndDelete(placement._id);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Placement delete error:', err);
    res.status(500).json({ error: '배치 취소 실패' });
  }
});

export default router;
export { router as placementsRouter };
