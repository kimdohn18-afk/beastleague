export default function StatBadge({ value }: { value: number }) {
  const isPos = value > 0;
  const color = isPos ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-textSecondary';
  const sign  = isPos ? '+' : '';
  return (
    <span className={`text-xs font-bold ${color}`}>
      {sign}{value.toFixed(1)}
    </span>
  );
}
