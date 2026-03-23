'use client';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number; // 0–100
  label?: string;
}

export default function ProgressBar({ value, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full">
      {label && <p className="text-xs text-textSecondary mb-1">{label}</p>}
      <div className="h-2 bg-surfaceLight rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
