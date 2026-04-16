import { Schema, model, Document, Types } from 'mongoose';

export interface IFeed extends Document {
  fromUserId: Types.ObjectId;
  toCharacterId: Types.ObjectId;
  date: string;
  xpCost: number;
  xpGiven: number;
  isSelf: boolean;
  createdAt: Date;
}

const feedSchema = new Schema<IFeed>(
  {
    fromUserId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toCharacterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    date:          { type: String, required: true },
    xpCost:        { type: Number, required: true },
    xpGiven:       { type: Number, required: true },
    isSelf:        { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

feedSchema.index({ fromUserId: 1, toCharacterId: 1, date: 1 }, { unique: true });
feedSchema.index({ fromUserId: 1, date: 1 });
feedSchema.index({ toCharacterId: 1 });

export const Feed = model<IFeed>('Feed', feedSchema);
