import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { StatLog } from '../models/StatLog';
import { Battle } from '../models/Battle';
import { Game } from '../models/Game';
import { calculateStatGains, applyStatGains, calculateXpFromGains } from '../engine/StatEngine';
import { checkLevelUp } from '../engine/LevelSystem';
import { executeBattle } from '../engine/BattleEngine';
import { BatterGroup, CharacterStats } from '@beastleague/shared';

export interface SettlementResult {
  gameId: string;
  settledPlacements: number;
  battles: number;
  errors: string[];
}

/** MongoMemoryServer는 replica set 없이 트랜잭션 미지원 → 항상 false로 처리(단순화) */
function isReplicaSet(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (mongoose.connection as any).client?.options;
    return !!(opts?.replicaSet);
  } catch {
    return false;
  }
}

export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];

  const activePlacements = await Placement.find({ gameId, status: 'active' });

  if (activePlacements.length === 0) {
    const settledCount = await Placement.countDocuments({ gameId, status: 'settled' });
    if (settledCount > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledPlacements: 0, battles: 0, errors };
  }

  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);

  let settledPlacements = 0;
  let battleCount = 0;

  const placementResults: Array<{ userId: string; characterId: string; statGain: number }> = [];

  const doSettle = async () => {
    for (const placement of activePlacements) {
      try {
        const batterGroup = game.batterGroups.find(
          (bg) => bg.team === placement.team && bg.groupType === placement.groupType
        ) as BatterGroup | undefined;

        if (!batterGroup) {
          errors.push(`배터 그룹 없음: ${placement.team}/${placement.groupType}`);
          continue;
        }

        const character = await Character.findById(placement.characterId);
        if (!character) {
          errors.push(`캐릭터 없음: ${String(placement.characterId)}`);
          continue;
        }

        const before: CharacterStats = {
          power: character.stats.power, agility: character.stats.agility,
          skill: character.stats.skill, stamina: character.stats.stamina,
          mind: character.stats.mind,
        };
        const gains = calculateStatGains(batterGroup.stats);
        const after = applyStatGains(before, gains);
        const xpGain = calculateXpFromGains(gains);
        const lvResult = checkLevelUp(character.level, character.xp, xpGain);

        character.stats.power   = after.power;
        character.stats.agility = after.agility;
        character.stats.skill   = after.skill;
        character.stats.stamina = after.stamina;
        character.stats.mind    = after.mind;
        character.xp    = lvResult.newXp;
        character.level = lvResult.newLevel;
        await character.save();

        await StatLog.create({
          userId: placement.userId, characterId: placement.characterId,
          source: 'game', sourceId: gameId,
          before, after,
          xpBefore: character.xp, xpAfter: lvResult.newXp,
          levelBefore: lvResult.newLevel - lvResult.levelsGained,
          levelAfter: lvResult.newLevel,
        });

        placement.status = 'settled';
        await placement.save();
        settledPlacements++;

        const totalGain = Object.values(gains)
          .filter((v): v is number => typeof v === 'number' && v > 0)
          .reduce((a, b) => a + b, 0);

        placementResults.push({
          userId: String(placement.userId),
          characterId: String(placement.characterId),
          statGain: totalGain,
        });
      } catch (err) {
        errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
      }
    }

    // 대결 매칭
    placementResults.sort((a, b) => b.statGain - a.statGain);

    for (let i = 0; i + 1 < placementResults.length; i += 2) {
      const p1 = placementResults[i];
      const p2 = placementResults[i + 1];
      const battleResult = executeBattle(p1.statGain, p2.statGain);

      await Battle.create({
        date: game.date, gameId,
        player1: { userId: p1.userId, characterId: p1.characterId, statGain: p1.statGain },
        player2: { userId: p2.userId, characterId: p2.characterId, statGain: p2.statGain },
        result: battleResult.result,
        xpAwarded: battleResult.xpAwarded,
      });

      for (const [player, xp] of [
        [p1, battleResult.xpAwarded.player1],
        [p2, battleResult.xpAwarded.player2],
      ] as [typeof p1, number][]) {
        const char = await Character.findById(player.characterId);
        if (!char) continue;
        const lvResult = checkLevelUp(char.level, char.xp, xp);
        char.xp = lvResult.newXp;
        char.level = lvResult.newLevel;
        await char.save();
      }
      battleCount++;
    }

    // 홀수 마지막 → XP +10 보너스
    if (placementResults.length % 2 === 1) {
      const last = placementResults[placementResults.length - 1];
      const char = await Character.findById(last.characterId);
      if (char) {
        const lvResult = checkLevelUp(char.level, char.xp, 10);
        char.xp = lvResult.newXp;
        char.level = lvResult.newLevel;
        await char.save();
      }
    }
  };

  // 프로덕션(replica set): 트랜잭션 사용 / 테스트(single node): 직접 실행
  if (isReplicaSet()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(doSettle);
    } finally {
      await session.endSession();
    }
  } else {
    await doSettle();
  }

  io.emit('settlement:complete', { gameId, settledPlacements, battles: battleCount });
  for (const p of placementResults) {
    io.to(`user:${p.userId}`).emit('stat:change', { gameId });
  }

  return { gameId, settledPlacements, battles: battleCount, errors };
}
