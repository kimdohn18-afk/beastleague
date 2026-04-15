import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

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
  // 공유 타입: 'main' | 'placement' | 'result'
  const type = searchParams.get('type') || 'main';
  const team = searchParams.get('team') || '';
  const order = searchParams.get('order') || '';
  const result = searchParams.get('result') || '';

  const animalName = ANIMAL_NAMES[animal] || animal;
  const baseUrl = 'https://beastleague-client.vercel.app';
  const charImgUrl = `${baseUrl}/characters/${animal}1.png`;

  // 서브텍스트 결정
  let subText = `KBO 경기로 키우는 나만의 ${animalName}`;
  if (type === 'placement' && team && order) {
    subText = `${team} ${order}번 타자에 배치 완료!`;
  } else if (type === 'result' && result) {
    subText = result;
  }

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
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '200px', height: '200px', borderRadius: '100px',
          background: 'rgba(251, 146, 60, 0.1)', display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '250px', height: '250px', borderRadius: '125px',
          background: 'rgba(251, 146, 60, 0.08)', display: 'flex',
        }} />

        {/* 로고 */}
        <div style={{
          position: 'absolute', top: '20px', left: '24px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '16px' }}>🐾</span>
          <span style={{ fontSize: '14px', color: '#FB923C', fontWeight: 700 }}>비스트리그</span>
        </div>

        {/* 픽셀아트 캐릭터 */}
        <img
          src={charImgUrl}
          width="160"
          height="160"
          style={{
            imageRendering: 'pixelated',
            objectFit: 'contain',
          }}
        />

        {/* 이름 */}
        <div style={{
          marginTop: '12px', fontSize: '32px', fontWeight: 800,
          color: '#1F2937', display: 'flex',
        }}>
          {name}
        </div>

        {/* 동물 · XP */}
        <div style={{
          marginTop: '6px', fontSize: '18px', color: '#6B7280',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>{animalName}</span>
          <span>·</span>
          <span style={{ color: '#F97316', fontWeight: 700 }}>
            {Number(xp).toLocaleString()} XP
          </span>
        </div>

        {/* 칭호 */}
        {trait && (
          <div style={{
            marginTop: '8px', fontSize: '14px', color: '#FB923C',
            background: 'rgba(251, 146, 60, 0.1)', padding: '4px 14px',
            borderRadius: '20px', display: 'flex',
          }}>
            {trait}
          </div>
        )}

        {/* 하단 서브텍스트 */}
        <div style={{
          position: 'absolute', bottom: '20px',
          fontSize: '13px', color: '#D1D5DB', display: 'flex',
        }}>
          {subText}
        </div>
      </div>
    ),
    { width: 600, height: 400 }
  );
}
