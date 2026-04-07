import { Schema, model, Document } from 'mongoose';

export interface IPushSubscription extends Document {
  userId: Schema.Types.ObjectId;
  fcmToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fcmToken: { type: String, required: true },
  },
  { timestamps: true }
);

// 같은 유저가 여러 기기에서 등록할 수 있으므로 fcmToken에 유니크 인덱스
pushSubscriptionSchema.index({ fcmToken: 1 }, { unique: true });
pushSubscriptionSchema.index({ userId: 1 });

export const PushSubscription = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
