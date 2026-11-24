import type { Season } from "./calendar";
import type { GatheringSpot } from "./gatheringSpots";
import type { LootTable } from "./lootTables";
import { creatureInfo } from "./creatures";

// The world reacts to the party:
//  - Seasons: plants, eggs and some fish can only be found in their seasons.
//  - Picked-over spots: every gathering attempt at a spot makes the next one
//    harder for a while; spots recover a little each day.
//  - Hunting pressure: killing a lot of one creature makes it scarce for a while.
//    When predators are hunted hard, prey thrives.

// ---------------------------------------------------------------- seasons
const ALL: Season[] = ["Spring", "Summer", "Autumn", "Winter"];
export const SEASONAL: Record<string, Season[]> = {
  Frostcurl: ["Spring"],
  Snowstalk: ["Winter", "Spring"],
  "Crag Nest Egg": ["Spring", "Summer"],
  "Reedfowl Egg": ["Spring", "Summer"],
  Cragberry: ["Summer", "Autumn"],
  Bramblesweet: ["Summer", "Autumn"],
  "Cloudwasp Comb": ["Summer", "Autumn"],
  Wardensbloom: ["Spring", "Summer"],
  "Pale Thistle": ["Summer", "Autumn"],
  Bitterleaf: ["Spring", "Summer", "Autumn"],
  Smokewort: ["Spring", "Summer", "Autumn"],
  Emberleaf: ["Summer", "Autumn"],
  Hollowcap: ["Spring", "Autumn"],
  Embergourd: ["Autumn"],
  Ashbulb: ["Autumn", "Winter"],
  "Hollowreed Seed": ["Summer", "Autumn"],
  Rimepod: ["Autumn", "Winter"],
  Streamfin: ["Spring", "Summer", "Autumn"],
};

// Rimepods also need a hard frost (or snow) to be worth picking.
const NEEDS_FROST = new Set(["Rimepod"]);
const FROSTY = new Set(["frost", "snow", "blizzard", "bitter-cold"]);

export function inSeason(name: string, season: Season, weather?: string) {
  const seasons = SEASONAL[name] || ALL;
  if (!seasons.includes(season)) return false;
  if (NEEDS_FROST.has(name) && season !== "Winter" && !FROSTY.has(weather || "")) return false;
  return true;
}

// The spot as it is today: out-of-season finds removed.
export function seasonalSpot(spot: GatheringSpot, season: Season, weather?: string): GatheringSpot {
  const yields = Object.fromEntries(
    Object.entries(spot.yields).map(([quality, entries]) => [quality, (entries || []).filter((entry) => inSeason(entry.name, season, weather))])
  ) as GatheringSpot["yields"];
  return { ...spot, yields };
}

export function outOfSeason(spot: GatheringSpot, season: Season, weather?: string) {
  const names = new Set<string>();
  Object.values(spot.yields).forEach((entries) => (entries || []).forEach((entry) => !inSeason(entry.name, season, weather) && names.add(entry.name)));
  return [...names];
}

// ---------------------------------------------------------------- picked-over spots
export type SpotUse = { uses: number; day: number };

// Recovers one use a day.
export function spotUsesNow(state: SpotUse | undefined, today: number) {
  return state ? Math.max(0, state.uses - Math.max(0, today - state.day)) : 0;
}

// The first 3 attempts are free; each one after adds +1 DC, up to +5.
export function spotDcPenalty(uses: number) {
  return Math.min(5, Math.max(0, uses - 2));
}

// ---------------------------------------------------------------- hunting pressure
export type Pressure = { pressure: number; day: number };

// Fades by 1 every 2 days.
export function pressureNow(state: Pressure | undefined, today: number) {
  return state ? Math.max(0, state.pressure - Math.max(0, today - state.day) / 2) : 0;
}

export type Abundance = "thriving" | "normal" | "thinning" | "scarce" | "hunted out";

export const ABUNDANCE_WEIGHT: Record<Abundance, number> = { thriving: 1.6, normal: 1, thinning: 0.6, scarce: 0.25, "hunted out": 0 };

export function abundanceFor(
  table: Pick<LootTable, "id" | "defaultTier" | "family">,
  pressures: Record<string, Pressure>,
  today: number,
  predatorPressure: number
): Abundance {
  const pressure = pressureNow(pressures[table.id], today);
  if (pressure >= 10) return "hunted out";
  if (pressure >= 6) return "scarce";
  if (pressure >= 3) return "thinning";
  // With the predators hunted hard, beasts that are prey multiply.
  if (creatureInfo(table).role === "prey" && table.family === "beast" && predatorPressure >= 8) return "thriving";
  return "normal";
}

// Total recent pressure on predatory beasts.
export function totalPredatorPressure(tables: Pick<LootTable, "id" | "defaultTier" | "family">[], pressures: Record<string, Pressure>, today: number) {
  return tables
    .filter((table) => table.family === "beast" && creatureInfo(table).role === "predator")
    .reduce((sum, table) => sum + pressureNow(pressures[table.id], today), 0);
}
