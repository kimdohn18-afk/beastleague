'use client';

import { useState } from 'react';
import {
  BATTER_XP,
  TEAM_WIN_XP,
  WIN_PREDICT_XP,
} from '@beastleague/shared';

// ─── XP 상수에서 동적 생성 ───
const HELP_CARDS = [
  {
    icon: '🐾',
    title: '비스트리그란?',
    lines: [
      '실제 KBO 경기 결과로',
      '내 동물 캐릭터가 성장하는',
      '육성형 웹앱입니다.',
      '',
      '매일 배치하고, XP를 모아',
      '캐릭터를 키워보세요!',
    ],
  },
  {
    icon: '⚾',
    title: '배치하기',
    lines: [
      '① 오늘의 경기 중 하나를 선택',
      '② 응원할 팀을 고르세요',
      '③ 1~9번 중 타순을 선택',
      '',
      '경기 시작 전까지만 배치 가능!',
      '하루 1경기만 배치할 수 있어요.',
    ],
  },
  {
    icon: '✨',
    title: 'XP 규칙',
    lines: [
      `안타 +${BATTER_XP.HIT} · 2루타 +${BATTER_XP.DOUBLE} · 3루타 +${BATTER_XP.TRIPLE}`,
      `홈런 +${BATTER_XP.HR} · 타점 +${BATTER_XP.RBI} · 득점 +${BATTER_XP.RUN}`,
      `도루 +${BATTER_XP.SB} · 도루실패 ${BATTER_XP.SB_FAIL}`,
      `끝내기 안타 +${BATTER_XP.WALK_OFF}`,
      '',
      `무안타(3타석↑) ${BATTER_XP.NO_HIT_PENALTY}`,
      `팀 승리 +${TEAM_WIN_XP} · 승리예측 적중 +${WIN_PREDICT_XP}`,
    ],
  },
  {
    icon: '📈',
    title: '캐릭터 성장',
    lines: [
      'XP가 쌓이면 캐릭터가',
      '점점 커집니다!',
      '',
      '두 손가락으로 줌 아웃하면',
      '전체 크기를 볼 수 있어요.',
      '',
      '내 배치 탭에서 경기별 기록과',
      'XP 내역을 확인할 수 있어요.',
    ],
  },
];

interface HelpCardsProps {
  onClose: () => void;
}

export default function HelpCards({ onClose }: HelpCardsProps) {
  const [page, setPage] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const card = HELP_CARDS[page];

  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 50 && page > 0) setPage(page - 1);
    if (diff < -50 && page < HELP_CARDS.length - 1) setPage(page + 1);
    setTouchStartX(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="text-center mb-4">
          <span className="text-4xl">{card.icon}</span>
          <h2 className="text-lg font-bold text-gray-800 mt-2">
            {card.title}
          </h2>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[140px]">
          {card.lines.map((line, i) => (
            <p
              key={i}
              className={`text-sm ${line === '' ? 'h-2' : 'text-gray-600'}`}
            >
              {line}
            </p>
          ))}
        </div>

        <div className="flex justify-center gap-1.5 mb-4">
          {HELP_CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === page ? 'bg-orange-400 w-4' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {page > 0 && (
            <button
              onClick={() => setPage(page - 1)}
              className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium"
            >
              이전
            </button>
          )}
          {page < HELP_CARDS.length - 1 ? (
            <button
              onClick={() => setPage(page + 1)}
              className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold"
            >
              다음
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
