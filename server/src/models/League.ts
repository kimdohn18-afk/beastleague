import { Schema, model, Document, Types } from 'mongoose';

export interface ILeague extends Document {
  name: string;
  code: string;
  ownerId: Types.ObjectId;
  members: Types.ObjectId[];
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

const leagueSchema = new Schema<ILeague>(
  {
    name: { type: String, required: true, maxlength: 20 },
    code: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    maxMembers: { type: Number, default: 20 },
  },
  { timestamps: true }
);

leagueSchema.index({ code: 1 }, { unique: true });
leagueSchema.index({ members: 1 });

export const League = model<ILeague>('League', leagueSchema);
