// ━━━ 업적 계산 메인 함수 ━━━ (수정됨)
export async function calculateAchievements(
  userId: string,
  characterId: string,
  options?: { skipTraitUpdate?: boolean }
) {
  const character = await Character.findById(characterId).lean();
  if (!character) throw new Error('Character not found');

  const ctx = await buildContext(userId, character.xp || 0);

  // 1차: 수집 업적 제외하고 계산
  const earned: string[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category === 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  // 팀 업적
  const teamAchievements: Array<{
    teamId: string;
    teamName: string;
    teamEmoji: string;
    tier: TeamAchievementTier;
    count: number;
  }> = [];

  for (const team of KBO_TEAMS) {
    const countById    = ctx.teamPlacementCounts[team.id] || 0;
    const countByName  = ctx.teamPlacementCounts[team.name] || 0;
    const countByShort = ctx.teamPlacementCounts[team.shortName] || 0;
    const totalCount = countById + countByName + countByShort;
    const tier = getTeamTier(totalCount);
    if (tier) {
      teamAchievements.push({
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji,
        tier,
        count: totalCount,
      });
    }
  }

  // 팀 업적도 earned 카운트에 포함
  ctx.earnedCount = earned.length + teamAchievements.length;

  // 2차: 수집 업적 체크
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category !== 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  // 최종 카운트
  const finalEarnedCount = earned.length + teamAchievements.length;

  // ──── activeTrait 결정 ────
  const currentTrait = character.activeTrait;

  // ★ 핵심 수정: skipTraitUpdate일 때는 DB에 저장된 값을 그대로 사용
  // (읽기 전용 호출에서 자동 선택 로직이 사용자의 선택을 덮어쓰는 문제 해결)
  if (options?.skipTraitUpdate && currentTrait) {
    // DB에 저장된 activeTrait이 실제로 달성된 업적인지 확인 후 반환
    let currentTraitObj: { id: string; emoji: string; name: string; description: string } | null = null;

    // 일반 업적에서 찾기
    const generalDef = ACHIEVEMENT_DEFINITIONS.find(d => d.id === currentTrait);
    if (generalDef && earned.includes(currentTrait)) {
      currentTraitObj = { id: generalDef.id, emoji: generalDef.emoji, name: generalDef.name, description: generalDef.description };
    }

    // 팀 업적에서 찾기
    if (!currentTraitObj) {
      const teamAch = teamAchievements.find(ta => ta.teamId === currentTrait);
      if (teamAch) {
        currentTraitObj = { id: teamAch.teamId, emoji: teamAch.teamEmoji, name: teamAch.teamName, description: `${teamAch.teamName} 충성파` };
      }
    }

    // 하위 호환 (구 형식 "🔮 예언자" 같은 경우)
    if (!currentTraitObj && currentTrait.includes(' ')) {
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (currentTrait.includes(def.name) && earned.includes(def.id)) {
          currentTraitObj = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
          break;
        }
      }
    }

    // 유효한 업적이면 DB 건드리지 않고 바로 반환
    if (currentTraitObj) {
      // earnedAchievements, teamAchievements만 업데이트 (activeTrait는 건드리지 않음)
      await Character.findByIdAndUpdate(characterId, {
        earnedAchievements: earned,
        teamAchievements: teamAchievements.map(t => ({
          teamId: t.teamId,
          tier: t.tier.tier,
          count: t.count,
        })),
      });

      return { activeTrait: currentTraitObj, earned, teamAchievements, earnedCount: finalEarnedCount };
    }
    // 유효하지 않으면 아래 자동 선택 로직으로 넘어감
  }

  // ── 자동 선택 (activeTrait이 null이거나, 유효하지 않은 경우) ──
  let resolvedTrait: { id: string; emoji: string; name: string; description: string } | null = null;

  if (currentTrait && !options?.skipTraitUpdate) {
    // 일반 업적에서 찾기
    const generalDef = ACHIEVEMENT_DEFINITIONS.find(d => d.id === currentTrait);
    if (generalDef && earned.includes(currentTrait)) {
      resolvedTrait = { id: generalDef.id, emoji: generalDef.emoji, name: generalDef.name, description: generalDef.description };
    }

    // 팀 업적에서 찾기
    if (!resolvedTrait) {
      const teamAch = teamAchievements.find(ta => ta.teamId === currentTrait);
      if (teamAch) {
        resolvedTrait = { id: teamAch.teamId, emoji: teamAch.teamEmoji, name: teamAch.teamName, description: `${teamAch.teamName} 충성파` };
      }
    }

    // 하위 호환
    if (!resolvedTrait && currentTrait.includes(' ')) {
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (currentTrait.includes(def.name) && earned.includes(def.id)) {
          resolvedTrait = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
          break;
        }
      }
    }
  }

  // 사용자 설정값이 없거나 유효하지 않으면 자동 선택
  if (!resolvedTrait) {
    const RARITY_ORDER = [
      'legend', 'streak_100', 'goat', 'xp_world_tree', 'nationwide',
      'streak_60', 'explosion', 'divine', 'xp_great_tree', 'collector_30',
      'ironman', 'hr_king', 'streak_30', 'prophet', 'xp_tree',
      'veteran', 'walkoff_king', 'fortune_teller', 'speedster',
      'collector_15', 'streak_14', 'jackpot', 'xp_sapling',
      'regular', 'hr_mania', 'getting_it', 'hit_machine', 'rbi_king', 'run_king',
      'streak_7', 'big_hit', 'extra_base', 'all_rounder', 'order_explorer',
      'hot_streak', 'loss_hero', 'nohit_survivor', 'wrong_a_lot', 'lose_streak',
      'rookie', 'xp_sprout', 'first_hr', 'first_steal', 'first_walkoff',
      'first_correct', 'xp_seed', 'first_placement', 'first_league',
      'zero_xp', 'negative_xp',
    ];

    for (const id of RARITY_ORDER) {
      if (earned.includes(id)) {
        const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === id)!;
        resolvedTrait = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
        break;
      }
    }
  }

  // ──── DB 업데이트 ────
  const updatePayload: any = {
    earnedAchievements: earned,
    teamAchievements: teamAchievements.map(t => ({
      teamId: t.teamId,
      tier: t.tier.tier,
      count: t.count,
    })),
  };

  if (!options?.skipTraitUpdate) {
    updatePayload.activeTrait = resolvedTrait ? resolvedTrait.id : null;
  }

  await Character.findByIdAndUpdate(characterId, updatePayload);

  return { activeTrait: resolvedTrait, earned, teamAchievements, earnedCount: finalEarnedCount };
}
