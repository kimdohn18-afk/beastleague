'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WalkingCharacterProps {
  animalType: string;
  characterSize: number;
  isPixelArt: boolean;
  emoji: string;
}

type Direction = 'left' | 'right';
type State = 'walking' | 'idle' | 'looking' | 'sleepy' | 'stretch' | 'jump';

export default function WalkingCharacter({
  animalType,
  characterSize,
  isPixelArt,
  emoji,
}: WalkingCharacterProps) {
  const [displaySize, setDisplaySize] = useState(60);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>('right');
  const [state, setState] = useState<State>('idle');
  const [transform, setTransform] = useState('');
  const [mounted, setMounted] = useState(false);

  const stateRef = useRef<State>('idle');
  const dirRef = useRef<Direction>('right');
  const posRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const frameCountRef = useRef(0);

  // 클라이언트 마운트 후 초기화
  useEffect(() => {
    setMounted(true);
    const size = Math.max(40, Math.min(characterSize, window.innerWidth * 0.6));
    setDisplaySize(size);
  }, [characterSize]);

  const getBounds = useCallback(() => {
    if (typeof window === 'undefined') return { minX: 10, maxX: 300, minY: 80, maxY: 500 };
    return {
      minX: 10,
      maxX: window.innerWidth - displaySize - 10,
      minY: 80,
      maxY: window.innerHeight - displaySize - 120,
    };
  }, [displaySize]);

  // 초기 위치
  useEffect(() => {
    if (!mounted) return;
    const bounds = getBounds();
    const startX = bounds.minX + Math.random() * Math.max(0, bounds.maxX - bounds.minX);
    const startY = bounds.minY + Math.random() * Math.max(0, bounds.maxY - bounds.minY);
    posRef.current = { x: startX, y: startY };
    setPos({ x: startX, y: startY });
  }, [mounted, getBounds]);

  const pickNewTarget = useCallback(() => {
    const bounds = getBounds();
    targetRef.current = {
      x: bounds.minX + Math.random() * Math.max(0, bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * Math.max(0, bounds.maxY - bounds.minY),
    };
  }, [getBounds]);

  // ──────────── 행동 결정 ────────────
  const decideNextAction = useCallback(() => {
    if (!mountedRef.current) return;
    const rand = Math.random();

    if (rand < 0.45) {
      // 걷기
      stateRef.current = 'walking';
      setState('walking');
      pickNewTarget();
      const dx = targetRef.current.x - posRef.current.x;
      dirRef.current = dx >= 0 ? 'right' : 'left';
      setDirection(dirRef.current);

      const dist = Math.sqrt(
        Math.pow(targetRef.current.x - posRef.current.x, 2) +
        Math.pow(targetRef.current.y - posRef.current.y, 2)
      );
      const speed = 1.0 + Math.random() * 0.6;
      const ms = Math.max(2000, (dist / speed / 60) * 1000 + 500);
      timerRef.current = setTimeout(decideNextAction, ms);
    } else if (rand < 0.65) {
      // 대기 (숨쉬기)
      stateRef.current = 'idle';
      setState('idle');
      timerRef.current = setTimeout(decideNextAction, 2000 + Math.random() * 3000);
    } else if (rand < 0.80) {
      // 두리번
      stateRef.current = 'looking';
      setState('looking');
      let lookCount = 0;
      const lookInterval = setInterval(() => {
        if (!mountedRef.current) { clearInterval(lookInterval); return; }
        lookCount++;
        dirRef.current = dirRef.current === 'left' ? 'right' : 'left';
        setDirection(dirRef.current);
        if (lookCount >= 3 + Math.floor(Math.random() * 3)) clearInterval(lookInterval);
      }, 350);
      timerRef.current = setTimeout(() => {
        clearInterval(lookInterval);
        decideNextAction();
      }, 2000 + Math.random() * 1000);
    } else if (rand < 0.92) {
      // 졸기
      stateRef.current = 'sleepy';
      setState('sleepy');
      timerRef.current = setTimeout(decideNextAction, 3000 + Math.random() * 2000);
    } else {
      // 기지개
      stateRef.current = 'stretch';
      setState('stretch');
      timerRef.current = setTimeout(decideNextAction, 1500 + Math.random() * 1000);
    }
  }, [pickNewTarget, getBounds]);

  // ──────────── 애니메이션 루프 ────────────
  useEffect(() => {
    if (!mounted) return;
    mountedRef.current = true;
    timerRef.current = setTimeout(decideNextAction, 500 + Math.random() * 800);

    const animate = () => {
      if (!mountedRef.current) return;
      frameCountRef.current++;
      const f = frameCountRef.current;
      const currentState = stateRef.current;

      // ── 이동 ──
      if (currentState === 'walking') {
        const dx = targetRef.current.x - posRef.current.x;
        const dy = targetRef.current.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          const speed = 1.0 + Math.random() * 0.2;
          posRef.current = {
            x: posRef.current.x + (dx / dist) * speed,
            y: posRef.current.y + (dy / dist) * speed,
          };
          const bounds = getBounds();
          posRef.current.x = Math.max(bounds.minX, Math.min(bounds.maxX, posRef.current.x));
          posRef.current.y = Math.max(bounds.minY, Math.min(bounds.maxY, posRef.current.y));
          setPos({ ...posRef.current });
        } else {
          stateRef.current = 'idle';
          setState('idle');
        }
      }

      // ── 변형 계산 ──
      let tx = '';
      const scaleX = dirRef.current === 'left' ? -1 : 1;

      if (currentState === 'walking') {
        // 걷기: 기울기 + 바운스 + 스쿼시 사이클
        const tilt = Math.sin(f * 0.18) * 3;
        const bounceY = Math.abs(Math.sin(f * 0.15)) * -6;
        const cycle = Math.sin(f * 0.15);
        const squashX = 1 + cycle * 0.04;
        const squashY = 1 - cycle * 0.04;
        tx = `scaleX(${scaleX}) rotate(${tilt}deg) translateY(${bounceY}px) scale(${squashX}, ${squashY})`;
      } else if (currentState === 'idle') {
        // 숨쉬기: 미세한 스케일 + 가끔 끄덕
        const breathe = Math.sin(f * 0.04) * 0.02;
        const nodChance = Math.sin(f * 0.01);
        const nod = nodChance > 0.97 ? Math.sin(f * 0.3) * 2 : 0;
        tx = `scaleX(${scaleX}) scale(${1 + breathe}, ${1 - breathe}) translateY(${nod}px)`;
      } else if (currentState === 'looking') {
        // 두리번: 방향 전환 시 찌그러짐
        const squish = Math.sin(f * 0.25) * 0.06;
        tx = `scaleX(${scaleX}) scale(${1 + squish}, ${1 - squish * 0.5})`;
      } else if (currentState === 'sleepy') {
        // 졸기: 앞으로 천천히 기울어짐 + zzZ
        const sleepTilt = Math.sin(f * 0.02) * 8;
        const droop = Math.sin(f * 0.015) * 3;
        tx = `scaleX(${scaleX}) rotate(${sleepTilt}deg) translateY(${droop}px)`;
      } else if (currentState === 'stretch') {
        // 기지개: 세로로 늘어남 → 원래대로
        const progress = (f % 90) / 90;
        const stretchY = progress < 0.4
          ? 1 + progress * 0.3
          : progress < 0.7
            ? 1.12 - (progress - 0.4) * 0.4
            : 1;
        const stretchX = progress < 0.4
          ? 1 - progress * 0.1
          : progress < 0.7
            ? 0.96 + (progress - 0.4) * 0.13
            : 1;
        tx = `scaleX(${scaleX}) scale(${stretchX}, ${stretchY})`;
      } else if (currentState === 'jump') {
        // 점프 (탭 반응)
        const jumpProgress = (f % 30) / 30;
        const jumpY = jumpProgress < 0.4
          ? -jumpProgress * 40
          : jumpProgress < 0.7
            ? -16 + (jumpProgress - 0.4) * 53
            : 0;
        const landSquash = jumpProgress > 0.65 && jumpProgress < 0.85
          ? 1 + (jumpProgress - 0.65) * 1.5
          : jumpProgress >= 0.85
            ? 1.3 - (jumpProgress - 0.85) * 2
            : 1;
        const landStretch = jumpProgress > 0.65 && jumpProgress < 0.85
          ? 1 - (jumpProgress - 0.65) * 0.8
          : jumpProgress >= 0.85
            ? 0.84 + (jumpProgress - 0.85) * 1.1
            : 1;
        tx = `scaleX(${scaleX}) translateY(${jumpY}px) scale(${landSquash}, ${landStretch})`;
      }

      setTransform(tx);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(frameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mounted, decideNextAction, getBounds]);

  // ──────────── 탭 반응 ────────────
  const handleTap = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // 점프 + 반대로 도망
    stateRef.current = 'jump';
    setState('jump');
    frameCountRef.current = 0;

    setTimeout(() => {
      if (!mountedRef.current) return;
      const bounds = getBounds();
      const jumpDir = dirRef.current === 'left' ? 1 : -1;
      targetRef.current = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, posRef.current.x + jumpDir * (60 + Math.random() * 80))),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, posRef.current.y - 10 + Math.random() * 20)),
      };
      dirRef.current = jumpDir > 0 ? 'right' : 'left';
      setDirection(dirRef.current);
      stateRef.current = 'walking';
      setState('walking');
      timerRef.current = setTimeout(decideNextAction, 1500);
    }, 500);
  };

  // SSR 방지
  if (!mounted) return null;

  const shadowWidth = displaySize * 0.6;

  return (
    <>
      {/* 캐릭터 */}
      <div
        onClick={handleTap}
        className="fixed z-20 cursor-pointer select-none"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${displaySize}px`,
          height: `${displaySize}px`,
        }}
      >
        {/* 그림자 */}
        <div
          className="absolute"
          style={{
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${shadowWidth}px`,
            height: `${shadowWidth * 0.25}px`,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* 캐릭터 이미지 */}
        <div
          style={{
            width: '100%',
            height: '100%',
            transform,
            transformOrigin: 'center bottom',
            transition: 'transform 0.08s linear',
          }}
        >
          {isPixelArt ? (
            <img
              src={`/characters/${animalType}1.png`}
              alt="character"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                imageRendering: 'pixelated',
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
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
              }}
            >
              {emoji}
            </div>
          )}
        </div>

        {/* 상태 이펙트 */}
        {state === 'walking' && (
          <div
            className="absolute opacity-40 transition-opacity"
            style={{
              bottom: '0px',
              left: direction === 'right' ? '10%' : '65%',
              fontSize: `${Math.max(10, displaySize * 0.12)}px`,
            }}
          >
            💨
          </div>
        )}
        {state === 'sleepy' && (
          <div
            className="absolute animate-bounce"
            style={{
              top: '-8px',
              right: '0px',
              fontSize: `${Math.max(12, displaySize * 0.15)}px`,
            }}
          >
            💤
          </div>
        )}
        {state === 'stretch' && (
          <div
            className="absolute animate-ping"
            style={{
              top: '-5px',
              right: '5px',
              fontSize: `${Math.max(10, displaySize * 0.12)}px`,
              animationDuration: '0.8s',
            }}
          >
            ✨
          </div>
        )}
        {state === 'looking' && (
          <div
            className="absolute"
            style={{
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: `${Math.max(10, displaySize * 0.12)}px`,
            }}
          >
            ❓
          </div>
        )}
      </div>
    </>
  );
}
