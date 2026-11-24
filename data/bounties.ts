import { lootTables, isLootTableVisible, type CreatureTier, type LootTable } from "./lootTables";
import { recipesRaw, type Recipe } from "./recipesRaw";
import { itemValueCp } from "./shops";

// Helpers for the bounty board: what the GM can post (only creatures and
// recipes the campaign can see) and suggested rewards.

// Reward per creature hunted, by tier.
export const BOUNTY_REWARD_CP: Record<CreatureTier, number> = {
  common: 200,
  uncommon: 600,
  rare: 2000,
  epic: 6000,
  boss: 15000,
};

export const QUALITY_RANK = { Flawed: 0, Normal: 1, Superior: 2 } as const;
export type DeliveryQuality = keyof typeof QUALITY_RANK;

// Paid on top when a commission is delivered at Superior quality but asked for less.
export const SUPERIOR_BONUS = 0.5;

export const GIVERS: Record<string, string[]> = {
  "undying-vigil": ["Wall Quartermaster", "Compact Warden", "Valdren Farmer", "Old Order Keeper", "Hunters' Lodge", "Village Elder"],
  "basic-gear": ["Village Elder", "Travelling Merchant", "Hunters' Lodge"],
  "tales-on-the-sea": ["Harbourmaster", "Ship's Quartermaster", "Fishmonger", "Island Elder"],
  blackspire: ["Academy Steward", "Faculty Notice Board", "Alchemy Stores"],
};

export function giversFor(set: string | undefined) {
  return GIVERS[set || ""] || ["Village Elder", "Travelling Merchant"];
}

export function visibleBountyCreatures(disabledSets: string[]): LootTable[] {
  return lootTables
    .filter((table) => isLootTableVisible(table, disabledSets))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function isRecipeVisible(recipe: Pick<Recipe, "tags">, disabledTags: string[]) {
  return !recipe.tags.some((tag) => disabledTags.includes(tag));
}

export function visibleCommissionRecipes(disabledTags: string[]): Recipe[] {
  const seen = new Set<string>();
  return recipesRaw
    .filter((recipe) => recipe.category !== "material-refinement" && isRecipeVisible(recipe, disabledTags))
    .filter((recipe) => (seen.has(recipe.name) ? false : (seen.add(recipe.name), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const TROPHY = /\b(hide|pelt|skin|tooth|teeth|fang|claw|horn|antler|skull|scale|tusk|jaw|ear|tail|feather|bone)s?\b/i;

// A material that proves the kill: something trophy-like from the common pool.
export function suggestedProof(table: LootTable, count: number) {
  const pool = (table.tables.common || []).filter((entry) => (entry.kind || "material") === "material");
  const pick = pool.find((entry) => TROPHY.test(entry.name)) || pool[0];
  return pick ? [{ name: pick.name, qty: Math.max(1, count) }] : [];
}

export function suggestedBountyReward(table: LootTable, count: number) {
  return BOUNTY_REWARD_CP[table.defaultTier || "common"] * Math.max(1, count);
}

// Commissions pay half again over what the item is worth.
export function suggestedCommissionReward(recipe: Recipe, qty: number) {
  return Math.max(100, Math.round(itemValueCp({ recipe }) * 1.5) * Math.max(1, qty));
}

export function recipeSet(recipe: Recipe) {
  return ["undying-vigil", "basic-gear", "blackspire", "tales-on-the-sea"].find((set) => recipe.tags.includes(set));
}

export function tableById(id: string | undefined) {
  return id ? lootTables.find((table) => table.id === id) : undefined;
}

export function randomItem<T>(items: T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}
