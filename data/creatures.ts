import type { LootTable } from "./lootTables";

// Challenge rating and role for every creature, used by the random bounty
// board and the Combat tab. Change a CR here if your table runs a creature
// stronger or weaker than listed.
//   predator: hunts (incl. monsters and hostile people)
//   prey:     grazes, scavenges or flees
//   kind:     canine / feline creatures can be tamed (DC 17 and up)

export type CreatureRole = "predator" | "prey";
export type CreatureInfo = { cr: number; role: CreatureRole; kind?: "canine" | "feline" };

export const CREATURE_INFO: Record<string, CreatureInfo> = {
  // Tales on the Sea
  skeleton: { cr: 0.25, role: "predator" },
  "blue-drake": { cr: 2, role: "predator" },
  "blue-half-dragon": { cr: 5, role: "predator" },
  "blue-dragon-wyrmling": { cr: 3, role: "predator" },
  "young-blue-dragon": { cr: 9, role: "predator" },
  "giant-wolf-spider": { cr: 0.25, role: "predator" },
  "giant-spider": { cr: 1, role: "predator" },
  "phase-spider": { cr: 3, role: "predator" },
  "giant-spider-matriarch": { cr: 5, role: "predator" },
  "merfolk-reaver": { cr: 2, role: "predator" },
  "merfolk-tide-caller": { cr: 3, role: "predator" },
  "coral-hulked-behemoth": { cr: 8, role: "predator" },
  "reef-shark": { cr: 0.5, role: "predator" },
  "hunter-shark": { cr: 2, role: "predator" },
  "giant-shark": { cr: 5, role: "predator" },
  "giant-crab": { cr: 0.125, role: "prey" },
  "giant-octopus": { cr: 1, role: "predator" },
  // Blackspire
  "failed-hybrid": { cr: 0.5, role: "predator" },
  dragonhound: { cr: 2, role: "predator" },
  "sparkwing-stalker": { cr: 4, role: "predator" },
  "arcane-devourer": { cr: 5, role: "predator" },
  "venomfang-stalker": { cr: 1, role: "predator" },
  "mirewing-hunter": { cr: 2, role: "predator" },
  "plague-maw-ravager": { cr: 5, role: "predator" },
  "frostclaw-prowler": { cr: 1, role: "predator" },
  "glacier-wing-predator": { cr: 3, role: "predator" },
  "winterfang-behemoth": { cr: 6, role: "predator" },
  "riftclaw-spider": { cr: 5, role: "predator" },
  "collar-sentinel": { cr: 3, role: "predator" },
  "sanguine-warden": { cr: 5, role: "predator" },
  "cryomantic-horror": { cr: 6, role: "predator" },
  "mutated-chimera-hound": { cr: 5, role: "predator" },
  "tempest-tyrant": { cr: 10, role: "predator" },
  // Undying Vigil
  brainless: { cr: 0.25, role: "predator" },
  "silkchoke-spider": { cr: 1, role: "predator" },
  "rime-bear": { cr: 2, role: "predator" },
  frostmaw: { cr: 3, role: "predator" },
  "pinewood-bear": { cr: 0.5, role: "predator" },
  "ridge-boar": { cr: 0.25, role: "prey" },
  "scree-adder": { cr: 0.125, role: "predator" },
  "rootcoil-constrictor": { cr: 0.25, role: "predator" },
  "ashback-viper": { cr: 0.25, role: "predator" },
  "crownhorn-elk": { cr: 2, role: "prey" },
  "highland-deer": { cr: 0, role: "prey" },
  "dusk-bat-swarm": { cr: 0.25, role: "prey" },
  "silkchoke-matriarch": { cr: 5, role: "predator" },
  "directed-brainless": { cr: 1, role: "predator" },
  "the-bellman": { cr: 5, role: "predator" },
  "oren-thask": { cr: 8, role: "predator" },
  "thornspine-wolf": { cr: 0.25, role: "predator", kind: "canine" },
  "ridge-stag": { cr: 0.25, role: "prey" },
  "crag-hawk": { cr: 0, role: "predator" },
  "thornspine-bear": { cr: 1, role: "predator" },
  "skeleton-warrior": { cr: 0.25, role: "predator" },
  "skeleton-archer": { cr: 0.25, role: "predator" },
  "skeleton-knight": { cr: 2, role: "predator" },
  "skeleton-mage": { cr: 2, role: "predator" },
  "death-knight": { cr: 8, role: "predator" },
  lich: { cr: 12, role: "predator" },
  "mountain-ram": { cr: 0.25, role: "prey" },
  "tuskback-boar": { cr: 2, role: "prey" },
  "carrion-crow": { cr: 0, role: "prey" },
  "cave-bat": { cr: 0, role: "prey" },
  "snow-cat": { cr: 0.5, role: "predator", kind: "feline" },
  "tarn-serpent": { cr: 3, role: "predator" },
  "brainless-wolf": { cr: 0.5, role: "predator" },
  "brainless-bear": { cr: 2, role: "predator" },
  "bloom-amalgam": { cr: 5, role: "predator" },
  "waking-cultist": { cr: 0.5, role: "predator" },
  "compact-deserter": { cr: 0.125, role: "predator" },
  "ridge-fox": { cr: 0, role: "predator", kind: "canine" },
  "scree-jackal": { cr: 0.125, role: "predator", kind: "canine" },
  "feral-hound": { cr: 0.125, role: "predator", kind: "canine" },
  "thornspine-direwolf": { cr: 1, role: "predator", kind: "canine" },
  "valdren-mouser": { cr: 0, role: "predator", kind: "feline" },
  "crag-lynx": { cr: 0.125, role: "predator", kind: "feline" },
  "ridge-panther": { cr: 0.25, role: "predator", kind: "feline" },
  "thornspine-sabretooth": { cr: 2, role: "predator", kind: "feline" },
  // Basic gear (farm)
  "valdren-kine": { cr: 0.25, role: "prey" },
  "valdren-hog": { cr: 0.125, role: "prey" },
};

const TIER_CR: Record<string, number> = { common: 0.25, uncommon: 1, rare: 3, epic: 5, boss: 10 };

// Creatures added later without an entry get a CR from their tier.
export function creatureInfo(table: Pick<LootTable, "id" | "defaultTier" | "family">): CreatureInfo {
  return CREATURE_INFO[table.id] || { cr: TIER_CR[table.defaultTier || "common"] ?? 1, role: "predator" };
}

export function formatCr(cr: number) {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}

// ---------------------------------------------------------------------------
// Random bounties: which creatures count as common, rare or epic for a party.
//   epic:   a challenging fight, CR above the party's level up to level + 2
//   rare:   up to 2 below that (CR above level − 2, never below 1/2, up to level)
//   common: CR 1 and under, and anything below the rare band
// Where common and rare overlap (low levels), predators are common and prey
// is rare: tough prey is hard to find.
// ---------------------------------------------------------------------------

export type BountyRarity = "common" | "rare" | "epic";

export const BOUNTY_CAPS: Record<BountyRarity, number> = { common: 8, rare: 5, epic: 3 };

export function bountyBands(partyLevel: number) {
  const level = Math.max(1, Math.round(partyLevel));
  const rareMin = Math.max(0.5, level - 2); // exclusive
  return {
    epic: { min: level, max: level + 2 }, // min exclusive, max inclusive
    rare: { min: rareMin, max: level },
    common: { max: Math.max(1, rareMin) },
  };
}

export function bountyRarityFor(info: CreatureInfo, partyLevel: number): BountyRarity | null {
  const bands = bountyBands(partyLevel);
  const inEpic = info.cr > bands.epic.min && info.cr <= bands.epic.max;
  const inRare = info.cr > bands.rare.min && info.cr <= bands.rare.max;
  const inCommon = info.cr <= bands.common.max;
  if (inRare && inCommon) return info.role === "prey" ? "rare" : "common";
  if (inEpic) return "epic";
  if (inRare) return "rare";
  if (inCommon) return "common";
  return null; // too strong for this party
}
