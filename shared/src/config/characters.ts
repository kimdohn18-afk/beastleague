export type AnimalType = 'dragon' | 'cat' | 'dog' | 'bear' | 'rabbit';

export interface CharacterStage {
  stage: 1 | 2 | 3 | 4;
  minLevel: number;
  maxLevel: number;
  imagePath: string;
  scale: number; // 상대적 크기
}

export const CHARACTER_STAGES: Record<AnimalType, CharacterStage[]> = {
  dragon: [
    { stage: 1, minLevel: 1, maxLevel: 5, imagePath: '/characters/dragon/stage1.png', scale: 1.0 },
    { stage: 2, minLevel: 6, maxLevel: 10, imagePath: '/characters/dragon/stage2.png', scale: 1.5 },
    { stage: 3, minLevel: 11, maxLevel: 15, imagePath: '/characters/dragon/stage3.png', scale: 2.0 },
    { stage: 4, minLevel: 16, maxLevel: 20, imagePath: '/characters/dragon/stage4.png', scale: 2.5 },
  ],
  cat: [
    { stage: 1, minLevel: 1, maxLevel: 5, imagePath: '/characters/cat/stage1.png', scale: 1.0 },
    { stage: 2, minLevel: 6, maxLevel: 10, imagePath: '/characters/cat/stage2.png', scale: 1.5 },
    { stage: 3, minLevel: 11, maxLevel: 15, imagePath: '/characters/cat/stage3.png', scale: 2.0 },
    { stage: 4, minLevel: 16, maxLevel: 20, imagePath: '/characters/cat/stage4.png', scale: 2.5 },
  ],
  // dog, bear, rabbit도 동일한 구조
  dog: [],
  bear: [],
  rabbit: [],
};

/**
 * 레벨에 따른 캐릭터 스테이지 가져오기
 */
export function getCharacterStage(animal: AnimalType, level: number): CharacterStage {
  const stages = CHARACTER_STAGES[animal];
  return stages.find(s => level >= s.minLevel && level <= s.maxLevel) || stages[0];
}

/**
 * 캐릭터 이미지 경로 가져오기
 */
export function getCharacterImage(animal: AnimalType, level: number): string {
  return getCharacterStage(animal, level).imagePath;
}
