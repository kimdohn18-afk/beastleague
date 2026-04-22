import { Schema, model, Document, Types } from 'mongoose';

export interface IMatchPersonalStats {
  atBats: number;       // 타수
  hits: number;         // 안타
  doubles: number;      // 2루타
  homeRuns: number;     // 홈런
  walks: number;        // 볼넷
  stolenBases: number;  // 도루
  runs: number;         // 득점
  errors: number;       // 실책
  mvp: boolean;
}

export interface IMatchResult {
  myScore: number;
  oppScore: number;
  win: boolean;
  personal: IMatchPersonalStats;
}

export interface IStatGain {
  power: number;
  skill: number;
  agility: number;
  stamina: number;
  mind: number;
}

export interface IVirtualMatch extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  date: string;
  matchNumber: number;

  // 시뮬레이션 입력 (경기 시작 시 스냅샷)
  stats: {
    power: number;
    agility: number;
    skill: number;
    stamina: number;
    mind: number;
  };

  // 시간 관리
  status: 'in_progress' | 'completed' | 'claimed';
  startedAt: Date;
  completedAt: Date;      // startedAt + 4시간

  // 결과 (completedAt 이후에만 의미)
  result: IMatchResult;
  statGain: IStatGain;

  // 보상
  xpReward: number;
  itemDropped: boolean;
  droppedItemId: Types.ObjectId | null;

  createdAt: Date;
}

const virtualMatchSchema = new Schema<IVirtualMatch>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId:  { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    date:         { type: String, required: true },
    matchNumber:  { type: Number, required: true },
    stats: {
      power:   { type: Number, default: 1 },
      agility: { type: Number, default: 1 },
      skill:   { type: Number, default: 1 },
      stamina: { type: Number, default: 1 },
      mind:    { type: Number, default: 1 },
    },
    status:       { type: String, enum: ['in_progress', 'completed', 'claimed'], default: 'in_progress' },
    startedAt:    { type: Date, required: true },
    completedAt:  { type: Date, required: true },
    result: {
      myScore:  { type: Number, default: 0 },
      oppScore: { type: Number, default: 0 },
      win:      { type: Boolean, default: false },
      personal: {
        atBats:      { type: Number, default: 0 },
        hits:        { type: Number, default: 0 },
        doubles:     { type: Number, default: 0 },
        homeRuns:    { type: Number, default: 0 },
        walks:       { type: Number, default: 0 },
        stolenBases: { type: Number, default: 0 },
        runs:        { type: Number, default: 0 },
        errors:      { type: Number, default: 0 },
        mvp:         { type: Boolean, default: false },
      },
    },
    statGain: {
      power:   { type: Number, default: 0 },
      skill:   { type: Number, default: 0 },
      agility: { type: Number, default: 0 },
      stamina: { type: Number, default: 0 },
      mind:    { type: Number, default: 0 },
    },
    xpReward:      { type: Number, default: 0 },
    itemDropped:   { type: Boolean, default: false },
    droppedItemId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

virtualMatchSchema.index({ userId: 1, date: 1 });
virtualMatchSchema.index({ userId: 1, status: 1 });

export const VirtualMatch = model<IVirtualMatch>('VirtualMatch', virtualMatchSchema);
