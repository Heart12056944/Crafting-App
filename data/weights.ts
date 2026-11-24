import { recipesRaw } from "./recipesRaw";
import type { InventoryRow } from "@/lib/supabaseInventory";

// Carrying weight. Each item weighs what its metadata says (set when it came
// from a character sheet), else its standard weight, else a sensible default
// for its type. Weights are per single item, in pounds.

export const STANDARD_WEIGHTS: Record<string, number> = {
  // PHB adventuring gear
  Torch: 1,
  Staff: 4,
  Quarterstaff: 4,
  Crowbar: 5,
  Spear: 3,
  Backpack: 5,
  Dagger: 1,
  Tinderbox: 1,
  Caltrops: 2,
  Rations: 2,
  "Hunting Trap": 25,
  Oil: 1,
  Waterskin: 5,
  Rope: 5,
  "Hempen Rope": 10,
  "Silk Rope": 5,
  Bedroll: 7,
  "Brewer's Supplies": 9,
  "Light Crossbow": 5,
  "Crossbow Bolts": 0.075,
  Arrows: 0.05,
  Piton: 0.25,
  Hammer: 3,
  "Thieves' Tools": 1,
  "Studded Leather Armor": 13,
  "Leather Armor": 10,
  Shortsword: 2,
  Longsword: 3,
  Shortbow: 2,
  Handaxe: 2,
  "Dungeoneer's Pack": 0,
  "Explorer's Pack": 0,
  "Arcane Focus (crystal)": 0,
  // Codex gear
  "Winter Coat": 6,
  "Fur Mittens & Hat": 1,
  "Snow Goggles": 0.5,
  "Oilskin Cloak": 4,
  "Waxed Tarp": 5,
  "Oiled Boots": 3,
  "Summer Linens": 2,
  "Large Waterskin": 6,
  Snowshoes: 4,
  Crampons: 2,
  "Fleece Bedroll": 6,
  "Hide Tent": 20,
  "Farmhand's Pack": 5,
  "Climbing Kit": 12,
};

const TYPE_WEIGHTS: Record<string, number> = {
  weapon: 3,
  armour: 15,
  armor: 15,
  accessory: 1,
  potion: 0.5,
  poison: 0.5,
  utility: 2,
  upgrade: 1,
  explosive: 1,
  trap: 5,
};

const recipeById = new Map(recipesRaw.map((recipe) => [recipe.id, recipe]));
const recipeByName = new Map(recipesRaw.map((recipe) => [recipe.name.toLowerCase(), recipe]));

// Weight of one of this item.
export function unitWeight(row: Pick<InventoryRow, "name" | "kind" | "metadata" | "description">): number {
  const meta = (row.metadata || {}) as { weight?: number; consumable?: boolean; usesPerItem?: number; recipeId?: string | null };
  if (typeof meta.weight === "number") return meta.weight;
  if (STANDARD_WEIGHTS[row.name] !== undefined) return STANDARD_WEIGHTS[row.name];
  const recipe = (meta.recipeId && recipeById.get(meta.recipeId)) || recipeByName.get(row.name.toLowerCase());
  if (recipe?.tool === "Cook's Utensils") {
    // Food: rations that keep weigh 2 lb a day's worth; fresh dishes 1 lb a serving.
    const per = Math.max(1, meta.usesPerItem ?? 1);
    return per * (/keeps for|ration/i.test(`${row.name} ${row.description || ""}`) ? 2 : 1);
  }
  const type = `${recipe?.category || row.kind || ""}`.toLowerCase();
  const match = Object.keys(TYPE_WEIGHTS).find((key) => type.includes(key));
  return match ? TYPE_WEIGHTS[match] : 1;
}

export function rowWeight(row: InventoryRow) {
  return unitWeight(row) * row.qty;
}

// Extra capacity from packs that say so ("carry 40 lb more").
export function bonusCapacity(rows: InventoryRow[]) {
  return rows.reduce((sum, row) => {
    const match = `${row.description || ""}`.match(/carry (\d+) lb more/i);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);
}

export function coinWeight(coins: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number } | undefined) {
  if (!coins) return 0;
  return ((coins.cp || 0) + (coins.sp || 0) + (coins.ep || 0) + (coins.gp || 0) + (coins.pp || 0)) / 50;
}

// Carrying capacity is STR × 15 (as on D&D Beyond). Over it, your speed drops
// to 5 ft. Pushing, dragging or lifting goes up to twice that.
export function encumbrance(total: number, strength: number, bonus = 0) {
  const capacity = strength * 15 + bonus;
  const over = total > capacity;
  return {
    capacity,
    lift: capacity * 2,
    over,
    near: !over && total > capacity * 0.8,
    status: over ? "Over capacity: speed drops to 5 ft" : "Unencumbered",
  };
}
