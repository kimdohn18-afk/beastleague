import { Schema, model, Document, Types } from 'mongoose';

export interface IFeed extends Document {
  fromUserId: Types.ObjectId;
  toCharacterId: Types.ObjectId;
  date: string;
  xpCost: number;
  xpGiven: number;
  createdAt: Date;
}

const feedSchema = new Schema<IFeed>(
  {
    fromUserId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toCharacterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    date:          { type: String, required: true },
    xpCost:        { type: Number, required: true },
    xpGiven:       { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 같은 유저가 같은 캐릭터에 하루 1번
feedSchema.index({ fromUserId: 1, toCharacterId: 1, date: 1 }, { unique: true });
// 하루 총 횟수 조회용
feedSchema.index({ fromUserId: 1, date: 1 });
// 받은 횟수 조회용
feedSchema.index({ toCharacterId: 1 });

export const Feed = model<IFeed>('Feed', feedSchema);
