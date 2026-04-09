'use client';

import { requestFcmToken } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

interface Character {
  _id: string;
  name: string;
  animalType: string;
  xp: number;
  userId: string;
}

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

function getEmojiPx(xp: number): number {
  const minPx = 60;
  const maxPx = 220;
  if (xp <= 0) return minPx;
  const progress = Math.log(1 + xp) / Math.log(1 + 10000);
  const clamped = Math.min(progress, 1.3);
  return Math.round(minPx + (maxPx - minPx) * Math.min(clamped, 1.0) + Math.max(0, clamped - 1.0) * 20);
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
      '랭킹에서 다른 유저와',
      '크기를 비교해보세요.',
      '',
      '내 배치 탭에서 경기별 기록과',
      'XP 내역을 확인할 수 있어요.',
    ],
  },
];

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPage, setHelpPage] = useState(0);
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBlockedGuide, setShowBlockedGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') setPushStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const checkSub = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/push/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPushStatus(data.subscribed ? 'granted' : 'idle');
        }
      } catch (e) {
        console.error('[Push] Status check failed:', e);
      }
    };
    checkSub();
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

  const fetchCharacter = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) { router.push('/character'); return; }
        throw new Error('Failed to fetch character');
      }
      const data = await res.json();
      setCharacter(data);

      const welcomeKey = `welcome-shown-${data._id}`;
      if (!localStorage.getItem(welcomeKey)) {
        setShowWelcome(true);
        localStorage.setItem(welcomeKey, 'true');
      }
    } catch (error) {
      console.error('Error fetching character:', error);
    } finally {
      setLoading(false);
    }
  };

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
        const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
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

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 50 && helpPage > 0) setHelpPage(helpPage - 1);
    if (diff < -50 && helpPage < HELP_CARDS.length - 1) setHelpPage(helpPage + 1);
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
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const emojiPx = getEmojiPx(character.xp);
  const initialPx = getEmojiPx(0);
  const card = HELP_CARDS[helpPage];

return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
{typeof navigator !== 'undefined' && /KAKAOTALK/i.test(navigator.userAgent) && (
  <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
    <div className="text-5xl mb-4">🌐</div>
    <h2 className="text-lg font-bold text-gray-800 mb-2">기본 브라우저에서 열어주세요</h2>
    <p className="text-sm text-gray-500 mb-6 leading-relaxed">
      카카오톡 브라우저에서는 알림 등<br />
      일부 기능이 제한됩니다.
    </p>
    {/iPhone|iPad/i.test(navigator.userAgent) ? (
      <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs">
        <p className="text-xs text-gray-500 leading-relaxed">
          우측 하단 <strong>공유(↗) 아이콘</strong> 탭<br />
          → <strong>Safari로 열기</strong> 선택
        </p>
      </div>
    ) : (
      <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs">
        <p className="text-xs text-gray-500 leading-relaxed">
          우측 하단 <strong>⋮</strong> 메뉴 탭<br />
          → <strong>다른 브라우저로 열기</strong> 선택
        </p>
      </div>
    )}
  </div>
)}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <div />
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      <div className="flex flex-col items-center justify-center" style={{ minHeight: '65vh' }}>
        <div
          className="leading-none select-none transition-all duration-700 ease-out"
          style={{ fontSize: `${emojiPx}px`, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))' }}
        >
          {emoji}
        </div>
        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">{character.name}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {animalName} · {character.xp.toLocaleString()} XP
          </p>
        </div>
      </div>

      <div className="fixed bottom-24 right-4 z-50">
        {menuOpen && (
          <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-2">
            <button onClick={handlePushSetup} disabled={pushStatus === 'loading'} className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 ${pushStatus === 'denied' ? 'text-red-400' : 'text-gray-700'}`}>
              {pushStatus === 'granted' ? '✅ 알림 설정됨' : pushStatus === 'loading' ? '⏳ 설정 중...' : pushStatus === 'denied' ? '🔕 알림 차단됨' : '🔔 알림 설정'}
            </button>
            <button onClick={() => { setShowHelp(true); setHelpPage(0); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
              ❓ 도움말
            </button>
            <button onClick={() => { setShowCompare(true); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
              📊 초기와 비교
            </button>
            <button onClick={() => { router.push('/my-placements'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
              📋 내 배치
            </button>
            <button onClick={() => { router.push('/match'); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
              ⚾ 오늘의 경기
            </button>
            <button onClick={() => { setShowDelete(true); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-50">
              🗑️ 캐릭터 삭제
            </button>
          </div>
        )}
        <button
          onClick={() => { setMenuOpen(!menuOpen); setShowCompare(false); setShowDelete(false); setShowHelp(false); }}
          className={`w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center text-2xl transition-transform duration-300 hover:bg-orange-600 active:scale-95 ${menuOpen ? 'rotate-45' : ''}`}
        >
          +
        </button>
      </div>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="px-6 pt-8 pb-4 text-center min-h-[320px] flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">{card.icon}</div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">{card.title}</h3>
              <div className="space-y-0.5">
                {card.lines.map((line, i) =>
                  line === '' ? <div key={i} className="h-3" /> : <p key={i} className="text-sm text-gray-500 leading-relaxed">{line}</p>
                )}
              </div>
            </div>
            <div className="px-6 pb-6">
              <div className="flex justify-center gap-1.5 mb-4">
                {HELP_CARDS.map((_, i) => (
                  <button key={i} onClick={() => setHelpPage(i)} className={`w-2 h-2 rounded-full transition-all ${i === helpPage ? 'bg-orange-400 w-4' : 'bg-gray-200'}`} />
                ))}
              </div>
              <div className="flex gap-3">
                {helpPage > 0 ? (
                  <button onClick={() => setHelpPage(helpPage - 1)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">이전</button>
                ) : <div className="flex-1" />}
                {helpPage < HELP_CARDS.length - 1 ? (
                  <button onClick={() => setHelpPage(helpPage + 1)} className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500">다음</button>
                ) : (
                  <button onClick={() => setShowHelp(false)} className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500">닫기</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-6 text-center">초기와 비교</h2>
            <div className="flex items-end justify-center gap-10 mb-8">
              <div className="text-center">
                <div className="leading-none mx-auto grayscale opacity-40" style={{ fontSize: `${initialPx}px` }}>{emoji}</div>
                <p className="text-xs text-gray-400 mt-3">처음</p>
                <p className="text-sm font-bold text-gray-400">0 XP</p>
              </div>
              <div className="text-2xl text-orange-400 mb-6">→</div>
              <div className="text-center">
                <div className="leading-none mx-auto" style={{ fontSize: `${Math.min(emojiPx, 100)}px` }}>{emoji}</div>
                <p className="text-xs text-orange-500 font-medium mt-3">현재</p>
                <p className="text-sm font-bold text-gray-800">{character.xp.toLocaleString()} XP</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">획득 XP</span>
                <span className="font-bold text-orange-500">+{character.xp.toLocaleString()} XP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">캐릭터 크기</span>
                <span className="font-bold text-gray-800">
                  {emojiPx <= 60 ? '기본' : emojiPx <= 100 ? '성장 중' : emojiPx <= 160 ? '많이 성장' : '거대'}
                </span>
              </div>
            </div>
            <button onClick={() => setShowCompare(false)} className="w-full mt-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">닫기</button>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">{emoji}</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">캐릭터를 삭제할까요?</h2>
            <p className="text-sm text-gray-400 mb-6">
              <strong>{character.name}</strong>과(와) 모든 배치 기록이 삭제됩니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">취소</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowBlockedGuide(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl text-center mb-3">🔕</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">알림이 차단되어 있어요</h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              브라우저 설정에서 직접 변경해야 합니다.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-3">
              <p className="text-sm font-bold text-gray-700 mb-2">📱 모바일 (Chrome)</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                주소창 왼쪽 🔒 아이콘 탭<br />
                → 권한 또는 사이트 설정<br />
                → 알림 → 허용으로 변경<br />
                → 페이지 새로고침
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-gray-700 mb-2">💻 PC (Chrome)</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                주소창 왼쪽 🔒 아이콘 클릭<br />
                → 사이트 설정<br />
                → 알림 → 허용으로 변경<br />
                → 페이지 새로고침
              </p>
            </div>
            <button onClick={() => setShowBlockedGuide(false)} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">
              닫기
            </button>
          </div>
        </div>
      )}

      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowWelcome(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">캐릭터가 탄생했어요!</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                매일 KBO 경기에 배치하면<br />
                실제 선수 성적에 따라 XP를 얻고<br />
                캐릭터가 성장합니다!
              </p>
              <div className="bg-orange-50 rounded-xl p-4 mb-4 text-left">
                <p className="text-sm font-bold text-orange-600 mb-2">🔔 알림 설정 추천!</p>
                <p className="text-xs text-orange-500 leading-relaxed">
                  알림을 켜면 배치를 잊지 않도록<br />
                  매일 경기 전에 알려드려요.<br />
                  오른쪽 하단 + 버튼 → 알림 설정
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-bold text-gray-700 mb-2">❓ 도움말</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  배치 방법, XP 규칙 등 자세한 내용은<br />
                  + 버튼 → 도움말에서 확인하세요.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setShowWelcome(false)} className="w-full py-3 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500">
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
