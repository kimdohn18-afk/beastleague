import { Schema, model, Document, Types } from 'mongoose';

export interface ILike extends Document {
  fromUserId: Types.ObjectId;   // 좋아요 누른 사람
  toCharacterId: Types.ObjectId; // 좋아요 받은 캐릭터
  date: string;                  // KST 날짜 (하루 1회 제한용)
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    fromUserId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toCharacterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    date:          { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 같은 유저가 같은 캐릭터에 하루 1번만
likeSchema.index({ fromUserId: 1, toCharacterId: 1, date: 1 }, { unique: true });
// 캐릭터별 총 좋아요 조회용
likeSchema.index({ toCharacterId: 1 });

export const Like = model<ILike>('Like', likeSchema);
