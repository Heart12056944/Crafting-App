import { materialTierEntries } from "./materialTiers";
import { isFoodRow } from "./rations";
import type { InventoryRow } from "@/lib/supabaseInventory";

// Helpers for passing a long stretch of time at once (weeks at the Vigil,
// years between chapters). The GM picks which of these happen.

export type TimeSkipOptions = {
  eat: boolean; // eat rations from packs and stash (off = meals are provided)
  spoil: boolean; // fresh food and perishable materials go off
  heal: boolean; // injuries heal; illnesses run their course
  rest: boolean; // exhaustion and hunger clear
  downtime: boolean; // characters keep up their downtime activity
  animals: boolean; // the herd's produce is collected into the materials
  bounties: boolean; // open jobs on the board expire
  standing: boolean; // faction standing drifts toward neutral
  resetWildlife: boolean; // hunting pressure and picked-over spots clear
};

export const DEFAULT_TIME_SKIP: TimeSkipOptions = {
  eat: false,
  spoil: true,
  heal: true,
  rest: true,
  downtime: true,
  animals: true,
  bounties: true,
  standing: false,
  resetWildlife: true,
};

export const TIME_SKIP_LABELS: Record<keyof TimeSkipOptions, string> = {
  eat: "Eat rations from packs and the stash (off: meals are provided, e.g. at the Vigil)",
  spoil: "Fresh food and perishable materials spoil (rations last as long as their label says)",
  heal: "Injuries heal and illnesses run their course",
  rest: "Everyone rests up: exhaustion and hunger clear",
  downtime: "Characters keep up their downtime (training, work, research, carousing)",
  animals: "The herd's produce (milk, eggs, wool...) is collected into the party's materials",
  bounties: "Open bounties and commissions expire",
  standing: "Faction standing drifts back toward neutral (1 point a month)",
  resetWildlife: "Hunted-out creatures and picked-over spots recover",
};

export const TIME_UNITS: { id: string; label: string; days: number }[] = [
  { id: "days", label: "days", days: 1 },
  { id: "weeks", label: "weeks", days: 7 },
  { id: "months", label: "months (30 days)", days: 30 },
  { id: "seasons", label: "seasons (90 days)", days: 90 },
  { id: "years", label: "years (360 days)", days: 360 },
];

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, nine: 9, twelve: 12 };
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 360 };

// How long a food item keeps, in days. Fresh dishes keep 3 days; rations say so on the label.
export function shelfLifeDays(row: Pick<InventoryRow, "name" | "description" | "metadata">): number | null {
  if (!isFoodRow(row)) return null; // not food: never spoils
  const match = `${row.description || ""}`.toLowerCase().match(/keeps? for (\d+|an?|one|two|three|four|five|six|nine|twelve) (day|week|month|year)s?/);
  if (match) {
    const count = Number(match[1]) || WORDS[match[1]] || 1;
    return count * UNIT_DAYS[match[2]];
  }
  return /ration/i.test(row.name) ? 180 : 3;
}

// Perishable materials in the party pool and how long they last.
const PERISHABLE: [string, number][] = [
  ["produce-milk", 2],
  ["fish", 2],
  ["fishing", 2],
  ["meat", 3],
  ["produce-egg", 21],
  ["produce-vegetable", 30],
  ["produce-fruit", 14],
];

const tagsByName = new Map(materialTierEntries.map((entry) => [entry.name.toLowerCase(), entry.tags || []]));

export function materialShelfLifeDays(name: string): number | null {
  const tags = tagsByName.get(name.toLowerCase()) || [];
  if (tags.includes("produce-cheese") || tags.includes("pantry") || tags.includes("produce-herb")) return null;
  for (const [tag, days] of PERISHABLE) if (tags.includes(tag)) return days;
  return null;
}

// "1d3" -> 2, "2" -> 2.
export function averageDice(expression: string | undefined | null) {
  if (!expression) return 1;
  const match = expression.replace(/\s/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return Number(expression) || 1;
  return Number(match[1] || 1) * ((Number(match[2]) + 1) / 2) + Number(match[3] || 0);
}

export function describeSpan(days: number) {
  const years = Math.floor(days / 360);
  const months = Math.floor((days % 360) / 30);
  const rest = days % 30;
  return [years ? `${years} year${years === 1 ? "" : "s"}` : "", months ? `${months} month${months === 1 ? "" : "s"}` : "", rest ? `${rest} day${rest === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(", ") || "no time";
}
