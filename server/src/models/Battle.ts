import { Schema, model, Document, Types } from 'mongoose';

const playerSchema = new Schema(
  { userId: Schema.Types.ObjectId, characterId: Schema.Types.ObjectId, statGain: Number },
  { _id: false }
);

export interface IBattle extends Document {
  date: string;
  gameId: string;
  player1: { userId: Types.ObjectId; characterId: Types.ObjectId; statGain: number };
  player2: { userId: Types.ObjectId; characterId: Types.ObjectId; statGain: number };
  result: { player1: string; player2: string };
  xpAwarded: { player1: number; player2: number };
  createdAt: Date;
}

const battleSchema = new Schema<IBattle>(
  {
    date:   { type: String, required: true },
    gameId: { type: String, required: true },
    player1: { type: playerSchema, required: true },
    player2: { type: playerSchema, required: true },
    result:  {
      type: new Schema({ player1: String, player2: String }, { _id: false }),
      required: true
    },
    xpAwarded: {
      type: new Schema({ player1: Number, player2: Number }, { _id: false }),
      required: true
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

battleSchema.index({ date: 1 });
battleSchema.index({ 'player1.userId': 1, date: 1 });

export const Battle = model<IBattle>('Battle', battleSchema);
