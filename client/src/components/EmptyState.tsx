export default function EmptyState({ emoji = '📭', title, description }: {
  emoji?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <span className="text-5xl">{emoji}</span>
      <p className="font-semibold text-textPrimary">{title}</p>
      {description && <p className="text-textSecondary text-sm text-center max-w-xs">{description}</p>}
    </div>
  );
}
