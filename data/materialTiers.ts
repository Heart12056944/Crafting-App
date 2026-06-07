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

type JsonMaterial = {
  id: string;
  name: string;
  tier: string;
  source: string;
  notes: string;
  appearsIn: {
    creature: string;
    pool: string;
    weight: number;
  }[];
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

function tierNumber(tier: string | number | undefined): number {
  if (typeof tier === "number") return tier;
  const match = String(tier || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function tagify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeMaterialName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const rawMaterials = materialsJson as JsonMaterial[];

export const materialTierEntries: MaterialTierEntry[] = rawMaterials
  .map((material) => {
    const tier = tierNumber(material.tier);
    const tags = new Set<string>([
      `tier-${tier}`,
      tagify(material.source || "material"),
    ]);

    for (const use of material.appearsIn || []) {
      tags.add(tagify(use.creature));
      tags.add(tagify(use.pool));
    }

    const lowerName = material.name.toLowerCase();
    if (lowerName.includes("phase")) tags.add("phase");
    if (lowerName.includes("dragon")) tags.add("dragon");
    if (lowerName.includes("storm") || lowerName.includes("lightning")) tags.add("storm");
    if (lowerName.includes("spider") || lowerName.includes("silk") || lowerName.includes("web")) tags.add("spider");
    if (lowerName.includes("frost") || lowerName.includes("ice") || lowerName.includes("cryo")) tags.add("frost");
    if (lowerName.includes("venom") || lowerName.includes("toxin") || lowerName.includes("poison")) tags.add("venom");

    return {
      name: material.name,
      tier,
      tierLabel: materialTierLabels[tier] || `Tier ${tier}`,
      rarity: tierToCraftingRarity[tier],
      tags: Array.from(tags).filter(Boolean),
      source: material.source,
      notes: material.notes,
      appearsIn: material.appearsIn || [],
    };
  })
  .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

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

export function getMaterialsByTag(tag: string): MaterialTierEntry[] {
  const normalizedTag = tagify(tag);

  return materialTierEntries.filter((entry) => {
    return entry.tags.some((entryTag) => {
      const normalizedEntryTag = tagify(entryTag);
      return (
        normalizedEntryTag === normalizedTag ||
        normalizedEntryTag.includes(normalizedTag) ||
        normalizedTag.includes(normalizedEntryTag)
      );
    });
  });
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
