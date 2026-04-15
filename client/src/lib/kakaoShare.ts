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

const BASE_URL = 'https://beastleague-client.vercel.app';

function buildOgUrl(params: {
  name: string;
  animal: string;
  xp: number;
  trait?: string;
  type?: string;
  team?: string;
  order?: string;
  result?: string;
}): string {
  const url = new URL(`${BASE_URL}/api/og`);
  url.searchParams.set('name', params.name);
  url.searchParams.set('animal', params.animal);
  url.searchParams.set('xp', String(params.xp));
  if (params.trait) url.searchParams.set('trait', params.trait);
  if (params.type) url.searchParams.set('type', params.type);
  if (params.team) url.searchParams.set('team', params.team);
  if (params.order) url.searchParams.set('order', params.order);
  if (params.result) url.searchParams.set('result', params.result);
  return url.toString();
}

/** 메인 화면 공유 */
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
  const imageUrl = buildOgUrl({
    name: characterName, animal: animalType, xp, trait: traitName, type: 'main',
  });

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${animalEmoji} ${characterName} — ${xp.toLocaleString()} XP`,
      description: `${traitLine}KBO 경기로 키우는 내 ${animalName}\n매일 배치하고 캐릭터를 성장시켜보세요!`,
      imageUrl,
      imageWidth: 600,
      imageHeight: 400,
      link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL },
    },
    buttons: [{ title: '나도 시작하기', link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL } }],
  });
}

/** 배치 완료 시 공유 */
export function sharePlacement(params: {
  characterName: string;
  animalType: string;
  xp: number;
  traitName?: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
}) {
  if (!ensureInit()) return;

  const { characterName, animalType, xp, traitName, team, battingOrder, predictedWinner, awayTeam, homeTeam, date } = params;
  const imageUrl = buildOgUrl({
    name: characterName, animal: animalType, xp, trait: traitName,
    type: 'placement', team, order: String(battingOrder),
  });

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `⚾ ${awayTeam} vs ${homeTeam}`,
      description: `${characterName}이(가) ${team} ${battingOrder}번 타자에 배치!\n${predictedWinner} 승리 예측 📢\n\n${date} 경기`,
      imageUrl,
      imageWidth: 600,
      imageHeight: 400,
      link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL },
    },
    buttons: [{ title: '나도 배치하기', link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL } }],
  });
}

/** 정산 결과 공유 */
export function shareResult(params: {
  characterName: string;
  animalType: string;
  xp: number;
  traitName?: string;
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
    characterName, animalType, xp, traitName,
    team, battingOrder, totalXp, isCorrect, predictedWinner,
    awayTeam, homeTeam, awayScore, homeScore, date,
  } = params;

  const sign = totalXp >= 0 ? '+' : '';
  const predictionText = isCorrect ? '예측 적중! ✅' : '예측 실패 ❌';
  const resultText = `${team} ${battingOrder}번 → ${sign}${totalXp} XP · ${predictionText}`;

  const imageUrl = buildOgUrl({
    name: characterName, animal: animalType, xp, trait: traitName,
    type: 'result', result: resultText,
  });

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${awayTeam} ${awayScore} : ${homeScore} ${homeTeam}`,
      description: `${characterName}의 정산 결과\n${team} ${battingOrder}번 타자 → ${sign}${totalXp} XP\n${predictedWinner} 승리 예측 ${predictionText}\n\n${date} 경기`,
      imageUrl,
      imageWidth: 600,
      imageHeight: 400,
      link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL },
    },
    buttons: [{ title: '나도 배치하기', link: { mobileWebUrl: BASE_URL, webUrl: BASE_URL } }],
  });
}
