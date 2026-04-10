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
