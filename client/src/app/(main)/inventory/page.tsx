'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ItemEffect {
  stat?: string;
  value: number;
  xpBonus?: number;
}

interface InvItem {
  _id: string;
  templateId: string;
  name: string;
  slot: string;
  rarity: string;
  icon: string;
  enhanceLevel: number;
  currentEffect: ItemEffect;
  equipped: boolean;
}

interface EnhanceInfo {
  currentLevel: number;
  cost: number;
  successRate: number;
  maxLevel: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-gray-200 bg-white',
  rare: 'border-blue-300 bg-blue-50',
  epic: 'border-purple-300 bg-purple-50',
  legendary: 'border-yellow-400 bg-yellow-50',
};

const RARITY_BADGE: Record<string, string> = {
  common: 'bg-gray-100 text-gray-500',
  rare: 'bg-blue-100 text-blue-600',
  epic: 'bg-purple-100 text-purple-600',
  legendary: 'bg-yellow-100 text-yellow-700',
};

const RARITY_NAMES: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
};

const SLOT_NAMES: Record<string, string> = {
  bat: '배트', glove: '글러브', shoes: '신발', helmet: '헬멧', accessory: '악세서리',
};

const STAT_NAMES: Record<string, string> = {
  power: '파워', agility: '민첩', skill: '기술', stamina: '체력', mind: '정신',
};

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [equipped, setEquipped] = useState<InvItem[]>([]);
  const [unequipped, setUnequipped] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InvItem | null>(null);
  const [enhanceInfo, setEnhanceInfo] = useState<EnhanceInfo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'equipped' | 'bag'>('equipped');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (token) fetchInventory();
  }, [token, status]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  async function fetchInventory() {
    try {
      const res = await fetch(`${apiUrl}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setEquipped(data.equipped);
        setUnequipped(data.unequipped);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleEquip(itemId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/inventory/${itemId}/equip`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('장착 완료!');
        setSelectedItem(null);
        await fetchInventory();
      } else {
        const data = await res.json();
        showToast(data.error || '장착 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setActionLoading(false); }
  }

  async function handleUnequip(itemId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/inventory/${itemId}/unequip`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('해제 완료!');
        setSelectedItem(null);
        await fetchInventory();
      } else {
        const data = await res.json();
        showToast(data.error || '해제 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setActionLoading(false); }
  }

  async function handleEnhance(itemId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/inventory/${itemId}/enhance`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        if (data.enhanced) {
          showToast(`✨ 강화 성공! +${data.newLevel} (-${data.cost} XP)`);
        } else {
          showToast(`💔 강화 실패... (-${data.cost} XP)`);
        }
        setSelectedItem(null);
        setEnhanceInfo(null);
        await fetchInventory();
      } else {
        showToast(data.error || '강화 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setActionLoading(false); }
  }

  async function handleDisassemble(itemId: string, itemName: string) {
    if (!confirm(`${itemName}을(를) 분해하시겠습니까? XP로 변환됩니다.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/inventory/${itemId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setSelectedItem(null);
        await fetchInventory();
      } else {
        showToast(data.error || '분해 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setActionLoading(false); }
  }

  async function openItemDetail(item: InvItem) {
    setSelectedItem(item);
    try {
      const res = await fetch(`${apiUrl}/api/inventory/${item._id}/enhance-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEnhanceInfo(await res.json());
    } catch { /* ignore */ }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allItems = tab === 'equipped' ? equipped : unequipped;

  // 장착 슬롯 표시
  const equippedBySlot: Record<string, InvItem | null> = {
    bat: null, glove: null, shoes: null, helmet: null, accessory: null,
  };
  equipped.forEach(item => { equippedBySlot[item.slot] = item; });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">{toast}</div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-3">
        <h1 className="text-lg font-bold text-gray-900">🎒 인벤토리</h1>
        <p className="text-xs text-gray-400 mt-1">아이템 {equipped.length + unequipped.length}개 보유</p>
      </div>

      {/* 장착 슬롯 미리보기 */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100">
          <p className="text-xs font-bold text-gray-500 mb-2">장착 중</p>
          <div className="flex gap-2">
            {Object.entries(equippedBySlot).map(([slot, item]) => (
              <div key={slot} className={`flex-1 rounded-xl p-2 text-center border ${item ? RARITY_COLORS[item.rarity] : 'border-dashed border-gray-200 bg-gray-50'}`}>
                <div className="text-lg">{item ? item.icon : '➕'}</div>
                <p className="text-[9px] text-gray-400 mt-0.5">{SLOT_NAMES[slot]}</p>
                {item && <p className="text-[9px] font-bold text-orange-500">+{item.enhanceLevel}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTab('equipped')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'equipped' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>
            장착 ({equipped.length})
          </button>
          <button onClick={() => setTab('bag')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'bag' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>
            가방 ({unequipped.length})
          </button>
        </div>
      </div>

      {/* 아이템 목록 */}
      <div className="px-4 pt-3 space-y-2">
        {allItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-sm text-gray-400">{tab === 'equipped' ? '장착 중인 아이템이 없습니다' : '가방이 비어있습니다'}</p>
            <p className="text-xs text-gray-300 mt-1">경기 뛰기에서 아이템을 획득하세요!</p>
          </div>
        ) : (
          allItems.map(item => (
            <div
              key={item._id}
              onClick={() => openItemDetail(item)}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer active:scale-[0.98] transition-all ${RARITY_COLORS[item.rarity]}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {item.name} {item.enhanceLevel > 0 ? `+${item.enhanceLevel}` : ''}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${RARITY_BADGE[item.rarity]}`}>
                    {RARITY_NAMES[item.rarity]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {SLOT_NAMES[item.slot]} · {STAT_NAMES[item.currentEffect?.stat || ''] || item.currentEffect?.stat} +{item.currentEffect?.value || 0}
                  {item.currentEffect?.xpBonus ? ` · XP +${item.currentEffect.xpBonus}%` : ''}
                </p>
              </div>
              <span className="text-gray-300 text-xs">›</span>
            </div>
          ))
        )}
      </div>

      {/* 아이템 상세 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => { setSelectedItem(null); setEnhanceInfo(null); }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{selectedItem.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedItem.name} {selectedItem.enhanceLevel > 0 ? `+${selectedItem.enhanceLevel}` : ''}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RARITY_BADGE[selectedItem.rarity]}`}>
                    {RARITY_NAMES[selectedItem.rarity]}
                  </span>
                  <span className="text-xs text-gray-400">{SLOT_NAMES[selectedItem.slot]}</span>
                </div>
              </div>
            </div>

            {/* 효과 */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">효과</p>
              <p className="text-sm font-bold text-gray-700">
                {STAT_NAMES[selectedItem.currentEffect?.stat || ''] || selectedItem.currentEffect?.stat} +{selectedItem.currentEffect?.value || 0}
                {selectedItem.currentEffect?.xpBonus ? ` · XP 보너스 +${selectedItem.currentEffect.xpBonus}%` : ''}
              </p>
            </div>

            {/* 강화 정보 */}
            {enhanceInfo && !enhanceInfo.maxLevel && (
              <div className="bg-orange-50 rounded-xl p-3 mb-4 border border-orange-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">강화 비용</span>
                  <span className="font-bold text-orange-600">{enhanceInfo.cost} XP</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">성공 확률</span>
                  <span className="font-bold text-orange-600">{enhanceInfo.successRate}%</span>
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="space-y-2">
              {selectedItem.equipped ? (
                <button onClick={() => handleUnequip(selectedItem._id)} disabled={actionLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 disabled:opacity-50">
                  장착 해제
                </button>
              ) : (
                <button onClick={() => handleEquip(selectedItem._id)} disabled={actionLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-orange-400 text-white disabled:opacity-50">
                  장착하기
                </button>
              )}

              {enhanceInfo && !enhanceInfo.maxLevel && (
                <button onClick={() => handleEnhance(selectedItem._id)} disabled={actionLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-indigo-500 text-white disabled:opacity-50">
                  ✨ 강화하기 ({enhanceInfo.cost} XP · {enhanceInfo.successRate}%)
                </button>
              )}

              {enhanceInfo?.maxLevel && (
                <div className="w-full py-3 rounded-xl text-sm font-bold bg-yellow-100 text-yellow-700 text-center">
                  ⭐ 최대 강화 달성!
                </div>
              )}

              <button onClick={() => handleDisassemble(selectedItem._id, selectedItem.name)} disabled={actionLoading}
                className="w-full py-3 rounded-xl text-sm font-bold bg-red-50 text-red-400 disabled:opacity-50">
                🔨 분해 (XP 획득)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
