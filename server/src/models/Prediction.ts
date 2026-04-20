// server/src/models/Prediction.ts

import { Schema, model, Document, Types } from 'mongoose';

export type ScoreDiffRange = '1-2' | '3-4' | '5+';
export type TotalRunsRange = 'low' | 'normal' | 'high';

export interface IPredictionResult {
  winCorrect: boolean;
  diffCorrect?: boolean;
  totalCorrect?: boolean;
  xpFromWin: number;        // 승리 예측 적중 보상 (무료, +20)
  xpFromDiff: number;       // 점수차 적중 시 베팅액 × 배율
  xpFromTotal: number;      // 총득점 적중 시 베팅액 × 배율
  xpLostDiff: number;       // 점수차 실패 시 잃은 XP
  xpLostTotal: number;      // 총득점 실패 시 잃은 XP
  netXp: number;            // 최종 합산
}

export interface IPrediction extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  gameId: string;
  date: string;

  // 필수: 승리팀 예측
  predictedWinner: string;

  // 선택: 점수차 베팅
  scoreDiffRange?: ScoreDiffRange;
  xpBetOnDiff?: number;

  // 선택: 총득점 베팅
  totalRunsRange?: TotalRunsRange;
  xpBetOnTotal?: number;

  status: 'active' | 'settled';
  result?: IPredictionResult;

  createdAt: Date;
}

const predictionResultSchema = new Schema<IPredictionResult>(
  {
    winCorrect:   { type: Boolean, required: true },
    diffCorrect:  Boolean,
    totalCorrect: Boolean,
    xpFromWin:    { type: Number, default: 0 },
    xpFromDiff:   { type: Number, default: 0 },
    xpFromTotal:  { type: Number, default: 0 },
    xpLostDiff:   { type: Number, default: 0 },
    xpLostTotal:  { type: Number, default: 0 },
    netXp:        { type: Number, default: 0 },
  },
  { _id: false }
);

const predictionSchema = new Schema<IPrediction>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId:     { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    gameId:          { type: String, required: true },
    date:            { type: String, required: true },
    predictedWinner: { type: String, required: true },
    scoreDiffRange:  { type: String, enum: ['1-2', '3-4', '5+'] },
    xpBetOnDiff:     { type: Number, min: 0 },
    totalRunsRange:  { type: String, enum: ['low', 'normal', 'high'] },
    xpBetOnTotal:    { type: Number, min: 0 },
    status:          { type: String, enum: ['active', 'settled'], default: 'active' },
    result:          predictionResultSchema,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 한 유저가 같은 경기에 중복 예측 불가
predictionSchema.index({ userId: 1, gameId: 1 }, { unique: true });
// 정산 시 경기별 조회
predictionSchema.index({ gameId: 1, status: 1 });
// 오늘 예측 목록 조회
predictionSchema.index({ userId: 1, date: 1 });

export const Prediction = model<IPrediction>('Prediction', predictionSchema);
