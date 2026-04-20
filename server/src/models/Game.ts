import { Schema, model, Document } from 'mongoose';

const batterRecordSchema = new Schema(
  {
    order: String,
    position: String,
    name: String,
    atBats: String,
    hits: String,
    rbi: String,
    runs: String,
    avg: String,
  },
  { _id: false }
);

const gameEventSchema = new Schema(
  {
    type: String,
    detail: String,
  },
  { _id: false }
);

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
    away: Array<{ order: string; position: string; name: string; atBats: string; hits: string; rbi: string; runs: string; avg: string }>;
    home: Array<{ order: string; position: string; name: string; atBats: string; hits: string; rbi: string; runs: string; avg: string }>;
  };
  events?: Array<{ type: string; detail: string }>;
}

const gameSchema = new Schema<IGame>(
  {
    gameId:    { type: String, required: true },
    date:      { type: String, required: true },
    homeTeam:  { type: String, required: true },
    awayTeam:  { type: String, required: true },
    status:    { type: String, required: true },
    startTime: { type: String },
    homeScore: Number,
    awayScore: Number,
     },
  { timestamps: true }
);

gameSchema.index({ gameId: 1 }, { unique: true });
gameSchema.index({ date: 1 });

export const Game = model<IGame>('Game', gameSchema);
