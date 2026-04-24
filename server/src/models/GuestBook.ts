import mongoose, { Schema, Document } from 'mongoose';

export interface IGuestBook extends Document {
  toCharacterId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  fromCharacterName: string;
  fromAnimalType: string;
  message: string;
  date: string;
  createdAt: Date;
}

const GuestBookSchema = new Schema<IGuestBook>({
  toCharacterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  fromUserId: { type: Schema.Types.ObjectId, required: true },
  fromCharacterName: { type: String, required: true },
  fromAnimalType: { type: String, required: true },
  message: { type: String, required: true, maxlength: 100 },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

GuestBookSchema.index({ toCharacterId: 1, date: 1 });
GuestBookSchema.index({ toCharacterId: 1, fromUserId: 1, date: 1 }, { unique: true });

export const GuestBook = mongoose.model<IGuestBook>('GuestBook', GuestBookSchema);
