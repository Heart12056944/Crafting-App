import recipesJson from "./crafting/recipes.json";
import refinementChainsJson from "./crafting/refinementChains.json";

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "ascendant"
  | "legendary"
  | "artifact";

export type CraftQuality = "Superior" | "Normal" | "Flawed";

export type RecipeOutcome = {
  quality: CraftQuality;
  description: string;
  statBlock?: string;
  effect?: string[];
};

export type RecipeMaterial = {
  name: string;
  qty: number;
};

export type Recipe = {
  id: string;
  name: string;
  category:
    | "item"
    | "weapon"
    | "armour"
    | "potion"
    | "poison"
    | "consumable"
    | "accessory"
    | "upgrade"
    | "armour-upgrade"
    | "weapon-upgrade"
    | "material-refinement"
    | "material";
  rarity: Rarity;
  tags: string[];
  description: string;
  dc: number;
  time: string;
  tool: string;
  stat: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  materials: RecipeMaterial[];
  outcomes: RecipeOutcome[];
};

type BlackspireRecipe = {
  id: string;
  name: string;
  type: string;
  dc: number | null;
  time: string;
  tool: string;
  materials: { name: string; quantity: number }[];
  materialsText: string;
  outcomes: {
    superior: string;
    normal: string;
    flawed: string;
  };
  chapter?: string;
  group?: string;
  section?: string;
};

type BlackspireRefinement = {
  id: string;
  inputMaterial: string;
  inputTier: string;
  quantity: number | null;
  outputMaterial: string;
  outputTier: string;
  dc: number | null;
  time: string;
  tool: string;
  outcomes: {
    superior: string;
    normal: string;
    flawed: string;
  };
  notes?: string;
  isTerminal?: boolean;
  chapter?: string;
  group?: string;
};

export const rarityColors: Record<Rarity, string> = {
  common: "#8f8f8f",
  uncommon: "#2f9e44",
  rare: "#1c7ed6",
  epic: "#9c36b5",
  ascendant: "#43c7d8",
  legendary: "#d6a21f",
  artifact: "#c92a2a",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function statFromTool(tool: string): Recipe["stat"] {
  const match = tool.match(/\((STR|DEX|CON|INT|WIS|CHA)\)/i);
  return (match?.[1]?.toUpperCase() as Recipe["stat"]) || "INT";
}

function toolName(tool: string) {
  return tool.replace(/\s*\((STR|DEX|CON|INT|WIS|CHA)\)\s*/i, "").trim();
}

function rarityFromDc(dc: number): Rarity {
  if (dc <= 11) return "common";
  if (dc <= 13) return "uncommon";
  if (dc <= 15) return "rare";
  if (dc <= 17) return "epic";
  if (dc <= 19) return "ascendant";
  if (dc <= 21) return "legendary";
  return "artifact";
}

function normalizeCategory(type: string): Recipe["category"] {
  const value = type.toLowerCase();

  if (value.includes("weapon")) return "weapon";
  if (value.includes("armour") || value.includes("armor")) return "armour";
  if (value.includes("potion")) return "potion";
  if (value.includes("poison")) return "poison";
  if (value.includes("accessory")) return "accessory";
  if (value.includes("upgrade")) return "upgrade";
  if (value.includes("throwable")) return "weapon";
  if (value.includes("focus")) return "item";
  if (value.includes("utility")) return "item";

  return "item";
}

function tagsFrom(...values: (string | undefined)[]) {
  const tags = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    value
      .split(/—|,|\s+/)
      .map((part) => slugify(part))
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  }

  return Array.from(tags);
}

function recipeOutcomes(outcomes: BlackspireRecipe["outcomes"]): RecipeOutcome[] {
  return [
    { quality: "Superior", description: outcomes.superior, effect: outcomes.superior ? [outcomes.superior] : [] },
    { quality: "Normal", description: outcomes.normal, effect: outcomes.normal ? [outcomes.normal] : [] },
    { quality: "Flawed", description: outcomes.flawed, effect: outcomes.flawed ? [outcomes.flawed] : [] },
  ];
}

function refinementOutcomes(refinement: BlackspireRefinement): RecipeOutcome[] {
  return [
    {
      quality: "Superior",
      description: refinement.outcomes.superior || "Superior refinement result.",
      effect: [refinement.outcomes.superior, refinement.outcomes.normal].filter(Boolean),
    },
    {
      quality: "Normal",
      description: refinement.outcomes.normal || `Create 1x ${refinement.outputMaterial}.`,
      effect: [refinement.outcomes.normal || `Create 1x ${refinement.outputMaterial}`],
    },
    {
      quality: "Flawed",
      description: refinement.outcomes.flawed || "Refinement failed.",
      effect: [refinement.outcomes.flawed || "Refinement failed"],
    },
  ];
}

const rawRecipes = recipesJson as BlackspireRecipe[];
const rawRefinements = refinementChainsJson as BlackspireRefinement[];

const craftingRecipes: Recipe[] = rawRecipes.map((recipe) => ({
  id: recipe.id,
  name: recipe.name,
  category: normalizeCategory(recipe.type),
  rarity: rarityFromDc(recipe.dc || 10),
  tags: [
    "blackspire",
    "crafting",
    normalizeCategory(recipe.type),
    rarityFromDc(recipe.dc || 10),
    ...tagsFrom(recipe.type, recipe.chapter, recipe.group, recipe.section),
  ],
  description: recipe.outcomes.normal || recipe.outcomes.superior || recipe.name,
  dc: recipe.dc || 10,
  time: recipe.time,
  tool: toolName(recipe.tool),
  stat: statFromTool(recipe.tool),
  materials: recipe.materials.map((material) => ({
    name: material.name,
    qty: material.quantity,
  })),
  outcomes: recipeOutcomes(recipe.outcomes),
}));

const refinementRecipes: Recipe[] = rawRefinements
  .filter((refinement) => !refinement.isTerminal)
  .map((refinement) => ({
    id: refinement.id,
    name: `${refinement.inputMaterial} → ${refinement.outputMaterial}`,
    category: "material-refinement",
    rarity: rarityFromDc(refinement.dc || 10),
    tags: [
      "blackspire",
      "refinement",
      "material-refinement",
      rarityFromDc(refinement.dc || 10),
      slugify(refinement.inputTier),
      slugify(refinement.outputTier),
      ...tagsFrom(refinement.chapter, refinement.group),
    ],
    description: refinement.notes || `Refine ${refinement.inputMaterial} into ${refinement.outputMaterial}.`,
    dc: refinement.dc || 10,
    time: refinement.time,
    tool: toolName(refinement.tool),
    stat: statFromTool(refinement.tool),
    materials: [
      {
        name: refinement.inputMaterial,
        qty: refinement.quantity || 1,
      },
    ],
    outcomes: refinementOutcomes(refinement),
  }));

export const recipesRaw: Recipe[] = [...craftingRecipes, ...refinementRecipes];
