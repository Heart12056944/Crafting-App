import spotsJson from "./crafting/gatheringSpots.json";
import type { LootEntry, LootQuality } from "./lootTables";

// Gathering spots live in crafting/gatheringSpots.json. Add a spot there and it
// shows up in the Gathering tab; no code changes needed.

export type GatheringActivity = "mining" | "woodcutting" | "foraging" | "fishing";
export type GatheringTier = "common" | "uncommon" | "rare" | "epic";
export type GatheringStat = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export type GatheringSpot = {
  id: string;
  name: string;
  activity: GatheringActivity;
  tier: GatheringTier;
  dc: number;
  description: string;
  set?: string;
  region?: string;
  yields: Partial<Record<LootQuality, LootEntry[]>>;
};

export const gatheringActivities: Record<
  GatheringActivity,
  { label: string; stat: GatheringStat; tool: string; verb: string; summary: string }
> = {
  mining: {
    label: "Mining",
    stat: "STR",
    tool: "Pickaxe",
    verb: "Mine",
    summary: "Strike when the marker crosses the vein. Three strikes per attempt.",
  },
  woodcutting: {
    label: "Woodcutting",
    stat: "STR",
    tool: "Woodcutter's Axe",
    verb: "Chop",
    summary: "Chop in rhythm as each ring closes. Five beats per attempt.",
  },
  foraging: {
    label: "Foraging",
    stat: "WIS",
    tool: "Herbalism Kit",
    verb: "Forage",
    summary: "Search the patch for herbs. Some plants are lookalikes.",
  },
  fishing: {
    label: "Fishing",
    stat: "DEX",
    tool: "Fishing Rod",
    verb: "Fish",
    summary: "Hook on the bite, then keep the line tension in the green.",
  },
};

export const GATHERING_TOOLS = Object.values(gatheringActivities).map((activity) => activity.tool);

export const GATHERING_ATTEMPTS_PER_DAY = 3;

// Attribute cards (data/attributes/attributeCards.json, ids 7240-7259) that the
// Gathering tab applies automatically when assigned to a character.
export const GATHERING_ATTRIBUTE_IDS = {
  prospectorsEye: 7240,
  steadySwing: 7241,
  deepDelver: 7242,
  gemSense: 7243,
  timberSense: 7244,
  lumberjacksRhythm: 7245,
  heartwoodFinder: 7246,
  cleanCuts: 7247,
  herbalistsEye: 7248,
  lookalikeWise: 7249,
  greenThumb: 7250,
  bountifulGatherer: 7251,
  patientAngler: 7252,
  hairTriggerReflexes: 7253,
  steadyLine: 7254,
  bigCatch: 7255,
  upBeforeDawn: 7256,
  jackOfTheWilds: 7257,
  fortuneFavours: 7258,
  cantWalkPastIt: 7259,
} as const;

export const gatheringAttributeMeta: { id: number; name: string; activity: GatheringActivity | "any"; summary: string }[] = [
  { id: 7240, name: "Prospector's Eye", activity: "mining", summary: "Advantage on Mining checks." },
  { id: 7241, name: "Steady Swing", activity: "mining", summary: "The vein counts as half again as wide." },
  { id: 7242, name: "Deep Delver", activity: "mining", summary: "One extra strike per Mining attempt." },
  { id: 7243, name: "Gem Sense", activity: "mining", summary: "Common Mining results reroll quality once, keeping the better." },
  { id: 7244, name: "Timber Sense", activity: "woodcutting", summary: "Advantage on Woodcutting checks." },
  { id: 7245, name: "Lumberjack's Rhythm", activity: "woodcutting", summary: "Chop timing window is half again as wide." },
  { id: 7246, name: "Heartwood Finder", activity: "woodcutting", summary: "Five clean chops: +1 loot roll and one quality upgrade." },
  { id: 7247, name: "Clean Cuts", activity: "woodcutting", summary: "+1 quantity on common Woodcutting results." },
  { id: 7248, name: "Herbalist's Eye", activity: "foraging", summary: "Advantage on Foraging checks; one herb always marked." },
  { id: 7249, name: "Lookalike Wise", activity: "foraging", summary: "Lookalikes are marked; immune to hollowcap poison." },
  { id: 7250, name: "Green Thumb", activity: "foraging", summary: "Two extra picks per Foraging attempt." },
  { id: 7251, name: "Bountiful Gatherer", activity: "foraging", summary: "+1 quantity on common Foraging results." },
  { id: 7252, name: "Patient Angler", activity: "fishing", summary: "Advantage on Fishing checks." },
  { id: 7253, name: "Hair-Trigger Reflexes", activity: "fishing", summary: "Bite window doubled; one extra cast." },
  { id: 7254, name: "Steady Line", activity: "fishing", summary: "Safe tension zone half again as wide; fish fight less." },
  { id: 7255, name: "Big Catch", activity: "fishing", summary: "+1 loot roll whenever you land a fish." },
  { id: 7256, name: "Up Before Dawn", activity: "any", summary: "One extra gathering attempt per day." },
  { id: 7257, name: "Jack of the Wilds", activity: "any", summary: "+2 to all gathering checks." },
  { id: 7258, name: "Fortune Favours the Forager", activity: "any", summary: "A natural 19 on a gathering check counts as a natural 20." },
  { id: 7259, name: "Can't Walk Past It", activity: "any", summary: "A natural 1 on a gathering check doesn't waste the attempt." },
];

export function gatheringAttemptsPerDay(cardIds: Set<number>) {
  return GATHERING_ATTEMPTS_PER_DAY + (cardIds.has(GATHERING_ATTRIBUTE_IDS.upBeforeDawn) ? 1 : 0);
}

// Chance of each loot quality per loot roll, by spot tier.
export const gatheringTierWeights: Record<GatheringTier, { none: number; common: number; rare: number; epic: number }> = {
  common: { none: 10, common: 75, rare: 13, epic: 2 },
  uncommon: { none: 6, common: 60, rare: 27, epic: 7 },
  rare: { none: 3, common: 42, rare: 40, epic: 15 },
  epic: { none: 2, common: 28, rare: 42, epic: 28 },
};

export const gatheringTierLabels: Record<GatheringTier, string> = {
  common: "Common Spot",
  uncommon: "Uncommon Spot",
  rare: "Rare Spot",
  epic: "Epic Spot",
};

export const gatheringSpots: GatheringSpot[] = (spotsJson as GatheringSpot[]).map((spot) => ({
  ...spot,
  yields: Object.fromEntries(
    Object.entries(spot.yields || {}).map(([quality, entries]) => [
      quality,
      (entries || []).map((entry) => ({ ...entry, kind: entry.kind || "material" })),
    ])
  ) as GatheringSpot["yields"],
}));

export function rollGatheringQuality(tier: GatheringTier): LootQuality | "none" {
  const weights = gatheringTierWeights[tier];
  const total = weights.none + weights.common + weights.rare + weights.epic;
  let roll = Math.random() * total;
  if ((roll -= weights.none) < 0) return "none";
  if ((roll -= weights.common) < 0) return "common";
  if ((roll -= weights.rare) < 0) return "rare";
  return "epic";
}

export function upgradeQuality(quality: LootQuality | "none"): LootQuality {
  if (quality === "none") return "common";
  if (quality === "common") return "rare";
  return "epic";
}
