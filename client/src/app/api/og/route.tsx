import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const ANIMAL_EMOJI: Record<string, string> = {
  turtle: '🐢', eagle: '🦅', lion: '🦁', dinosaur: '🦖', dog: '🐶',
  fox: '🦊', penguin: '🐧', shark: '🦈', bear: '🐻', tiger: '🐯',
  seagull: '🕊️', dragon: '🐉', cat: '🐱', rabbit: '🐰',
  gorilla: '🦍', elephant: '🐘',
};

const ANIMAL_NAMES: Record<string, string> = {
  turtle: '거북이', eagle: '독수리', lion: '사자', dinosaur: '공룡', dog: '강아지',
  fox: '여우', penguin: '펭귄', shark: '상어', bear: '곰', tiger: '호랑이',
  seagull: '갈매기', dragon: '드래곤', cat: '고양이', rabbit: '토끼',
  gorilla: '고릴라', elephant: '코끼리',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '???';
  const animal = searchParams.get('animal') || 'turtle';
  const xp = searchParams.get('xp') || '0';
  const trait = searchParams.get('trait') || '';

  const emoji = ANIMAL_EMOJI[animal] || '🐾';
  const animalName = ANIMAL_NAMES[animal] || animal;

  return new ImageResponse(
    (
      <div
        style={{
          width: '600px',
          height: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 배경 장식 원 */}
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '200px',
            height: '200px',
            borderRadius: '100px',
            background: 'rgba(251, 146, 60, 0.1)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '-60px',
            width: '250px',
            height: '250px',
            borderRadius: '125px',
            background: 'rgba(251, 146, 60, 0.08)',
            display: 'flex',
          }}
        />

        {/* 로고 */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚾</span>
          <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 600 }}>비스트리그</span>
        </div>

        {/* 캐릭터 이모지 */}
        <div style={{ fontSize: '120px', lineHeight: 1, display: 'flex' }}>
          {emoji}
        </div>

        {/* 이름 */}
        <div
          style={{
            marginTop: '16px',
            fontSize: '32px',
            fontWeight: 800,
            color: '#1F2937',
            display: 'flex',
          }}
        >
          {name}
        </div>

        {/* 동물 · XP */}
        <div
          style={{
            marginTop: '8px',
            fontSize: '18px',
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{animalName}</span>
          <span>·</span>
          <span style={{ color: '#F97316', fontWeight: 700 }}>
            {Number(xp).toLocaleString()} XP
          </span>
        </div>

        {/* 칭호 */}
        {trait && (
          <div
            style={{
              marginTop: '12px',
              fontSize: '16px',
              color: '#9CA3AF',
              background: 'rgba(255,255,255,0.7)',
              padding: '6px 16px',
              borderRadius: '20px',
              display: 'flex',
            }}
          >
            {trait}
          </div>
        )}

        {/* 하단 CTA */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#D1D5DB' }}>
            KBO 경기로 키우는 나만의 캐릭터
          </span>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 400,
    }
  );
}
