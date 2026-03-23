import { Schema, model, Document } from 'mongoose';

const batterStatsSchema = new Schema(
  { AB: Number, H: Number, '2B': Number, '3B': Number, HR: Number,
    RBI: Number, RUN: Number, SB: Number, BB: Number, K: Number },
  { _id: false }
);

const batterGroupSchema = new Schema(
  { team: String, groupType: String, stats: batterStatsSchema },
  { _id: false }
);

const pitcherStatsSchema = new Schema(
  { IP: Number, PITCH: Number, H: Number, K: Number, BB: Number, ER: Number },
  { _id: false }
);

const pitcherSchema = new Schema(
  { team: String, role: String, stats: pitcherStatsSchema },
  { _id: false }
);

export interface IGame extends Document {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  batterGroups: Array<{ team: string; groupType: string; stats: Record<string, number> }>;
  pitchers?: Array<{ team: string; role: string; stats: Record<string, number> }>;
  updatedAt: Date;
}

const gameSchema = new Schema<IGame>(
  {
    gameId:    { type: String, required: true },
    date:      { type: String, required: true },
    homeTeam:  { type: String, required: true },
    awayTeam:  { type: String, required: true },
    status:    { type: String, required: true },
    homeScore: Number,
    awayScore: Number,
    batterGroups: [batterGroupSchema],
    pitchers:     [pitcherSchema],
  },
  { timestamps: false }
);

gameSchema.index({ gameId: 1 }, { unique: true });
gameSchema.index({ date: 1 });

export const Game = model<IGame>('Game', gameSchema);
