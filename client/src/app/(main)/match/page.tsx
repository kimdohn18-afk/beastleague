'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { requestFcmToken } from '@/lib/firebase';
import { sharePlacement } from '@/lib/kakaoShare';
import { ANIMAL_EMOJI, ANIMAL_NAMES, TRAIT_DISPLAY } from '@/lib/constants';

// ──────────── 인터페이스 ────────────

interface Game {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
}

interface Selection {
  gameId: string;
  predictedWinner: string;
  selectedTeam: string;
  selectedOrder: number;
}

interface CharacterInfo {
  name: string;
  animalType: string;
  xp: number;
  activeTrait?: string | null;
}

// ──────────── 유틸 ────────────

function isGameStartedByTime(game: Game): boolean {
  if (game.status === 'finished' || game.status === 'live') return true;
  if (game.status === 'cancelled') return true;
  if (!game.startTime || !game.date) return false;
  try {
    const [hour, minute] = game.startTime.split(':').map(Number);
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentDate = now.toISOString().slice(0, 10);
    if (currentDate === game.date) {
      return currentHour > hour || (currentHour === hour && currentMinute >= minute);
    }
  } catch {}
  return false;
}

// ──────────── 컴포넌트 ────────────

export default function MatchPage() {
  const { data: session } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [placementLocked, setPlacementLocked] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const todayKST = () => {
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    return now.toISOString().slice(0, 10);
  };

  // ──────────── 데이터 로드 ────────────

  useEffect(() => {
    if (!token) return;
    fetchGames();
    fetchMyPlacement();
    fetchCharacterInfo();
  }, [token]);

  async function fetchGames() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/games?date=${todayKST()}`, { headers });
      if (res.ok) setGames(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchMyPlacement() {
    try {
      const res = await fetch(`${apiUrl}/api/placements/today`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSelection({
            gameId: data.gameId,
            predictedWinner: data.predictedWinner || '',
            selectedTeam: data.team,
            selectedOrder: data.battingOrder || 0,
          });
          if (data.status === 'settled') setPlacementLocked(true);
        }
      }
    } catch (e) { console.error(e); }
  }

  async function fetchCharacterInfo() {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCharacterInfo({
          name: data.name,
          animalType: data.animalType,
          xp: data.xp,
          activeTrait: data.activeTrait,
        });
      }
    } catch (e) { console.error(e); }
  }

  // ──────────── 경기 시작 감지 ────────────

  useEffect(() => {
    if (selection && games.length > 0) {
      const placedGame = games.find(g => g.gameId === selection.gameId);
      if (placedGame && isGameStartedByTime(placedGame)) {
        setPlacementLocked(true);
      }
    }
  }, [selection, games]);

  // ──────────── 선택 핸들러 ────────────

  function handleExpand(gameId: string) {
    if (placementLocked) return;
    setExpandedGame(expandedGame === gameId ? null : gameId);
  }

  function handlePrediction(gameId: string, team: string) {
    if (placementLocked) return;
    setSelection((prev) => ({
      gameId,
      predictedWinner: team,
      selectedTeam: prev?.gameId === gameId ? prev.selectedTeam : '',
      selectedOrder: prev?.gameId === gameId ? prev.selectedOrder : 0,
    }));
  }

  function handleBattingOrder(gameId: string, team: string, order: number) {
    if (placementLocked) return;
    setSelection((prev) => ({
      gameId,
      predictedWinner: prev?.gameId === gameId ? prev.predictedWinner : '',
      selectedTeam: team,
      selectedOrder: order,
    }));
  }

  // ──────────── 푸시 알림 ────────────

  async function shouldShowPushPrompt(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    const dismissedDate = localStorage.getItem('push-prompt-dismissed');
    if (dismissedDate === todayKST()) return false;
    if (Notification.permission === 'default') return true;
    try {
      const res = await fetch(`${apiUrl}/api/push/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return !data.subscribed;
      }
    } catch {}
    return false;
  }

  // ──────────── 공유 ────────────

  async function handleShareAccept() {
    if (selection && characterInfo) {
      const game = games.find(g => g.gameId === selection.gameId);
      if (game) {
        const traitInfo = characterInfo.activeTrait
          ? TRAIT_DISPLAY[characterInfo.activeTrait]
          : null;
        sharePlacement({
          characterName: characterInfo.name,
          animalType: characterInfo.animalType,
          xp: characterInfo.xp,
          traitName: traitInfo ? `${traitInfo.emoji} ${traitInfo.name}` : undefined,
          team: selection.selectedTeam,
          battingOrder: selection.selectedOrder,
          predictedWinner: selection.predictedWinner,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          date: todayKST(),
        });
      }
    }
    setShowSharePrompt(false);
    const shouldShow = await shouldShowPushPrompt();
    if (shouldShow) {
      setTimeout(() => setShowPushPrompt(true), 500);
    }
  }

  async function handleShareDismiss() {
    setShowSharePrompt(false);
    const shouldShow = await shouldShowPushPrompt();
    if (shouldShow) {
      setTimeout(() => setShowPushPrompt(true), 500);
    }
  }

  async function handlePushAccept() {
    setPushLoading(true);
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        await<span class="cursor">█</span>
