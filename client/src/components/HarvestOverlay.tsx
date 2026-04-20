'use client';

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

interface HarvestOverlayProps {
  xpOrbs: XpOrb[];
  totalHarvestXp: number;
  harvestToast: string;
  harvestComplete: boolean;
  eatingOrbId: number | null;
  onOrbClick: (id: number) => void;
}

export default function HarvestOverlay({
  xpOrbs, totalHarvestXp, harvestToast, harvestComplete, eatingOrbId, onOrbClick
}: HarvestOverlayProps) {
  return (
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

      {harvestToast && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 bg-black/70 text-white px-5 py-2 rounded-full text-sm font-bold z-[35] animate-bounce">
          {harvestToast}
        </div>
      )}

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

      {xpOrbs.map(orb => (
        <button
          key={orb.id}
          onClick={() => onOrbClick(orb.id)}
          disabled={orb.eaten || eatingOrbId !== null}
          className={`fixed z-[30] transition-all duration-500 ${
            orb.eaten ? 'scale-0 opacity-0'
              : eatingOrbId === orb.id ? 'scale-150 opacity-50'
              : 'hover:scale-110 active:scale-95'
          }`}
          style={{
            left: `${orb.x}px`,
            top: `${orb.y}px`,
            transform: 'translate(-50%, -50%)',
            animation: orb.eaten ? 'none' : 'orbFloat 3s ease-in-out infinite',
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

      <div className="fixed bottom-28 left-0 right-0 text-center z-[35] pointer-events-none">
        <p className="text-gray-400 text-xs">
          남은 구슬: {xpOrbs.filter(o => !o.eaten).length} / {xpOrbs.length}
        </p>
      </div>
    </>
  );
}
