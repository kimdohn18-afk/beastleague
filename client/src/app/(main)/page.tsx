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
import EvolutionModal from '@/components/EvolutionModal';
import AnimalChangeModal from '@/components/AnimalChangeModal';
import ShareMenu from '@/components/ShareMenu';
import DeleteModal from '@/components/DeleteModal';
import HelpCards from '@/components/HelpCards';

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

      <div className="min-h-screen bg-gray-50 pb-24 relative">
