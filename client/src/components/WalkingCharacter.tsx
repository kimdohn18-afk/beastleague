'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface WalkingCharacterHandle {
  walkTo: (x: number, y: number) => Promise<void>;
  getPosition: () => { x: number; y: number };
}
interface WalkingCharacterProps {
  animalType: string;
  characterSize: number;
  isPixelArt: boolean;
  emoji: string;
}

type Direction = 'left' | 'right';
type State = 'walking' | 'idle' | 'looking' | 'sleepy' | 'stretch' | 'jump';

const WalkingCharacter = forwardRef<WalkingCharacterHandle, WalkingCharacterProps>(function WalkingCharacter({
  animalType,
  characterSize,
  isPixelArt,
  emoji,
}, ref) {
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
  // sleepy 진입 시점 프레임을 기록해서 눕기/일어나기 진행도 계산
  const sleepStartFrameRef = useRef(0);
  const sleepDurationRef = useRef(0);

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

  // ★ 외부에서 명령을 내릴 수 있는 핸들
  const walkResolveRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    getPosition: () => ({ ...posRef.current }),
    walkTo: (x: number, y: number) => {
      return new Promise<void>((resolve) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const bounds = getBounds();
        const half = displaySizeRef.current / 2;
        targetRef.current = {
          x: Math.max(bounds.minX, Math.min(bounds.maxX, x - half)),
          y: Math.max(bounds.minY, Math.min(bounds.maxY, y - half)),
        };
        dirRef.current = targetRef.current.x >= posRef.current.x ? 'right' : 'left';
        setDirection(dirRef.current);
        stateRef.current = 'walking';
        setState('walking');
        walkResolveRef.current = resolve;
      });
    },
  }), [getBounds]);

  

  useEffect(() => {
    if (!mounted) return;
    const bounds = getBounds();
    const startX = bounds.minX + Math.random() * Math.max(0, bounds.maxX - bounds.minX);
    const startY = bounds.minY + Math.random() * Math.max(0, bounds.maxY - bounds.minY);
    posRef.current = { x: startX, y: startY };
    setPos({ x: startX, y: startY });
  }, [mounted, getBounds]);

  // ──────────── 같은 방향 선호 타겟 선택 ────────────
  const pickNewTarget = useCallback(() => {
    const bounds = getBounds();
    const cx = posRef.current.x;
    const currentDir = dirRef.current;

    // 70% 확률로 현재 방향 유지, 30%만 반대쪽
    const keepDir = Math.random() < 0.7;
    let targetX: number;

    if (keepDir) {
      if (currentDir === 'right') {
        // 현재 위치보다 오른쪽
        const rightSpace = bounds.maxX - cx;
        targetX = rightSpace > 30
          ? cx + 30 + Math.random() * (rightSpace - 30)
          : bounds.minX + Math.random() * (bounds.maxX - bounds.minX); // 공간 부족하면 자유
      } else {
        const leftSpace = cx - bounds.minX;
        targetX = leftSpace > 30
          ? bounds.minX + Math.random() * (leftSpace - 30)
          : bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      }
    } else {
      targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    }

    targetRef.current = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, targetX)),
      y: bounds.minY + Math.random() * Math.max(0, bounds.maxY - bounds.minY),
    };
  }, [getBounds]);

  // ──────────── 행동 결정 ────────────
  const decideNextAction = useCallback(() => {
    if (!mountedRef.current) return;
    const rand = Math.random();
    const ratio = getSizeRatio();

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
      const speed = (0.8 + Math.random() * 0.5) * ratio;
      const ms = Math.max(2000, (dist / Math.max(speed, 0.3) / 60) * 1000 + 500);
      timerRef.current = setTimeout(decideNextAction, ms);

    } else if (rand < 0.65) {
      // 대기
      stateRef.current = 'idle';
      setState('idle');
      timerRef.current = setTimeout(decideNextAction, (2000 + Math.random() * 3000) / ratio);

    } else if (rand < 0.80) {
      // 두리번 — 방향 반전 없이, 갸웃거리기만
      stateRef.current = 'looking';
      setState('looking');
      // 방향은 바꾸지 않음! 갸웃 애니메이션만 재생
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) decideNextAction();
      }, (2500 + Math.random() * 1500) / ratio);

    } else if (rand < 0.92) {
      // 졸기 — 완전히 눕기
      stateRef.current = 'sleepy';
      setState('sleepy');
      sleepStartFrameRef.current = frameCountRef.current;
      const sleepTime = 4000 + Math.random() * 3000; // 4~7초
      sleepDurationRef.current = sleepTime;
      timerRef.current = setTimeout(decideNextAction, sleepTime);

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

      // ── 이동 ──
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
          if (walkResolveRef.current) {
            walkResolveRef.current();
            walkResolveRef.current = null;
          }
        }
      }

      // ── 변형 계산 ──
      let tx = '';
      const scaleX = dirRef.current === 'left' ? -1 : 1;
      const freq = ratio;

      if (currentState === 'walking') {
        const tilt = Math.sin(f * 0.18 * freq) * 3;
        const bounceY = Math.abs(Math.sin(f * 0.15 * freq)) * -6;
        const cycle = Math.sin(f * 0.15 * freq);
        tx = `scaleX(${scaleX}) rotate(${tilt}deg) translateY(${bounceY}px) scale(${1 + cycle * 0.04}, ${1 - cycle * 0.04})`;

      } else if (currentState === 'idle') {
        const breathe = Math.sin(f * 0.04 * freq) * 0.02;
        const nodChance = Math.sin(f * 0.01 * freq);
        const nod = nodChance > 0.97 ? Math.sin(f * 0.3 * freq) * 2 : 0;
        tx = `scaleX(${scaleX}) scale(${1 + breathe}, ${1 - breathe}) translateY(${nod}px)`;

      } else if (currentState === 'looking') {
        // 방향 반전 없이 갸웃만: 좌우로 살짝 기울어짐
        const tiltAngle = Math.sin(f * 0.06 * freq) * 12; // 느리게 좌우 12도
        const squish = Math.sin(f * 0.08 * freq) * 0.03;
        tx = `scaleX(${scaleX}) rotate(${tiltAngle}deg) scale(${1 + squish}, ${1 - squish * 0.5})`;

      } else if (currentState === 'sleepy') {
        // 서서히 눕기 → 드르렁 → 서서히 일어나기
        const elapsed = f - sleepStartFrameRef.current;
        const totalFrames = (sleepDurationRef.current / 1000) * 60; // 대략적 프레임 수
        const progress = Math.min(1, elapsed / totalFrames);

        const layDownPhase = 0.15;   // 처음 15%: 눕는 과정
        const getUpPhase = 0.85;     // 마지막 15%: 일어나는 과정

        let rotateDeg: number;
        let shiftY: number;
        let breathe: number;

        if (progress < layDownPhase) {
          // 서서히 눕기: 0 → 80도
          const p = progress / layDownPhase;
          const eased = p * p; // ease-in
          rotateDeg = eased * 80;
          shiftY = eased * (displaySizeRef.current * 0.3);
          breathe = 0;
        } else if (progress < getUpPhase) {
          // 완전히 누운 상태: 80도 + 미세한 숨쉬기
          rotateDeg = 80;
          shiftY = displaySizeRef.current * 0.3;
          breathe = Math.sin(f * 0.03 * freq) * 0.015;
        } else {
          // 서서히 일어나기: 80 → 0도
          const p = (progress - getUpPhase) / (1 - getUpPhase);
          const eased = 1 - (1 - p) * (1 - p); // ease-out
          rotateDeg = 80 * (1 - eased);
          shiftY = displaySizeRef.current * 0.3 * (1 - eased);
          breathe = 0;
        }

        const dir = scaleX === 1 ? 1 : -1; // 눕는 방향
        tx = `scaleX(${scaleX}) rotate(${rotateDeg * dir}deg) translateY(${shiftY}px) scale(${1 + breathe}, ${1 - breathe})`;

      } else if (currentState === 'stretch') {
        const period = Math.round(90 / ratio);
        const progress = (f % period) / period;
        const stretchY = progress < 0.4 ? 1 + progress * 0.3
          : progress < 0.7 ? 1.12 - (progress - 0.4) * 0.4 : 1;
        const stretchX = progress < 0.4 ? 1 - progress * 0.1
          : progress < 0.7 ? 0.96 + (progress - 0.4) * 0.13 : 1;
        tx = `scaleX(${scaleX}) scale(${stretchX}, ${stretchY})`;

      } else if (currentState === 'jump') {
        const jumpPeriod = Math.round(30 / ratio);
        const jp = (f % jumpPeriod) / jumpPeriod;
        const jumpY = jp < 0.4 ? -jp * 40 : jp < 0.7 ? -16 + (jp - 0.4) * 53 : 0;
        const sq = jp > 0.65 && jp < 0.85 ? 1 + (jp - 0.65) * 1.5
          : jp >= 0.85 ? 1.3 - (jp - 0.85) * 2 : 1;
        const st = jp > 0.65 && jp < 0.85 ? 1 - (jp - 0.65) * 0.8
          : jp >= 0.85 ? 0.84 + (jp - 0.85) * 1.1 : 1;
        tx = `scaleX(${scaleX}) translateY(${jumpY}px) scale(${sq}, ${st})`;
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

  // ──────────── 캐릭터 클릭 → 클릭 위치로 이동 ────────────
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);

    stateRef.current = 'jump';
    setState('jump');
    frameCountRef.current = 0;

    const clickX = e.clientX;
    const clickY = e.clientY;

    setTimeout(() => {
      if (!mountedRef.current) return;
      const bounds = getBounds();
      const half = displaySizeRef.current / 2;
      targetRef.current = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, clickX - half)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, clickY - half)),
      };
      dirRef.current = targetRef.current.x >= posRef.current.x ? 'right' : 'left';
      setDirection(dirRef.current);
      stateRef.current = 'walking';
      setState('walking');
      timerRef.current = setTimeout(decideNextAction, 2000);
    }, 400);
  };

  // ──────────── 빈 공간 클릭 → 그쪽으로 걸어감 ────────────
  useEffect(() => {
    if (!mounted) return;
    const onBodyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-walking-char]')) return;
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
      {/* 그림자 — 눕는 중에는 옆으로 넓어짐 */}
      <div
        className="absolute"
        style={{
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${state === 'sleepy' ? shadowWidth * 1.6 : shadowWidth}px`,
          height: `${shadowWidth * 0.25}px`,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          transition: 'width 0.5s ease',
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
          className="absolute opacity-40"
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
          className="absolute"
          style={{
            top: '-12px',
            right: '-5px',
            fontSize: `${Math.max(14, displaySize * 0.18)}px`,
            animation: 'float-up 2s ease-in-out infinite',
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

      {/* 💤 float-up 애니메이션 */}
      <style jsx>{`
        @keyframes float-up {
          0%, 100% { opacity: 0.4; transform: translateY(0px) scale(0.8); }
          50% { opacity: 1; transform: translateY(-10px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
export default WalkingCharacter;
