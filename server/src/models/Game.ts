// server/src/models/Game.ts

import { Schema, model, Document } from 'mongoose';

// 타자 기록
export interface IBatterRecord {
  order: string;
  position: string;
  name: string;
  atBats: string;
  hits: string;
  rbi: string;
  runs: string;
  avg: string;
  homeRuns: number;
  doubles: number;
  triples: number;
  stolenBases: number;
  stolenBaseFails: number;
  walks: number;
  walkOff: boolean;
}

// 이벤트
export interface IGameEvent {
  type: string;
  detail: string;
}

export interface IGame extends Document {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
  batterRecords?: {
    away: IBatterRecord[];
    home: IBatterRecord[];
  };
  events?: IGameEvent[];
}

const batterRecordSchema = new Schema<IBatterRecord>(
  {
    order: { type: String, default: '' },
    position: { type: String, default: '' },
    name: { type: String, default: '' },
    atBats: { type: String, default: '0' },
    hits: { type: String, default: '0' },
    rbi: { type: String, default: '0' },
    runs: { type: String, default: '0' },
    avg: { type: String, default: '.000' },
    homeRuns: { type: Number, default: 0 },
    doubles: { type: Number, default: 0 },
    triples: { type: Number, default: 0 },
    stolenBases: { type: Number, default: 0 },
    stolenBaseFails: { type: Number, default: 0 },
    walks: { type: Number, default: 0 },
    walkOff: { type: Boolean, default: false },
  },
  { _id: false }
);

const gameEventSchema = new Schema<IGameEvent>(
  {
    type: { type: String, default: '' },
    detail: { type: String, default: '' },
  },
  { _id: false }
);

const gameSchema = new Schema<IGame>(
  {
    gameId: { type: String, required: true },
    date: { type: String, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    status: { type: String, required: true },
    startTime: { type: String },
    homeScore: Number,
    awayScore: Number,
    batterRecords: {
      away: [batterRecordSchema],
      home: [batterRecordSchema],
    },
    events: [gameEventSchema],
  },
  { timestamps: true }
);

gameSchema.index({ gameId: 1 }, { unique: true });
gameSchema.index({ date: 1 });

export const Game = model<IGame>('Game', gameSchema);
