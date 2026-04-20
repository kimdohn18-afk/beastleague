'use client';

import { useState } from 'react';
import { EVOLUTION_STAGES, CHANGE_ANIMAL_COST } from '@/lib/constants';

interface Character {
  _id: string;
  name: string;
  animalType: string;
  xp: number;
  evolvedStage?: number;
  displayStage?: number | null;
  displaySize?: number | null;
  earnedAchievements?: string[];
  teamAchievements?: Array<{ teamId: string; tier: string; count: number }>;
}

interface EvolutionModalProps {
  character: Character;
  onClose: () => void;
  onEvolve: () => Promise<void>;
  onDisplayStageChange: (stage: number | null) => void;
  onDisplaySizeChange: (size: number | null) => void;
  evolving: boolean;
  getCharacterSize: (xp: number) => number;
  apiUrl: string;
  token: string;
}

export default function EvolutionModal({
  character, onClose, onEvolve, onDisplayStageChange, onDisplaySizeChange,
  evolving, getCharacterSize, apiUrl, token,
}: EvolutionModalProps) {
  const evolvedStage = character.evolvedStage ?? 1;
  const displayStage = character.displayStage ?? evolvedStage;
  const earnedCount = (character.earnedAchievements || []).length + (character.teamAchievements || []).length;
  const nextEvo = evolvedStage < 5 ? EVOLUTION_STAGES[evolvedStage] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">⚔️ 진화 & 외형</h2>

        {/* 현재 단계 */}
        <div className="text-center mb-4">
          <span className="text-3xl">{EVOLUTION_STAGES[evolvedStage - 1]?.badge}</span>
          <p className="text-sm font-bold text-gray-700 mt-1">
            {evolvedStage}단계 · {EVOLUTION_STAGES[evolvedStage - 1]?.name}
          </p>
          <p className="text-xs text-gray-400">
            {character.xp.toLocaleString()} XP · 업적 {earnedCount}개
          </p>
        </div>

        {/* 다음 진화 */}
        {nextEvo ? (
          <div className={`${nextEvo.bgColor} border ${nextEvo.borderColor} rounded-xl p-4 mb-4`}>
            <p className="text-sm font-bold text-gray-700 mb-2">
              다음: {nextEvo.badge} {nextEvo.stage}단계 · {nextEvo.name}
            </p>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>XP {nextEvo.xpCost.toLocaleString()} 필요</span>
                <span>{character.xp >= nextEvo.xpCost ? '✅' : `${character.xp.toLocaleString()} / ${nextEvo.xpCost.toLocaleString()}`}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (character.xp / nextEvo.xpCost) * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span>업적 {nextEvo.requiredAchievements}개 필요</span>
                <span>{earnedCount >= nextEvo.requiredAchievements ? '✅' : `${earnedCount} / ${nextEvo.requiredAchievements}`}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (earnedCount / nextEvo.requiredAchievements) * 100)}%` }} />
              </div>
            </div>
            <button
              onClick={onEvolve}
              disabled={evolving || character.xp < nextEvo.xpCost || earnedCount < nextEvo.requiredAchievements}
              className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                character.xp >= nextEvo.xpCost && earnedCount >= nextEvo.requiredAchievements
                  ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {evolving ? '진화 중...' : `${nextEvo.stage}단계로 진화!`}
            </button>
          </div>
        ) : (
          <div className="text-center mb-4 p-3 bg-gradient-to-r from-purple-50 to-cyan-50 rounded-xl border border-purple-100">
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
              onDisplaySizeChange(val === getCharacterSize(character.xp) ? null : val);
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
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>60px</span>
            <span>{getCharacterSize(character.xp)}px</span>
          </div>
        </div>

        {/* 외형 단계 선택 */}
        {evolvedStage > 1 && (
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-sm font-bold text-gray-700 mb-2">외형 단계 선택</p>
            <div className="flex gap-2 flex-wrap">
              {EVOLUTION_STAGES.filter(e => e.stage <= evolvedStage).map(evo => (
                <button
                  key={evo.stage}
                  onClick={async () => {
                    const value = evo.stage === evolvedStage ? null : evo.stage;
                    onDisplayStageChange(value);
                    try {
                      await fetch(`${apiUrl}/api/characters/me/display`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ displayStage: value }),
                      });
                    } catch {}
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    displayStage === evo.stage
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {evo.badge} {evo.stage}단계
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
