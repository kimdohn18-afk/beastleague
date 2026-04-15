'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WalkingCharacterProps {
  animalType: string;
  characterSize: number;
  isPixelArt: boolean;
  emoji: string;
}

type Direction = 'left' | 'right';
type State = 'walking' | 'idle' | 'looking';

export default function WalkingCharacter({
  animalType,
  characterSize,
  isPixelArt,
  emoji,
}: WalkingCharacterProps) {
  // 화면 안에서의 크기: 최소 40px, 최대 화면 너비의 60%
  const displaySize = Math.max(40, Math.min(characterSize, window.innerWidth * 0.6));

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>('right');
  const [state, setState] = useState<State>('idle');
  const [bobOffset, setBobOffset] = useState(0);

  const stateRef = useRef<State>('idle');
  const dirRef = useRef<Direction>('right');
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 화면 경계 계산
  const getBounds = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      minX: 10,
      maxX: w - displaySize - 10,
      minY: 80, // 로그아웃 버튼 아래
      maxY: h - displaySize - 120, // 하단 네비 위
    };
  }, [displaySize]);

  // 초기 위치 설정
  useEffect(() => {
    const bounds = getBounds();
    const startX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const startY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    posRef.current = { x: startX, y: startY };
    setPos({ x: startX, y: startY });
  }, [getBounds]);

  // 랜덤 타겟 생성
  const pickNewTarget = useCallback(() => {
    const bounds = getBounds();
    targetRef.current = {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
    };
  }, [getBounds]);

  // 행동 결정
  const decideNextAction = useCallback(() => {
    if (!mountedRef.current) return;

    const rand = Math.random();

    if (rand < 0.55) {
      // 걷기
      stateRef.current = 'walking';
      setState('walking');
      pickNewTarget();
      const dx = targetRef.current.x - posRef.current.x;
      dirRef.current = dx >= 0 ? 'right' : 'left';
      setDirection(dirRef.current);

      // 도착 예상 시간 후 다음 행동
      const dist = Math.sqrt(
        Math.pow(targetRef.current.x - posRef.current.x, 2) +
        Math.pow(targetRef.current.y - posRef.current.y, 2)
      );
      const speed = 1.2 + Math.random() * 0.8; // px per frame
      const frames = dist / speed;
      const ms = Math.max(2000, (frames / 60) * 1000 + 500);
      timerRef.current = setTimeout(decideNextAction, ms);
    } else if (rand < 0.8) {
      // 멈춰서 대기
      stateRef.current = 'idle';
      setState('idle');
      timerRef.current = setTimeout(decideNextAction, 1500 + Math.random() * 2500);
    } else {
      // 두리번거림 (좌우 반복)
      stateRef.current = 'looking';
      setState('looking');
      const lookDuration = 800 + Math.random() * 1200;

      // 좌우로 번갈아 바라보기
      let lookCount = 0;
      const lookInterval = setInterval(() => {
        if (!mountedRef.current) { clearInterval(lookInterval); return; }
        lookCount++;
        dirRef.current = dirRef.current === 'left' ? 'right' : 'left';
        setDirection(dirRef.current);
        if (lookCount >= 3 + Math.floor(Math.random() * 3)) {
          clearInterval(lookInterval);
        }
      }, 300);

      timerRef.current = setTimeout(() => {
        clearInterval(lookInterval);
        decideNextAction();
      }, lookDuration + 1000);
    }
  }, [pickNewTarget, getBounds]);

  // 애니메이션 루프
  useEffect(() => {
    mountedRef.current = true;

    // 시작 후 잠시 대기 → 행동 시작
    timerRef.current = setTimeout(decideNextAction, 500 + Math.random() * 1000);

    let bobFrame = 0;

    const animate = () => {
      if (!mountedRef.current) return;

      // 걷기 상태일 때 타겟을 향해 이동
      if (stateRef.current === 'walking') {
        const dx = targetRef.current.x - posRef.current.x;
        const dy = targetRef.current.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          const speed = 1.2 + Math.random() * 0.3;
          const nx = dx / dist;
          const ny = dy / dist;

          posRef.current = {
            x: posRef.current.x + nx * speed,
            y: posRef.current.y + ny * speed,
          };

          // 경계 체크
          const bounds = getBounds();
          posRef.current.x = Math.max(bounds.minX, Math.min(bounds.maxX, posRef.current.x));
          posRef.current.y = Math.max(bounds.minY, Math.min(bounds.maxY, posRef.current.y));

          setPos({ ...posRef.current });
        } else {
          // 도착
          stateRef.current = 'idle';
          setState('idle');
        }
      }

      // 통통 바운스 (걷기 중에만)
      bobFrame++;
      if (stateRef.current === 'walking') {
        setBobOffset(Math.sin(bobFrame * 0.15) * 4);
      } else {
        // 대기 시 부드럽게 숨쉬기
        setBobOffset(Math.sin(bobFrame * 0.03) * 1.5);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(frameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [decideNextAction, getBounds]);

  // 탭하면 반대 방향으로 뛰어가기
  const handleTap = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // 반대 방향으로 점프
    const bounds = getBounds();
    const jumpDist = 80 + Math.random() * 60;
    const jumpDir = dirRef.current === 'left' ? 1 : -1;
    targetRef.current = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, posRef.current.x + jumpDir * jumpDist)),
      y: posRef.current.y - 20 + Math.random() * 40,
    };
    targetRef.current.y = Math.max(bounds.minY, Math.min(bounds.maxY, targetRef.current.y));

    dirRef.current = jumpDir > 0 ? 'right' : 'left';
    setDirection(dirRef.current);
    stateRef.current = 'walking';
    setState('walking');

    timerRef.current = setTimeout(decideNextAction, 1500);
  };

  // 그림자 크기
  const shadowWidth = displaySize * 0.6;

  return (
    <div
      onClick={handleTap}
      className="fixed z-20 cursor-pointer select-none"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y + bobOffset}px`,
        width: `${displaySize}px`,
        height: `${displaySize}px`,
        transition: 'left 0.05s linear, top 0.05s linear',
        pointerEvents: 'auto',
      }}
    >
      {/* 그림자 */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${shadowWidth}px`,
          height: `${shadowWidth * 0.25}px`,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%)',
        }}
      />

      {/* 캐릭터 */}
      {isPixelArt ? (
        <img
          src={`/characters/${animalType}1.png`}
          alt="character"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            transform: `scaleX(${direction === 'left' ? -1 : 1})`,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${displaySize * 0.8}px`,
            lineHeight: 1,
            transform: `scaleX(${direction === 'left' ? -1 : 1})`,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
          }}
        >
          {emoji}
        </div>
      )}

      {/* 걷기 중 발자국 이펙트 */}
      {state === 'walking' && (
        <div
          className="absolute opacity-30"
          style={{
            bottom: '-2px',
            left: direction === 'right' ? '20%' : '60%',
            fontSize: `${Math.max(10, displaySize * 0.12)}px`,
          }}
        >
          💨
        </div>
      )}
    </div>
  );
}
