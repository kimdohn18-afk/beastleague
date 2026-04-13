declare global {
  interface Window {
    Kakao: any;
  }
}

let initialized = false;

function ensureInit() {
  if (typeof window === 'undefined' || !window.Kakao) return false;
  if (!initialized && !window.Kakao.isInitialized()) {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) return false;
    window.Kakao.init(key);
    initialized = true;
  }
  return window.Kakao.isInitialized();
}

/** 배치 완료 시 공유 */
export function sharePlacement(params: {
  team: string;
  battingOrder: number;
  predictedWinner: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
}) {
  if (!ensureInit()) return;

  const { team, battingOrder, predictedWinner, awayTeam, homeTeam, date } = params;

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `⚾ ${awayTeam} vs ${homeTeam}`,
      description: `${team} ${battingOrder}번 타자에 배치!\n${predictedWinner} 승리 예측 📢\n\n${date} 경기`,
      imageUrl: 'https://beastleague.vercel.app/icon-512.png',
      link: {
        mobileWebUrl: 'https://beastleague.vercel.app',
        webUrl: 'https://beastleague.vercel.app',
      },
    },
    buttons: [
      {
        title: '나도 배치하기',
        link: {
          mobileWebUrl: 'https://beastleague.vercel.app',
          webUrl: 'https://beastleague.vercel.app',
        },
      },
    ],
  });
}

/** 정산 결과 공유 */
export function shareResult(params: {
  characterName: string;
  team: string;
  battingOrder: number;
  totalXp: number;
  isCorrect: boolean;
  predictedWinner: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  date: string;
}) {
  if (!ensureInit()) return;

  const {
    characterName, team, battingOrder, totalXp,
    isCorrect, predictedWinner,
    awayTeam, homeTeam, awayScore, homeScore, date,
  } = params;

  const sign = totalXp >= 0 ? '+' : '';
  const predictionText = isCorrect ? '예측 적중! ✅' : '예측 실패 ❌';

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${awayTeam} ${awayScore} : ${homeScore} ${homeTeam}`,
      description: `${characterName}의 정산 결과\n${team} ${battingOrder}번 타자 → ${sign}${totalXp} XP\n${predictedWinner} 승리 예측 ${predictionText}\n\n${date} 경기`,
      imageUrl: 'https://beastleague.vercel.app/icon-512.png',
      link: {
        mobileWebUrl: 'https://beastleague.vercel.app',
        webUrl: 'https://beastleague.vercel.app',
      },
    },
    buttons: [
      {
        title: '나도 배치하기',
        link: {
          mobileWebUrl: 'https://beastleague.vercel.app',
          webUrl: 'https://beastleague.vercel.app',
        },
      },
    ],
  });
}

/** 캐릭터(메인 화면) 공유 */
export function shareCharacter(params: {
  characterName: string;
  animalName: string;
  animalEmoji: string;
  animalType: string;
  xp: number;
  traitName?: string;
}) {
  if (!ensureInit()) return;

  const { characterName, animalName, animalEmoji, xp, traitName, animalType } = params;
  const traitLine = traitName ? `칭호: ${traitName}\n` : '';

  const ogUrl = new URL('https://beastleague-client.vercel.app/api/og');
  ogUrl.searchParams.set('name', characterName);
  ogUrl.searchParams.set('animal', animalType);
  ogUrl.searchParams.set('xp', String(xp));
  if (traitName) ogUrl.searchParams.set('trait', traitName);

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${animalEmoji} ${characterName} — ${xp.toLocaleString()} XP`,
      description: `${traitLine}KBO 경기로 키우는 내 ${animalName}\n매일 배치하고 캐릭터를 성장시켜보세요!`,
      imageUrl: ogUrl.toString(),
      imageWidth: 600,
      imageHeight: 400,
      link: {
        mobileWebUrl: 'https://beastleague-client.vercel.app',
        webUrl: 'https://beastleague-client.vercel.app',
      },
    },
    buttons: [
      {
        title: '나도 시작하기',
        link: {
          mobileWebUrl: 'https://beastleague-client.vercel.app',
          webUrl: 'https://beastleague-client.vercel.app',
        },
      },
    ],
  });
}
