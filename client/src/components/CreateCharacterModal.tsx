'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useToast } from './Toast';

const ANIMALS = [
  { type: 'bear',   emoji: '🐻', label: '곰',     desc: '파워형' },
  { type: 'tiger',  emoji: '🐯', label: '호랑이', desc: '밸런스' },
  { type: 'eagle',  emoji: '🦅', label: '독수리', desc: '민첩형' },
  { type: 'wolf',   emoji: '🐺', label: '늑대',   desc: '스킬형' },
  { type: 'dragon', emoji: '🐲', label: '용',     desc: '정신형' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateCharacterModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [animalType, setAnimalType] = useState('bear');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (name.trim().length < 2) { toast('이름은 2자 이상 입력해주세요', 'error'); return; }
    if (name.trim().length > 10) { toast('이름은 10자 이하로 입력해주세요', 'error'); return; }
    setLoading(true);
    try {
      await api.post('/api/characters', { name: name.trim(), animalType });
      toast('캐릭터가 생성되었습니다! 🎉', 'success');
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '생성 실패';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-surfaceLight w-full max-w-lg rounded-t-2xl p-6"
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-5">캐릭터 만들기</h2>

            {/* 이름 */}
            <input
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-textPrimary placeholder-textSecondary outline-none focus:border-primary mb-4"
              placeholder="캐릭터 이름 (2~10자)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
            />

            {/* 동물 선택 */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {ANIMALS.map((a) => (
                <button
                  key={a.type}
                  onClick={() => setAnimalType(a.type)}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all
                    ${animalType === a.type ? 'border-primary bg-primary/10' : 'border-white/10'}`}
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="text-[10px] font-semibold mt-1 text-textPrimary">{a.label}</span>
                  <span className="text-[9px] text-textSecondary">{a.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary font-semibold text-white text-sm disabled:opacity-50"
            >
              {loading ? '생성 중...' : '시작하기'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
