export type LootQuality = "common" | "rare" | "epic";
export type CreatureTier = "common" | "uncommon" | "rare" | "epic" | "boss";

export type LootEntry = {
  name: string;
  amount?: string;
  kind?: "material" | "item" | "tool" | "kit";
};

export type LootTable = {
  id: string;
  label: string;
  family: string;
  tables: Partial<Record<LootQuality, LootEntry[]>>;
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

function e(name: string, kind: LootEntry["kind"] = "material"): LootEntry {
  const match = name.match(/^(.*?)\s+\((\d*d\d+|\d+)\)$/i);
  if (match) return { name: match[1].trim(), amount: match[2], kind };
  return { name, kind };
}

export const lootTables: LootTable[] = [
  {
    id: "skeleton",
    label: "Skeleton",
    family: "skeleton",
    tables: {
      common: [
        "Carved Bone", "Scrap Steel", "Basic Fiber", "Cloth", "Leather Scraps", "Bone Needle",
        "Twine (50ft.)", "Cloth Bolts", "Leather Cord", "Cotton Thread", "Wood Planks", "Resin",
        "Binding Agents", "Empty Vials (set of 3)", "Basic Weapon Components", "Basic Tool Kit",
        "Sharpening Kit", "Weaver's Tools", "Leatherworker's Tools", "Smith's Tools", "Mana Dust", "Blank Scrolls",
      ].map((name) => e(name, name.includes("Tools") || name.includes("Kit") ? "tool" : "material")),
      rare: [
        "Rusted Shortsword", "Chipped Spear", "Cracked Bone Club", "Old Dagger", "Tarnished Shield",
        "Pitted Handaxe", "Rusty Mace", "Splintered Light Crossbow", "Cracked Longbow", "Old Flintlock", "Worn Arcane Focus",
      ].map((name) => e(name, "item")),
      epic: [
        "Powderburn Musket", "Brine-Tuned Pistol", "Reefbreaker Blunderbuss", "Tidehook Harpoon",
        "Saltfang Shortsword", "Barnacle Guard Shield", "Mistwalker Cloak", "Kelpgrip Gloves", "Deepwater Ring",
        "Coral Edge Dagger", "Rustbite Musket", "Splintermouth Blunderbuss", "Quickflash Pistol",
        "Cracklefang Dagger", "Stormspine Spear", "Rainspark Flintlock",
      ].map((name) => e(name, "item")),
    },
  },
  {
    id: "blue-drake",
    label: "Blue Drake",
    family: "blue-dragon",
    tables: {
      common: [
        "Crackling Scale Fragments (1d4)", "Static-Charged Hide Scraps (1d4)", "Brittle Horn Shards (1d4)",
        "Drake Scales (1d4)", "Residual Lightning Gland", "Scorched Bone Splinters (1d6)",
        "Salt-Cracked Hide Scraps (1d4)", "Flicker Residue", "Minor Conductive Blood Sample",
      ].map((name) => e(name)),
      rare: [
        "Reinforced Drake Scale", "Charged Lightning Gland", "Conductive Blood Crystal", "Stormbound Tendon Coil",
        "Pressure-Forged Spine Segment", "Tempest Core Fragment", "Ionized Fang", "Flicker Core Cluster", "Stormcall Scale Cluster",
      ].map((name) => e(name)),
      epic: [
        "Large Reinforced Drake Scale", "Fully Intact Tempest Core", "Apex Lighting Gland", "Conductive Blood Reservoir",
        "Stormcall Spine (Primary Segment)", "Ionized Crest Horn", "Living Storm Essence", "Tempest Anchor Node",
        "Phase-Charged Thunder Sac",
      ].map((name) => e(name)),
    },
  },
  {
    id: "blue-half-dragon",
    label: "Blue Half-Dragon",
    family: "blue-dragon",
    tables: {
      common: [
        "Fractured Scale Fragments (1d4)", "Storm-Touched Hide Scraps (1d4)", "Residual Storm Gland", "Flicker Residue",
        "Cracked Horn Shards (1d4)", "Charred Bone Splinters (1d6)", "Charged Tendon Strips (1d4)",
        "Salt-Burnt Hide Scraps (1d4)", "Minor Conductive Blood Sample", "Unstable Scale Dust",
        "Nerve Filament Threads (1d4)", "Half-Dragon Scale",
      ].map((name) => e(name)),
      rare: [
        "Hardened Half-Dragon Scale", "Charged Storm Gland", "Conductive Blood Crystal", "Stormbound Tendon Coil",
        "Reinforced Spine Segment", "Ionized Fang", "Flicker Core Cluster", "Stormcall Scale Cluster", "Hybrid Energy Node",
      ].map((name) => e(name)),
      epic: [
        "Unstable Tempest Core", "Apex Storm Gland", "Condensed Conductive Blood Reservoir", "Stormcall Spine (Refined)",
        "Ionized Crest Horn", "Living Storm Essence", "Hybrid Core Node", "Phase-Charged Organ Cluster",
        "Draconic Mutation Core", "Volatile Lighting Heart Fragment",
      ].map((name) => e(name)),
    },
  },
  {
    id: "blue-dragon-wyrmling",
    label: "Blue Dragon Wyrmling",
    family: "blue-dragon",
    tables: {
      common: [
        "Dragon Scale Fragments (1d4)", "Charged Dragonhide Scraps (1d4)", "Crackling Horn Shards (1d4)",
        "Minor Lighting Gland", "Dragonbone Splinters (1d6)", "Residual Storm Essence", "Conductive Blood Droplets",
        "Flicker Residue", "Ionized Nerve Threads (1d4)", "Scaled Membrane Strips (1d4)",
      ].map((name) => e(name)),
      rare: [
        "Blue Dragon Scale", "Charged Lighting Gland", "Conductive Blood Crystal", "Stormbound Tendon Coil",
        "Reinforced Dragonbone Segment", "Tempest Core Fragment", "Ionized Fang", "Stormcall Crest Fragment", "Draconic Energy Node",
      ].map((name) => e(name)),
      epic: [
        "Young Tempest Core (Incomplete)", "Apex Lighting Gland (Juvenile)", "Condensed Conductive Blood Reservoir",
        "Stormcall Spine Segment", "Ionized Crest Horn", "Living Storm Essence", "Draconic Core Node",
        "Pure Lighting Organ Cluster", "Stormheart Fragment",
      ].map((name) => e(name)),
    },
  },
  {
    id: "young-blue-dragon",
    label: "Young Blue Dragon",
    family: "blue-dragon",
    tables: {
      common: [
        "Dragon Scale Fragments (Refined) (1d4)", "Charged Dragonhide Strips (1d4)", "Reinforced Horn Shards (1d4)",
        "Residual Lighting Gland", "Dense Dragonbone Splinters (1d6)", "Storm Essence Residue", "Conductive Blood Droplets",
        "Flicker Residue", "Ionized Nerve Threads (1d4)", "Scaled Membrane Strips (1d4)",
      ].map((name) => e(name)),
      rare: [
        "Blue Dragon Scale (Reinforced)", "Apex Lighting Gland", "Conductive Blood Crystal", "Stormbound Tendon Coil",
        "Reinforced Dragonbone Segment", "Tempest Core (Stable)", "Ionized Fang", "Stormcall Crest", "Draconic Energy Node",
      ].map((name) => e(name)),
      epic: [
        "Perfect Tempest Core", "Supreme Lighting Gland", "Grand Conductive Blood Reservoir", "Stormcall Spine (Complete)",
        "Ionized Crown Horn", "Living Storm Essence (Pure)", "Dragonheart (Stormbound)", "Primal Lighting Organ Cluster",
        "Tempest Anchor Core",
      ].map((name) => e(name)),
    },
  },
  {
    id: "giant-wolf-spider",
    label: "Giant Wolf Spider",
    family: "spider",
    tables: {
      common: [
        "Thin Webbing Bundle (1d4)", "Spider Silk Strands (1d4)", "Small Chitin Fragments (1d4)",
        "Minor Venom Residue", "Hair Bristle Clumps", "Lightweight Leg Segments", "Organic Binding Fibers",
        "Silk Membrane Scraps", "Dried Venom Trace",
      ].map((name) => e(name)),
      rare: [
        "Basic Venom Sac", "Thick Webbing Bundle", "Hardened Chitin Plate (Small)", "Silk Gland (Minor)",
        "Reinforced Leg Segment", "Adhesive Silk Core", "Concentrated Venom Droplet", "Dense Web Cluster",
      ].map((name) => e(name)),
      epic: [
        "Refined Venom Sac (Lesser)", "Silk Gland (Refined)", "Hardened Chitin Plate", "Elastic Web Core",
        "Concentrated Adhesive Node", "Neural Silk Filament", "Predator Instinct Node",
      ].map((name) => e(name)),
    },
  },
  {
    id: "giant-spider",
    label: "Giant Spider",
    family: "spider",
    tables: {
      common: [
        "Webbing Bundle (1d4)", "Thick Silk Strands (1d4)", "Chitin Fragments (1d4)", "Minor Venom Residue",
        "Bristle Hair Clumps", "Leg Segments", "Organic Binding Fibers", "Silk Membrane Sheets",
        "Dried Venom Trace", "Silk Thread Cluster",
      ].map((name) => e(name)),
      rare: [
        "Basic Venom Sac", "Thick Webbing Bundle", "Hardened Chitin Plate", "Silk Gland", "Reinforced Leg Segment",
        "Adhesive Silk Core", "Concentrated Venom Droplet", "Dense Web Cluster", "Flexible Chitin Layer",
      ].map((name) => e(name)),
      epic: [
        "Refined Venom Sac", "Advanced Silk Gland", "Reinforced Chitin Plate", "Elastic Web Core",
        "Concentrated Adhesive Node", "Neural Silk Filament", "Predator Instinct Node", "Venom Catalyst Organ", "Silkflow Core",
      ].map((name) => e(name)),
    },
  },
  {
    id: "phase-spider",
    label: "Phase Spider",
    family: "spider",
    tables: {
      common: [
        "Phase-Touched Silk Strands (1d4)", "Distortion Webbing Fragments (1d4)", "Faded Chitin Fragments (1d4)",
        "Residual Phase Essence", "Flicker Residue", "Warped Leg Segments", "Dimensional Membrane Scraps",
        "Unstable Silk Threads (1d4)", "Ether Residue Clumps", "Phase Dust",
      ].map((name) => e(name)),
      rare: [
        "Phase Silk Bundle", "Phase Gland", "Distortion Core Fragment", "Warped Chitin Plate",
        "Dimensional Tendon Coil", "Phase Residue Cluster", "Flicker Core Node", "Etheric Venom Sac",
        "Spatial Anchor Thread",
      ].map((name) => e(name)),
      epic: [
        "Phase Core", "Advanced Phase Silk", "Distortion Core", "Planar Membrane Node", "Phase-Touched Venom Sac",
        "Spatial Tear Filament", "Ether Heart Fragment", "Dimensional Anchor Node", "Phase Echo Organ",
      ].map((name) => e(name)),
    },
  },
  {
    id: "giant-spider-matriarch",
    label: "Giant Spider Matriarch",
    family: "spider",
    tables: {
      common: [
        "Thick Webbing Bundles (1d4)", "Reinforced Silk Strands (1d4)", "Dense Chitin Fragments (1d4)",
        "Residual Venom Gland", "Brood-Touched Hair Clumps", "Reinforced Leg Segments",
        "Organic Binding Fibers", "Silk Membrane Sheets", "Venom Residue Cluster", "Silk Thread Core",
      ].map((name) => e(name)),
      rare: [
        "Potent Venom Gland", "High-Tensile Silk Bundle", "Hardened Chitin Plate", "Advanced Silk Gland",
        "Reinforced Leg Core", "Adhesive Silk Core", "Concentrated Venom Sac", "Dense Web Cluster",
        "Flexible Chitin Layer",
      ].map((name) => e(name)),
      epic: [
        "Queen Silk Thread", "Apex Venom Core", "Reinforced Chitin (Superior)", "Brood Essence Sac",
        "Royal Spinneret", "Living Silk Core", "Venom Nexus Organ", "Broodmind Node", "Predator Instinct Core",
      ].map((name) => e(name)),
    },
  },
  {
    id: "merfolk-reaver",
    label: "Merfolk Reaver",
    family: "merfolk",
    tables: {
      common: [
        "Brittle Coral Shards (1d4)",
        "Wet Scale Clippings (1d4)",
        "Salty Slime Residue (1d4)",
        "Fin Membranes (1d4)",
        "Bone Needle Fragments (1d4)",
        "Sea-Glass Scraps (1d4)",
      ].map((name) => e(name)),
      rare: [
        "Hardened Shell Fragment",
        "Living Coral Branch",
        "Reaver’s Spear-Tip",
        "Bioluminescent Gland",
        "Siren’s Pearl (Minor)",
        "Aquatic Sinew",
      ].map((name) => e(name)),
      epic: [
        "Reinforced Reef Plate",
        "Tide-Caller Node (Minor)",
        "Siren Essence (Refined)",
        "Coral Core Fragment",
        "Shamanic Bone Carving",
      ].map((name) => e(name)),
    },
  },
  {
    id: "merfolk-tide-caller",
    label: "Merfolk Tide-Caller",
    family: "merfolk",
    tables: {
      common: [
        "Hardened Shell Fragment",
        "Living Coral Branch",
        "Siren’s Pearl (Minor)",
        "Bioluminescent Gland",
        "Tide-Caller Node (Minor)",
        "Aquatic Sinew",
        "Luminous Sea-Glass",
      ].map((name) => e(name)),
      rare: [
        "Ancient Deep-Pearl",
        "Tide-Caller's Heart Node",
        "Concentrated Siren Essence",
        "Reef-Spire Fragment",
        "Deep-Sea Essence",
        "Oceanic Binding Fiber",
      ].map((name) => e(name)),
      epic: [
        "Heart of the Sea Node",
        "Sovereign Tide-Core",
        "Ancient Reef-Core",
        "Abyssal Pearl (Pristine)",
        "Tide-Master’s Staff Fragment",
      ].map((name) => e(name)),
    },
  },
  {
    id: "coral-hulked-behemoth",
    label: "Coral-Hulked Behemoth",
    family: "behemoth",
    tables: {
      common: [
        "Brittle Coral Shards (1d6)",
        "Hardened Shell Fragment (1d6)",
        "Salty Slime Residue (1d6)",
        "Thick Chitin Fragments (1d6)",
        "Crustacean Meat (Raw) (1d6)",
        "Heavy Bone Segments (1d6)",
      ].map((name) => e(name)),
      rare: [
        "Reinforced Reef Plate",
        "Massive Behemoth Pincer",
        "Living Coral Branch (Large)",
        "Hardened Chitin Plate",
        "Behemoth Eye-Stalk",
      ].map((name) => e(name)),
      epic: [
        "Leviathan-Scratched Carapace",
        "Heart of the Sea Node",
        "Ancient Reef-Core",
        "Apex Mobility Core (Oceanic)",
        "Behemoth Soul-Pearl",
      ].map((name) => e(name)),
    },
  },
];

export function rollWeightedLootQuality(tier: CreatureTier): LootQuality | "none" {
  const weights = creatureTierRules[tier].weights;
  const total = weights.noLoot + weights.common + weights.rare + weights.epic;
  let roll = Math.floor(Math.random() * total) + 1;
  if ((roll -= weights.noLoot) <= 0) return "none";
  if ((roll -= weights.common) <= 0) return "common";
  if ((roll -= weights.rare) <= 0) return "rare";
  return "epic";
}

export function rollDiceExpression(amount?: string) {
  if (!amount) return 1;
  const cleaned = amount.trim().toLowerCase();
  const dice = cleaned.match(/^(\d*)d(\d+)$/);
  if (dice) {
    const count = dice[1] ? Number(dice[1]) : 1;
    const sides = Number(dice[2]);
    return Array.from({ length: count }).reduce<number>((sum) => sum + Math.floor(Math.random() * sides) + 1, 0);
  }
  const flat = Number(cleaned);
  return Number.isFinite(flat) && flat > 0 ? flat : 1;
}

export function getLootTable(id: string) {
  return lootTables.find((table) => table.id === id) || lootTables[0];
}
