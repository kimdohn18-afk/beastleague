battingOrder: number;
xpFromPlayer: number;
xpFromPrediction: number;
    xpFromStreak: number;
totalXp: number;
breakdown: XpBreakdown;
}>;
errors: string[];
}

/**
 * streak 보너스 계산
 * - 1~2일: +0
 * - 3일 이상: 매일 +5
 * - 7일 달성: 추가 +50
 * - 14일 달성: 추가 +100
 * - 30일 달성: 추가 +200
 * - 30일 초과: 매일 +10 (기본 +5 대신)
 */
function calculateStreakBonus(streak: number): { daily: number; milestone: number; total: number; milestoneName: string | null } {
  let daily = 0;
  let milestone = 0;
  let milestoneName: string | null = null;

  if (streak >= 30) {
    daily = 10;
  } else if (streak >= 3) {
    daily = 5;
  }

  if (streak === 7) {
    milestone = 50;
    milestoneName = '7일 연속 보너스!';
  } else if (streak === 14) {
    milestone = 100;
    milestoneName = '14일 연속 보너스!';
  } else if (streak === 30) {
    milestone = 200;
    milestoneName = '30일 연속 보너스!';
  }

  return { daily, milestone, total: daily + milestone, milestoneName };
}

export async function settleGame(
gameId: string,
io: SocketIOServer
@@ -73,7 +108,11 @@ export async function settleGame(
isCorrect = true;
}

      const totalXp = breakdown.total + xpFromPrediction;
      // streak 보너스 계산
      const streakBonus = calculateStreakBonus(character.streak || 0);
      const xpFromStreak = streakBonus.total;

      const totalXp = breakdown.total + xpFromPrediction + xpFromStreak;

      character.xp = (character.xp || 0) + totalXp;
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      // 10회 배수마다 칭호/뱃지 재계산
      if (character.totalPlacements >= 10 && character.totalPlacements % 10 === 0) {
        try {
          const { calculateTraits, getBadgeById } = await import('./TraitCalculator');
          const traitResult = await calculateTraits(character);
          character.activeTrait = traitResult.activeTrait;
          character.earnedBadges = traitResult.earnedBadges;

          if (traitResult.newBadges.length > 0) {
            const badgeNames = traitResult.newBadges
              .map(id => {
                const b = getBadgeById(id);
                return b ? `${b.emoji} ${b.name}` : id;
              })
              .join(', ');

            sendPushToUser(
              String(placement.userId),
              '🏆 새 뱃지 획득!',
              `${badgeNames}을(를) 달성했어요!`,
              { url: '/badges' }
            ).catch((e) => console.error('[Push] Badge push error:', e));
          }
        } catch (e) {
          console.error('[Trait] Calculation error:', e);
        }
      }

      await character.save();
@@ -106,16 +145,25 @@ export async function settleGame(
battingOrder: placement.battingOrder,
xpFromPlayer: xpFromPlayer + breakdown.teamResult,
xpFromPrediction,
        xpFromStreak,
totalXp,
breakdown,
});

      // 푸시 알림 전송
      // 개인화 푸시 알림 전송
const sign = totalXp >= 0 ? '+' : '';
      let pushBody = `${character.name}이(가) ${sign}${totalXp} XP를 획득했어요!`;

      if (streakBonus.milestoneName) {
        pushBody += `\n🏆 ${streakBonus.milestoneName} +${streakBonus.total} XP`;
      } else if (xpFromStreak > 0) {
        pushBody += `\n🔥 ${character.streak}일 연속 보너스 +${xpFromStreak} XP`;
      }

sendPushToUser(
String(placement.userId),
'⚾ 정산 완료!',
        `${character.name}이(가) ${sign}${totalXp} XP를 획득했어요!`,
        pushBody,
{ url: '/my-placements' }
).catch((e) => console.error('[Push] Settlement push error:', e));
