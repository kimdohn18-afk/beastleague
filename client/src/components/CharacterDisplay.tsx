'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { getCharacterImage, getCharacterStage } from '@/config/characters';
import type { AnimalType } from '@/config/characters';

interface CharacterDisplayProps {
  animal: AnimalType;
  level: number;
  className?: string;
  animated?: boolean;
}

export default function CharacterDisplay({
  animal,
  level,
  className = '',
  animated = true,
}: CharacterDisplayProps) {
  const imagePath = getCharacterImage(animal, level);
  const stage = getCharacterStage(animal, level);

  const ImageComponent = animated ? motion.div : 'div';

  return (
    <ImageComponent
      className={`relative ${className}`}
      initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
      animate={animated ? { scale: 1, opacity: 1 } : undefined}
      transition={animated ? { duration: 0.5, ease: 'easeOut' } : undefined}
    >
      <Image
        src={imagePath}
        alt={`${animal} level ${level}`}
        width={200}
        height={200}
        className="w-full h-auto"
        style={{
          transform: `scale(${stage.scale})`,
          transition: 'transform 0.3s ease',
        }}
        priority
      />
      
      {/* 레벨 표시 */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
        Lv. {level}
      </div>
    </ImageComponent>
  );
}
