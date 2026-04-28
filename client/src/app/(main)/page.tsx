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

/* ─── 타입 ─── */
interface Character {
  _id: string;
  name: string;
  animalType: string;
  xp: number;
  totalXp?: number;
  currentXp?: number;
  stats?: {
    power: number;
    agility: number;
    skill: number;
    stamina: number;
    mind: number;
  };
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

/* ─── 유틸 ─── */
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

/* ─── 핀치 줌 훅 ─── */
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
      const newScale = Math.max(0.02, Math.min(startScaleRef.current * ratio, 3));
      setScale(newScale);
    }
  }, []);

  const onTouchEnd = useCallback(() => {}, []);

  const lastTapRef = useRef(0);
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) setScale(1);
        lastTapRef.current = now;
      }
      if (e.touches.length === 2) onTouchStart(e);
    },
    [onTouchStart],
  );

  return { scale, setScale, containerRef, onTouchStart: handleTouchStart, onTouchMove, onTouchEnd };
}

/* ═══════════════════════════════════════════
   메인 페이지
   ═══════════════════════════════════════════ */
export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  /* UI 토글 */
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPage, setHelpPage] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBlockedGuide, setShowBlockedGuide] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  /* 푸시 */
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');

  /* 밥주기 */
  const [selfFed, setSelfFed] = useState(false);
  const [feedAnimation, setFeedAnimation] = useState(false);
  const [feedToast, setFeedToast] = useState('');

  /* 진화 & 동물 변경 */
  const [showEvolution, setShowEvolution] = useState(false);
  const [showAnimalChange, setShowAnimalChange] = useState(false);
  const [selectedNewAnimal, setSelectedNewAnimal] = useState<string | null>(null);
  const [animalChanging, setAnimalChanging] = useState(false);
  const [evolutionToast, setEvolutionToast] = useState('');
  const [evolving, setEvolving] = useState(false);

  /* XP 수확 */
  const [xpOrbs, setXpOrbs] = useState<XpOrb[]>([]);
  const [harvestMode, setHarvestMode] = useState(false);
  const [eatingOrbId, setEatingOrbId] = useState<number | null>(null);
  const [charPos, setCharPos] = useState<{ x: number; y: number }>({ x: 50, y: 75 });
  const [harvestToast, setHarvestToast] = useState('');
  const [totalHarvestXp, setTotalHarvestXp] = useState(0);
  const [harvestComplete, setHarvestComplete] = useState(false);
  const orbIdCounter = useRef(0);
  const walkingCharRef = useRef<WalkingCharacterHandle>(null);

  /* 공유 */
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  /* 방명록 */
  const [guestbookEntries, setGuestbookEntries] = useState<any[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;
  const pinch = usePinchZoom();

  /* ─── 푸시 알림 초기화 ─── */
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
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  /* ─── 인증 & 캐릭터 로드 ─── */
  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated' && token) fetchCharacter();
  }, [status, token]);

  /* ─── 푸시 프롬프트 타이밍 ─── */
  useEffect(() => {
    if (!character || !token) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (/KAKAOTALK/i.test(navigator.userAgent)) return;
    if (character.xp === 0) return;

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    if (localStorage.getItem('push-prompt-dismissed') === today) return;

    if (Notification.permission === 'denied' || Notification.permission === 'default') {
      setTimeout(() => setShowPushPrompt(true), 1000);
      return;
    }

    const checkSub = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/push/status`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (!data.subscribed) setTimeout(() => setShowPushPrompt(true), 1000);
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
        if (res.status === 404) { router.push('/character'); return; }
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error(`Failed: ${res.status}`);
      }
      const data = await res.json();
      setCharacter(data);

      if (!data.tutorialCompleted) { router.push('/tutorial'); return; }

      const welcomeKey = `welcome-shown-${data._id}`;
      if (!localStorage.getItem(welcomeKey)) {
        setShowWelcome(true);
        localStorage.setItem(welcomeKey, 'true');
      }
    } catch (error) {
      console.error('Error fetching character:', error);
      if (retry < 2) { setTimeout(() => fetchCharacter(retry + 1), 1000 * (retry + 1)); return; }
    } finally {
      if (retry === 0 || retry >= 2) setLoading(false);
    }
  };

  /* 포커스 복귀 시 갱신 */
  useEffect(() => {
    const handleFocus = () => { if (token && !loading) fetchCharacter(); };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => { if (document.visibilityState === 'visible') handleFocus(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, loading]);

  /* ─── 밥주기 상태 체크 ─── */
  useEffect(() => {
    if (!character?._id || !token) return;
    const checkFeedStatus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/characters/${character._id}/feed-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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

  /* ─── 방명록 로드 ─── */
useEffect(() => {
  if (!character?._id || !token) return;
  const fetchGuestbook = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me/guestbook`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGuestbookEntries(data);
      }
    } catch (e) {
      console.error('Guestbook fetch failed:', e);
    }
  };
  fetchGuestbook();
}, [character?._id, token]);
  
  /* ─── 튜토리얼 XP 구슬 ─── */
  useEffect(() => {
    const tutorialXp = searchParams.get('tutorialXp');
    if (!tutorialXp || !character?._id) return;

    const tutorialHarvestKey = `tutorial-harvest-${character._id}`;
    if (sessionStorage.getItem(tutorialHarvestKey)) return;

    const xpAmount = parseInt(tutorialXp, 10);
    if (isNaN(xpAmount) || xpAmount <= 0) return;

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
    sessionStorage.setItem(tutorialHarvestKey, 'true');
    window.history.replaceState({}, '', '/');
  }, [searchParams, character?._id]);

  /* ─── 미수확 XP 확인 ─── */
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

  /* ─── 핸들러: 밥주기 ─── */
  const handleSelfFeed = async () => {
    if (!character || !token || selfFed) return;
    try {
      const res = await fetch(`${apiUrl}/api/characters/${character._id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSelfFed(true);
        setFeedAnimation(true);
        setTimeout(() => setFeedAnimation(false), 1800);
        setCharacter((prev) => prev ? { ...prev, xp: data.theirXp, totalFeeds: data.totalFeeds } : prev);
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

  /* ─── 핸들러: 동물 변경 ─── */
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ animalType: selectedNewAnimal }),
      });
      const data = await res.json();
      if (res.ok) {
        setCharacter(prev => prev ? { ...prev, animalType: data.character.animalType, xp: data.character.xp } : prev);
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

  /* ─── 핸들러: XP 구슬 클릭 ─── */
  const handleOrbClick = useCallback(async (orbId: number) => {
    if (eatingOrbId !== null) return;
    const orb = xpOrbs.find(o => o.id === orbId);
    if (!orb || orb.eaten) return;

    setEatingOrbId(orbId);

    if (walkingCharRef.current) {
      await walkingCharRef.current.walkTo(orb.x, orb.y);
    }

    setXpOrbs(prev => {
      const updated = prev.map(o => o.id === orbId ? { ...o, eaten: true } : o);
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

  /* ─── 핸들러: 캐릭터 삭제 ─── */
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

  /* ─── 핸들러: 푸시 설정 ─── */
  const handlePushSetup = async () => {
    setMenuOpen(false);
    if (pushStatus === 'denied') { setShowBlockedGuide(true); return; }

    if (pushStatus === 'granted') {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
        await fetch(`${apiUrl}/api/push/unsubscribe`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken }),
        });
        localStorage.removeItem('push-manually-disabled');
        setPushStatus('granted');
        alert('알림이 설정되었습니다! 배치 미완료 시 알림을 받을 수 있어요.');
      } else {
        setPushStatus('denied');
        alert('알림 권한이 차단되었습니다. 브라우저 설정에서 알림을 허용해주세요.');
      }
    } catch (e) {
      console.error('[Push] Setup failed:', e);
      setPushStatus('idle');
      alert('알림 설정 중 오류가 발생했습니다.');
    }
  };

  const handlePushPromptAccept = async () => {
    setShowPushPrompt(false);
    if (Notification.permission === 'denied') { setShowBlockedGuide(true); return; }
    setPushStatus('loading');
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        await fetch(`${apiUrl}/api/push/subscribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    localStorage.setItem('push-prompt-dismissed', today);
    setShowPushPrompt(false);
  };

  /* ─── 핸들러: 공유 ─── */
  const handleShare = async (target: 'kakao' | 'instagram' | 'download') => {
    if (!character) return;
    let shareSuccess = false;

    if (target === 'kakao') {
      const { shareCharacter } = await import('@/lib/kakaoShare');
      shareCharacter({
        characterName: character.name,
        animalName: ANIMAL_NAMES[character.animalType] || character.animalType,
        animalEmoji: ANIMAL_EMOJI[character.animalType] || '🐾',
        animalType: character.animalType,
        xp: character.xp,
        traitName: character.activeTrait ? getTraitDisplay(character.activeTrait) || undefined : undefined,
      });
      shareSuccess = true;
      setShowShareMenu(false);
    } else {
      if (!shareCardRef.current) return;
      setShareLoading(true);
      setShowShareMenu(false);

      try {
        const blob = await captureCardAsBlob(shareCardRef.current);
        if (!blob) { alert('이미지 생성에 실패했습니다.'); setShareLoading(false); return; }

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
        const res = await fetch(`${apiUrl}/api/characters/me/share-reward`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.rewarded) {
            alert(`공유 보상 +${data.added} XP! (${data.xpBefore} → ${data.xpAfter})`);
            setCharacter((prev) => prev ? { ...prev, xp: data.xpAfter } : prev);
          }
        }
      } catch (e) {
        console.error('Share reward failed:', e);
      }
    }
  };

  /* ─── 로딩 / 에러 렌더 ─── */
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

  /* ─── 파생 값 ─── */
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const characterSize = character.displaySize ?? getCharacterSize(character.xp);
  const evolvedStage = character.evolvedStage ?? 1;
  const displayStage = character.displayStage ?? evolvedStage;
  const earnedCount = (character.earnedAchievements || []).length + (character.teamAchievements || []).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* XP 수확 오버레이 */}
      {harvestMode && (
        <HarvestOverlay
          xpOrbs={xpOrbs}
          totalHarvestXp={totalHarvestXp}
          harvestToast={harvestToast}
          harvestComplete={harvestComplete}
          eatingOrbId={eatingOrbId}
          onOrbClick={handleOrbClick}
        />
      )}

      {/* 밥주기 애니메이션 */}
      {feedAnimation && (
        <div className="fixed inset-0 pointer-events-none z-[60]">
          {['🍖', '🥩', '🍗'].map((food, i) => (
            <div key={i} className="absolute text-4xl" style={{ left: `${25 + i * 25}%`, animation: `feedFly${i} 1.5s ease-in forwards` }}>{food}</div>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 text-3xl font-black text-orange-500" style={{ animation: 'nomnom 1.5s ease-out forwards' }}>냠냠!</div>
        </div>
      )}

      {/* 토스트 */}
      {feedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-2.5 rounded-full text-sm font-medium z-[60] animate-bounce">{feedToast}</div>
      )}
      {evolutionToast && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white px-5 py-2.5 rounded-full text-sm font-medium z-[60] animate-bounce">{evolutionToast}</div>
      )}

      {/* 카카오톡 브라우저 차단 */}
      {typeof navigator !== 'undefined' && /KAKAOTALK/i.test(navigator.userAgent) && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">🌐</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">기본 브라우저에서 열어주세요</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">카카오톡 브라우저에서는 알림 등<br />일부 기능이 제한됩니다.</p>
          {/iPhone|iPad/i.test(navigator.userAgent) ? (
            <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs"><p className="text-xs text-gray-500 leading-relaxed">우측 하단 <strong>공유(↗) 아이콘</strong> 탭<br />→ <strong>Safari로 열기</strong> 선택</p></div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs"><p className="text-xs text-gray-500 leading-relaxed">우측 하단 <strong>⋮</strong> 메뉴 탭<br />→ <strong>다른 브라우저로 열기</strong> 선택</p></div>
          )}
        </div>
      )}

      {/* 상단 바 */}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between relative z-10">
        <div />
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      {/* 걷는 캐릭터 */}
      <WalkingCharacter
        ref={walkingCharRef}
        animalType={character.animalType}
        characterSize={characterSize}
        isPixelArt={PIXEL_ART_ANIMALS.includes(character.animalType)}
        emoji={emoji}
        stage={displayStage}
      />

      {/* 캐릭터 정보 */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4 relative z-10">
        <h1 className="text-2xl font-bold text-gray-800">{character.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{animalName}</p>

        <div className="mt-1">
  <span className="text-xs bg-orange-100 text-orange-600 px-2.5 py-0.5 rounded-full font-bold">
    {(character.totalXp ?? character.xp ?? 0).toLocaleString()} XP
  </span>
</div>
        
        {character.activeTrait && (
          <div className="mt-3 bg-white/80 backdrop-blur rounded-xl px-4 py-2 border border-orange-100 shadow-sm">
            <p className="text-sm text-gray-700 font-medium">{getTraitDisplay(character.activeTrait)}</p>
          </div>
        )}

        {((character.totalLikes ?? 0) > 0 || (character.totalFeeds ?? 0) > 0) && (
          <div className="mt-3 flex items-center gap-3">
            {(character.totalLikes ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-pink-50 rounded-full px-3 py-1">
                <span className="text-sm">❤️</span>
                <span className="text-xs font-bold text-pink-400">{(character.totalLikes ?? 0).toLocaleString()}</span>
              </div>
            )}
            {(character.totalFeeds ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1">
                <span className="text-sm">🍖</span>
                <span className="text-xs font-bold text-amber-400">{(character.totalFeeds ?? 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

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
      
      {/* ─── 방명록 ─── */}
      <div className="mx-4 mt-6 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-700">📝 방명록</h2>
          <span className="text-xs text-gray-400">{guestbookEntries.length}개</span>
        </div>

        {guestbookEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-400">아직 방명록이 없어요</p>
            <p className="text-xs text-gray-300 mt-1">다른 사람의 프로필에서 방명록을 남기면<br />여기에 표시됩니다!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {guestbookEntries.map((entry: any) => {
              const writerEmoji = ANIMAL_EMOJI[entry.writerAnimal] || '🐾';
              const timeAgo = (() => {
                const diff = Date.now() - new Date(entry.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return '방금';
                if (mins < 60) return `${mins}분 전`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours}시간 전`;
                const days = Math.floor(hours / 24);
                return `${days}일 전`;
              })();

              return (
                <div key={entry._id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{writerEmoji}</span>
                    <span className="text-sm font-bold text-gray-700">{entry.writerName}</span>
                    <span className="text-xs text-gray-300 ml-auto">{timeAgo}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{entry.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── FAB 메뉴 ─── */}
      <div className="fixed bottom-24 right-4 z-50">
        {menuOpen && (
          <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-2">
            <button onClick={handlePushSetup} disabled={pushStatus === 'loading'} className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 ${pushStatus === 'denied' ? 'text-red-400' : 'text-gray-700'}`}>
              {pushStatus === 'granted' ? '✅ 알림 설정됨' : pushStatus === 'loading' ? '⏳ 설정 중...' : pushStatus === 'denied' ? '🔕 알림 차단됨' : '🔔 알림 설정'}
            </button>
            <button onClick={() => { setShowHelp(true); setHelpPage(0); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">❓ 도움말</button>
            <button onClick={() => { router.push('/achievements'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">🏆 내 업적</button>
            <button onClick={() => { setShowEvolution(true); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
              {(() => {
                const evo = EVOLUTION_STAGES[evolvedStage - 1];
                return evolvedStage >= 5
                  ? `💎 신화 · ${character.xp.toLocaleString()} XP`
                  : `${evo.badge} ${evo.stage}단계 · ${character.xp.toLocaleString()} XP`;
              })()}
            </button>
            <button onClick={() => { setShowAnimalChange(true); setSelectedNewAnimal(null); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">🔄 캐릭터 변경 ({CHANGE_ANIMAL_COST} XP)</button>
            <button onClick={() => { setShowShareMenu(true); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">📢 공유하기</button>
            <button onClick={() => { setShowDelete(true); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-50">🗑️ 캐릭터 삭제</button>
          </div>
        )}
        <button
          onClick={() => { setMenuOpen(!menuOpen); setShowDelete(false); setShowHelp(false); }}
          className={`w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center text-2xl transition-transform duration-300 hover:bg-orange-600 active:scale-95 ${menuOpen ? 'rotate-45' : ''}`}
        >
          +
        </button>
      </div>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}

      {/* ─── 모달들 ─── */}
      {showHelp && <HelpCards onClose={() => setShowHelp(false)} />}

      {showEvolution && character && (
        <EvolutionModal
          character={character}
          onClose={() => setShowEvolution(false)}
          onEvolve={async () => {
            if (!token || evolving) return;
            setEvolving(true);
            try {
              const res = await fetch(`${apiUrl}/api/characters/me/evolve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              });
const data = await res.json();
if (res.ok) {
  setCharacter(prev => prev ? {
    ...prev,
    evolvedStage: data.evolvedStage ?? prev.evolvedStage,
    displayStage: null,
  } : prev);
  setEvolutionToast(`✨ ${data.evolvedStage}단계로 진화!`);
                setTimeout(() => setEvolutionToast(''), 3000);
                setShowEvolution(false);
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
          onDisplayStageChange={(stage) => setCharacter(prev => prev ? { ...prev, displayStage: stage } : prev)}
          onDisplaySizeChange={(size) => setCharacter(prev => prev ? { ...prev, displaySize: size } : prev)}
          evolving={evolving}
          getCharacterSize={getCharacterSize}
          apiUrl={apiUrl}
          token={token}
        />
      )}

      {showAnimalChange && (
        <AnimalChangeModal
          currentAnimal={character.animalType}
          xp={character.xp}
          onClose={() => setShowAnimalChange(false)}
          onConfirm={async (animal) => {
            setSelectedNewAnimal(animal);
            await handleAnimalChange();
          }}
          changing={animalChanging}
        />
      )}

      {showDelete && (
        <DeleteModal
          characterName={character.name}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}

      {showShareMenu && (
        <ShareMenu
          onShare={handleShare}
          onClose={() => setShowShareMenu(false)}
          shareLoading={shareLoading}
        />
      )}

      {/* 푸시 프롬프트 */}
      {showPushPrompt && (
        <div className="fixed bottom-28 left-4 right-4 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-800 mb-1">🔔 알림을 받으시겠어요?</p>
          <p className="text-xs text-gray-500 mb-3">배치 미완료, 경기 결과 등을 알려드려요.</p>
          <div className="flex gap-2">
            <button onClick={handlePushPromptDismiss} className="flex-1 py-2 bg-gray-100 rounded-xl text-xs text-gray-500">다음에</button>
            <button onClick={handlePushPromptAccept} className="flex-1 py-2 bg-orange-400 text-white rounded-xl text-xs font-bold">허용하기</button>
          </div>
        </div>
      )}

      {/* 알림 차단 안내 */}
      {showBlockedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-center">
            <div className="text-4xl mb-3">🔕</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">알림이 차단되어 있어요</h2>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">브라우저 설정에서 알림을 허용해주세요.<br />설정 → 사이트 설정 → 알림</p>
            <button onClick={() => setShowBlockedGuide(false)} className="w-full py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium">닫기</button>
          </div>
        </div>
      )}

      {/* 웰컴 모달 */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="text-5xl mb-3">{emoji}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">환영합니다!</h2>
            <p className="text-sm text-gray-500 mb-4">{character.name}의 모험이 시작됩니다!</p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold">시작하기</button>
          </div>
        </div>
      )}

      {/* 공유 카드 (숨김) */}
      <div className="hidden">
        <ShareCard
          ref={shareCardRef}
          characterName={character.name}
          animalType={character.animalType}
          animalName={animalName}
          xp={character.xp}
          characterSize={characterSize}
          traitName={character.activeTrait ? getTraitDisplay(character.activeTrait) || undefined : undefined}
        />
      </div>

      <style jsx global>{`
        @keyframes feedFly0 { 0% { top: 20%; opacity: 1; } 100% { top: 50%; opacity: 0; transform: scale(0.3); } }
        @keyframes feedFly1 { 0% { top: 15%; opacity: 1; } 100% { top: 50%; opacity: 0; transform: scale(0.3); } }
        @keyframes feedFly2 { 0% { top: 25%; opacity: 1; } 100% { top: 50%; opacity: 0; transform: scale(0.3); } }
        @keyframes nomnom { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); } 30% { opacity: 1; transform: translate(-50%, 0) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, -30px) scale(0.8); } }
        @keyframes orbFloat { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(-10px); } }
        @keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes harvestComplete { 0% { opacity: 0; transform: scale(0.5); } 30% { opacity: 1; transform: scale(1.1); } 50% { transform: scale(1); } 100% { opacity: 0; transform: scale(0.8) translateY(-20px); } }
      `}</style>
    </div>
  );
}
