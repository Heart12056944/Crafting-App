import lootTablesJson from "./crafting/lootTables.json";

export type LootQuality = "common" | "rare" | "epic";
export type CreatureTier = "common" | "uncommon" | "rare" | "epic" | "boss";

export type LootEntry = {
  name: string;
  amount?: string;
  kind?: "material" | "item" | "tool" | "kit";
  weight?: number;
  tier?: string;
  source?: string;
  notes?: string;
};

export type LootTable = {
  id: string;
  label: string;
  family: string;
  creatureTier?: CreatureTier;
  notes?: string;
  tables: Partial<Record<LootQuality, LootEntry[]>>;
};

type JsonLootEntry = {
  weight: number;
  materialName: string;
  tier: string;
  source: string;
  notes: string;
};

type JsonLootTable = {
  id: string;
  creature: string;
  creatureTier: string;
  pool: string;
  totalWeight: number;
  entries: JsonLootEntry[];
  chapter?: string;
  notes?: string;
  source?: string;
};

export const creatureTierRules: Record<CreatureTier, {
  label: string;
  attempts: number;
  dc: number;
  weights: { noLoot: number; common: number; rare: number; epic: number };
}> = {
  common: { label: "Common Creature", attempts: 2, dc: 10, weights: { noLoot: 20, common: 74, rare: 5, epic: 1 } },
  uncommon: { label: "Uncommon Creature", attempts: 3, dc: 12, weights: { noLoot: 12, common: 63, rare: 20, epic: 5 } },
  rare: { label: "Rare Creature", attempts: 4, dc: 14, weights: { noLoot: 8, common: 42, rare: 35, epic: 15 } },
  epic: { label: "Epic Creature", attempts: 5, dc: 15, weights: { noLoot: 3, common: 27, rare: 40, epic: 30 } },
  boss: { label: "Boss Creature", attempts: 6, dc: 17, weights: { noLoot: 1, common: 19, rare: 35, epic: 45 } },
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizePool(pool: string): LootQuality {
  const normalized = pool.toLowerCase();
  if (normalized === "rare") return "rare";
  if (normalized === "epic") return "epic";
  return "common";
}

function normalizeCreatureTier(tier: string): CreatureTier {
  const normalized = tier.toLowerCase();
  if (normalized.includes("boss")) return "boss";
  if (normalized.includes("epic")) return "epic";
  if (normalized.includes("rare")) return "rare";
  if (normalized.includes("uncommon")) return "uncommon";
  return "common";
}

function familyFromTable(table: JsonLootTable) {
  const chapter = table.chapter?.replace(/^CHAPTER\s+\d+\s+—\s+/i, "") || "";
  return slugify(chapter || table.creature);
}

const rawLootTables = lootTablesJson as JsonLootTable[];

const lootTableMap = new Map<string, LootTable>();

for (const table of rawLootTables) {
  const id = slugify(table.creature);
  const pool = normalizePool(table.pool);

  if (!lootTableMap.has(id)) {
    lootTableMap.set(id, {
      id,
      label: table.creature,
      family: familyFromTable(table),
      creatureTier: normalizeCreatureTier(table.creatureTier),
      notes: table.notes,
      tables: {},
    });
  }

  const existing = lootTableMap.get(id)!;

  existing.tables[pool] = table.entries.map((entry) => ({
    name: entry.materialName,
    kind: "material",
    weight: entry.weight,
    tier: entry.tier,
    source: entry.source,
    notes: entry.notes,
  }));
}

export const lootTables: LootTable[] = Array.from(lootTableMap.values());

export function rollDiceExpression(expr?: string): number {
  if (!expr) return 1;

  const cleaned = expr.trim();
  const diceMatch = cleaned.match(/^(\d*)d(\d+)$/i);

  if (diceMatch) {
    const count = Number(diceMatch[1] || 1);
    const sides = Number(diceMatch[2] || 0);
    let total = 0;

    for (let i = 0; i < count; i += 1) {
      total += Math.floor(Math.random() * sides) + 1;
    }

    return total;
  }

  const flatNumber = Number(cleaned);
  return Number.isFinite(flatNumber) && flatNumber > 0 ? flatNumber : 1;
}

export function rollWeightedLootQuality(tier: CreatureTier): LootQuality | "none" {
  const rule = creatureTierRules[tier] || creatureTierRules.common;
  const total =
    rule.weights.noLoot +
    rule.weights.common +
    rule.weights.rare +
    rule.weights.epic;

  let roll = Math.random() * total;

  roll -= rule.weights.noLoot;
  if (roll < 0) return "none";

  roll -= rule.weights.common;
  if (roll < 0) return "common";

  roll -= rule.weights.rare;
  if (roll < 0) return "rare";

  return "epic";
}

export function getLootTable(id: string): LootTable {
  return lootTables.find((table) => table.id === id) || lootTables[0];
}

export function rollWeightedLootEntry(entries: LootEntry[], randomValue = Math.random()) {
  const pool = entries.filter((entry) => (entry.weight || 0) > 0);

  if (pool.length === 0) {
    return entries.length > 0 ? entries[Math.floor(randomValue * entries.length)] : null;
  }

  const totalWeight = pool.reduce((sum, entry) => sum + (entry.weight || 1), 0);
  let roll = randomValue * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight || 1;
    if (roll <= 0) return entry;
  }

  return pool[pool.length - 1];
}
