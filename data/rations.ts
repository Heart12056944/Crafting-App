import { recipesRaw } from "./recipesRaw";
import type { InventoryRow } from "@/lib/supabaseInventory";

// What counts as a day's food when Pass Day feeds the party: one ration or
// one serving of any cooked dish.

const recipeById = new Map(recipesRaw.map((recipe) => [recipe.id, recipe]));
const recipeByName = new Map(recipesRaw.map((recipe) => [recipe.name.toLowerCase(), recipe]));

function recipeFor(row: Pick<InventoryRow, "name" | "metadata">) {
  return (row.metadata?.recipeId && recipeById.get(row.metadata.recipeId)) || recipeByName.get(row.name.toLowerCase());
}

export function isFoodRow(row: Pick<InventoryRow, "name" | "metadata" | "description">) {
  if (!row.metadata?.consumable) return false;
  const recipe = recipeFor(row);
  return Boolean((recipe && recipe.tool === "Cook's Utensils") || /ration/i.test(row.name));
}

// Long-keeping food. Fresh meals are eaten first so rations last.
export function isRationRow(row: Pick<InventoryRow, "name" | "metadata" | "description">) {
  return /ration|keeps for/i.test(`${row.name} ${row.description || ""}`);
}

// The food a character eats today: their own first, then the party stash;
// fresh meals before rations.
export function pickFoodFor(characterId: string, rows: InventoryRow[]): InventoryRow | undefined {
  const food = rows.filter((row) => row.qty > 0 && isFoodRow(row));
  const order = (row: InventoryRow) => (row.character_id === characterId ? 0 : 2) + (isRationRow(row) ? 1 : 0);
  return food
    .filter((row) => row.character_id === characterId || row.character_id === null)
    .sort((a, b) => order(a) - order(b))[0];
}

// Days of food a holder has: each use of a food item is one day.
export function daysOfFood(rows: InventoryRow[], characterId: string | null) {
  return rows
    .filter((row) => row.character_id === characterId && isFoodRow(row))
    .reduce((sum, row) => {
      const per = Math.max(1, row.metadata.usesPerItem ?? 1);
      const left = row.metadata.usesLeft ?? per;
      return sum + (row.qty - 1) * per + left;
    }, 0);
}
