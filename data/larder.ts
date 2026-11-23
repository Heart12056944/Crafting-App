// The Larder: what every meat, fish, vegetable, fruit, herb and dish looks
// like, where it comes from and what it's cooked into. Built from the crafting
// data, so new foods show up here as soon as they have an "appearance".

import materialsJson from "./crafting/materials.json";
import recipesJson from "./crafting/recipes.json";
import { lootTables } from "./lootTables";
import { gatheringSpots } from "./gatheringSpots";
import { SHOP_TEMPLATES } from "./shops";
import { HUSBANDRY_SPECIES } from "./husbandry";

type MaterialJson = { name: string; tier: number; tags?: string[]; set?: string; notes?: string; appearance?: string };
type RecipeJson = {
  name: string;
  type: string;
  dc: number | null;
  set?: string;
  appearance?: string;
  materials: { name: string; quantity: number; tag?: string }[];
  outcomes: { superior?: string; normal?: string; flawed?: string };
};

export type LarderSection = "meat" | "fish" | "egg" | "dairy" | "vegetable" | "fruit" | "herb" | "pantry" | "dish";

export type LarderEntry = {
  name: string;
  section: LarderSection;
  set: string;
  look: string;
  notes: string;
  // Short labels: grade or band, region, animal.
  badges: string[];
  foundIn: string[];
  usedIn: string[];
};

export const LARDER_SECTIONS: { id: LarderSection; label: string; intro: string }[] = [
  { id: "meat", label: "Meat", intro: "Cuts from game animals, farm kine and hogs, and sea creatures, by grade: everyday, choice and prime." },
  { id: "fish", label: "Fish", intro: "Caught at fishing spots." },
  { id: "egg", label: "Eggs", intro: "From wild nests, farm coops, island rocks, and the occasional hunted creature." },
  { id: "dairy", label: "Milk & Cheese", intro: "Bought from farms and ports, or milked from your own animals (Husbandry tab) and ripened into cheese." },
  { id: "vegetable", label: "Vegetables", intro: "Foraged in the wild, or bought from valley farms and island ports." },
  { id: "fruit", label: "Fruit", intro: "Foraged in the wild, or bought from valley orchards and island ports." },
  { id: "herb", label: "Herbs", intro: "Culinary herbs and seasonings." },
  { id: "pantry", label: "Pantry & Preserving", intro: "Flour and bread, and the salt, vinegar and spice that keep food for months." },
  { id: "dish", label: "Meals & Rations", intro: "Everything that can be cooked with Cook's Utensils." },
];

const ANIMALS: Record<string, string> = {
  wolf: "Wolf",
  deer: "Stag",
  bird: "Hawk",
  bear: "Bear",
  ram: "Ram",
  boar: "Boar",
  serpent: "Tarn Serpent",
  shark: "Shark",
  crab: "Crab",
  octopus: "Octopus",
  kine: "Kine",
  hog: "Hog",
};

const materials = materialsJson as MaterialJson[];
const recipes = recipesJson as RecipeJson[];

function title(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sectionFor(tags: string[]): LarderSection | null {
  if (tags.includes("meat")) return "meat";
  if (tags.includes("fishing")) return "fish";
  if (tags.includes("egg")) return "egg";
  if (tags.includes("dairy")) return "dairy";
  if (tags.includes("pantry")) return "pantry";
  if (tags.includes("produce-vegetable")) return "vegetable";
  if (tags.includes("produce-fruit")) return "fruit";
  if (tags.includes("produce-herb")) return "herb";
  return null;
}

function badgesFor(tags: string[]): string[] {
  const badges: string[] = [];
  if (tags.includes("meat-grade-prime")) badges.push("Prime cut");
  else if (tags.includes("meat-grade-choice")) badges.push("Choice cut");
  else if (tags.includes("meat")) badges.push("Everyday cut");
  const animal = Object.keys(ANIMALS).find((key) => tags.includes(key));
  if (animal) badges.push(ANIMALS[animal]);
  if (tags.includes("valdren")) badges.push("Valdren farms");
  if (tags.includes("romley")) badges.push("Romley islands");
  if (tags.includes("foraging")) badges.push("Wild, Thornspine");
  if (tags.includes("husbandry")) badges.push("From your animals");
  return badges;
}

// Where each material can be found: creatures, gathering spots, shop templates.
const foundInByName = new Map<string, Set<string>>();
function addFound(name: string, place: string) {
  if (!foundInByName.has(name)) foundInByName.set(name, new Set());
  foundInByName.get(name)!.add(place);
}
lootTables.forEach((table) =>
  Object.values(table.tables).forEach((entries) => (entries || []).forEach((entry) => addFound(entry.name, title(table.label))))
);
gatheringSpots.forEach((spot) =>
  Object.values(spot.yields).forEach((entries) => (entries || []).forEach((entry) => addFound(entry.name, spot.name)))
);
SHOP_TEMPLATES.forEach((shop) => shop.stock.forEach((name) => addFound(name, `${shop.name} (shop)`)));
HUSBANDRY_SPECIES.forEach((species) =>
  species.products.forEach((product) => product.materials.forEach((item) => addFound(item.name, `${species.name} (husbandry)`)))
);

const foodRecipes = recipes.filter((recipe) => recipe.type === "Food");

// Dishes that name this exact food come first, then those asking for its best
// grade (a prime cut before "any meat cut").
const TAG_RANK: Record<string, number> = { "meat-grade-prime": 1, "meat-grade-choice": 2 };

function usedInFor(material: MaterialJson): string[] {
  const tags = material.tags || [];
  return foodRecipes
    .map((recipe) => {
      const ranks = recipe.materials
        .filter((item) => (item.tag ? tags.includes(item.tag) : item.name === material.name))
        .map((item) => (item.tag ? TAG_RANK[item.tag] ?? 3 : 0));
      return { name: recipe.name, rank: ranks.length ? Math.min(...ranks) : -1 };
    })
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.name);
}

function bandFor(recipe: RecipeJson): string {
  const text = `${recipe.outcomes.normal || ""} ${recipe.outcomes.superior || ""}`.toLowerCase();
  if (text.includes("ration")) return "Rations";
  const dc = recipe.dc ?? 10;
  if (dc >= 14) return "Fine meal: bonuses unless botched";
  if (dc >= 12) return "Good meal: bonus on a Superior result";
  return "Plain meal";
}

export const larderEntries: LarderEntry[] = [
  ...materials
    .filter((material) => material.appearance)
    .flatMap((material): LarderEntry[] => {
      const tags = material.tags || [];
      const section = sectionFor(tags);
      if (!section) return [];
      return [
        {
          name: material.name,
          section,
          set: material.set || "blackspire",
          look: material.appearance || "",
          notes: material.notes || "",
          badges: badgesFor(tags),
          foundIn: Array.from(foundInByName.get(material.name) || []),
          usedIn: usedInFor(material),
        },
      ];
    }),
  ...foodRecipes
    .filter((recipe) => recipe.appearance)
    .map((recipe) => ({
      name: recipe.name,
      section: "dish" as const,
      set: recipe.set || "blackspire",
      look: recipe.appearance || "",
      notes: `Made from ${recipe.materials.map((item) => `${item.quantity}× ${item.name}`).join(", ")}.`,
      badges: [bandFor(recipe), `DC ${recipe.dc ?? 10}`],
      foundIn: [],
      usedIn: [],
    })),
];
