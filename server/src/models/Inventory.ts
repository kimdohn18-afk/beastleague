import { Schema, model, Document, Types } from 'mongoose';
import { ItemSlot, ItemRarity } from './Item';

export interface IInventoryEffect {
  stat: string;
  value: number;
}

export interface IInventoryItem extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  templateId: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  icon: string;

  // 강화
  enhanceLevel: number;
  currentEffects: IInventoryEffect[];  // 복합 효과
  xpBonus: number;                     // XP 보너스 %
  special: string | null;              // 특수 효과 키
  setId: string | null;                // 세트 소속

  // 하위호환
  currentEffect?: { stat?: string; value: number; xpBonus?: number };

  equipped: boolean;
  createdAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId:   { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    templateId:    { type: String, required: true },
    name:          { type: String, required: true },
    slot:          { type: String, required: true },
    rarity:        { type: String, required: true },
    icon:          { type: String, default: '📦' },
    enhanceLevel:  { type: Number, default: 0 },
    currentEffects: [{
      stat:  { type: String, required: true },
      value: { type: Number, required: true },
    }],
    xpBonus:       { type: Number, default: 0 },
    special:       { type: String, default: null },
    setId:         { type: String, default: null },
    currentEffect: {
      stat:    { type: String },
      value:   { type: Number, default: 0 },
      xpBonus: { type: Number, default: 0 },
    },
    equipped: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryItemSchema.index({ userId: 1 });
inventoryItemSchema.index({ userId: 1, equipped: 1 });

export const InventoryItem = model<IInventoryItem>('InventoryItem', inventoryItemSchema);
