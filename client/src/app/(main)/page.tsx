'use client';

import { requestFcmToken } from '@/lib/firebase';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import ShareCard from '@/components/ShareCard';
import { captureCardAsBlob, shareToInstagramStory } from '@/lib/shareUtils';
import {
  ANIMAL_EMOJI,
  ANIMAL_NAMES,
  PIXEL_ART_ANIMALS,
  TRAIT_DISPLAY,
  getTraitDisplay,
  getEvolutionStage,      
  getNextEvolutionStage,  
  EVOLUTION_STAGES,        
  CHANGE_ANIMAL_COST,      
} from '@/lib/constants';
import WalkingCharacter, { WalkingCharacterHandle } from '@/components/WalkingCharacter';
import HarvestOverlay from '@/components/HarvestOverlay';


interface Character {
  _id: string;
  name: string;
  animalType: string;
  xp: number;
  userId: string;
  activeTrait?: string | null;
  earnedAchievements?: string[];
  teamAchievements?: Array<{ teamId: string; tier: string; count: number }>;
  totalPlacements?: number;
  tutorialCompleted?: boolean;
  totalLikes?: number;
  totalFeeds?: number;
  displayStage?: number | null;
  displaySize?: number | null;
  evolvedStage?: number;
}

interface XpOrb {
  id: number;
  label: string;
  emoji: string;
  xp: number;
  x: number;
  y: number;
  floatOffset: number;
  eaten: boolean;
}

function getCharacterSize(xp: number): number {
  const minPx = 60;
  if (xp <= 0) return minPx;
  const size = minPx + Math.pow(xp, 0.55) * 7.5;
  return Math.max(minPx, Math.round(size));
}

function getEmojiPx(xp: number): number {
  const minPx = 60;
  const maxPx = 220;
  if (xp <= 0) return minPx;
  const progress = Math.log(1 + xp) / Math.log(1 + 10000);
  const clamped = Math.min(progress, 1.3);
  return Math.round(
    minPx +
      (maxPx - minPx) * Math.min(clamped, 1.0) +
      Math.max(0, clamped - 1.0) * 20,
  );
}

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
      '④ 승리팀을 예측하세요',
      '',
      '경기 시작 전까지만 배치 가능!',
      '경기가 시작되면 수정할 수 없어요.',
    ],
  },
  {
    icon: '✨',
    title: 'XP 규칙',
    lines: [
      '안타 +8 · 2루타 +12 · 3루타 +20',
      '홈런 +40 · 타점 +12 · 득점 +8',
      '도루 +15 · 도루실패 -10',
      '끝내기 안타 +25',
      '',
      '무안타(3타석↑) -15',
      '팀 승리 +25 · 승리예측 적중 +25',
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

// ──────────── 핀치 줌 훅 ────────────
function usePinchZoom() {
  const [scale, setScale] = useState(1);
  const startDistRef = useRef(0);
  const startScaleRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        startDistRef.current = getDistance(e.touches[0], e.touches[1]);
        startScaleRef.current = scale;
      }
    },
    [scale],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const ratio = dist / startDistRef.current;
      const newScale = Math.max(
        0.02,
        Math.min(startScaleRef.current * ratio, 3),
      );
      setScale(newScale);
    }
  }, []);

  const onTouchEnd = useCallback(() => {}, []);

  const lastTapRef = useRef(0);
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          setScale(1);
        }
        lastTapRef.current = now;
      }
      if (e.touches.length === 2) {
        onTouchStart(e);
      }
    },
    [onTouchStart],
  );

  return {
    scale,
    setScale,
    containerRef,
    onTouchStart: handleTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPage, setHelpPage] = useState(0);
  const [pushStatus, setPushStatus] = useState<
    'idle' | 'loading' | 'granted' | 'denied'
  >('idle');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBlockedGuide, setShowBlockedGuide] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // ★ 밥주기 state
  const [selfFed, setSelfFed] = useState(false);
  const [feedAnimation, setFeedAnimation] = useState(false);
  const [feedToast, setFeedToast] = useState('');

  // ★ 진화 & 캐릭터 변경 state
  const [showEvolution, setShowEvolution] = useState(false);
  const [showAnimalChange, setShowAnimalChange] = useState(false);
  const [selectedNewAnimal, setSelectedNewAnimal] = useState<string | null>(null);
  const [animalChanging, setAnimalChanging] = useState(false);
  const [evolutionToast, setEvolutionToast] = useState('');
  const [evolving, setEvolving] = useState(false);
  
  // ★ XP 수확 state
  const [xpOrbs, setXpOrbs] = useState<XpOrb[]>([]);
  const [harvestMode, setHarvestMode] = useState(false);
  const [eatingOrbId, setEatingOrbId] = useState<number | null>(null);
  const [charPos, setCharPos] = useState<{ x: number; y: number }>({ x: 50, y: 75 });
  const [harvestToast, setHarvestToast] = useState('');
  const [totalHarvestXp, setTotalHarvestXp] = useState(0);
  const [harvestComplete, setHarvestComplete] = useState(false);
  const orbIdCounter = useRef(0);
  const walkingCharRef = useRef<WalkingCharacterHandle>(null);


  
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token =
    (session as any)?.backendToken || (session as any)?.accessToken;

  const pinch = usePinchZoom();

  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') setPushStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('push-manually-disabled') === 'true') return;
    const checkAndAutoSubscribe = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/push/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.subscribed) {
            setPushStatus('granted');
          } else {
            const fcmToken = await requestFcmToken();
            if (fcmToken) {
              await fetch(`${apiUrl}/api/push/subscribe`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fcmToken }),
              });
              setPushStatus('granted');
            }
          }
        }
      } catch (e) {
        console.error('[Push] Auto subscribe failed:', e);
      }
    };
    checkAndAutoSubscribe();
  }, [token]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated' && token) {
      fetchCharacter();
    }
  }, [status, token]);

  useEffect(() => {
    if (!character || !token) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (/KAKAOTALK/i.test(navigator.userAgent)) return;
    if (character.xp === 0) return;
    const today = new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    if (localStorage.getItem('push-prompt-dismissed') === today) return;
    if (Notification.permission === 'denied') {
      setTimeout(() => setShowPushPrompt(true), 1000);
      return;
    }
    if (Notification.permission === 'default') {
      setTimeout(() => setShowPushPrompt(true), 1000);
      return;
    }
    const checkSub = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/push/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.subscribed)
            setTimeout(() => setShowPushPrompt(true), 1000);
        }
      } catch {}
    };
    checkSub();
  }, [character, token]);

  const fetchCharacter = async (retry = 0) => {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/character');
          return;
        }
        // 401이면 세션 만료 → 로그인으로
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`Failed: ${res.status}`);
      }
      const data = await res.json();
      setCharacter(data);
      if (!data.tutorialCompleted) {
        router.push('/tutorial');
        return;
      }
      const welcomeKey = `welcome-shown-${data._id}`;
      if (!localStorage.getItem(welcomeKey)) {
        setShowWelcome(true);
        localStorage.setItem(welcomeKey, 'true');
      }
    } catch (error) {
      console.error('Error fetching character:', error);
      // 최대 2번 재시도
      if (retry < 2) {
        setTimeout(() => fetchCharacter(retry + 1), 1000 * (retry + 1));
        return;
      }
    } finally {
      if (retry === 0 || retry >= 2) {
        setLoading(false);
      }
    }
  };

  // 다른 페이지에서 돌아왔을 때 캐릭터 데이터 갱신
  useEffect(() => {
    const handleFocus = () => {
      if (token && !loading) {
        fetchCharacter();
      }
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, loading]);

  // ★ 자기 밥주기 상태 확인 — token 변수 사용
  useEffect(() => {
    if (!character?._id || !token) return;
    const checkFeedStatus = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/api/characters/${character._id}/feed-status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setSelfFed(data.fed);
        }
      } catch (e) {
        console.error('Feed status check failed:', e);
      }
    };
    checkFeedStatus();
  }, [character?._id, token]);

  // ★ 연습배치 직후 구슬 연출
  useEffect(() => {
    const tutorialXp = searchParams.get('tutorialXp');
    if (!tutorialXp || !character?._id) return;

    // 이미 처리했으면 스킵
    const tutorialHarvestKey = `tutorial-harvest-${character._id}`;
    if (sessionStorage.getItem(tutorialHarvestKey)) return;

    const xpAmount = parseInt(tutorialXp, 10);
    if (isNaN(xpAmount) || xpAmount <= 0) return;

    // 구슬 생성
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const orb: XpOrb = {
      id: orbIdCounter.current++,
      label: '연습배치 보너스',
      emoji: '⚾',
      xp: xpAmount,
      x: 40 + Math.random() * (vw - 80),
      y: 120 + Math.random() * (vh - 300),
      floatOffset: 0,
      eaten: false,
    };

    setXpOrbs([orb]);
    setTotalHarvestXp(xpAmount);
    setHarvestMode(true);

    // 중복 방지
    sessionStorage.setItem(tutorialHarvestKey, 'true');

    // URL에서 쿼리 파라미터 제거 (뒤로가기 시 재실행 방지)
    window.history.replaceState({}, '', '/');
  }, [searchParams, character?._id]);
  
    // ★ 미수확 XP 확인
  useEffect(() => {
    if (!character?._id || !token) return;

    const checkUnclaimed = async () => {
      const harvestKey = `xp-harvested-${character._id}`;
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      if (localStorage.getItem(harvestKey) === today) return;

      try {
        const res = await fetch(`${apiUrl}/api/characters/me/unclaimed-xp`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.hasUnclaimed || data.orbs.length === 0) return;

               const vw = window.innerWidth;
        const vh = window.innerHeight;
        const orbs: XpOrb[] = data.orbs
          .filter((o: any) => o.xp !== 0)
          .map((o: any) => ({
            id: orbIdCounter.current++,
            label: o.label,
            emoji: o.emoji,
            xp: o.xp,
            x: 40 + Math.random() * (vw - 80),
            y: 120 + Math.random() * (vh - 300),
            floatOffset: Math.random() * Math.PI * 2,
            eaten: false,
          }));

        if (orbs.length > 0) {
          setXpOrbs(orbs);
          setTotalHarvestXp(data.totalXp);
          setHarvestMode(true);
          setCharPos({ x: 50, y: 75 });
        }
      } catch (e) {
        console.error('Unclaimed XP check failed:', e);
      }
    };

    checkUnclaimed();
  }, [character?._id, token]);

  // ★ 자기 밥주기 함수 — token 변수 사용
  const handleSelfFeed = async () => {
    if (!character || !token || selfFed) return;
    try {
      const res = await fetch(
        `${apiUrl}/api/characters/${character._id}/feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setSelfFed(true);
        setFeedAnimation(true);
        setTimeout(() => setFeedAnimation(false), 1800);
        setCharacter((prev) =>
          prev
            ? { ...prev, xp: data.theirXp, totalFeeds: data.totalFeeds }
            : prev,
        );
        setFeedToast('🍖 냠냠! +3 XP');
        setTimeout(() => setFeedToast(''), 2500);
      } else {
        if (data.code === 'alreadyFed') setSelfFed(true);
        setFeedToast(data.error || '밥주기 실패');
        setTimeout(() => setFeedToast(''), 2500);
      }
    } catch (e) {
      setFeedToast('네트워크 오류');
      setTimeout(() => setFeedToast(''), 2500);
    }
  };

  // ★ 캐릭터 동물 변경
  const handleAnimalChange = async () => {
    if (!character || !token || !selectedNewAnimal || animalChanging) return;
    if (character.xp < CHANGE_ANIMAL_COST) {
      setEvolutionToast(`XP가 부족합니다 (${CHANGE_ANIMAL_COST} XP 필요)`);
      setTimeout(() => setEvolutionToast(''), 2500);
      return;
    }
    setAnimalChanging(true);
    try {
      const res = await fetch(`${apiUrl}/api/characters/me/animal`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ animalType: selectedNewAnimal }),
      });
      const data = await res.json();
      if (res.ok) {
        setCharacter(prev =>
          prev ? { ...prev, animalType: data.character.animalType, xp: data.character.xp } : prev
        );
        setEvolutionToast(`✨ ${ANIMAL_NAMES[data.character.animalType] || data.character.animalType}(으)로 변신! -${data.cost} XP`);
        setTimeout(() => setEvolutionToast(''), 3000);
        setShowAnimalChange(false);
        setSelectedNewAnimal(null);
      } else {
        setEvolutionToast(data.error || '변경 실패');
        setTimeout(() => setEvolutionToast(''), 2500);
      }
    } catch {
      setEvolutionToast('네트워크 오류');
      setTimeout(() => setEvolutionToast(''), 2500);
    } finally {
      setAnimalChanging(false);
    }
  };

    // ★ XP 구슬 클릭
    const handleOrbClick = useCallback(async (orbId: number) => {
    if (eatingOrbId !== null) return;
    const orb = xpOrbs.find(o => o.id === orbId);
    if (!orb || orb.eaten) return;

    setEatingOrbId(orbId);

    // 캐릭터를 구슬 위치로 걸어가게 함
    if (walkingCharRef.current) {
      await walkingCharRef.current.walkTo(orb.x, orb.y);
    }

    // 도착 후 구슬 먹기
    setXpOrbs(prev => {
      const updated = prev.map(o =>
        o.id === orbId ? { ...o, eaten: true } : o
      );
      const remaining = updated.filter(o => !o.eaten);

      if (remaining.length === 0) {
        setTimeout(() => {
          setHarvestComplete(true);
          if (character) {
            const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
            localStorage.setItem(`xp-harvested-${character._id}`, today);
          }
          setTimeout(() => {
            setHarvestMode(false);
            setHarvestComplete(false);
            setXpOrbs([]);
          }, 2500);
        }, 600);
      }

      return updated;
    });

    const sign = orb.xp > 0 ? '+' : '';
    setHarvestToast(`${orb.emoji} ${orb.label} ${sign}${orb.xp} XP`);
    setTimeout(() => setHarvestToast(''), 1500);
    setEatingOrbId(null);
  }, [eatingOrbId, xpOrbs, character]);

  
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert('캐릭터가 삭제되었습니다.');
        router.push('/character');
      } else {
        const data = await res.json();
        alert(data.error || '삭제 실패');
      }
    } catch (e) {
      console.error('Delete failed:', e);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handlePushSetup = async () => {
    setMenuOpen(false);
    if (pushStatus === 'denied') {
      setShowBlockedGuide(true);
      return;
    }
    if (pushStatus === 'granted') {
      try {
        const reg = await navigator.serviceWorker.getRegistration(
          '/firebase-messaging-sw.js',
        );
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
        await fetch(`${apiUrl}/api/push/unsubscribe`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fcmToken: 'all' }),
        });
        localStorage.setItem('push-manually-disabled', 'true');
        setPushStatus('idle');
        alert('알림이 해제되었습니다.');
      } catch (e) {
        console.error('[Push] Unsubscribe failed:', e);
        alert('알림 해제 중 오류가 발생했습니다.');
      }
      return;
    }
    setPushStatus('loading');
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        await fetch(`${apiUrl}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fcmToken }),
        });
        localStorage.removeItem('push-manually-disabled');
        setPushStatus('granted');
        alert(
          '알림이 설정되었습니다! 배치 미완료 시 알림을 받을 수 있어요.',
        );
      } else {
        setPushStatus('denied');
        alert(
          '알림 권한이 차단되었습니다. 브라우저 설정에서 알림을 허용해주세요.',
        );
      }
    } catch (e) {
      console.error('[Push] Setup failed:', e);
      setPushStatus('idle');
      alert('알림 설정 중 오류가 발생했습니다.');
    }
  };

  const handlePushPromptAccept = async () => {
    setShowPushPrompt(false);
    if (Notification.permission === 'denied') {
      setShowBlockedGuide(true);
      return;
    }
    setPushStatus('loading');
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        await fetch(`${apiUrl}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fcmToken }),
        });
        setPushStatus('granted');
      } else {
        setPushStatus('denied');
      }
    } catch {
      setPushStatus('idle');
    }
  };

  const handlePushPromptDismiss = () => {
    const today = new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    localStorage.setItem('push-prompt-dismissed', today);
    setShowPushPrompt(false);
  };

  const handleShare = async (
    target: 'kakao' | 'instagram' | 'download',
  ) => {
    if (!character) return;

    let shareSuccess = false;

    if (target === 'kakao') {
      const { shareCharacter } = await import('@/lib/kakaoShare');
      shareCharacter({
        characterName: character.name,
        animalName:
          ANIMAL_NAMES[character.animalType] || character.animalType,
        animalEmoji: ANIMAL_EMOJI[character.animalType] || '🐾',
        animalType: character.animalType,
        xp: character.xp,
        traitName: character.activeTrait
          ? getTraitDisplay(character.activeTrait) || undefined
          : undefined,
      });
      shareSuccess = true;
      setShowShareMenu(false);
    } else {
      if (!shareCardRef.current) return;
      setShareLoading(true);
      setShowShareMenu(false);

      try {
        const blob = await captureCardAsBlob(shareCardRef.current);
        if (!blob) {
          alert('이미지 생성에 실패했습니다.');
          setShareLoading(false);
          return;
        }

        if (target === 'instagram') {
          shareSuccess = await shareToInstagramStory(blob);
        } else {
          const { downloadBlob } = await import('@/lib/shareUtils');
          downloadBlob(blob, 'beastleague.png');
          shareSuccess = true;
        }
      } catch (e) {
        console.error('Share failed:', e);
        alert('공유 중 오류가 발생했습니다.');
      } finally {
        setShareLoading(false);
      }
    }

    if (shareSuccess && token) {
      try {
        const res = await fetch(
          `${apiUrl}/api/characters/me/share-reward`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.rewarded) {
            alert(
              `🎉 공유 보상 +${data.added} XP! (${data.xpBefore} → ${data.xpAfter})`,
            );
            setCharacter((prev) =>
              prev ? { ...prev, xp: data.xpAfter } : prev,
            );
          }
        }
      } catch (e) {
        console.error('Share reward failed:', e);
      }
    }
  };

  const handleHelpTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);
  const handleHelpTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 50 && helpPage > 0) setHelpPage(helpPage - 1);
    if (diff < -50 && helpPage < HELP_CARDS.length - 1)
      setHelpPage(helpPage + 1);
    setTouchStartX(null);
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">캐릭터를 불러올 수 없습니다</p>
        <LogoutButton />
      </div>
    );
  }

  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName =
    ANIMAL_NAMES[character.animalType] || character.animalType;
    const characterSize = character.displaySize ?? getCharacterSize(character.xp);
  const evolvedStage = character.evolvedStage ?? 1;
  const displayStage = character.displayStage ?? evolvedStage;

  const initialPx = getEmojiPx(0);
  const emojiPx = getEmojiPx(character.xp);
  const card = HELP_CARDS[helpPage];

   const earnedCount = (character.earnedAchievements || []).length + (character.teamAchievements || []).length;
  const nextEvo = evolvedStage < 5 ? EVOLUTION_STAGES[evolvedStage] : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* XP 수확 모드 */}
      {harvestMode && (
        <>
          <div className="fixed top-16 left-0 right-0 text-center z-[35] pointer-events-none">
            <p className="text-gray-500 text-xs mb-0.5">어제의 경기 결과</p>
            <p className="text-gray-800 text-base font-bold">
              ✨ 구슬을 터치하면 캐릭터가 먹으러 갑니다!
            </p>
            <p className="text-orange-500 text-sm mt-1 font-bold">
              총 {totalHarvestXp > 0 ? '+' : ''}{totalHarvestXp} XP
            </p>
          </div>
          
          {/* 수확 토스트 */}
          {harvestToast && (
            <div className="fixed top-32 left-1/2 -translate-x-1/2 bg-black/70 text-white px-5 py-2 rounded-full text-sm font-bold z-[35] animate-bounce">
              {harvestToast}
            </div>
          )}

          {/* 수확 완료 */}
          {harvestComplete && (
            <div className="fixed inset-0 flex items-center justify-center z-[36] pointer-events-none">
              <div className="text-center" style={{ animation: 'harvestComplete 2s ease-out forwards' }}>
                <div className="text-6xl mb-3">🎉</div>
                <p className="text-gray-800 text-2xl font-black">수확 완료!</p>
                <p className="text-orange-500 text-lg font-bold mt-1">
                  {totalHarvestXp > 0 ? '+' : ''}{totalHarvestXp} XP 획득!
                </p>
              </div>
            </div>
          )}

          {/* 구슬들 */}
          {xpOrbs.map(orb => (
            <button
              key={orb.id}
              onClick={() => handleOrbClick(orb.id)}
              disabled={orb.eaten || eatingOrbId !== null}
              className={`fixed z-[30] transition-all duration-500 ${
                orb.eaten
                  ? 'scale-0 opacity-0'
                  : eatingOrbId === orb.id
                    ? 'scale-150 opacity-50'
                    : 'hover:scale-110 active:scale-95'
              }`}
              style={{
                left: `${orb.x}px`,
                top: `${orb.y}px`,
                transform: 'translate(-50%, -50%)',
                animation: orb.eaten ? 'none' : `orbFloat 3s ease-in-out infinite`,
                animationDelay: `${orb.floatOffset}s`,
              }}
            >
              <div className={`relative flex flex-col items-center ${
                orb.xp > 0
                  ? 'drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]'
                  : 'drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]'
              }`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl ${
                  orb.xp > 0
                    ? 'bg-gradient-to-br from-yellow-200 to-amber-400 shadow-lg'
                    : 'bg-gradient-to-br from-red-300 to-red-500 shadow-lg'
                }`}>
                  {orb.emoji}
                </div>
                <div className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  orb.xp > 0
                    ? 'bg-yellow-400/90 text-yellow-900'
                    : 'bg-red-400/90 text-white'
                }`}>
                  {orb.xp > 0 ? '+' : ''}{orb.xp}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 font-medium">
                  {orb.label}
                </span>
              </div>
            </button>
          ))}

          {/* 남은 카운터 */}
          <div className="fixed bottom-28 left-0 right-0 text-center z-[35] pointer-events-none">
            <p className="text-gray-400 text-xs">
              남은 구슬: {xpOrbs.filter(o => !o.eaten).length} / {xpOrbs.length}
            </p>
          </div>
        </>
      )}

      {/* ★ 밥 먹는 애니메이션 */}
      {feedAnimation && (
        <div className="fixed inset-0 pointer-events-none z-[60]">
          {['🍖', '🥩', '🍗'].map((food, i) => (
            <div
              key={i}
              className="absolute text-4xl"
              style={{
                left: `${25 + i * 25}%`,
                animation: `feedFly${i} 1.5s ease-in forwards`,
              }}
            >
              {food}
            </div>
          ))}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 text-3xl font-black text-orange-500"
            style={{ animation: 'nomnom 1.5s ease-out forwards' }}
          >
            냠냠!
          </div>
        </div>
      )}

      {/* ★ 밥주기 토스트 */}
      {feedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-2.5 rounded-full text-sm font-medium z-[60] animate-bounce">
          {feedToast}
        </div>
      )}

{/* ★ 진화/변경 토스트 */}
{evolutionToast && (
  <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white px-5 py-2.5 rounded-full text-sm font-medium z-[60] animate-bounce">
    {evolutionToast}
  </div>
)}

      
      {/* 카카오 브라우저 안내 */}
      {typeof navigator !== 'undefined' &&
        /KAKAOTALK/i.test(navigator.userAgent) && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
            <div className="text-5xl mb-4">🌐</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              기본 브라우저에서 열어주세요
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              카카오톡 브라우저에서는 알림 등
              <br />
              일부 기능이 제한됩니다.
            </p>
            {/iPhone|iPad/i.test(navigator.userAgent) ? (
              <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs">
                <p className="text-xs text-gray-500 leading-relaxed">
                  우측 하단 <strong>공유(↗) 아이콘</strong> 탭
                  <br />→ <strong>Safari로 열기</strong> 선택
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs">
                <p className="text-xs text-gray-500 leading-relaxed">
                  우측 하단 <strong>⋮</strong> 메뉴 탭
                  <br />→ <strong>다른 브라우저로 열기</strong> 선택
                </p>
              </div>
            )}
          </div>
        )}

      {/* 로그아웃 */}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between relative z-10">
        <div />
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      {/* ──── 돌아다니는 캐릭터 ──── */}
            <WalkingCharacter
        ref={walkingCharRef}
        animalType={character.animalType}
        characterSize={characterSize}
        isPixelArt={PIXEL_ART_ANIMALS.includes(character.animalType)}
        emoji={emoji}
        stage={displayStage} 
      />

      {/* ──── 캐릭터 정보 ──── */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4 relative z-10">
                <h1 className="text-2xl font-bold text-gray-800">
          {character.name}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {animalName} · {character.xp.toLocaleString()} XP
        </p>

        {character.activeTrait && (
          <div className="mt-3 bg-white/80 backdrop-blur rounded-xl px-4 py-2 border border-orange-100 shadow-sm">
            <p className="text-sm text-gray-700 font-medium">
              {getTraitDisplay(character.activeTrait)}
            </p>
          </div>
        )}

        {/* ★ 좋아요 & 밥 카운트 */}
        {((character.totalLikes ?? 0) > 0 ||
          (character.totalFeeds ?? 0) > 0) && (
          <div className="mt-3 flex items-center gap-3">
            {(character.totalLikes ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-pink-50 rounded-full px-3 py-1">
                <span className="text-sm">❤️</span>
                <span className="text-xs font-bold text-pink-400">
                  {(character.totalLikes ?? 0).toLocaleString()}
                </span>
              </div>
            )}
            {(character.totalFeeds ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1">
                <span className="text-sm">🍖</span>
                <span className="text-xs font-bold text-amber-400">
                  {(character.totalFeeds ?? 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ★ 밥주기 버튼 */}
        <button
          onClick={handleSelfFeed}
          disabled={selfFed}
          className={`mt-4 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
            selfFed
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-400 text-white hover:bg-orange-500 active:scale-95 shadow-md'
          }`}
        >
          {selfFed ? '🍖 오늘 밥 완료!' : '🍖 밥주기 (+3 XP)'}
        </button>
      </div>
      
      {/* ──── FAB 메뉴 ──── */}
      <div className="fixed bottom-24 right-4 z-50">
               {menuOpen && (
          <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-2">
            <button
              onClick={handlePushSetup}
              disabled={pushStatus === 'loading'}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 ${pushStatus === 'denied' ? 'text-red-400' : 'text-gray-700'}`}
            >
              {pushStatus === 'granted' ? '✅ 알림 설정됨' : pushStatus === 'loading' ? '⏳ 설정 중...' : pushStatus === 'denied' ? '🔕 알림 차단됨' : '🔔 알림 설정'}
            </button>
            <button
              onClick={() => { setShowHelp(true); setHelpPage(0); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              ❓ 도움말
            </button>
            <button
              onClick={() => { router.push('/achievements'); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              🏆 내 업적
            </button>
                        <button
              onClick={() => { setShowEvolution(true); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              {(() => {
                const evo = EVOLUTION_STAGES[evolvedStage - 1];
                return evolvedStage >= 5
                  ? `💎 신화 · ${character.xp.toLocaleString()} XP`
                  : `${evo.badge} ${evo.stage}단계 · ${character.xp.toLocaleString()} XP`;
              })()}
                          
            </button>
            <button
              onClick={() => { setShowAnimalChange(true); setSelectedNewAnimal(null); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              🔄 캐릭터 변경 ({CHANGE_ANIMAL_COST} XP)
            </button>
            <button
              onClick={() => { setShowShareMenu(true); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              📢 공유하기
            </button>
            <button
              onClick={() => { setShowDelete(true); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-50"
            >
              🗑️ 캐릭터 삭제
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setMenuOpen(!menuOpen);
            setShowDelete(false);
            setShowHelp(false);
          }}
          className={`w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center text-2xl transition-transform duration-300 hover:bg-orange-600 active:scale-95 ${menuOpen ? 'rotate-45' : ''}`}
        >
          +
        </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ──── 모달들 ──── */}

      {/* 도움말 */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleHelpTouchStart}
            onTouchEnd={handleHelpTouchEnd}
          >
            <div className="px-6 pt-8 pb-4 text-center min-h-[320px] flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">{card.icon}</div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                {card.title}
              </h3>
              <div className="space-y-0.5">
                {card.lines.map((line, i) =>
                  line === '' ? (
                    <div key={i} className="h-3" />
                  ) : (
                    <p
                      key={i}
                      className="text-sm text-gray-500 leading-relaxed"
                    >
                      {line}
                    </p>
                  ),
                )}
              </div>
            </div>
            <div className="px-6 pb-6">
              <div className="flex justify-center gap-1.5 mb-4">
                {HELP_CARDS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHelpPage(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === helpPage ? 'bg-orange-400 w-4' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                {helpPage > 0 ? (
                  <button
                    onClick={() => setHelpPage(helpPage - 1)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
                  >
                    이전
                  </button>
                ) : (
                  <div className="flex-1" />
                )}
                {helpPage < HELP_CARDS.length - 1 ? (
                  <button
                    onClick={() => setHelpPage(helpPage + 1)}
                    className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHelp(false)}
                    className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500"
                  >
                    닫기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 비교 */}
      {showCompare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowCompare(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">
              초기와 비교
            </h2>
            <div className="flex items-end justify-center gap-10 mb-8">
              <div className="text-center">
                <div
                  className="leading-none mx-auto grayscale opacity-40"
                  style={{ fontSize: `${initialPx}px` }}
                >
                  {emoji}
                </div>
                <p className="text-xs text-gray-400 mt-3">처음</p>
                <p className="text-sm font-bold text-gray-400">0 XP</p>
              </div>
              <div className="text-2xl text-orange-400 mb-6">→</div>
              <div className="text-center">
                <div
                  className="leading-none mx-auto"
                  style={{
                    fontSize: `${Math.min(emojiPx, 100)}px`,
                  }}
                >
                  {emoji}
                </div>
                <p className="text-xs text-orange-500 font-medium mt-3">
                  현재
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {character.xp.toLocaleString()} XP
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">획득 XP</span>
                <span className="font-bold text-orange-500">
                  +{character.xp.toLocaleString()} XP
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">캐릭터 크기</span>
                <span className="font-bold text-gray-800">
                  {characterSize <= 60
                    ? '기본'
                    : characterSize <= 200
                      ? '성장 중'
                      : characterSize <= 500
                        ? '많이 성장'
                        : '거대'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowCompare(false)}
              className="w-full mt-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}

{/* ──── 진화 단계 모달 ──── */}
{showEvolution && character && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    onClick={() => setShowEvolution(false)}>
    <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm max-h-[85vh] overflow-y-auto p-6"
      onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">진화 단계</h3>

      {/* 현재 상태 */}
      <div className="text-center mb-4 p-3 bg-gray-50 rounded-xl">
        <span className="text-3xl">{EVOLUTION_STAGES[evolvedStage - 1].badge}</span>
        <p className="text-sm font-bold text-gray-700 mt-1">
          {evolvedStage}단계 · {EVOLUTION_STAGES[evolvedStage - 1].name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          보유 XP: {character.xp.toLocaleString()} · 업적: {earnedCount}개
        </p>
      </div>

      {/* 다음 진화 */}
      {nextEvo ? (
        <div className={`mb-4 p-4 rounded-xl border-2 ${
          character.xp >= nextEvo.xpCost && earnedCount >= nextEvo.requiredAchievements
            ? `${nextEvo.borderColor} ${nextEvo.bgColor}`
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{nextEvo.badge}</span>
            <div>
              <p className={`text-sm font-bold ${nextEvo.color}`}>
                {nextEvo.stage}단계 · {nextEvo.name}
              </p>
              <p className="text-xs text-gray-400">다음 진화</p>
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">XP 소모</span>
              <span className={character.xp >= nextEvo.xpCost ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>
                {character.xp >= nextEvo.xpCost ? '✓' : '✗'} {nextEvo.xpCost.toLocaleString()} XP
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${character.xp >= nextEvo.xpCost ? 'bg-emerald-400' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(100, (character.xp / nextEvo.xpCost) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-gray-500">업적</span>
              <span className={earnedCount >= nextEvo.requiredAchievements ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>
                {earnedCount >= nextEvo.requiredAchievements ? '✓' : '✗'} {earnedCount} / {nextEvo.requiredAchievements}개
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${earnedCount >= nextEvo.requiredAchievements ? 'bg-emerald-400' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(100, (earnedCount / nextEvo.requiredAchievements) * 100)}%` }}
              />
            </div>
          </div>

          <button
            onClick={async () => {
              if (evolving) return;
              setEvolving(true);
              try {
                const res = await fetch(`${apiUrl}/api/characters/me/evolve`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (res.ok) {
                  setCharacter(prev => prev ? {
                    ...prev,
                    xp: data.remainingXp,
                    evolvedStage: data.evolvedStage,
                    displayStage: null,
                  } : prev);
                  setShowEvolution(false);
                  setEvolutionToast(`${data.badge} ${data.stageName} 단계로 진화! -${data.xpSpent} XP`);
                  setTimeout(() => setEvolutionToast(''), 3000);
                } else {
                  setEvolutionToast(data.error || '진화 실패');
                  setTimeout(() => setEvolutionToast(''), 2500);
                }
              } catch {
                setEvolutionToast('네트워크 오류');
                setTimeout(() => setEvolutionToast(''), 2500);
              } finally {
                setEvolving(false);
              }
            }}
            disabled={evolving || character.xp < nextEvo.xpCost || earnedCount < nextEvo.requiredAchievements}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition ${
              character.xp >= nextEvo.xpCost && earnedCount >= nextEvo.requiredAchievements
                ? 'bg-orange-400 text-white hover:bg-orange-500 active:scale-95 shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {evolving ? '진화 중...' : character.xp >= nextEvo.xpCost && earnedCount >= nextEvo.requiredAchievements
              ? `진화하기 (-${nextEvo.xpCost.toLocaleString()} XP)`
              : '조건 미달'}
          </button>
        </div>
      ) : (
        <div className="mb-4 p-4 rounded-xl bg-cyan-50 border-2 border-cyan-300 text-center">
          <p className="text-cyan-500 font-bold">최고 단계 달성!</p>
        </div>
      )}

      {/* 전체 단계 목록 */}
      <p className="text-xs text-gray-400 mb-2">전체 단계</p>
      <div className="space-y-1.5 mb-4">
        {EVOLUTION_STAGES.map(evo => {
          const isEvolved = evolvedStage >= evo.stage;
          const isCurrent = evolvedStage === evo.stage;
          return (
            <div
              key={evo.stage}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${
                isCurrent
                  ? `${evo.bgColor} ${evo.borderColor} border-2 font-bold`
                  : isEvolved
                    ? 'bg-gray-50 border border-gray-100'
                    : 'bg-gray-100 opacity-50 border border-gray-100'
              }`}
            >
              <span className="text-xl">{evo.badge}</span>
              <div className="flex-1">
                <span className={isEvolved ? evo.color : 'text-gray-400'}>
                  {evo.stage}단계 · {evo.name}
                </span>
                {evo.stage > 1 && (
                  <p className="text-[10px] text-gray-400">
                    {evo.xpCost.toLocaleString()} XP + 업적 {evo.requiredAchievements}개
                  </p>
                )}
              </div>
              {isCurrent && <span className="text-xs text-orange-500 font-bold">현재</span>}
              {isEvolved && !isCurrent && <span className="text-xs text-gray-400">완료</span>}
            </div>
          );
        })}
      </div>

      {/* 크기 조절 슬라이더 */}
      <div className="border-t border-gray-100 pt-4 mb-4">
        <p className="text-sm font-bold text-gray-700 mb-2">캐릭터 크기</p>
        <input
          type="range"
          min={60}
          max={getCharacterSize(character.xp)}
          value={character.displaySize ?? getCharacterSize(character.xp)}
          onChange={e => {
            const val = parseInt(e.target.value);
            setCharacter(prev => prev ? { ...prev, displaySize: val } : prev);
          }}
          onMouseUp={async e => {
            const val = parseInt((e.target as HTMLInputElement).value);
            const value = val === getCharacterSize(character.xp) ? null : val;
            try {
              await fetch(`${apiUrl}/api/characters/me/display`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ displaySize: value }),
              });
            } catch {}
          }}
          onTouchEnd={async e => {
            const val = parseInt((e.target as HTMLInputElement).value);
            const value = val === getCharacterSize(character.xp) ? null : val;
            try {
              await fetch(`${apiUrl}/api/characters/me/display`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ displaySize: value }),
              });
            } catch {}
          }}
          className="w-full accent-orange-400"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>최소 (60px)</span>
          <span>최대 ({getCharacterSize(character.xp)}px)</span>
        </div>
      </div>

      {/* 외형 단계 선택 */}
      {evolvedStage > 1 && (
        <div className="border-t border-gray-100 pt-4 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">외형 단계 선택</p>
          <p className="text-xs text-gray-400 mb-2">진화한 단계 이하로 외형을 변경할 수 있어요</p>
          <div className="flex gap-2 flex-wrap">
            {EVOLUTION_STAGES.filter(evo => evo.stage <= evolvedStage).map(evo => {
              const isSelected = displayStage === evo.stage;
              return (
                <button
                  key={evo.stage}
                  onClick={async () => {
                    const value = evo.stage === evolvedStage ? null : evo.stage;
                    try {
                      const res = await fetch(`${apiUrl}/api/characters/me/display`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ displayStage: value }),
                      });
                      if (res.ok) {
                        setCharacter(prev => prev ? { ...prev, displayStage: value } : prev);
                      }
                    } catch {}
                  }}
                  className={`px-3 py-2 rounded-xl text-sm transition ${
                    isSelected
                      ? `${evo.bgColor} ${evo.borderColor} border-2 font-bold`
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {evo.badge} {evo.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowEvolution(false)}
        className="w-full py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium"
      >
        닫기
      </button>
    </div>   {/* ← bg-white rounded-2xl (모달 내용 div) 닫기 */}
  </div>     {/* ← fixed inset-0 (오버레이 div) 닫기 */}
)}           {/* ← showEvolution && character && ( 닫기 */}

      {/* ★ 캐릭터 변경 모달 */}
{showAnimalChange && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    onClick={() => setShowAnimalChange(false)}
  >
    <div
      className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 max-h-[80vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">🔄 캐릭터 변경</h2>
      <p className="text-xs text-gray-400 text-center mb-1">
        동물을 변경합니다. 이름과 XP는 유지됩니다.
      </p>
      <p className="text-xs text-center mb-4">
        <span className="text-orange-500 font-bold">비용: {CHANGE_ANIMAL_COST} XP</span>
        <span className="text-gray-400 ml-2">(보유: {character.xp.toLocaleString()} XP)</span>
      </p>

      {character.xp < CHANGE_ANIMAL_COST && (
        <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-3 rounded-lg mb-4 font-medium">
          XP가 부족합니다! {CHANGE_ANIMAL_COST - character.xp} XP 더 필요해요.
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mb-5">
        {Object.entries(ANIMAL_EMOJI).map(([type, emo]) => {
          const isCurrent = type === character.animalType;
          const isSelected = type === selectedNewAnimal;
          return (
            <button
              key={type}
              onClick={() => !isCurrent && setSelectedNewAnimal(type)}
              disabled={isCurrent}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                isCurrent
                  ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                  : isSelected
                    ? 'border-indigo-400 bg-indigo-50 shadow-md scale-105'
                    : 'border-gray-100 bg-white hover:border-gray-300 active:scale-95'
              }`}
            >
              <span className="text-2xl">{emo}</span>
              <span className={`text-[10px] font-medium ${isCurrent ? 'text-gray-400' : isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>
                {ANIMAL_NAMES[type] || type}
              </span>
              {isCurrent && <span className="text-[9px] text-gray-400">현재</span>}
            </button>
          );
        })}
      </div>

      {selectedNewAnimal && (
        <div className="bg-indigo-50 rounded-xl p-3 mb-4 text-center">
          <span className="text-3xl">{ANIMAL_EMOJI[selectedNewAnimal]}</span>
          <p className="text-sm font-bold text-indigo-600 mt-1">
            {ANIMAL_NAMES[selectedNewAnimal]}(으)로 변경
          </p>
          <p className="text-xs text-indigo-400 mt-0.5">
            {character.xp.toLocaleString()} → {(character.xp - CHANGE_ANIMAL_COST).toLocaleString()} XP
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowAnimalChange(false);
            setSelectedNewAnimal(null);
          }}
          className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
        >
          취소
        </button>
        <button
          onClick={handleAnimalChange}
          disabled={!selectedNewAnimal || animalChanging || character.xp < CHANGE_ANIMAL_COST}
          className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {animalChanging ? '변경 중...' : '변경하기'}
        </button>
      </div>
    </div>
  </div>
)}

      
      {/* 삭제 확인 */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">{emoji}</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              캐릭터를 삭제할까요?
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              <strong>{character.name}</strong>과(와) 모든 배치 기록이
              삭제됩니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 푸시 안내 */}
      {showPushPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-28 bg-black/30"
          onClick={handlePushPromptDismiss}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl">🔔</div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  알림을 켜볼까요?
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  하루에 한 번만 물어볼게요
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              경기 전 배치 리마인더와
              <br />
              정산 결과를 알림으로 받을 수 있어요.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePushPromptDismiss}
                className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium"
              >
                다음에
              </button>
              <button
                onClick={handlePushPromptAccept}
                className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold"
              >
                알림 받기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 차단 가이드 */}
      {showBlockedGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowBlockedGuide(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl text-center mb-3">🔕</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">
              알림이 차단되어 있어요
            </h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              브라우저 설정에서 직접 변경해야 합니다.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-3">
              <p className="text-sm font-bold text-gray-700 mb-2">
                📱 모바일 (Chrome)
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                주소창 왼쪽 ⚙️ 아이콘 탭
                <br />→ 권한 또는 사이트 설정
                <br />→ 알림 → 허용으로 변경
                <br />→ 페이지 새로고침
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-gray-700 mb-2">
                💻 PC (Chrome)
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                주소창 왼쪽 🔒 아이콘 클릭
                <br />→ 사이트 설정
                <br />→ 알림 → 허용으로 변경
                <br />→ 페이지 새로고침
              </p>
            </div>
            <button
              onClick={() => setShowBlockedGuide(false)}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 웰컴 */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowWelcome(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                캐릭터가 탄생했어요!
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                매일 KBO 경기에 배치하면
                <br />
                실제 선수 성적에 따라 XP를 얻고
                <br />
                캐릭터가 성장합니다!
              </p>
              <div className="bg-orange-50 rounded-xl p-4 mb-4 text-left">
                <p className="text-sm font-bold text-orange-600 mb-2">
                  🔔 알림 설정 추천!
                </p>
                <p className="text-xs text-orange-500 leading-relaxed">
                  알림을 켜면 배치를 잊지 않도록
                  <br />
                  매일 경기 전에 알려드려요.
                  <br />
                  오른쪽 하단 + 버튼 → 알림 설정
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-bold text-gray-700 mb-2">
                  ❓ 도움말
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  배치 방법, XP 규칙 등 자세한 내용은
                  <br />+ 버튼 → 도움말에서 확인하세요.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowWelcome(false)}
                className="w-full py-3 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유용 카드 */}
      <div
        style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}
      >
        <ShareCard
          ref={shareCardRef}
          characterName={character.name}
          animalType={character.animalType}
          animalName={animalName}
          xp={character.xp}
          characterSize={characterSize}
          traitName={
            character.activeTrait
              ? getTraitDisplay(character.activeTrait) || undefined
              : undefined
          }
        />
      </div>

      {/* 공유 메뉴 모달 */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-28 bg-black/30"
          onClick={() => setShowShareMenu(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-800 mb-4 text-center">
              공유하기
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleShare('kakao')}
                disabled={shareLoading}
                className="flex-1 flex flex-col items-center gap-2 py-4 bg-yellow-50 rounded-xl hover:bg-yellow-100 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="text-2xl">💬</span>
                <span className="text-xs font-medium text-gray-700">
                  카카오톡
                </span>
              </button>
              <button
                onClick={() => handleShare('instagram')}
                disabled={shareLoading}
                className="flex-1 flex flex-col items-center gap-2 py-4 bg-purple-50 rounded-xl hover:bg-purple-100 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="text-2xl">📸</span>
                <span className="text-xs font-medium text-gray-700">
                  인스타 스토리
                </span>
              </button>
              <button
                onClick={() => handleShare('download')}
                disabled={shareLoading}
                className="flex-1 flex flex-col items-center gap-2 py-4 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="text-2xl">📋</span>
                <span className="text-xs font-medium text-gray-700">
                  이미지 저장
                </span>
              </button>
            </div>
            {shareLoading && (
              <p className="text-xs text-gray-400 text-center mt-3 animate-pulse">
                카드 생성 중...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ★ CSS 애니메이션 */}
      <style jsx global>{`
        @keyframes feedFly0 {
          0% {
            top: 80%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 40%;
            opacity: 1;
            transform: scale(1.3);
          }
          100% {
            top: 35%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes feedFly1 {
          0% {
            top: 85%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 42%;
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            top: 37%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes feedFly2 {
          0% {
            top: 82%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 38%;
            opacity: 1;
            transform: scale(1.4);
          }
          100% {
            top: 33%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes nomnom {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.5);
          }
          30% {
            opacity: 1;
            transform: translate(-50%, -20px) scale(1.2);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -30px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50px) scale(0.8);
          }
        }
          @keyframes orbFloat {
    0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
    50% { transform: translate(-50%, -50%) translateY(-12px); }
  }

  @keyframes twinkle {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.8; }
  }

  @keyframes harvestComplete {
    0% { transform: scale(0.5); opacity: 0; }
    30% { transform: scale(1.2); opacity: 1; }
    50% { transform: scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: scale(1) translateY(-20px); }
  }

      `}</style>
    </div>
  );
}
