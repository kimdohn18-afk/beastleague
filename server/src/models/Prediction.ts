// server/src/models/Prediction.ts

import { Schema, model, Document, Types } from 'mongoose';

export type ScoreDiffRange = '1-2' | '3-4' | '5+';
export type TotalRunsRange = 'low' | 'normal' | 'high';

// 타자 기록 결과
export interface IBatterResult {
  playerName: string;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  stolenBases: number;
  stolenBaseFails: number;
  walks: number;
  walkOff: boolean;
}

export interface IPredictionResult {
  // 공통
  winCorrect: boolean;
  netXp: number;

  // 타자 기록 기반 (신규)
  xpFromPlayer?: number;
  xpFromTeamWin?: number;
  xpFromWinPredict?: number;
  batterResult?: IBatterResult;

  // 스코어 기반 (하위호환)
  diffCorrect?: boolean;
  totalCorrect?: boolean;
  xpFromWin: number;
  xpFromDiff: number;
  xpFromTotal: number;
  xpLostDiff: number;
  xpLostTotal: number;
}

export interface IPrediction extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  gameId: string;
  date: string;

  // 필수: 팀 선택 + 승리 예측
  team: string;
  predictedWinner: string;

  // 신규: 타순 배치
  battingOrder?: number;  // 1~9

  // 하위호환: 스코어 베팅
  scoreDiffRange?: ScoreDiffRange;
  xpBetOnDiff?: number;
  totalRunsRange?: TotalRunsRange;
  xpBetOnTotal?: number;

  status: 'active' | 'settled';
  result?: IPredictionResult;

  createdAt: Date;
}

const batterResultSchema = new Schema<IBatterResult>(
  {
    playerName: { type: String, default: '' },
    atBats: { type: Number, default: 0 },
    hits: { type: Number, default: 0 },
    doubles: { type: Number, default: 0 },
    triples: { type: Number, default: 0 },
    homeRuns: { type: Number, default: 0 },
    rbi: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    stolenBases: { type: Number, default: 0 },
    stolenBaseFails: { type: Number, default: 0 },
    walks: { type: Number, default: 0 },
    walkOff: { type: Boolean, default: false },
  },
  { _id: false }
);

const predictionResultSchema = new Schema<IPredictionResult>(
  {
    winCorrect: { type: Boolean, required: true },
    netXp: { type: Number, default: 0 },
    xpFromPlayer: Number,
    xpFromTeamWin: Number,
    xpFromWinPredict: Number,
    batterResult: batterResultSchema,
    diffCorrect: Boolean,
    totalCorrect: Boolean,
    xpFromWin: { type: Number, default: 0 },
    xpFromDiff: { type: Number, default: 0 },
    xpFromTotal: { type: Number, default: 0 },
    xpLostDiff: { type: Number, default: 0 },
    xpLostTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const predictionSchema = new Schema<IPrediction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    gameId: { type: String, required: true },
    date: { type: String, required: true },
    team: { type: String, default: '' },
    predictedWinner: { type: String, required: true },
    battingOrder: { type: Number, min: 1, max: 9 },
    scoreDiffRange: { type: String, enum: ['1-2', '3-4', '5+'] },
    xpBetOnDiff: { type: Number, min: 0 },
    totalRunsRange: { type: String, enum: ['low', 'normal', 'high'] },
    xpBetOnTotal: { type: Number, min: 0 },
    status: { type: String, enum: ['active', 'settled'], default: 'active' },
    result: predictionResultSchema,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

predictionSchema.index({ userId: 1, gameId: 1 }, { unique: true });
predictionSchema.index({ gameId: 1, status: 1 });
predictionSchema.index({ userId: 1, date: 1 });

export const Prediction = model<IPrediction>('Prediction', predictionSchema);
