// Shop stock, prices and what things are worth when sold.
//
// Shops only carry basic materials: components, simple refined goods, a few
// common herbs, and what an ordinary hunter brings in from everyday wildlife.
// Anything from tougher creatures (monsters, undead, bosses, any epic drop)
// has to be hunted or harvested. The GM can still add anything to a shop.

import lootTablesJson from "./crafting/lootTables.json";
import { getMaterialTier, materialTierEntries, normalizeMaterialName } from "./materialTiers";
import { recipesRaw, type Recipe } from "./recipesRaw";
import { consumableInfo } from "./consumables";

export type StockEntry = {
  name: string;
  kind: "material" | "item";
  priceCp: number;
  qty: number | null; // null = unlimited
};

// Prices for basic goods, in copper.
export const BASIC_PRICES_CP: Record<string, number> = {
  // Components
  "Basic Fiber": 5,
  "Leather Scraps": 10,
  "Twine (50ft.)": 10,
  "Cotton Thread": 10,
  Cloth: 20,
  "Cloth Bolts": 100,
  "Leather Cord": 20,
  Resin: 20,
  "Binding Agents": 50,
  "Metal Fitting": 50,
  "Scrap Steel": 30,
  "Reinforced Metal Plates": 500,
  "Steel Blade": 400,
  "Reinforced Steel Blade": 1000,
  "Wooden Shield": 200,
  "Carved Focus": 500,
  "Empty Infusion Base": 50,
  "Empty Vials (set of 3)": 30,
  "Blank Scrolls": 100,
  // Simple refined goods
  "Wood Planks": 20,
  "Iron Ingot": 100,
  Charcoal: 10,
  "Pitch Binder": 50,
  "Fish Oil": 30,
  "Fish Glue": 40,
  "Whetstone Paste": 50,
  "Bone Meal": 30,
  "Grave Salt": 100,
  "Distilled Alcohol": 100,
  "Woven Wool": 150,
  "Rendered Tallow": 60,
  "Cured Wolf Leather": 200,
  "Supple Stag Leather": 200,
  "Cured Winter Fur": 600,
  // Common raw goods
  "Pine Logs": 10,
  "Pine Pitch": 10,
  "Grey Ironstone": 20,
  "Slate Grit": 10,
  Bitterleaf: 20,
  "Crag Moss": 20,
  "Hollowreed Seed": 5,
  Streamfin: 10,
  "Coarse Salt": 5,
  // Butcher's trim. Named cuts are priced by tier: 2 sp for everyday cuts
  // (necks, shanks...), 1 gp for choice cuts (shoulders, ribs...). Prime cuts
  // (backstrap, tenderloin...) are never stocked.
  "Raw Game Meat": 20,
  // Farm and island produce (wild Thornspine produce is never stocked: forage it)
  Tull: 5,
  Kesh: 5,
  Varn: 5,
  Orrel: 5,
  Dunsk: 20,
  Tidecress: 5,
  "Sailor's Knot": 5,
  Sourbell: 5,
  Bloodpod: 20,
  Galleyweed: 5,
  "Coop Egg": 2,
  "Skerry Egg": 3,
  "Coarse Flour": 5,
  Hearthbread: 10,
  "Valdren Curd": 20,
  "Kine Milk": 2,
  "Goat's Milk": 2,
  Wallwheel: 50,
  Brinecheese: 20,
  "Ridge Wheel": 80,
  "Curing Salt": 10,
  "Sour Vinegar": 10,
  Kindlepod: 5,
};

// Value of a material by tier when it has no set price: 2 sp, 1 gp, 5 gp, 25 gp, 125 gp, 500 gp.
const TIER_VALUE_CP = [20, 100, 500, 2500, 12500, 50000];

const basicPriceByName = new Map(Object.entries(BASIC_PRICES_CP).map(([name, cp]) => [normalizeMaterialName(name), cp]));
const knownMaterialNames = new Set(materialTierEntries.map((entry) => normalizeMaterialName(entry.name)));
const materialTags = new Map(materialTierEntries.map((entry) => [normalizeMaterialName(entry.name), entry.tags || []]));

export function isMaterialName(name: string) {
  const key = normalizeMaterialName(name);
  return basicPriceByName.has(key) || knownMaterialNames.has(key);
}

export function materialValueCp(name: string): number {
  const basic = basicPriceByName.get(normalizeMaterialName(name));
  if (basic !== undefined) return basic;
  return TIER_VALUE_CP[getMaterialTier(name)] ?? TIER_VALUE_CP[0];
}

// What an average hunter brings in: common and rare drops (never epic) of
// common or uncommon wildlife, tier 2 or lower (tier 1 for meat, so the
// best cuts have to be hunted), and nothing touched by the dead.
type LootJson = { creature: string; creatureTier: string; pool: string; family?: string; entries: { materialName: string }[] };
export const HUNTER_MATERIALS: string[] = Array.from(
  new Set(
    (lootTablesJson as LootJson[])
      .filter(
        (table) =>
          table.family === "beast" &&
          ["Common", "Uncommon"].includes(table.creatureTier) &&
          table.pool !== "Epic"
      )
      .flatMap((table) => table.entries.map((entry) => entry.materialName))
      .filter((name) => {
        const tags = materialTags.get(normalizeMaterialName(name)) || [];
        if (tags.includes("undead")) return false;
        // Prime cuts and the big signature cuts are for fine meals: hunt them.
        if (tags.includes("meat")) return getMaterialTier(name) <= 1 && !tags.includes("meat-grade-prime");
        return getMaterialTier(name) <= 2;
      })
  )
).sort();

// Item value by recipe difficulty: 10 gp, 50 gp, 200 gp, 750 gp, 2,500 gp, 10,000 gp.
function recipeValueCp(dc: number) {
  if (dc <= 11) return 1000;
  if (dc <= 13) return 5000;
  if (dc <= 15) return 20000;
  if (dc <= 17) return 75000;
  if (dc <= 19) return 250000;
  return 1000000;
}

const RARITY_VALUE_CP: Record<string, number> = {
  common: 1000,
  uncommon: 10000,
  rare: 50000,
  epic: 250000,
  ascendant: 500000,
  legendary: 1000000,
};

const QUALITY_MULT: Record<string, number> = { Superior: 1.5, Normal: 1, Flawed: 0.5 };

// Full value of one item. Shops pay half of this.
// Food is priced per serving or ration: 5 cp for rations and plain meals,
// 15 cp for good meals, 5 sp for fine meals.
function foodValueCp(recipe: Recipe) {
  const normal = recipe.outcomes.find((outcome) => outcome.quality === "Normal");
  const servings = Math.max(1, consumableInfo(recipe, normal?.description || recipe.description).usesPerItem);
  const each = recipe.dc >= 14 ? 50 : recipe.dc >= 12 ? 15 : 5;
  return servings * each;
}

// Everyday travel and weather gear, priced like the PHB's adventuring gear.
const GEAR_PRICES_CP: Record<string, number> = {
  "Winter Coat": 800,
  "Fur Mittens & Hat": 100,
  "Snow Goggles": 50,
  "Oilskin Cloak": 300,
  "Waxed Tarp": 200,
  "Oiled Boots": 200,
  "Summer Linens": 100,
  "Large Waterskin": 50,
  Snowshoes: 200,
  Crampons: 300,
  "Fleece Bedroll": 200,
  "Hide Tent": 500,
};

export function itemValueCp(options: { recipe?: Pick<Recipe, "dc"> | null; rarity?: string | null; quality?: string | null }): number {
  const recipe = options.recipe as Recipe | null | undefined;
  const base = recipe
    ? recipe.name && GEAR_PRICES_CP[recipe.name] !== undefined
      ? GEAR_PRICES_CP[recipe.name]
      : recipe.tool === "Cook's Utensils" && recipe.outcomes
      ? foodValueCp(recipe)
      : recipeValueCp(recipe.dc)
    : RARITY_VALUE_CP[(options.rarity || "").toLowerCase()] ?? 100;
  return Math.round(base * (QUALITY_MULT[options.quality || "Normal"] ?? 1));
}

export const SELL_RATE = 0.5;

// stock: materials; items: finished goods (by recipe name), priced by value.
export type ShopTemplate = { kind: string; name: string; description: string; stock: string[]; items?: string[] };

export const SHOP_TEMPLATES: ShopTemplate[] = [
  {
    kind: "general",
    name: "General Store",
    description: "Cloth, cord, thread and the odds and ends every crafter runs out of.",
    stock: ["Cloth", "Cloth Bolts", "Leather Cord", "Leather Scraps", "Twine (50ft.)", "Cotton Thread", "Basic Fiber", "Resin", "Binding Agents", "Wood Planks", "Charcoal", "Fish Oil", "Coarse Salt", "Empty Vials (set of 3)", "Blank Scrolls"],
    items: ["Dried Meat Strips", "Trail Cakes", "Winter Coat", "Fur Mittens & Hat", "Snow Goggles", "Oilskin Cloak", "Waxed Tarp", "Oiled Boots", "Summer Linens", "Large Waterskin"],
  },
  {
    kind: "smithy",
    name: "Smithy",
    description: "Iron, fittings, plates and plain blades.",
    stock: ["Scrap Steel", "Iron Ingot", "Grey Ironstone", "Metal Fitting", "Reinforced Metal Plates", "Steel Blade", "Reinforced Steel Blade", "Wooden Shield", "Whetstone Paste", "Charcoal"],
  },
  {
    kind: "apothecary",
    name: "Apothecary",
    description: "Infusion bases, vials, spirit and common herbs.",
    stock: ["Empty Infusion Base", "Empty Vials (set of 3)", "Distilled Alcohol", "Bitterleaf", "Crag Moss", "Bone Meal", "Hollowreed Seed", "Rendered Tallow"],
  },
  {
    kind: "woodworker",
    name: "Woodworker & Fletcher",
    description: "Timber, pitch, glue and cord.",
    stock: ["Pine Logs", "Wood Planks", "Pine Pitch", "Pitch Binder", "Fish Glue", "Resin", "Twine (50ft.)", "Carved Focus"],
  },
  {
    kind: "hunter",
    name: "Hunter's Lodge",
    description: "Hides, pelts, wool, feathers and meat from everyday hunting. Nothing from anything truly dangerous.",
    stock: [...HUNTER_MATERIALS, "Raw Game Meat", "Cured Wolf Leather", "Supple Stag Leather", "Cured Winter Fur", "Woven Wool", "Rendered Tallow", "Coarse Salt"],
  },
  {
    kind: "butcher",
    name: "Butcher & Curer",
    description: "Farm beef and pork, everyday game, fat, curing salt and spice, and a rack of cured meats ready for the road. Prime cuts are spoken for.",
    stock: [
      "Kine Shank", "Kine Brisket", "Kine Flank", "Kine Skirt", "Kine Tail", "Kine Chuck", "Kine Round", "Kine Short Ribs", "Kine Sirloin",
      "Hog Jowl", "Hog Hock", "Hog Belly", "Hog Shoulder", "Hog Spare Ribs", "Hog Ham",
      "Raw Game Meat", "Kine Suet", "Hog Lard", "Curing Salt", "Coarse Salt", "Kindlepod", "Sour Vinegar",
    ],
    items: ["Smokebelly", "Redlink", "Hanging Link", "Hanging Ham", "Brine Brisket", "Dried Meat Strips", "Potted Meat"],
  },
  {
    kind: "valley-market",
    name: "Valley Market",
    description: "Root, leaf, beans, orchard fruit, eggs, milk, cheese and bread from the Valdren farms, plus salt and butcher's trim.",
    stock: ["Tull", "Kesh", "Varn", "Orrel", "Dunsk", "Kindlepod", "Coop Egg", "Kine Milk", "Valdren Curd", "Wallwheel", "Coarse Flour", "Hearthbread", "Coarse Salt", "Sour Vinegar", "Raw Game Meat"],
    items: ["Compact Bean Brick", "Wallwheel Slices"],
  },
  {
    kind: "island-market",
    name: "Island Market",
    description: "Romley produce from the island farms and tide pools, and everything a ship's galley runs on.",
    stock: ["Tidecress", "Sailor's Knot", "Sourbell", "Bloodpod", "Galleyweed", "Skerry Egg", "Goat's Milk", "Brinecheese", "Hearthbread", "Coarse Salt"],
    items: ["Hold Rations", "Salted Fish"],
  },
  {
    kind: "fishmonger",
    name: "Dockside Fishmonger",
    description: "The day's catch: shark, crab and octopus, plus salt for curing. Nothing from anything a crew would brag about killing.",
    stock: ["Shark Fillet", "Shark Steak", "Shark Belly", "Crab Leg Meat", "Crab Body Meat", "Crab Claw Meat", "Octopus Tentacle", "Octopus Mantle", "Coarse Salt", "Fish Oil"],
  },
  {
    kind: "quartermaster",
    name: "Order Quartermaster",
    description: "Grave salt, bone meal and field supplies for those who fight the dead.",
    stock: ["Grave Salt", "Bone Meal", "Iron Ingot", "Whetstone Paste", "Empty Infusion Base", "Blank Scrolls", "Carved Focus", "Fish Oil"],
    items: ["Compact Bean Brick", "Dried Meat Strips", "Winter Coat", "Fur Mittens & Hat", "Oilskin Cloak", "Snowshoes", "Crampons", "Fleece Bedroll"],
  },
  { kind: "custom", name: "New Shop", description: "", stock: [] },
];

const foodRecipeByName = new Map(recipesRaw.map((recipe) => [recipe.name, recipe]));

export function stockFromNames(names: string[], items: string[] = []): StockEntry[] {
  return [
    ...Array.from(new Set(names)).map((name) => ({ name, kind: "material" as const, priceCp: materialValueCp(name), qty: null })),
    ...items
      .filter((name) => foodRecipeByName.has(name))
      .map((name) => ({ name, kind: "item" as const, priceCp: itemValueCp({ recipe: foodRecipeByName.get(name) }), qty: null })),
  ];
}
