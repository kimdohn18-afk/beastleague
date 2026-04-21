import { Schema, model, Document, Types } from 'mongoose';

export interface IVirtualMatchResult {
  myHits: number;
  myHomeRuns: number;
  myRuns: number;
  oppRuns: number;
  mvp: boolean;
  win: boolean;
}

export interface IVirtualMatch extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  date: string;
  matchNumber: number;        // 1 = 무료, 2 = 예측 보너스
  
  // 시뮬레이션 입력
  stats: {
    power: number;
    agility: number;
    skill: number;
    stamina: number;
    mind: number;
  };
  
  // 결과
  result: IVirtualMatchResult;
  
  // 보상
  itemDropped: boolean;
  droppedItemId: Types.ObjectId | null;
  xpReward: number;
  
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
    result: {
      myHits:     { type: Number, default: 0 },
      myHomeRuns: { type: Number, default: 0 },
      myRuns:     { type: Number, default: 0 },
      oppRuns:    { type: Number, default: 0 },
      mvp:        { type: Boolean, default: false },
      win:        { type: Boolean, default: false },
    },
    itemDropped:   { type: Boolean, default: false },
    droppedItemId: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
    xpReward:      { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

virtualMatchSchema.index({ userId: 1, date: 1 });

export const VirtualMatch = model<IVirtualMatch>('VirtualMatch', virtualMatchSchema);
