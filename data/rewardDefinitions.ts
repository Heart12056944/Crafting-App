import rewardDefinitionsJson from "./rewardDefinitions.json";

export type RewardRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

export type RewardCategory =
  | "Treasure"
  | "Item"
  | "Potion"
  | "Weapon"
  | "Armour"
  | "Companion"
  | "Companion Ability";

export type RewardDefinition = {
  id: string;
  sourceId?: string;

  name: string;

  category: RewardCategory;
  rarity: RewardRarity;

  valueGp: number;

  requiresAttunement?: boolean;

  tags: string[];

  description: string;

  originalText?: string;
};

export const REWARD_RARITY_WEIGHTS: Record<
  RewardRarity,
  number
> = {
  Common: 14,
  Uncommon: 12,
  Rare: 10,
  Epic: 7,
  Legendary: 3,
};

export const REWARD_CATEGORIES: RewardCategory[] = [
  "Treasure",
  "Item",
  "Potion",
  "Weapon",
  "Armour",
  "Companion",
  "Companion Ability",
];

export const REWARD_DEFINITIONS =
  rewardDefinitionsJson as RewardDefinition[];