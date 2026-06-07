import materialsJson from "./crafting/materials.json";

export type CraftingRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "ascendant"
  | "legendary"
  | "artifact";

export type MaterialTierEntry = {
  id?: string;
  name: string;
  tier: number;
  tierLabel: string;
  rarity?: CraftingRarity;
  tags: string[];
  source?: string;
  notes?: string;
  appearsIn?: {
    creature: string;
    pool: string;
    weight: number;
  }[];
};

export type MaterialTierGroup = {
  tier: number;
  label: string;
  names: string[];
};

export const tierToCraftingRarity: Record<number, CraftingRarity> = {
  0: "common",
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "ascendant",
  6: "legendary",
  7: "artifact",
};

export const materialTierLabels: Record<number, string> = {
  0: "Tier 0 – Raw Materials",
  1: "Tier 1 – Basic Materials",
  2: "Tier 2 – Standard Materials",
  3: "Tier 3 – Advanced Materials",
  4: "Tier 4 – High-End Materials",
  5: "Tier 5 – Master Materials",
  6: "Tier 6 – Legendary Materials",
  7: "Tier 7 – Artifact Materials",
};

export function normalizeMaterialName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const materialTierEntries = (materialsJson as MaterialTierEntry[]).map((entry) => ({
  ...entry,
  tier: Number(entry.tier ?? 0),
  tierLabel: entry.tierLabel || materialTierLabels[Number(entry.tier ?? 0)] || `Tier ${Number(entry.tier ?? 0)}`,
  rarity: entry.rarity || tierToCraftingRarity[Number(entry.tier ?? 0)] || "common",
  tags: Array.from(new Set([...(entry.tags || []), `tier-${Number(entry.tier ?? 0)}`])),
}));

const materialByName = new Map(
  materialTierEntries.map((entry) => [normalizeMaterialName(entry.name), entry])
);

export const materialTiers: MaterialTierGroup[] = Object.values(
  materialTierEntries.reduce<Record<number, MaterialTierGroup>>((acc, entry) => {
    if (!acc[entry.tier]) {
      acc[entry.tier] = {
        tier: entry.tier,
        label: entry.tierLabel,
        names: [],
      };
    }

    acc[entry.tier].names.push(entry.name);
    return acc;
  }, {})
).sort((a, b) => a.tier - b.tier);

export function getMaterialTier(name: string): number {
  return materialByName.get(normalizeMaterialName(name))?.tier ?? 0;
}

function normalizeTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getMaterialsByTag(tag: string): MaterialTierEntry[] {
  const normalizedTag = normalizeTag(tag);

  return materialTierEntries.filter((entry) =>
    (entry.tags || []).some((entryTag) => {
      const normalizedEntryTag = normalizeTag(entryTag);
      return (
        normalizedEntryTag === normalizedTag ||
        normalizedEntryTag.includes(normalizedTag) ||
        normalizedTag.includes(normalizedEntryTag)
      );
    })
  );
}

export function getPhaseTouchedCounterpart(name: string): string {
  const normalized = normalizeMaterialName(name);

  if (normalized.includes("phase touched")) return name;

  const direct = materialTierEntries.find(
    (entry) => normalizeMaterialName(entry.name) === `phase touched ${normalized}`
  );

  if (direct) return direct.name;

  const loose = materialTierEntries.find((entry) => {
    const entryName = normalizeMaterialName(entry.name);
    return entryName.includes("phase touched") && entryName.endsWith(normalized);
  });

  return loose?.name || `Phase-Touched ${name}`;
}
