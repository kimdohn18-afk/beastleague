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
  const displaySizeRef = useRef(60);

  // ──────────── 크기 기반 속도 비율 ────────────
  // displaySize 120px → sizeRatio 1.0 (기준), 300px → 0.5배 속도, 60px → 1.2배 속도
  const getSizeRatio = useCallback(() => {
    const base = 120;
    return Math.max(0.3, Math.min(1.3, base / displaySizeRef.current));
  }, []);

  useEffect(() => {
    setMounted(true);
    const size = Math.max(40, Math.min(characterSize, window.innerWidth * 0.6));
    setDisplaySize(size);
    displaySizeRef.current = size;
  }, [characterSize]);

  const getBounds = useCallback(() => {
    if (typeof window === 'undefined') return { minX: 10, maxX: 300, minY: 80, maxY: 500 };
    return {
      minX: 10,
      maxX: window.innerWidth - displaySizeRef.current - 10,
      minY: 80,
      maxY: window.innerHeight - displaySizeRef.current - 120,
    };
  }, []);

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
    const ratio = getSizeRatio(); // 큰 캐릭터일수록 작은 값

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
      // 큰 캐릭터는 더 느리게 이동하므로 타임아웃도 길어짐
      const speed = (0.8 + Math.random() * 0.5) * ratio;
      const ms = Math.max(2000, (dist / Math.max(speed, 0.3) / 60) * 1000 + 500);
      timerRef.current = setTimeout(decideNextAction, ms);
    } else if (rand < 0.65) {
      // 대기 (숨쉬기)
      stateRef.current = 'idle';
      setState('idle');
      // 큰 캐릭터는 좀 더 오래 쉼
      timerRef.current = setTimeout(decideNextAction, (2000 + Math.random() * 3000) / ratio);
    } else if (rand < 0.80) {
      // 두리번 — 느리게, 2~3회만
      stateRef.current = 'looking';
      setState('looking');
      let lookCount = 0;
      const maxLooks = 2 + Math.floor(Math.random() * 2); // 2~3회
      const lookInterval = setInterval(() => {
        if (!mountedRef.current) { clearInterval(lookInterval); return; }
        lookCount++;
        dirRef.current = dirRef.current === 'left' ? 'right' : 'left';
        setDirection(dirRef.current);
        if (lookCount >= maxLooks) clearInterval(lookInterval);
      }, 700 / ratio); // 큰 캐릭터일수록 더 느림 (기본 700ms, 큰 캐릭터는 ~1400ms)
      timerRef.current = setTimeout(() => {
        clearInterval(lookInterval);
        decideNextAction();
      }, (2500 + Math.random() * 1500) / ratio);
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
  }, [pickNewTarget, getBounds, getSizeRatio]);

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
      const ratio = getSizeRatio();

      // ── 이동 (속도에 sizeRatio 반영) ──
      if (currentState === 'walking') {
        const dx = targetRef.current.x - posRef.current.x;
        const dy = targetRef.current.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          const speed = (0.8 + Math.random() * 0.15) * ratio;
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

      // ── 변형 계산 (애니메이션 주파수도 ratio 반영) ──
      let tx = '';
      const scaleX = dirRef.current === 'left' ? -1 : 1;
      // freq: 큰 캐릭터 → 느린 주파수
      const freq = ratio;

      if (currentState === 'walking') {
        const tilt = Math.sin(f * 0.18 * freq) * 3;
        const bounceY = Math.abs(Math.sin(f * 0.15 * freq)) * -6;
        const cycle = Math.sin(f * 0.15 * freq);
        const squashX = 1 + cycle * 0.04;
        const squashY = 1 - cycle * 0.04;
        tx = `scaleX(${scaleX}) rotate(${tilt}deg) translateY(${bounceY}px) scale(${squashX}, ${squashY})`;
      } else if (currentState === 'idle') {
        const breathe = Math.sin(f * 0.04 * freq) * 0.02;
        const nodChance = Math.sin(f * 0.01 * freq);
        const nod = nodChance > 0.97 ? Math.sin(f * 0.3 * freq) * 2 : 0;
        tx = `scaleX(${scaleX}) scale(${1 + breathe}, ${1 - breathe}) translateY(${nod}px)`;
      } else if (currentState === 'looking') {
        const squish = Math.sin(f * 0.15 * freq) * 0.05;
        tx = `scaleX(${scaleX}) scale(${1 + squish}, ${1 - squish * 0.5})`;
      } else if (currentState === 'sleepy') {
        const sleepTilt = Math.sin(f * 0.02 * freq) * 8;
        const droop = Math.sin(f * 0.015 * freq) * 3;
        tx = `scaleX(${scaleX}) rotate(${sleepTilt}deg) translateY(${droop}px)`;
      } else if (currentState === 'stretch') {
        const period = Math.round(90 / ratio);
        const progress = (f % period) / period;
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
        const jumpPeriod = Math.round(30 / ratio);
        const jumpProgress = (f % jumpPeriod) / jumpPeriod;
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
  }, [mounted, decideNextAction, getBounds, getSizeRatio]);

  // ──────────── 탭 → 클릭 위치로 이동 ────────────
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const clickX = e.clientX;
    const clickY = e.clientY;

    // 점프
    stateRef.current = 'jump';
    setState('jump');
    frameCountRef.current = 0;

    setTimeout(() => {
      if (!mountedRef.current) return;
      const bounds = getBounds();
      const half = displaySizeRef.current / 2;

      // 클릭한 좌표를 타겟으로 (캐릭터 중심이 오도록 보정)
      targetRef.current = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, clickX - half)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, clickY - half)),
      };

      // 방향 결정
      dirRef.current = targetRef.current.x >= posRef.current.x ? 'right' : 'left';
      setDirection(dirRef.current);

      stateRef.current = 'walking';
      setState('walking');
      timerRef.current = setTimeout(decideNextAction, 2000);
    }, 400);
  };

  // ──────────── 화면 아무 데나 클릭하면 그쪽으로 이동 ────────────
  useEffect(() => {
    if (!mounted) return;
    const onBodyClick = (e: MouseEvent) => {
      // 캐릭터 자체를 클릭한 경우는 handleTap이 처리하므로 무시
      const target = e.target as HTMLElement;
      if (target.closest('[data-walking-char]')) return;
      // 버튼, 모달 등 UI 요소 클릭은 무시
      if (target.closest('button, a, [role="dialog"], [data-modal]')) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      const bounds = getBounds();
      const half = displaySizeRef.current / 2;
      targetRef.current = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, e.clientX - half)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, e.clientY - half)),
      };
      dirRef.current = targetRef.current.x >= posRef.current.x ? 'right' : 'left';
      setDirection(dirRef.current);
      stateRef.current = 'walking';
      setState('walking');
      timerRef.current = setTimeout(decideNextAction, 2500);
    };

    document.addEventListener('click', onBodyClick);
    return () => document.removeEventListener('click', onBodyClick);
  }, [mounted, getBounds, decideNextAction]);

  if (!mounted) return null;

  const shadowWidth = displaySize * 0.6;

  return (
    <div
      data-walking-char
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
  );
}
