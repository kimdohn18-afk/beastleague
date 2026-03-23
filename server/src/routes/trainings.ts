import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Training } from '../models/Training';
import { StatLog } from '../models/StatLog';
import { executeTraining } from '../engine/TrainingEngine';
import { applyStatGains, calculateXpFromGains } from '../engine/StatEngine';
import { checkLevelUp } from '../engine/LevelSystem';
import { TrainingType, CharacterStats } from '@beastleague/shared';

export const trainingsRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// POST /api/trainings
trainingsRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type } = req.body as { type: TrainingType };

    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });

    const today = todayKST();
    const todayTrainings = await Training.countDocuments({ userId, date: today });
    if (todayTrainings >= 3) {
      return res.status(400).json({ error: '오늘 훈련 횟수를 모두 사용했습니다' });
    }

    const session = (todayTrainings + 1) as 1 | 2 | 3;
    const currentStats: CharacterStats = {
      power: character.stats.power,
      agility: character.stats.agility,
      skill: character.stats.skill,
      stamina: character.stats.stamina,
      mind: character.stats.mind,
    };

    const trainResult = executeTraining(type, session, currentStats);
    const xpGain = calculateXpFromGains(trainResult.statChanges) + trainResult.xpGained;
    const newStats = applyStatGains(currentStats, trainResult.statChanges);
    const lvResult = checkLevelUp(character.level, character.xp, xpGain);

    const before = { ...currentStats };
    character.stats.power   = newStats.power;
    character.stats.agility = newStats.agility;
    character.stats.skill   = newStats.skill;
    character.stats.stamina = newStats.stamina;
    character.stats.mind    = newStats.mind;
    character.xp = lvResult.newXp;
    character.level = lvResult.newLevel;
    await character.save();

    await StatLog.create({
      userId, characterId: character._id,
      source: 'training', sourceId: String(character._id) + '-' + today + '-' + session,
      before, after: newStats,
      xpBefore: character.xp - xpGain + (lvResult.leveledUp ? 0 : 0),
      xpAfter: lvResult.newXp,
      levelBefore: character.level - lvResult.levelsGained,
      levelAfter: lvResult.newLevel,
    });

    const training = await Training.create({
      userId, characterId: character._id,
      type, date: today, session,
      statChanges: trainResult.statChanges,
      xpGained: trainResult.xpGained,
      bonusApplied: trainResult.bonusApplied,
    });

    return res.json({ character, training, levelUpResult: lvResult });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/trainings/today
trainingsRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const today = todayKST();
    const list = await Training.find({ userId: req.user!.userId, date: today }).lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
