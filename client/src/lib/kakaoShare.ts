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
