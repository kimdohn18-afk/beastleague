import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { League } from '../models/League';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import crypto from 'crypto';

export const leaguesRouter = Router();

function generateCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6자리
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// POST /api/leagues — 리그 생성
leaguesRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '리그 이름을 입력해주세요' });
    }
    if (name.length > 20) {
      return res.status(400).json({ error: '리그 이름은 20자 이내입니다' });
    }

    // 최대 3개 리그 생성 제한
    const ownedCount = await League.countDocuments({ ownerId: userId });
    if (ownedCount >= 3) {
      return res.status(400).json({ error: '리그는 최대 3개까지 만들 수 있습니다' });
    }

    // 유니크 코드 생성
    let code = generateCode();
    let attempts = 0;
    while (await League.findOne({ code })) {
      code = generateCode();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: '코드 생성 실패, 다시 시도해주세요' });
      }
    }

    const league = await League.create({
      name: name.trim(),
      code,
      ownerId: userId,
      members: [userId],
    });

    return res.status(201).json(league);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/leagues/join — 리그 참가
leaguesRouter.post('/join', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;

    if (!code) return res.status(400).json({ error: '초대 코드를 입력해주세요' });

    const league = await League.findOne({ code: code.toUpperCase() });
    if (!league) return res.status(404).json({ error: '존재하지 않는 초대 코드입니다' });

    if (league.members.some((m) => String(m) === String(userId))) {
      return res.status(400).json({ error: '이미 참가한 리그입니다' });
    }

    if (league.members.length >= league.maxMembers) {
      return res.status(400).json({ error: '리그 인원이 가득 찼습니다' });
    }

    // 최대 5개 리그 참가 제한
    const joinedCount = await League.countDocuments({ members: userId });
    if (joinedCount >= 5) {
      return res.status(400).json({ error: '리그는 최대 5개까지 참가할 수 있습니다' });
    }

    league.members.push(userId);
    await league.save();

    return res.json(league);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/leagues — 내가 속한 리그 목록
leaguesRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const leagues = await League.find({ members: userId })
      .select('name code members ownerId createdAt')
      .lean();

    return res.json(leagues);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/leagues/:code/ranking — 리그 랭킹
leaguesRouter.get('/:code/ranking', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const league = await League.findOne({ code: req.params.code.toUpperCase() });
    if (!league) return res.status(404).json({ error: '존재하지 않는 리그입니다' });

    if (!league.members.some((m) => String(m) === String(userId))) {
      return res.status(403).json({ error: '이 리그의 멤버가 아닙니다' });
    }

    // 멤버들의 캐릭터 정보
    const characters = await Character.find({ userId: { $in: league.members } })
      .select('userId name animalType xp activeTrait')
      .sort({ xp: -1 })
      .lean();

    // 오늘 배치 여부
    const today = todayKST();
    const placements = await Placement.find({
      userId: { $in: league.members },
      date: today,
    }).select('userId').lean();
    const placedSet = new Set(placements.map((p) => String(p.userId)));

    const ranking = characters.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      animalType: c.animalType,
      xp: c.xp,
      activeTrait: c.activeTrait,
      placedToday: placedSet.has(String(c.userId)),
      isMe: String(c.userId) === String(userId),
    }));

    return res.json({
      league: { name: league.name, code: league.code, memberCount: league.members.length },
      ranking,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/leagues/:code — 리그 나가기 (방장이면 삭제)
leaguesRouter.delete('/:code', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const league = await League.findOne({ code: req.params.code.toUpperCase() });
    if (!league) return res.status(404).json({ error: '존재하지 않는 리그입니다' });

    if (String(league.ownerId) === String(userId)) {
      await League.deleteOne({ _id: league._id });
      return res.json({ message: '리그가 삭제되었습니다' });
    }

    league.members = league.members.filter((m) => String(m) !== String(userId));
    await league.save();
    return res.json({ message: '리그에서 나왔습니다' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
