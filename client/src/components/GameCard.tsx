interface GameCardProps {
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  onClick?: () => void;
  selected?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  live: '진행 중',
  finished: '종료',
  cancelled: '취소',
  postponed: '연기',
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'text-textSecondary',
  live: 'text-green-400',
  finished: 'text-textSecondary',
  cancelled: 'text-red-400',
  postponed: 'text-yellow-400',
};

export default function GameCard({ homeTeam, awayTeam, status, homeScore, awayScore, onClick, selected }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border transition-all text-left
        ${selected
          ? 'border-primary bg-primary/10'
          : 'border-white/10 bg-surfaceLight hover:border-white/20'}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-textPrimary">{awayTeam}</span>
        {status === 'finished' || status === 'live'
          ? <span className="text-lg font-black">{awayScore ?? 0} : {homeScore ?? 0}</span>
          : <span className="text-textSecondary text-sm">VS</span>}
        <span className="font-semibold text-textPrimary">{homeTeam}</span>
      </div>
      <p className={`text-xs mt-1 text-center ${STATUS_COLOR[status] ?? 'text-textSecondary'}`}>
        {STATUS_LABEL[status] ?? status}
      </p>
    </button>
  );
}
