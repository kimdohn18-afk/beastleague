'use client';

import { forwardRef } from 'react';

interface ShareCardProps {
  characterName: string;
  animalType: string;
  animalName: string;
  xp: number;
  characterSize: number;
  traitName?: string;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ characterName, animalType, animalName, xp, characterSize, traitName }, ref) => {
    // 카드 내 캐릭터 크기: 최소 80, 최대 280, XP 비례
    const cardCharSize = Math.min(280, Math.max(80, characterSize * 0.7));

    return (
      <div
        ref={ref}
        style={{
          width: '360px',
          height: '480px',
          background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'rgba(251, 146, 60, 0.1)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(251, 146, 60, 0.08)',
        }} />

        {/* 로고 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '24px',
          fontSize: '14px',
          fontWeight: 700,
          color: '#FB923C',
          letterSpacing: '-0.5px',
        }}>
          🐾 비스트리그
        </div>

        {/* 캐릭터 */}
        <img
          src={`/characters/${animalType}1.png`}
          alt={characterName}
          crossOrigin="anonymous"
          style={{
            width: `${cardCharSize}px`,
            height: `${cardCharSize}px`,
            objectFit: 'contain',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))',
            marginBottom: '20px',
          }}
        />

        {/* 이름 */}
        <div style={{
          fontSize: '28px',
          fontWeight: 800,
          color: '#1F2937',
          marginBottom: '6px',
        }}>
          {characterName}
        </div>

        {/* 종류 · XP */}
        <div style={{
          fontSize: '15px',
          color: '#9CA3AF',
          marginBottom: '12px',
        }}>
          {animalName} · {xp.toLocaleString()} XP
        </div>

        {/* 칭호 */}
        {traitName && (
          <div style={{
            fontSize: '13px',
            color: '#FB923C',
            background: 'rgba(251, 146, 60, 0.1)',
            padding: '6px 16px',
            borderRadius: '20px',
            marginBottom: '8px',
          }}>
            {traitName}
          </div>
        )}

        {/* 크기 표시 */}
        <div style={{
          fontSize: '12px',
          color: '#D1D5DB',
          marginTop: '16px',
        }}>
          캐릭터 크기: {characterSize}px
          {characterSize > 390 ? ' 🔥 화면 초과!' : characterSize > 200 ? ' ✨ 많이 성장!' : ''}
        </div>

        {/* 하단 CTA */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          fontSize: '12px',
          color: '#D1D5DB',
        }}>
          beastleague-client.vercel.app
        </div>
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';
export default ShareCard;
