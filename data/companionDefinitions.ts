import companionDefinitionsJson from "./companions/companionDefinitions.json";

export type CompanionRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

export type CompanionCategory =
  | "Companion"
  | "Companion Ability";

export type CompanionDefinition = {
  id: string;
  sourceId?: string;
  name: string;
  category: CompanionCategory;
  rarity: CompanionRarity;
  valueGp: number;
  requiresAttunement?: boolean;
  action?: string;
  usedBy?: string[];
  tags: string[];
  description: string;
  originalText?: string;
  source?: string;
};

export const COMPANION_CATEGORIES: CompanionCategory[] = [
  "Companion",
  "Companion Ability",
];

export const COMPANION_DEFINITIONS =
  companionDefinitionsJson as CompanionDefinition[];
