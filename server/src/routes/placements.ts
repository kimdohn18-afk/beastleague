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

/**
 * streak 계산: "직전 경기일"에 배치했으면 streak+1, 아니면 리셋
 */
async function updateStreak(character: any, today: string): Promise<void> {
  // 오늘 이미 streak 업데이트 했으면 스킵 (같은 날 배치 수정)
  if (character.lastPlacementDate === today) return;

  // 오늘 이전의 가장 최근 경기일 조회
  const lastGameDay = await Game.findOne({
    date: { $lt: today },
    status: { $in: ['finished', 'scheduled', 'in_progress'] },
  })
    .sort({ date: -1 })
    .select('date')
    .lean();

  if (!lastGameDay) {
    // 이전 경기 기록 없음 → 첫 배치
    character.streak = 1;
  } else if (character.lastPlacementDate === lastGameDay.date) {
    // 직전 경기일에 배치했음 → 연속
    character.streak = (character.streak || 0) + 1;
  } else {
    // 직전 경기일에 배치 안 했음 → 리셋
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

      existing.gameId = gameId;
      existing.team = team;
      existing.battingOrder = battingOrder;
      existing.predictedWinner = predictedWinner;
      await existing.save();

      // 배치 수정이지만 streak은 이미 업데이트됨 (같은 날이므로 스킵)
      await updateStreak(character, today);

      return res.status(200).json(existing);
    }

    // 새 배치
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

    // streak 업데이트
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

// ── 튜토리얼 ──

// GET /api/placements/tutorial/games — 최근 finished 경기 목록 반환
placementsRouter.get('/tutorial/games', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });
    if (character.tutorialCompleted) {
      return res.status(400).json({ error: '이미 튜토리얼을 완료했습니다' });
    }

    // 가장 최근 finished 경기가 있는 날짜 찾기
    const latestGame = await Game.findOne({ status: 'finished' })
      .sort({ date: -1, gameId: -1 })
      .lean();

    if (!latestGame) {
      return res.status(404).json({ error: '완료된 경기가 없습니다' });
    }

    // 그 날짜의 모든 finished 경기
    const games = await Game.find({ date: latestGame.date, status: 'finished' }).lean();
    return res.json(games);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/placements/tutorial — 튜토리얼 배치 (즉시 정산, 고정 15 XP)
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

    // 실제 XP 계산 (breakdown은 실제 값으로 기록)
    const { calculatePlacementXp } = await import('../services/XpCalculator');
    const breakdown = calculatePlacementXp(game, team, battingOrder);

    // 승리 예측 적중 여부
    const homeScore = game.homeScore ?? 0;
    const awayScore = game.awayScore ?? 0;
    let winner = '';
    if (homeScore > awayScore) winner = game.homeTeam;
    else if (awayScore > homeScore) winner = game.awayTeam;
    const isCorrect = winner !== '' && predictedWinner === winner;

    const xpFromPrediction = isCorrect ? 30 : 0;

    // Placement 레코드 생성 — 실제 정산과 동일한 구조
    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: game.date,
      status: 'settled',
      isCorrect,
      xpFromPlayer: breakdown.total,
      xpFromPrediction,
      xpBreakdown: {
        hits: breakdown.hits,
        rbi: breakdown.rbi,
        runs: breakdown.runs,
        noHitPenalty: breakdown.noHitPenalty,
        homeRun: breakdown.homeRun,
        double: breakdown.double,
        triple: breakdown.triple,
        stolenBase: breakdown.stolenBase,
        caughtStealing: breakdown.caughtStealing,
        walkOff: breakdown.walkOff,
        teamResult: breakdown.teamResult,
        total: breakdown.total,
      },
    });

    // 캐릭터에는 고정 15 XP만 지급
    const TUTORIAL_XP = 15;
    character.xp = (character.xp || 0) + TUTORIAL_XP;
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
          batterRecords: game.batterRecords,
        },
      },
      tutorialXp: TUTORIAL_XP,
      actualXp: breakdown.total + xpFromPrediction,
    });
