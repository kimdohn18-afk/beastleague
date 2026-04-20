'use client';

import { useState } from 'react';
import { ANIMAL_EMOJI, ANIMAL_NAMES, PIXEL_ART_ANIMALS, CHANGE_ANIMAL_COST } from '@/lib/constants';

interface AnimalChangeModalProps {
  currentAnimal: string;
  xp: number;
  onClose: () => void;
  onConfirm: (animal: string) => Promise<void>;
  changing: boolean;
}

export default function AnimalChangeModal({
  currentAnimal, xp, onClose, onConfirm, changing,
}: AnimalChangeModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const animals = Object.keys(ANIMAL_EMOJI).filter(a => a !== currentAnimal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">🔄 캐릭터 변경</h2>
        <p className="text-xs text-gray-400 text-center mb-4">
          비용: {CHANGE_ANIMAL_COST} XP (보유: {xp.toLocaleString()} XP)
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {animals.map(animal => (
            <button
              key={animal}
              onClick={() => setSelected(animal)}
              className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                selected === animal
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <span className="text-2xl">{ANIMAL_EMOJI[animal]}</span>
              <span className="text-[10px] text-gray-500 mt-1">
                {ANIMAL_NAMES[animal] || animal}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected || changing || xp < CHANGE_ANIMAL_COST}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all mb-2 ${
            selected && !changing && xp >= CHANGE_ANIMAL_COST
              ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {changing ? '변경 중...' : xp < CHANGE_ANIMAL_COST ? 'XP 부족' : '변경하기'}
        </button>

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
