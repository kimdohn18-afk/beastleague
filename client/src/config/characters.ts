export type AnimalType = 'dragon' | 'cat' | 'dog' | 'bear' | 'rabbit';

interface CharacterStage {
  name: string;
  scale: number;
}

const STAGES: Record<AnimalType, CharacterStage[]> = {
  dragon: [
    { name: 'baby', scale: 0.8 },
    { name: 'teen', scale: 1.0 },
    { name: 'adult', scale: 1.2 },
  ],
  cat: [
    { name: 'baby', scale: 0.8 },
    { name: 'teen', scale: 1.0 },
    { name: 'adult', scale: 1.2 },
  ],
  dog: [
    { name: 'baby', scale: 0.8 },
    { name: 'teen', scale: 1.0 },
    { name: 'adult', scale: 1.2 },
  ],
  bear: [
    { name: 'baby', scale: 0.8 },
    { name: 'teen', scale: 1.0 },
    { name: 'adult', scale: 1.2 },
  ],
  rabbit: [
    { name: 'baby', scale: 0.8 },
    { name: 'teen', scale: 1.0 },
    { name: 'adult', scale: 1.2 },
  ],
};

export function getCharacterStage(animal: AnimalType, level: number): CharacterStage {
  const stages = STAGES[animal] || STAGES.dragon;
  if (level >= 20) return stages[2];
  if (level >= 10) return stages[1];
  return stages[0];
}

export function getCharacterImage(animal: AnimalType, level: number): string {
  const stage = getCharacterStage(animal, level);
  return `/characters/${animal}_${stage.name}.png`;
}
