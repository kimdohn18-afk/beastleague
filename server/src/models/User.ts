import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  provider: 'kakao' | 'google';
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    provider: { type: String, enum: ['kakao', 'google'], required: true },
    providerId: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser>('User', userSchema);
