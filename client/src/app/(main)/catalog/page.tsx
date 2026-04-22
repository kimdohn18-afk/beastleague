'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ItemEffect { stat: string; value: number; }
interface CatalogItem {
  templateId: string; name: string; description: string; slot: string; rarity: string;
  icon: string; effects: ItemEffect[]; xpBonus: number; special: string | null;
  setId: string | null; owned: boolean;
}
interface SetInfo {
  setId: string; name: string;
  bonuses: { count: number; description: string }[];
  items: { templateId: string; name: string; icon: string; slot: string; rarity: string; owned: boolean }[];
}

const RARITY_COLORS: Record<string, string> = { common: 'border-gray-200 bg-white', rare: 'border-blue-300 bg-blue-50', epic: 'border-purple-300 bg-purple-50', legendary: 'border-yellow-400 bg-yellow-50' };
const RARITY_BADGE: Record<string, string> = { common: 'bg-gray-100 text-gray-500', rare: 'bg-blue-100 text-blue-600', epic: 'bg-purple-100 text-purple-600', legendary: 'bg-yellow-100 text-yellow-700' };
const RARITY_NAMES: Record<string, string> = { common: '일반', rare: '레어', epic: '에픽', legendary: '전설' };
const SLOT_NAMES: Record<string, string> = { bat: '배트', glove: '글러브', shoes: '신발', helmet: '헬멧', accessory: '악세서리' };
const STAT_NAMES: Record<string, string> = { power: '파워', agility: '민첩', skill: '기술', stamina: '체력', mind: '정신' };
const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

type FilterSlot = 'all' | 'bat' | 'glove' | 'shoes' | 'helmet' | 'accessory';
type FilterRarity = 'all' | 'common' | 'rare' | 'epic' | 'legendary';
type Tab = 'items' | 'sets';

export default function CatalogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [completion, setCompletion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('items');
  const [filterSlot, setFilterSlot] = useState<FilterSlot>('all');
  const [filterRarity, setFilterRarity] = useState<FilterRarity>('all');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (token) fetchCatalog();
  }, [token, status]);

  async function fetchCatalog() {
    try {
      const res = await fetch(`${apiUrl}/api/inventory/catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog);
        setSets(data.sets);
        setTotalCount(data.totalCount);
        setOwnedCount(data.ownedCount);
        setCompletion(data.completion);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const filtered = catalog
    .filter(i => filterSlot === 'all' || i.slot === filterSlot)
    .filter(i => filterRarity === 'all' || i.rarity === filterRarity)
    .sort((a, b) => {
      const slotOrder = ['bat', 'glove', 'shoes', 'helmet', 'accessory'];
      const slotDiff = slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
      if (slotDiff !== 0) return slotDiff;
      return (RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0);
    });

  if (loading || status === 'loading') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="text-gray-400 text-sm">← 뒤로</button>
          <h1 className="text-lg font-bold text-gray-900">📖 아이템 도감</h1>
        </div>
        {/* 수집률 */}
        <div className="mt-3 bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">수집률</span>
            <span className="text-sm font-bold text-orange-500">{ownedCount} / {totalCount} ({completion}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-orange-400 h-2 rounded-full transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mt-3">
          <button onClick={() => setTab('items')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'items' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>
            아이템 ({totalCount})
          </button>
          <button onClick={() => setTab('sets')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'sets' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>
            세트 ({sets.length})
          </button>
        </div>
      </div>

      {/* ===== 아이템 탭 ===== */}
      {tab === 'items' && (
        <div className="p-4">
          {/* 필터 */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {([['all', '전체'], ['bat', '배트'], ['glove', '글러브'], ['shoes', '신발'], ['helmet', '헬멧'], ['accessory', '악세']] as [FilterSlot, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setFilterSlot(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  filterSlot === val ? 'bg-orange-400 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {([['all', '전체'], ['common', '일반'], ['rare', '레어'], ['epic', '에픽'], ['legendary', '전설']] as [FilterRarity, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setFilterRarity(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  filterRarity === val ? 'bg-orange-400 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>{label}</button>
            ))}
          </div>

          {/* 아이템 그리드 */}
          <div className="grid grid-cols-4 gap-2">
            {filtered.map(item => (
              <div key={item.templateId} onClick={() => setSelectedItem(item)}
                className={`rounded-xl p-2 text-center border-2 cursor-pointer active:scale-95 transition-all ${
                  item.owned ? RARITY_COLORS[item.rarity] : 'border-gray-200 bg-gray-100 opacity-40'
                }`}>
                <div className={`text-2xl ${!item.owned ? 'grayscale' : ''}`}>{item.owned ? item.icon : '❓'}</div>
                <p className="text-[9px] text-gray-500 mt-0.5 truncate">{item.owned ? item.name : '???'}</p>
                <span className={`text-[8px] px-1 py-0.5 rounded-full ${RARITY_BADGE[item.rarity]}`}>
                  {RARITY_NAMES[item.rarity]}
                </span>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">해당 조건의 아이템이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ===== 세트 탭 ===== */}
      {tab === 'sets' && (
        <div className="p-4 space-y-3">
          {sets.map(s => {
            const ownedInSet = s.items.filter(i => i.owned).length;
            const totalInSet = s.items.length;
            return (
              <div key={s.setId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-700">🔮 {s.name}</span>
                    <span className="text-xs text-gray-400">{ownedInSet}/{totalInSet} 수집</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div className="bg-indigo-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${totalInSet > 0 ? (ownedInSet / totalInSet) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* 세트 아이템 */}
                <div className="px-4 py-2">
                  <div className="flex gap-2 mb-2">
                    {s.items.map(item => (
                      <div key={item.templateId}
                        className={`flex-1 rounded-lg p-1.5 text-center border ${
                          item.owned ? RARITY_COLORS[item.rarity] : 'border-dashed border-gray-200 bg-gray-50 opacity-50'
                        }`}>
                        <div className="text-lg">{item.owned ? item.icon : '❓'}</div>
                        <p className="text-[8px] text-gray-400 truncate">{item.owned ? item.name : '???'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 세트 보너스 */}
                <div className="px-4 pb-3 space-y-1">
                  {s.bonuses.map((b, i) => {
                    const isActive = ownedInSet >= b.count;
                    return (
                      <div key={i} className={`flex items-center gap-2 text-xs ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <span>{isActive ? '✅' : '🔒'}</span>
                        <span className="font-medium">{b.count}세트:</span>
                        <span>{b.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 아이템 상세 모달 ===== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className={`text-5xl mb-2 ${!selectedItem.owned ? 'grayscale opacity-50' : ''}`}>
                {selectedItem.owned ? selectedItem.icon : '❓'}
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                {selectedItem.owned ? selectedItem.name : '???'}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RARITY_BADGE[selectedItem.rarity]}`}>
                  {RARITY_NAMES[selectedItem.rarity]}
                </span>
                <span className="text-xs text-gray-400">{SLOT_NAMES[selectedItem.slot]}</span>
                {selectedItem.setId && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-medium">세트</span>}
              </div>
            </div>

            {selectedItem.owned ? (
              <>
                <p className="text-xs text-gray-400 text-center mb-3">{selectedItem.description}</p>
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-400 mb-1">효과</p>
                  {selectedItem.effects.map((eff, i) => (
                    <p key={i} className="text-sm font-bold text-gray-700">
                      {STAT_NAMES[eff.stat] || eff.stat} +{eff.value}
                    </p>
                  ))}
                  {selectedItem.xpBonus > 0 && (
                    <p className="text-sm font-bold text-orange-500">XP 보너스 +{selectedItem.xpBonus}%</p>
                  )}
                </div>
                {selectedItem.special && (
                  <div className="bg-purple-50 rounded-xl p-3 mb-3">
                    <p className="text-xs text-purple-600 font-bold">✨ 특수 효과: {selectedItem.special}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-3">
                <p className="text-sm text-gray-400">아직 획득하지 못한 아이템입니다</p>
                <p className="text-xs text-gray-300 mt-1">경기 뛰기에서 드롭될 수 있어요!</p>
              </div>
            )}

            <button onClick={() => setSelectedItem(null)}
              className="w-full py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
