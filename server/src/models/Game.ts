import { Schema, model, Document } from 'mongoose';

export interface IGame extends Document {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
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
