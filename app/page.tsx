"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Dice5,
  FlaskConical,
  Hammer,
  KeyRound,
  Package,
  Plus,
  ScrollText,
  Shield,
  Trash2,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";

import { recipesRaw, rarityColors, type Recipe, type Rarity } from "@/data/recipesRaw";
import { materialTiers, getMaterialTier, normalizeMaterialName, getMaterialsByTag, getPhaseTouchedCounterpart } from "@/data/materialTiers";
import {
  calculateCraftResult,
  applyRegularTraining,
  applyExpertTraining,
  getRegularTrainingCost,
  shouldGainAdvantageFromDailyCategoryLimit,
  type CraftResultSummary,
  type ToolProgress,
} from "@/data/craftingRules";
import {
  canApplyPhaseTouchedEffect,
  getPhaseTouchedEffectForCategory,
  getInfusedEffectForCategory,
  getInfusionPrefixForMaterialName,
  recipeAlreadyPhaseTouched,
} from "@/data/phaseEffects";

import { fetchCampaigns, createCampaign, deleteCampaign } from "@/lib/supabaseCampaigns";
import { fetchCampaignMaterials, replaceCampaignMaterials } from "@/lib/supabaseMaterials";
import { fetchCampaignCraftedItems, insertCraftedItem, deleteCraftedItem } from "@/lib/supabaseCraftedItems";
import { fetchCampaignCharacters, replaceCampaignCharacters } from "@/lib/supabaseCharacters";
import {
  fetchCampaignLootCreatures,
  insertCampaignLootCreature,
  deleteCampaignLootCreature,
  decrementCampaignLootCreature,
  type SupabaseLootCreature,
} from "@/lib/supabaseLootCreatures";
import {
  fetchCampaignLootLog,
  insertCampaignLootLog,
  type SupabaseLootLog,
} from "@/lib/supabaseLootLog";
import { creatureTierRules, lootTables, rollDiceExpression, rollWeightedLootQuality, getLootTable, type CreatureTier, type LootQuality } from "@/data/lootTables";
import { supabase } from "@/lib/supabaseClient";
import AttributeCardsPanel from "@/components/AttributeCardsPanel";
import { GmLoginPanel, CreateGmPanel } from "@/components/GmAuthPanels";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


type Material = {
  id: string;
  name: string;
  qty: number;
  tier?: number;
};

type InventoryProfile = {
  id: string;
  name: string;
  materials: Material[];
  characters: Character[];
  craftedItems: CraftedItem[];
  disabledTags: string[];
};

type Stat = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

type TabId = "craft" | "available" | "recipes" | "materials" | "characters" | "advancement" | "attributes" | "looting" | "craftingRules" | "lootingRules" | "admin";

const tabs = [
  ["craft", "Craft", Hammer],
  ["available", "Available", BookOpen],
  ["recipes", "All Recipes", ClipboardList],
  ["materials", "Materials", FlaskConical],
  ["characters", "Characters", UserRound],
  ["advancement", "PP Improvements", Wrench],
  ["attributes", "Attributes", BookOpen],
  ["looting", "Looting", Package],
  ["craftingRules", "Crafting Rules", ScrollText],
  ["lootingRules", "Looting Rules", Dice5],
  ["admin", "GM", KeyRound],
] as const satisfies readonly (readonly [TabId, string, React.ComponentType<{ className?: string }>])[];

type ProficiencyLevel = "none" | "proficient" | "expertise";
type CraftQuality = "Superior" | "Normal" | "Flawed";
type CraftQualityOrFailed = CraftQuality | "Failed";
type RecipeMaterialWithTag = Recipe["materials"][number] & { tagRequirement?: string };

type CraftedEffect = {
  name: string;
  description?: string;
  effect: string[];
};

type Character = {
  id: string;
  name: string;
  isActive: boolean;
  harvesting: number;
  stats: Record<Stat, number>;
  tools: Record<string, ProficiencyLevel>;
  ownedTools: Record<string, boolean>;
  brokenTools: Record<string, boolean>;
  progressPoints: Record<string, number>;
  toolProgress: Record<string, ToolProgress>;
};

type CraftedItem = {
  id: string;
  name: string;
  type: string;
  rarity: Rarity;
  tags: string[];
  quality: CraftQualityOrFailed;
  crafter: string;
  rollTotal: number;
  naturalRoll: number;
  effect?: string[];
  statBlock?: string;
  phaseTouched?: boolean;
  phaseTouchedMaterial?: string;
  phaseTouchedEffect?: CraftedEffect;
};

type LootResultItem = {
  name: string;
  qty: number;
  kind: string;
  quality: string;
  rollText?: string;
};


type CharacterAttributeAssignmentRow = {
  campaign_id: string;
  character_id: string;
  card_id: number;
};

const CRAFTING_ATTRIBUTE_IDS = {
  keenHarvester: 7201,
  efficientHarvester: 7202,
  phaseExtractor: 7203,
  dragonSense: 7204,
  criticalAnatomy: 7205,
  scavengersEye: 7206,
  cantLeaveIt: 7207,
  masterworkInstinct: 7208,
  materialMemory: 7209,
  salvager: 7210,
  hybridIntuition: 7211,
  quickHands: 7212,
  natTwentyFrugal: 7213,
  masteryFastTrack: 7214,
  perfectionist: 7215,
  closeEnough: 7216,
  battlefieldCrafter: 7217,
  forgeBorn: 7218,
  alchemicalBloodline: 7219,
  leatherworkerHands: 7220,
  tinkersGift: 7221,
  threadborne: 7222,
  venomWise: 7223,
  phaseStable: 7224,
  stormReader: 7225,
  chitinCraft: 7226,
  silkSmith: 7227,
  dailyGrind: 7228,
} as const;

const ATTRIBUTE_TOOL_AFFINITY: Record<number, string[]> = {
  [CRAFTING_ATTRIBUTE_IDS.forgeBorn]: ["Smith"],
  [CRAFTING_ATTRIBUTE_IDS.alchemicalBloodline]: ["Alchemist", "Poisoner"],
  [CRAFTING_ATTRIBUTE_IDS.leatherworkerHands]: ["Leatherworker"],
  [CRAFTING_ATTRIBUTE_IDS.tinkersGift]: ["Tinker"],
  [CRAFTING_ATTRIBUTE_IDS.threadborne]: ["Weaver"],
};


type AttributeEffectMeta = {
  id: number;
  name: string;
  summary: string;
};

const HARVESTING_ATTRIBUTE_EFFECT_IDS = [
  CRAFTING_ATTRIBUTE_IDS.keenHarvester,
  CRAFTING_ATTRIBUTE_IDS.efficientHarvester,
  CRAFTING_ATTRIBUTE_IDS.phaseExtractor,
  CRAFTING_ATTRIBUTE_IDS.dragonSense,
  CRAFTING_ATTRIBUTE_IDS.criticalAnatomy,
  CRAFTING_ATTRIBUTE_IDS.scavengersEye,
  CRAFTING_ATTRIBUTE_IDS.cantLeaveIt,
] as number[];

const CRAFTING_ATTRIBUTE_EFFECT_IDS = [
  CRAFTING_ATTRIBUTE_IDS.masterworkInstinct,
  CRAFTING_ATTRIBUTE_IDS.materialMemory,
  CRAFTING_ATTRIBUTE_IDS.salvager,
  CRAFTING_ATTRIBUTE_IDS.hybridIntuition,
  CRAFTING_ATTRIBUTE_IDS.quickHands,
  CRAFTING_ATTRIBUTE_IDS.natTwentyFrugal,
  CRAFTING_ATTRIBUTE_IDS.masteryFastTrack,
  CRAFTING_ATTRIBUTE_IDS.perfectionist,
  CRAFTING_ATTRIBUTE_IDS.closeEnough,
  CRAFTING_ATTRIBUTE_IDS.battlefieldCrafter,
  CRAFTING_ATTRIBUTE_IDS.forgeBorn,
  CRAFTING_ATTRIBUTE_IDS.alchemicalBloodline,
  CRAFTING_ATTRIBUTE_IDS.leatherworkerHands,
  CRAFTING_ATTRIBUTE_IDS.tinkersGift,
  CRAFTING_ATTRIBUTE_IDS.threadborne,
  CRAFTING_ATTRIBUTE_IDS.venomWise,
  CRAFTING_ATTRIBUTE_IDS.phaseStable,
  CRAFTING_ATTRIBUTE_IDS.stormReader,
  CRAFTING_ATTRIBUTE_IDS.chitinCraft,
  CRAFTING_ATTRIBUTE_IDS.silkSmith,
  CRAFTING_ATTRIBUTE_IDS.dailyGrind,
] as number[];

const CRAFTING_ATTRIBUTE_EFFECT_META: Record<number, AttributeEffectMeta> = {
  [CRAFTING_ATTRIBUTE_IDS.keenHarvester]: {
    id: CRAFTING_ATTRIBUTE_IDS.keenHarvester,
    name: "Keen Harvester",
    summary: "Harvesting advantage, Nat 20 grants an extra loot roll, and first failed harvest per creature costs no attempt.",
  },
  [CRAFTING_ATTRIBUTE_IDS.efficientHarvester]: {
    id: CRAFTING_ATTRIBUTE_IDS.efficientHarvester,
    name: "Efficient Harvester",
    summary: "Successful harvests gain +1 loot roll, and No Loot becomes common loot.",
  },
  [CRAFTING_ATTRIBUTE_IDS.phaseExtractor]: {
    id: CRAFTING_ATTRIBUTE_IDS.phaseExtractor,
    name: "Phase Extractor",
    summary: "Advantage against phase/dimensional creatures and common phase loot can improve by one reroll.",
  },
  [CRAFTING_ATTRIBUTE_IDS.dragonSense]: {
    id: CRAFTING_ATTRIBUTE_IDS.dragonSense,
    name: "Dragon Sense",
    summary: "Advantage against dragon/draconic creatures and common draconic loot can improve by one reroll.",
  },
  [CRAFTING_ATTRIBUTE_IDS.criticalAnatomy]: {
    id: CRAFTING_ATTRIBUTE_IDS.criticalAnatomy,
    name: "Critical Anatomy",
    summary: "Harvesting DC is reduced by 2, minimum DC 8.",
  },
  [CRAFTING_ATTRIBUTE_IDS.scavengersEye]: {
    id: CRAFTING_ATTRIBUTE_IDS.scavengersEye,
    name: "Scavenger's Eye",
    summary: "When attempts run out, grants one final DC 10 bonus harvest check.",
  },
  [CRAFTING_ATTRIBUTE_IDS.cantLeaveIt]: {
    id: CRAFTING_ATTRIBUTE_IDS.cantLeaveIt,
    name: "Can't Leave It",
    summary: "Nat 1 harvesting checks only lose 1 attempt instead of 2.",
  },
  [CRAFTING_ATTRIBUTE_IDS.masterworkInstinct]: {
    id: CRAFTING_ATTRIBUTE_IDS.masterworkInstinct,
    name: "Masterwork Instinct",
    summary: "Once per long rest, upgrades a Normal crafting success to Superior.",
  },
  [CRAFTING_ATTRIBUTE_IDS.materialMemory]: {
    id: CRAFTING_ATTRIBUTE_IDS.materialMemory,
    name: "Material Memory",
    summary: "First craft of each category that day gets -2 DC and first-time PP applies again.",
  },
  [CRAFTING_ATTRIBUTE_IDS.salvager]: {
    id: CRAFTING_ATTRIBUTE_IDS.salvager,
    name: "Salvager",
    summary: "On failed crafts, supports material recovery rules and rarest-material protection.",
  },
  [CRAFTING_ATTRIBUTE_IDS.hybridIntuition]: {
    id: CRAFTING_ATTRIBUTE_IDS.hybridIntuition,
    name: "Hybrid Intuition",
    summary: "Hybrid crafting penalties are ignored for this character.",
  },
  [CRAFTING_ATTRIBUTE_IDS.quickHands]: {
    id: CRAFTING_ATTRIBUTE_IDS.quickHands,
    name: "Quick Hands",
    summary: "Crafting time benefits apply narratively; the app flags this character as a fast crafter.",
  },
  [CRAFTING_ATTRIBUTE_IDS.natTwentyFrugal]: {
    id: CRAFTING_ATTRIBUTE_IDS.natTwentyFrugal,
    name: "Nat Twenty Frugal",
    summary: "Nat 20 crafting preserves the two rarest materials instead of only the rarest.",
  },
  [CRAFTING_ATTRIBUTE_IDS.masteryFastTrack]: {
    id: CRAFTING_ATTRIBUTE_IDS.masteryFastTrack,
    name: "Mastery Fast-Track",
    summary: "Successful crafts gain +1 additional PP.",
  },
  [CRAFTING_ATTRIBUTE_IDS.perfectionist]: {
    id: CRAFTING_ATTRIBUTE_IDS.perfectionist,
    name: "Perfectionist",
    summary: "Superior results gain +1 additional PP.",
  },
  [CRAFTING_ATTRIBUTE_IDS.closeEnough]: {
    id: CRAFTING_ATTRIBUTE_IDS.closeEnough,
    name: "Close Enough",
    summary: "Failures within 2 of the DC become Normal successes.",
  },
  [CRAFTING_ATTRIBUTE_IDS.battlefieldCrafter]: {
    id: CRAFTING_ATTRIBUTE_IDS.battlefieldCrafter,
    name: "Battlefield Crafter",
    summary: "Short-rest/common-item crafting benefits apply narratively; app flags the attribute here.",
  },
  [CRAFTING_ATTRIBUTE_IDS.forgeBorn]: {
    id: CRAFTING_ATTRIBUTE_IDS.forgeBorn,
    name: "Forge-Born",
    summary: "Smith tools are treated as proficient with at least 10 PP.",
  },
  [CRAFTING_ATTRIBUTE_IDS.alchemicalBloodline]: {
    id: CRAFTING_ATTRIBUTE_IDS.alchemicalBloodline,
    name: "Alchemical Bloodline",
    summary: "Alchemist and Poisoner tools are treated as proficient with at least 10 PP; Normal potion/poison crafts can become Superior.",
  },
  [CRAFTING_ATTRIBUTE_IDS.leatherworkerHands]: {
    id: CRAFTING_ATTRIBUTE_IDS.leatherworkerHands,
    name: "Leatherworker's Hands",
    summary: "Leatherworker tools are treated as proficient with at least 10 PP; some creature-material crafts get -1 DC.",
  },
  [CRAFTING_ATTRIBUTE_IDS.tinkersGift]: {
    id: CRAFTING_ATTRIBUTE_IDS.tinkersGift,
    name: "The Tinker's Gift",
    summary: "Tinker tools are treated as proficient with at least 10 PP; Tinker failures within 2 become Normal.",
  },
  [CRAFTING_ATTRIBUTE_IDS.threadborne]: {
    id: CRAFTING_ATTRIBUTE_IDS.threadborne,
    name: "Threadborne",
    summary: "Weaver tools are treated as proficient with at least 10 PP.",
  },
  [CRAFTING_ATTRIBUTE_IDS.venomWise]: {
    id: CRAFTING_ATTRIBUTE_IDS.venomWise,
    name: "Venom Wise",
    summary: "Venom crafting benefits apply narratively; app flags this attribute for the crafter.",
  },
  [CRAFTING_ATTRIBUTE_IDS.phaseStable]: {
    id: CRAFTING_ATTRIBUTE_IDS.phaseStable,
    name: "Phase Stable",
    summary: "Phase-touched effect selection benefits apply narratively; app flags this attribute for the crafter.",
  },
  [CRAFTING_ATTRIBUTE_IDS.stormReader]: {
    id: CRAFTING_ATTRIBUTE_IDS.stormReader,
    name: "Storm Reader",
    summary: "Crafting with blue-dragon/storm/lightning materials gains advantage.",
  },
  [CRAFTING_ATTRIBUTE_IDS.chitinCraft]: {
    id: CRAFTING_ATTRIBUTE_IDS.chitinCraft,
    name: "Chitin Craft",
    summary: "Chitin/spider material crafts get -2 DC.",
  },
  [CRAFTING_ATTRIBUTE_IDS.silkSmith]: {
    id: CRAFTING_ATTRIBUTE_IDS.silkSmith,
    name: "Silk Smith",
    summary: "Silk crafting benefits apply narratively; app flags this attribute for the crafter.",
  },
  [CRAFTING_ATTRIBUTE_IDS.dailyGrind]: {
    id: CRAFTING_ATTRIBUTE_IDS.dailyGrind,
    name: "Daily Grind",
    summary: "Successful crafts gain +1 additional PP even after the daily category cap.",
  },
};

type SharedLootResultItem = LootResultItem & {
  id: string;
  createdAt: string;
  characterName?: string;
  creatureLabel?: string;
};


type CreatureLootQueueEntry = {
  id: string;
  creatureTableId: string;
  creatureLabel: string;
  creatureTier: CreatureTier;
  qty: number;
};


type GmAuthState = {
  userId: string;
  username: string;
  displayName: string;
  isSiteAdmin: boolean;
  mustChangePassword: boolean;
};

function supabaseLootCreatureToLocal(row: SupabaseLootCreature): CreatureLootQueueEntry {
  return {
    id: row.id,
    creatureTableId: row.creature_table_id,
    creatureLabel: row.creature_label,
    creatureTier: row.creature_tier as CreatureTier,
    qty: row.remaining ?? row.qty ?? 1,
  };
}

function supabaseLootLogToLocal(row: SupabaseLootLog, characters: Character[]): SharedLootResultItem {
  const character = row.character_id
    ? characters.find((item) => item.id === row.character_id)
    : undefined;

  return {
    id: row.id,
    name: row.loot_name,
    qty: row.qty,
    kind: row.kind,
    quality: row.loot_quality || "unknown",
    rollText: row.roll_text || undefined,
    createdAt: row.created_at,
    characterName: character?.name,
    creatureLabel: row.creature_label || undefined,
  };
}


const ADMIN_PASSWORD = "craftadmin";

const MAIN_RECIPE_TAGS = [
  "spider",
  "blue dragon",
  "hybrid",
] as const;

const WEAPON_RECIPE_TAGS = [
  "weapon",
  "weapon-upgrade",
  "flintlock",
  "musket",
  "blunderbuss",
  "firearm",
  "ranged",
  "melee",
  "dagger",
  "rapier",
  "stiletto",
  "warhammer",
  "morning-star",
  "staff",
  "tattoo",
] as const;

const MANAGED_RECIPE_TAGS = [...MAIN_RECIPE_TAGS, ...WEAPON_RECIPE_TAGS];

const MATERIALS_STORAGE_KEY = "artisan-codex-materials";
const INVENTORY_PROFILES_STORAGE_KEY = "artisan-codex-inventory-profiles";
const ACTIVE_INVENTORY_STORAGE_KEY = "artisan-codex-active-inventory";
const DISABLED_TAGS_STORAGE_KEY = "artisan-codex-disabled-tags";
const CREATURE_LOOT_QUEUE_STORAGE_KEY = "artisan-codex-creature-loot-queue";
const DISCOVERED_RECIPES_STORAGE_KEY = "artisan-codex-discovered-recipes";
const HIDDEN_RECIPES_STORAGE_KEY = "artisan-codex-hidden-recipes";
const RECIPE_TAG_FILTERS_STORAGE_KEY = "artisan-codex-recipe-tag-filters";
const RECIPE_SORT_STORAGE_KEY = "artisan-codex-recipe-sort";
const RECIPE_DISCOVERY_FILTER_STORAGE_KEY = "artisan-codex-recipe-discovery-filter";
const STATS: Stat[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const TOOL_OPTIONS = [
  "Smith",
  "Tinker",
  "Weaver",
  "Leatherworker",
  "Alchemist",
  "Poisoner",
  "Carpenter",
  "Carver",
  "Woodcarver",
  "Jeweler",
  "Fletcher",
  "Tattoo Artist Needles",
];

const PROFICIENCY_BONUS: Record<ProficiencyLevel, number> = {
  none: 0,
  proficient: 2,
  expertise: 4,
};

function emptyToolProgress(): ToolProgress {
  return {
    pp: 0,
    regularTrainingUsed: 0,
    expertTrainingUsed: 0,
    craftsTodayByCategory: {},
    proficient: false,
    specializations: [],
  };
}

function buildToolProgress(defaultProficient = false): Record<string, ToolProgress> {
  return TOOL_OPTIONS.reduce((acc, tool) => {
    acc[tool] = { ...emptyToolProgress(), proficient: defaultProficient, pp: defaultProficient ? 10 : 0 };
    return acc;
  }, {} as Record<string, ToolProgress>);
}

function buildToolOwnership(defaultOwned = false): Record<string, boolean> {
  return TOOL_OPTIONS.reduce((acc, tool) => {
    acc[tool] = defaultOwned;
    return acc;
  }, {} as Record<string, boolean>);
}

function characterHasUsableTool(character: Character, tool: string) {
  return Boolean(character.ownedTools?.[tool]) && !Boolean(character.brokenTools?.[tool]);
}

function recipeAlwaysKnown(recipe: Recipe) {
  return recipe.tags.includes("basic") || recipe.tags.includes("material-creation");
}

function recipeIsDiscovered(recipe: Recipe, discoveredMaterialNames: Set<string>) {
  if (recipeAlwaysKnown(recipe)) return true;

  return (recipe.materials as RecipeMaterialWithTag[]).some((material) => {
    if (material.tagRequirement) return true;
    return discoveredMaterialNames.has(normalizeName(material.name));
  });
}

const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "ascendant",
  "legendary",
  "artifact",
];

const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  ascendant: "Ascendant",
  legendary: "Legendary",
  artifact: "Artifact",
};

const PANEL = {
  parchment: "#e7d0a3",
  parchmentLight: "#f2dfb9",
  ink: "#251b10",
  dark: "#1f1e1a",
  dark2: "#141414",
  gold: "#d2ad5f",
};



const STARTING_MATERIALS: Omit<Material, "id" | "tier">[] = [
  { name: "Reinforced Metal Plates", qty: 2 },
  { name: "Scrap Steel", qty: 12 },
  { name: "Cloth", qty: 16 },
  { name: "Iron Ingot", qty: 3 },
  { name: "Webbing Bundle", qty: 28 },
  { name: "Minor Venom Residue", qty: 24 },
  { name: "Basic Venom Sac", qty: 6 },
  { name: "Spider Silk Strands", qty: 12 },
  { name: "Small Chitin Fragments", qty: 12 },
  { name: "Thin Webbing Bundle", qty: 36 },
  { name: "Lightweight Leg Segments", qty: 24 },
  { name: "Dried Venom Trace", qty: 12 },
  { name: "Hair Bristle Clumps", qty: 20 },
  { name: "Silk Membrane Sheets", qty: 4 },
  { name: "Organic Binding Fibers", qty: 8 },
  { name: "Thick Silk Strands", qty: 4 },
  { name: "Warped Leg Segments", qty: 4 },
  { name: "Advanced Phase Silk", qty: 1 },
  { name: "Distortion Core Fragment", qty: 1 },
  { name: "Phase-Touched Silk Strands", qty: 13 },
  { name: "Dimensional Tendon Coil", qty: 2 },
  { name: "Flicker Residue", qty: 13 },
  { name: "Spatial Anchor Thread", qty: 1 },
  { name: "Distortion Webbing Fragments", qty: 3 },
  { name: "Phase Core", qty: 1 },
  { name: "Unstable Silk Threads", qty: 8 },
  { name: "Dimensional Membrane Scraps", qty: 4 },
  { name: "Faded Chitin Fragments", qty: 22 },
  { name: "Residual Phase Essence", qty: 2 },
  { name: "Phase Residue Cluster", qty: 2 },
  { name: "Phase Silk Strand", qty: 2 },
  { name: "Dense Chitin Fragments", qty: 7 },
  { name: "Dense Web Cluster", qty: 1 },
  { name: "Apex Venom Core", qty: 1 },
  { name: "Potent Venom Gland", qty: 3 },
  { name: "Royal Spinneret", qty: 2 },
  { name: "Broodmind Node", qty: 1 },
  { name: "Thick Webbing Bundle", qty: 1 },
  { name: "Brood Essence Sac", qty: 1 },
  { name: "Predator Instinct Core", qty: 3 },
  { name: "Residual Venom Gland", qty: 1 },
  { name: "Dense Organic Binding Fibers", qty: 1 },
  { name: "Stormbound Tendon Coil", qty: 3 },
  { name: "Static-Charged Hide Scraps", qty: 16 },
  { name: "Scorched Bone Splinters", qty: 12 },
  { name: "Brittle Horn Shards", qty: 16 },
  { name: "Minor Conductive Blood Sample", qty: 8 },
  { name: "Crackling Scale Fragments", qty: 10 },
  { name: "Drake Scales", qty: 28 },
  { name: "Conductive Blood Crystal", qty: 4 },
  { name: "Minor Lightning Gland", qty: 6 },
  { name: "Charged Dragonhide Scraps", qty: 14 },
  { name: "Dragonbone Splinters", qty: 2 },
  { name: "Ionized Fang", qty: 2 },
  { name: "Dragon Scale Fragments", qty: 6 },
  { name: "Crackling Horn Shards", qty: 12 },
  { name: "Residual Storm Essence", qty: 4 },
  { name: "Fractured Scale Fragments", qty: 2 },
  { name: "Reinforced Spine Segment", qty: 1 },
  { name: "Charged Tendon Strips", qty: 4 },
  { name: "Residual Storm Gland", qty: 1 },
  { name: "Stormcall Spine (Primary Segment)", qty: 1 },
  { name: "Perfect Tempest Core", qty: 1 },
  { name: "Blue Dragon Scale (Reinforced)", qty: 3 },
  { name: "Stormcall Spine (Complete)", qty: 1 },
  { name: "Draconic Energy Node", qty: 2 },
  { name: "Living Storm Essence (Pure)", qty: 1 },
  { name: "Supreme Lightning Gland", qty: 1 },
  { name: "Dragonheart (Stormbound)", qty: 1 },
];

function buildStartingMaterials(): Material[] {
  return STARTING_MATERIALS.map((material) => ({
    ...material,
    id: crypto.randomUUID(),
    tier: getMaterialTier(material.name),
  }));
}

const CRAFTING_RULES = [
  {
    title: "Basic Crafting Rule",
    body: "Roll d20 + the listed stat modifier. Add proficiency only if the crafter is proficient with the listed tool.",
  },
  {
    title: "Assisted Crafting",
    body: "One proficient assistant may grant advantage or provide a +2 bonus per crafting attempt.",
  },
  {
    title: "NPC Crafting",
    body: "A shop NPC or specialist can craft an item as Normal with no roll. Materials are still consumed.",
  },
  {
    title: "Material Quality",
    body: "Superior key material: DC -2 and success cannot produce Flawed. Flawed key material: DC +2 and failure can only produce Flawed.",
  },
  {
    title: "Crafting Outcomes",
    body: "Meet DC: Normal. Beat DC by 5+: Superior. Fail by less than 5: Flawed. Fail by 5+: lose some common materials. Nat 1: lose all materials and tools break. Nat 20: rarest material is not consumed.",
  },
  {
    title: "Weapon Upgrades",
    body: "Weapons hold 2 upgrades, 3 if Epic or higher, and 4 if Legendary.",
  },
  {
    title: "Armour Upgrades",
    body: "Armour holds 2 upgrades, 3 if Rare or higher, and 4 if Legendary.",
  },
  {
    title: "Progress Points",
    body: "Success: +1 PP. Success by 5+: +2 PP. Failure: 0 PP. Critical failure: -2 PP. First time crafting a new item type grants +1 bonus PP.",
  },
  {
    title: "Hybrid Crafting",
    body: "Hybrid crafting normally adds +2 DC and reduces damage dice. Hybrid specialists ignore the damage reduction.",
  },
];

const SPECIALIZATIONS = [
  "Alchemist / Poisoner: Venomcrafter, Neurotoxin Specialist, Hybrid Infusion Expert, Corrosive Alchemist, Vitality Brewer.",
  "Tinker / Firearm: Siege Engineer, Precision Mechanic, Control Systems Builder, Overclock Engineer, Ironblood Smith, Hybrid Ballistics Engineer.",
  "Weaver: Silkshaper, Shadowweaver, Phaseweaver, Threadbinder, Soulthread Weaver, Phasecurrent Weaver.",
  "Smith: Bonebreaker, Armoursmith, Edgecrafter, Forgeheart Smith, Composite Forge Master.",
  "Leatherworker: Tracker Gearwright, Venom Ward Crafter, Beastskin Crafter, Lifewoven Crafter, Adaptive Skin Crafter.",
  "Tattoo Artist Needles: Inkbinder, Runic Skinworker, Living Mark Specialist, Oceanic Tattooist.",
];

const TOOL_IMPROVEMENT_OPTIONS: Record<string, string[]> = {
  Smith: [
    "Specialization: Bonebreaker",
    "Specialization: Armoursmith",
    "Specialization: Edgecrafter",
    "Specialization: Forgeheart Smith",
    "Specialization: Composite Forge Master",
  ],
  Tinker: [
    "Specialization: Siege Engineer",
    "Specialization: Precision Mechanic",
    "Specialization: Control Systems Builder",
    "Specialization: Overclock Engineer",
    "Specialization: Ironblood Smith",
    "Specialization: Hybrid Ballistics Engineer",
  ],
  Weaver: [
    "Specialization: Silkshaper",
    "Specialization: Shadowweaver",
    "Specialization: Phaseweaver",
    "Specialization: Threadbinder",
    "Specialization: Soulthread Weaver",
    "Specialization: Phasecurrent Weaver",
  ],
  Leatherworker: [
    "Specialization: Tracker Gearwright",
    "Specialization: Venom Ward Crafter",
    "Specialization: Beastskin Crafter",
    "Specialization: Lifewoven Crafter",
    "Specialization: Adaptive Skin Crafter",
  ],
  Alchemist: [
    "Specialization: Venomcrafter",
    "Specialization: Neurotoxin Specialist",
    "Specialization: Hybrid Infusion Expert",
    "Specialization: Corrosive Alchemist",
    "Specialization: Vitality Brewer",
  ],
  Poisoner: [
    "Specialization: Venomcrafter",
    "Specialization: Neurotoxin Specialist",
    "Specialization: Corrosive Alchemist",
  ],
  "Tattoo Artist Needles": [
    "Specialization: Inkbinder",
    "Specialization: Runic Skinworker",
    "Specialization: Living Mark Specialist",
    "Specialization: Oceanic Tattooist",
  ],
};

const MASTERY_OPTIONS = [
  "Mastery: Advantage on crafting rolls",
  "Mastery: Reduce crafting DC by 1",
  "Mastery: Treat failures within 2 of DC as Normal",
];

function improvementSlotsForPp(pp: number) {
  return pp >= 25 ? Math.floor(pp / 25) : 0;
}

function toolImprovementOptions(tool: string) {
  return [...(TOOL_IMPROVEMENT_OPTIONS[tool] || []), ...MASTERY_OPTIONS];
}

function isMasteryImprovement(improvement: string) {
  return improvement.startsWith("Mastery:");
}

function characterHasMasteryForTool(character: Character, tool: string) {
  const progress = character.toolProgress?.[tool] ?? emptyToolProgress();
  return (progress.specializations || []).some(isMasteryImprovement);
}

function normalizeName(value: string) {
  return normalizeMaterialName(value);
}

function numberValue(value: string | number, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanGenericMaterialLabel(value: string) {
  return value.replace(/^\s*\[/, "").replace(/\]\s*$/, "").trim();
}

function genericMaterialTagFromName(value: string) {
  const cleaned = cleanGenericMaterialLabel(value).toLowerCase();

  if (cleaned.includes("base material")) return "base material";
  if (cleaned.includes("standard material")) return "advanced material";
  if (cleaned.includes("advanced material")) return "high end material";
  if (cleaned.includes("high-tier material") || cleaned.includes("high tier material")) return "epic material";
  if (cleaned.includes("high-end material") || cleaned.includes("high end material")) return "high end material";
  if (cleaned.includes("master material")) return "master material";

  return "";
}

function normalizeRequirement(required: RecipeMaterialWithTag): RecipeMaterialWithTag {
  const inferredTag = required.tagRequirement || genericMaterialTagFromName(required.name);

  return inferredTag
    ? { ...required, name: cleanGenericMaterialLabel(required.name), tagRequirement: inferredTag }
    : required;
}

function getGenericInfusionPrefixFromEffects(effect?: string[]) {
  const combined = (effect || []).join(" ").toLowerCase();

  if (combined.includes("phase-touched")) return "Phase-Touched";
  if (combined.includes("storm-touched")) return "Storm-Touched";
  if (combined.includes("lightning-charged")) return "Lightning-Charged";
  if (combined.includes("tempest-touched")) return "Tempest-Touched";
  if (combined.includes("draconic-storm")) return "Draconic-Storm";
  if (combined.includes("ascendant storm-forged")) return "Ascendant Storm-Forged";

  return "";
}

function genericInfusionOutputName(prefix: string, materialName: string) {
  if (!prefix) return materialName;
  const lower = materialName.toLowerCase();
  if (
    lower.includes("phase-touched") ||
    lower.includes("storm-touched") ||
    lower.includes("lightning-charged") ||
    lower.includes("tempest-touched") ||
    lower.includes("draconic-storm") ||
    lower.includes("ascendant storm-forged")
  ) {
    return materialName;
  }

  return `${prefix} ${materialName}`;
}

function materialText(materials: Recipe["materials"]) {
  return (materials as RecipeMaterialWithTag[]).map((raw) => {
    const m = normalizeRequirement(raw);
    return m.tagRequirement ? `${m.qty}× ${m.name}` : `${m.qty}× ${m.name}`;
  }).join(", ");
}

function getRarityFromTags(recipe: Recipe): Rarity {
  const found = RARITY_ORDER.find((rarity) => recipe.tags.includes(rarity));
  return found || recipe.rarity || "common";
}

function getRarityColor(recipe: Recipe): string {
  return rarityColors[getRarityFromTags(recipe)] || rarityColors.common;
}


function availableQtyForRequirement(rawRequired: RecipeMaterialWithTag, materialMap: Map<string, number>) {
  const required = normalizeRequirement(rawRequired);

  if (!required.tagRequirement) return materialMap.get(normalizeName(required.name)) || 0;

  return getMaterialsByTag(required.tagRequirement).reduce((total, entry) => {
    return total + (materialMap.get(normalizeName(entry.name)) || 0);
  }, 0);
}

function firstAvailableMaterialForRequirement(rawRequired: RecipeMaterialWithTag, materialMap: Map<string, number>) {
  const required = normalizeRequirement(rawRequired);

  if (!required.tagRequirement) {
    const qty = materialMap.get(normalizeName(required.name)) || 0;
    return qty >= required.qty
      ? { name: required.name, tier: getMaterialTier(required.name), tags: [] as string[] }
      : undefined;
  }

  return getMaterialsByTag(required.tagRequirement).find((entry) => {
    const qty = materialMap.get(normalizeName(entry.name)) || 0;
    return qty >= required.qty;
  });
}

function canRecipe(recipe: Recipe, materialMap: Map<string, number>) {
  return (recipe.materials as RecipeMaterialWithTag[]).every(
    (required) => availableQtyForRequirement(required, materialMap) >= required.qty
  );
}

function missingMaterials(recipe: Recipe, materialMap: Map<string, number>) {
  return (recipe.materials as RecipeMaterialWithTag[])
    .map((rawRequired) => {
      const required = normalizeRequirement(rawRequired);
      const available = availableQtyForRequirement(required, materialMap);
      const label = required.tagRequirement ? required.name : required.name;
      return available >= required.qty
        ? null
        : { name: label, needed: required.qty, available };
    })
    .filter(Boolean) as { name: string; needed: number; available: number }[];
}

function getCompatiblePhaseTouchedMaterials(
  recipe: Recipe,
  materials: Material[],
  materialMap: Map<string, number>
) {
  const compatibleNames = new Set(
    (recipe.materials as RecipeMaterialWithTag[])
      .filter((required) => !required.tagRequirement)
      .map((required) => normalizeName(getPhaseTouchedCounterpart(required.name)))
  );

  return materials.filter((material) => {
    const normalizedName = normalizeName(material.name);
    const availableQty = materialMap.get(normalizedName) || 0;

    return (
      availableQty > 0 &&
      material.name.toLowerCase().includes("phase-touched") &&
      compatibleNames.has(normalizedName)
    );
  });
}

function isCompatiblePhaseTouchedMaterial(
  recipe: Recipe,
  selectedPhaseMaterial: string,
  materials: Material[],
  materialMap: Map<string, number>
) {
  if (!selectedPhaseMaterial || selectedPhaseMaterial === "none") return true;

  return getCompatiblePhaseTouchedMaterials(recipe, materials, materialMap).some(
    (material) => normalizeName(material.name) === normalizeName(selectedPhaseMaterial)
  );
}

function canCraftWithPhaseTouchedMaterial(
  recipe: Recipe,
  materials: Material[],
  materialMap: Map<string, number>
) {
  return (
    canRecipe(recipe, materialMap) &&
    canApplyPhaseTouchedEffect(recipe) &&
    !recipeAlreadyPhaseTouched(recipe) &&
    getCompatiblePhaseTouchedMaterials(recipe, materials, materialMap).length > 0
  );
}

function parseCreatedMaterialsFromOutcome(effect?: string[]): Omit<Material, "id" | "tier">[] {
  if (!effect) return [];
  return effect.flatMap((line) => {
    const match = line.match(/Create\s+(\d+)\s*[×x]\s*(.+)$/i);
    if (!match) return [];
    const qty = numberValue(match[1], 0);
    const name = match[2].trim();
    if (!qty || !name || name.toLowerCase().includes("version of")) return [];
    return [{ name, qty }];
  });
}

function parseInventoryText(rawText: string): Material[] {
  return rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•]/, "").trim())
    .map((line) => {
      const match =
        line.match(/^(.+?)\s*--\s*(\d+)$/) ||
        line.match(/^(.+?)\s*-\s*(\d+)$/) ||
        line.match(/^(.+?)\s*:\s*(\d+)$/) ||
        line.match(/^(\d+)\s*[x×]\s*(.+)$/i);

      if (!match) return { id: crypto.randomUUID(), name: line, qty: 0 };

      if (/^\d/.test(match[1])) {
        return {
          id: crypto.randomUUID(),
          name: match[2].trim(),
          qty: numberValue(match[1], 0),
          tier: getMaterialTier(match[2].trim()),
        };
      }

      return {
        id: crypto.randomUUID(),
        name: match[1].trim(),
        qty: numberValue(match[2], 0),
        tier: getMaterialTier(match[1].trim()),
      };
    });
}

function upsertMaterialList(current: Material[], incoming: Material[]) {
  const next = [...current];
  incoming.forEach((item) => {
    const index = next.findIndex((m) => normalizeName(m.name) === normalizeName(item.name));
    if (index >= 0) {
      next[index] = {
        ...next[index],
        qty: next[index].qty + item.qty,
        tier: next[index].tier ?? getMaterialTier(next[index].name),
      };
    } else {
      next.push({ ...item, tier: item.tier ?? getMaterialTier(item.name) });
    }
  });

  return next.sort((a, b) => {
    const tierA = a.tier ?? 99;
    const tierB = b.tier ?? 99;
    return tierA === tierB ? a.name.localeCompare(b.name) : tierA - tierB;
  });
}

function outcomeForRoll(total: number, dc: number, naturalRoll: number): CraftQuality {
  if (naturalRoll === 1) return "Flawed";
  if (total >= dc + 5) return "Superior";
  if (total >= dc) return "Normal";
  return "Flawed";
}

function getOutcome(recipe: Recipe, quality: CraftQuality) {
  return recipe.outcomes.find((outcome) => outcome.quality === quality);
}


function NormalOutcomePreview({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) {
  const normalOutcome = getOutcome(recipe, "Normal");

  if (!normalOutcome) return null;

  const effectLines = normalOutcome.effect || [];

  return (
    <div
      className={`rounded-xl border border-[#b99b62] bg-[#f8e8c2] ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}
    >
      <h4 className={`${compact ? "text-sm" : "text-base"} font-bold`}>Normal Craft Preview</h4>

      {normalOutcome.description && (
        <p className="mt-1 leading-relaxed">{normalOutcome.description}</p>
      )}

      {normalOutcome.statBlock && (
        <p className="mt-2">
          <strong>Stat Block:</strong> {normalOutcome.statBlock}
        </p>
      )}

      {effectLines.length > 0 && (
        <div className="mt-2">
          <strong>Effect:</strong>
          <ul className="ml-5 list-disc">
            {effectLines.map((line, index) => (
              <li key={`${recipe.id}-normal-effect-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {!normalOutcome.statBlock && effectLines.length === 0 && (
        <p className="mt-2 italic">Creates the normal version of this recipe.</p>
      )}
    </div>
  );
}


function supabaseMaterialsToLocalMaterials(
  rows: { id: string; name: string; qty: number; tier: number | null }[]
): Material[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    qty: row.qty,
    tier: row.tier ?? getMaterialTier(row.name),
  }));
}

function supabaseCraftedItemsToLocalItems(
  rows: {
    id: string;
    name: string;
    rarity: string | null;
    category: string | null;
    quality: string | null;
    effect: string[] | null;
    stat_block: string | null;
    phase_effect: Record<string, unknown> | null;
    created_at: string;
  }[]
): CraftedItem[] {
  return rows.map((row) => {
    const phaseEffect = row.phase_effect as CraftedEffect | null;

    return {
      id: row.id,
      name: row.name,
      type: row.category || "item",
      rarity: (row.rarity || "common") as Rarity,
      tags: [],
      quality: (row.quality || "Normal") as CraftQualityOrFailed,
      crafter: "Shared Campaign",
      rollTotal: 0,
      naturalRoll: 0,
      effect: row.effect || [],
      statBlock: row.stat_block || undefined,
      phaseTouched: Boolean(phaseEffect),
      phaseTouchedEffect: phaseEffect || undefined,
    };
  });
}

function normalizeCharacter(character: Partial<Character>): Character {
  return {
    id: character.id || crypto.randomUUID(),
    name: character.name || "Unnamed Crafter",
    isActive: character.isActive ?? true,
    harvesting: character.harvesting ?? 0,
    stats: {
      STR: character.stats?.STR ?? 0,
      DEX: character.stats?.DEX ?? 0,
      CON: character.stats?.CON ?? 0,
      INT: character.stats?.INT ?? 0,
      WIS: character.stats?.WIS ?? 0,
      CHA: character.stats?.CHA ?? 0,
    },
    tools: {
      ...TOOL_OPTIONS.reduce((acc, tool) => {
        acc[tool] = "none";
        return acc;
      }, {} as Record<string, ProficiencyLevel>),
      ...(character.tools || {}),
    },
    ownedTools: {
      ...buildToolOwnership(false),
      ...(character.ownedTools || {}),
    },
    brokenTools: {
      ...buildToolOwnership(false),
      ...(character.brokenTools || {}),
    },
    progressPoints: character.progressPoints || {},
    toolProgress: {
      ...buildToolProgress(false),
      ...(character.toolProgress || {}),
    },
  };
}

function supabaseCharactersToLocalCharacters(
  rows: {
    id: string;
    name: string;
    is_active?: boolean;
    tool_progress: Record<string, unknown>;
  }[]
): Character[] {
  return rows.map((row) => {
    const stored = row.tool_progress?.character as Partial<Character> | undefined;
    return normalizeCharacter({
      ...(stored || {}),
      id: row.id,
      name: stored?.name || row.name,
      isActive: row.is_active ?? stored?.isActive ?? true,
    });
  });
}

function characterToSupabasePayload(character: Character) {
  return {
    id: character.id,
    name: character.name,
    isActive: character.isActive,
    data: {
      character,
    } as Record<string, unknown>,
  };
}

function defaultCharacter(): Character {
  return {
    id: crypto.randomUUID(),
    name: "GM Crafter",
    isActive: true,
    harvesting: 1,
    stats: { STR: 3, DEX: 3, CON: 1, INT: 3, WIS: 1, CHA: 0 },
    tools: TOOL_OPTIONS.reduce((acc, tool) => {
      acc[tool] = "proficient";
      return acc;
    }, {} as Record<string, ProficiencyLevel>),
    ownedTools: buildToolOwnership(true),
    brokenTools: buildToolOwnership(false),
    progressPoints: {},
    toolProgress: buildToolProgress(true),
  };
}

export default function ArcaneCraftingCodexPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventoryProfiles, setInventoryProfiles] = useState<InventoryProfile[]>([]);
  const [activeInventoryId, setActiveInventoryId] = useState("");
  const [recipes] = useState<Recipe[]>(recipesRaw);
  const [characters, setCharacters] = useState<Character[]>([defaultCharacter()]);
  const [craftedItems, setCraftedItems] = useState<CraftedItem[]>([]);

  const [activeTab, setActiveTab] = useState<TabId>("craft");
  const [showPhaseCraftableOnly, setShowPhaseCraftableOnly] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [gmAuth, setGmAuth] = useState<GmAuthState | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [bulkMaterials, setBulkMaterials] = useState("");
  const [newMaterial, setNewMaterial] = useState({ name: "", qty: 1 });
  const [newInventoryName, setNewInventoryName] = useState("");
  const [disabledTags, setDisabledTags] = useState<string[]>([]);
  const [importLog, setImportLog] = useState("");

  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(() => characters[0].id);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(() => recipes[0]?.id ?? "");
  const [rollMode, setRollMode] = useState<"normal" | "advantage">("normal");
  const [assistantBonus, setAssistantBonus] = useState<"none" | "plus2">("none");
  const [npcCraft, setNpcCraft] = useState(false);
  const [phaseTouchedMaterial, setPhaseTouchedMaterial] = useState("none");

  const [lastRoll, setLastRoll] = useState<{
    recipeName: string;
    naturalRoll: number;
    secondRoll?: number;
    total: number;
    quality: CraftQualityOrFailed;
    ppGained: number;
    message: string;
    title?: string;
    phaseTouchedEffect?: string;
    result?: CraftResultSummary;
  } | null>(null);

  const [newCharacter, setNewCharacter] = useState<Character>(() => ({
    id: crypto.randomUUID(),
    name: "",
    isActive: true,
    harvesting: 0,
    stats: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    tools: TOOL_OPTIONS.reduce((acc, tool) => {
      acc[tool] = "none";
      return acc;
    }, {} as Record<string, ProficiencyLevel>),
    ownedTools: buildToolOwnership(false),
    brokenTools: buildToolOwnership(false),
    progressPoints: {},
    toolProgress: buildToolProgress(false),
  }));

  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [recipeSort, setRecipeSort] = useState<"alphabetical" | "rarity" | "tag">("alphabetical");
  const [recipeDiscoveryFilter, setRecipeDiscoveryFilter] = useState<"all" | "discovered" | "undiscovered">("all");
  const [availableRecipePage, setAvailableRecipePage] = useState(1);
  const [allRecipePage, setAllRecipePage] = useState(1);
  const [manuallyDiscoveredMaterials, setManuallyDiscoveredMaterials] = useState<string[]>([]);
  const [manuallyDiscoveredRecipeIds, setManuallyDiscoveredRecipeIds] = useState<string[]>([]);
  const [manuallyHiddenRecipeIds, setManuallyHiddenRecipeIds] = useState<string[]>([]);
  const [lootTier, setLootTier] = useState<CreatureTier>("common");
  const [lootTableId, setLootTableId] = useState(lootTables[0]?.id || "skeleton");
  const [lootQuality, setLootQuality] = useState<LootQuality | "none" | "unrolled">("unrolled");
  const [targetLootName, setTargetLootName] = useState("random");
  const [targetSpecificLoot, setTargetSpecificLoot] = useState(false);
  const [lootResults, setLootResults] = useState<LootResultItem[]>([]);
  const [sharedLootResults, setSharedLootResults] = useState<SharedLootResultItem[]>([]);
  const [creatureLootQueue, setCreatureLootQueue] = useState<CreatureLootQueueEntry[]>([]);
  const [selectedCreatureQueueId, setSelectedCreatureQueueId] = useState("");
  const [newLootCreatureTier, setNewLootCreatureTier] = useState<CreatureTier>("common");
  const [newLootCreatureTableId, setNewLootCreatureTableId] = useState(lootTables[0]?.id || "skeleton");
  const [newLootCreatureQty, setNewLootCreatureQty] = useState(1);
  const [activeCreatureQueueId, setActiveCreatureQueueId] = useState("");
  const [lootCharacterId, setLootCharacterId] = useState<string>(() => characters[0].id);
  const [harvestStarted, setHarvestStarted] = useState(false);
  const [harvestAttemptsRemaining, setHarvestAttemptsRemaining] = useState(0);
  const [harvestDc, setHarvestDc] = useState(10);
  const [harvestLog, setHarvestLog] = useState<string[]>([]);
  const [harvestStep, setHarvestStep] = useState<"setup" | "attempt" | "quality" | "loot">("setup");
  const [pendingLootRolls, setPendingLootRolls] = useState(0);
  const [doubleNextLoot, setDoubleNextLoot] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [isLoadingCampaignData, setIsLoadingCampaignData] = useState(false);
  const skipSupabaseSaveRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const shouldSaveMaterialsRef = useRef(false);
  const shouldSaveCharactersRef = useRef(false);
  const [characterAttributeAssignments, setCharacterAttributeAssignments] = useState<CharacterAttributeAssignmentRow[]>([]);
  const [harvestAttributeFlags, setHarvestAttributeFlags] = useState({
    firstFailIgnored: false,
    scavengerEyeUsed: false,
    masterworkInstinctUsed: false,
  });

  function skipNextSupabaseSave() {
    skipSupabaseSaveRef.current = true;
    window.setTimeout(() => {
      skipSupabaseSaveRef.current = false;
    }, 2000);
  }

  function markMaterialsForSupabaseSave() {
    shouldSaveMaterialsRef.current = true;
  }

  function markCharactersForSupabaseSave() {
    shouldSaveCharactersRef.current = true;
  }

  useEffect(() => {
    async function loadCampaignData() {
      try {
        const savedProfiles = window.localStorage.getItem(INVENTORY_PROFILES_STORAGE_KEY);
        const savedActiveId = window.localStorage.getItem(ACTIVE_INVENTORY_STORAGE_KEY);
        const oldSavedMaterials = window.localStorage.getItem("arcane-crafting-materials") || window.localStorage.getItem(MATERIALS_STORAGE_KEY);
        const oldSavedDisabledTags = window.localStorage.getItem(DISABLED_TAGS_STORAGE_KEY);

        let profiles: InventoryProfile[] = [];

        if (savedProfiles) {
          profiles = (JSON.parse(savedProfiles) as Partial<InventoryProfile>[]).map((profile) => ({
            id: profile.id || crypto.randomUUID(),
            name: profile.name || "Campaign",
            materials: (profile.materials || []).map((material) => ({
              ...material,
              id: material.id || crypto.randomUUID(),
              tier: material.tier ?? getMaterialTier(material.name),
            })),
            characters:
              profile.characters && profile.characters.length > 0
                ? profile.characters.map((character) => normalizeCharacter(character))
                : [defaultCharacter()],
            craftedItems: profile.craftedItems || [],
            disabledTags: profile.disabledTags || [],
          }));
        }

        if (profiles.length === 0) {
          const startingMaterials = oldSavedMaterials
            ? (JSON.parse(oldSavedMaterials) as Material[]).map((material) => ({
                ...material,
                id: material.id || crypto.randomUUID(),
                tier: material.tier ?? getMaterialTier(material.name),
              }))
            : buildStartingMaterials();

          profiles = [
            {
              id: crypto.randomUUID(),
              name: "Main Campaign",
              materials: startingMaterials,
              characters: [defaultCharacter()],
              craftedItems: [],
              disabledTags: oldSavedDisabledTags ? JSON.parse(oldSavedDisabledTags) : [],
            },
          ];
        }

        // Stage 1 Supabase sync:
        // Campaign IDs/names come from Supabase. Materials, characters, and crafted items still use localStorage for now.
        const supabaseCampaigns = await fetchCampaigns();

        if (supabaseCampaigns.length > 0) {
          profiles = supabaseCampaigns.map((campaign) => {
            const localMatch =
              profiles.find((profile) => profile.id === campaign.id) ||
              profiles.find((profile) => profile.name === campaign.name);

            return {
              id: campaign.id,
              name: campaign.name,
              materials: localMatch?.materials || [],
              characters: localMatch?.characters?.length ? localMatch.characters : [defaultCharacter()],
              craftedItems: localMatch?.craftedItems || [],
              disabledTags: localMatch?.disabledTags || [],
            };
          });
        }

        const activeProfile =
          profiles.find((profile) => profile.id === savedActiveId) ||
          profiles.find((profile) => profile.name === "Tales on The Sea") ||
          profiles[0];

        const [supabaseMaterials, supabaseCraftedRows, supabaseCharacterRows] = await Promise.all([
          fetchCampaignMaterials(activeProfile.id),
          fetchCampaignCraftedItems(activeProfile.id),
          fetchCampaignCharacters(activeProfile.id),
        ]);

        const activeMaterials =
          supabaseMaterials.length > 0
            ? supabaseMaterialsToLocalMaterials(supabaseMaterials)
            : activeProfile.materials;

        const activeCraftedItems =
          supabaseCraftedRows.length > 0
            ? supabaseCraftedItemsToLocalItems(supabaseCraftedRows)
            : activeProfile.craftedItems || [];

        const activeCharacters =
          supabaseCharacterRows.length > 0
            ? supabaseCharactersToLocalCharacters(supabaseCharacterRows)
            : activeProfile.characters.length
              ? activeProfile.characters
              : [defaultCharacter()];

        skipNextSupabaseSave();
        skipNextSupabaseSave();
        setInventoryProfiles(
          profiles.map((profile) =>
            profile.id === activeProfile.id
              ? { ...profile, materials: activeMaterials, craftedItems: activeCraftedItems, characters: activeCharacters }
              : profile
          )
        );
        setActiveInventoryId(activeProfile.id);
        setMaterials(activeMaterials);
        setCharacters(activeCharacters);
        setCraftedItems(activeCraftedItems);
        setDisabledTags(activeProfile.disabledTags || []);
        setSelectedCharacterId((activeCharacters[0] || defaultCharacter()).id);
      } catch (error) {
        console.error("Failed to load Supabase campaigns. Falling back to local data.", error);

        const fallbackMaterials = buildStartingMaterials();
        const fallbackCharacter = defaultCharacter();
        const fallbackProfile: InventoryProfile = {
          id: crypto.randomUUID(),
          name: "Main Campaign",
          materials: fallbackMaterials,
          characters: [fallbackCharacter],
          craftedItems: [],
          disabledTags: [],
        };

        skipNextSupabaseSave();
        skipNextSupabaseSave();
        setInventoryProfiles([fallbackProfile]);
        setActiveInventoryId(fallbackProfile.id);
        setMaterials(fallbackMaterials);
        setCharacters([fallbackCharacter]);
        setCraftedItems([]);
        setDisabledTags([]);
        setSelectedCharacterId(fallbackCharacter.id);
      } finally {
        setMaterialsLoaded(true);
      }
    }

    loadCampaignData();
  }, []);

  async function refreshActiveCampaignFromSupabase(campaignId: string) {
    setIsLoadingCampaignData(true);

    try {
      const [supabaseMaterials, supabaseCraftedRows, supabaseCharacterRows] = await Promise.all([
        fetchCampaignMaterials(campaignId),
        fetchCampaignCraftedItems(campaignId),
        fetchCampaignCharacters(campaignId),
      ]);

      const activeMaterials = supabaseMaterialsToLocalMaterials(supabaseMaterials);
      const activeCraftedItems = supabaseCraftedItemsToLocalItems(supabaseCraftedRows);
      const activeCharacters = supabaseCharacterRows.length > 0
        ? supabaseCharactersToLocalCharacters(supabaseCharacterRows)
        : characters;

      skipNextSupabaseSave();
      setMaterials(activeMaterials);
      setCraftedItems(activeCraftedItems);
      setCharacters(activeCharacters);
      setSelectedCharacterId((currentId) =>
        activeCharacters.some((character) => character.id === currentId)
          ? currentId
          : (activeCharacters[0]?.id || currentId)
      );

      setInventoryProfiles((current) =>
        current.map((profile) =>
          profile.id === campaignId
            ? {
                ...profile,
                materials: activeMaterials,
                craftedItems: activeCraftedItems,
                characters: activeCharacters,
              }
            : profile
        )
      );
    } catch (error) {
      setImportLog("Realtime refresh was delayed by Supabase. Refresh if the shared data looks stale.");
    } finally {
      setIsLoadingCampaignData(false);
    }
  }

  function scheduleRealtimeRefresh(campaignId: string) {
    if (realtimeRefreshTimerRef.current) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      refreshActiveCampaignFromSupabase(campaignId);
    }, 1200);
  }

  useEffect(() => {
    if (!materialsLoaded || !activeInventoryId) return;

    const channel = supabase
      .channel(`artisan-codex-campaign-${activeInventoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crafted_items",
          filter: `campaign_id=eq.${activeInventoryId}`,
        },
        () => scheduleRealtimeRefresh(activeInventoryId)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_characters",
          filter: `campaign_id=eq.${activeInventoryId}`,
        },
        () => scheduleRealtimeRefresh(activeInventoryId)
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [materialsLoaded, activeInventoryId]);


  async function loadCharacterAttributeAssignments(campaignId: string) {
    const { data, error } = await supabase
      .from("campaign_character_attributes")
      .select("campaign_id, character_id, card_id")
      .eq("campaign_id", campaignId);

    if (error) {
      console.warn("Failed to load character attribute assignments.", error);
      return;
    }

    setCharacterAttributeAssignments((data as CharacterAttributeAssignmentRow[] | null) || []);
  }

  useEffect(() => {
    if (!activeInventoryId) {
      setCharacterAttributeAssignments([]);
      return;
    }

    loadCharacterAttributeAssignments(activeInventoryId);

    const channel = supabase
      .channel(`artisan-codex-attributes-for-effects-${activeInventoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_character_attributes",
          filter: `campaign_id=eq.${activeInventoryId}`,
        },
        () => loadCharacterAttributeAssignments(activeInventoryId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeInventoryId]);

  function characterHasAttribute(characterId: string | undefined, cardId: number) {
    if (!characterId) return false;
    return characterAttributeAssignments.some((row) => row.character_id === characterId && row.card_id === cardId);
  }

  function characterHasAnyAttribute(characterId: string | undefined, cardIds: number[]) {
    return cardIds.some((cardId) => characterHasAttribute(characterId, cardId));
  }

  function currentLootTableLooksLike(...terms: string[]) {
    const table = getLootTable(lootTableId);
    const haystack = `${table.id} ${table.label} ${table.family}`.toLowerCase();
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  }

  function improveLootQualityOnce(quality: LootQuality | "none", creatureTerms: string[]): LootQuality | "none" {
    if (quality !== "common" || !currentLootTableLooksLike(...creatureTerms)) return quality;

    const reroll = rollWeightedLootQuality(lootTier);
    const rank: Record<LootQuality | "none", number> = { none: 0, common: 1, rare: 2, epic: 3 };
    return rank[reroll] > rank[quality] ? reroll : quality;
  }

  useEffect(() => {
    if (!materialsLoaded || !activeInventoryId || isLoadingCampaignData || skipSupabaseSaveRef.current) return;

    setInventoryProfiles((current) =>
      current.map((profile) =>
        profile.id === activeInventoryId
          ? { ...profile, materials, characters, craftedItems, disabledTags }
          : profile
      )
    );

    window.localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materials));
    window.localStorage.setItem("arcane-crafting-materials", JSON.stringify(materials));
    window.localStorage.setItem(DISABLED_TAGS_STORAGE_KEY, JSON.stringify(disabledTags));

    if (shouldSaveMaterialsRef.current) {
      shouldSaveMaterialsRef.current = false;

      replaceCampaignMaterials(
        activeInventoryId,
        materials.map((material) => ({
          name: material.name,
          qty: material.qty,
          tier: material.tier ?? getMaterialTier(material.name),
        }))
      ).catch((error) => {
        console.warn("Failed to save campaign materials to Supabase.", error);
        setImportLog("Warning: materials saved locally, but Supabase sync failed.");
      });
    }

    if (shouldSaveCharactersRef.current && characters.length > 0) {
      shouldSaveCharactersRef.current = false;

      replaceCampaignCharacters(
        activeInventoryId,
        characters.map(characterToSupabasePayload)
      ).catch((error) => {
        console.warn("Failed to save campaign characters to Supabase.", error);
        setImportLog("Warning: characters saved locally, but Supabase character sync failed.");
      });
    }
  }, [materials, characters, disabledTags, materialsLoaded, activeInventoryId, isLoadingCampaignData]);

  useEffect(() => {
    if (!materialsLoaded || inventoryProfiles.length === 0) return;
    window.localStorage.setItem(INVENTORY_PROFILES_STORAGE_KEY, JSON.stringify(inventoryProfiles));
  }, [inventoryProfiles, materialsLoaded]);

  useEffect(() => {
    if (!activeInventoryId) return;
    window.localStorage.setItem(ACTIVE_INVENTORY_STORAGE_KEY, activeInventoryId);
  }, [activeInventoryId]);

  useEffect(() => {
    window.localStorage.setItem(DISABLED_TAGS_STORAGE_KEY, JSON.stringify(disabledTags));
  }, [disabledTags]);

  useEffect(() => {
    if (!activeInventoryId) {
      setCreatureLootQueue([]);
      setSelectedCreatureQueueId("");
      return;
    }

    let cancelled = false;

    async function loadCreatureQueue() {
      try {
        const rows = await fetchCampaignLootCreatures(activeInventoryId);
        if (cancelled) return;

        const localQueue = rows.map(supabaseLootCreatureToLocal);
        setCreatureLootQueue(localQueue);
        setSelectedCreatureQueueId((current) =>
          current && localQueue.some((entry) => entry.id === current)
            ? current
            : localQueue[0]?.id || ""
        );
      } catch (error) {
        console.warn("Failed to load creature loot queue from Supabase.", error);
      }
    }

    loadCreatureQueue();

    const channel = supabase
      .channel(`campaign-loot-creatures-${activeInventoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_loot_creatures",
          filter: `campaign_id=eq.${activeInventoryId}`,
        },
        () => {
          loadCreatureQueue();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeInventoryId]);

  useEffect(() => {
    if (selectedCreatureQueueId && !creatureLootQueue.some((entry) => entry.id === selectedCreatureQueueId)) {
      setSelectedCreatureQueueId(creatureLootQueue[0]?.id || "");
    }
  }, [creatureLootQueue, selectedCreatureQueueId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("artisan-codex-discovered-materials");
      if (saved) setManuallyDiscoveredMaterials(JSON.parse(saved));
    } catch {
      setManuallyDiscoveredMaterials([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "artisan-codex-discovered-materials",
      JSON.stringify(manuallyDiscoveredMaterials)
    );
  }, [manuallyDiscoveredMaterials]);

  useEffect(() => {
    try {
      const discovered = window.localStorage.getItem(DISCOVERED_RECIPES_STORAGE_KEY);
      const hidden = window.localStorage.getItem(HIDDEN_RECIPES_STORAGE_KEY);
      if (discovered) setManuallyDiscoveredRecipeIds(JSON.parse(discovered));
      if (hidden) setManuallyHiddenRecipeIds(JSON.parse(hidden));
    } catch {
      setManuallyDiscoveredRecipeIds([]);
      setManuallyHiddenRecipeIds([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DISCOVERED_RECIPES_STORAGE_KEY, JSON.stringify(manuallyDiscoveredRecipeIds));
  }, [manuallyDiscoveredRecipeIds]);

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_RECIPES_STORAGE_KEY, JSON.stringify(manuallyHiddenRecipeIds));
  }, [manuallyHiddenRecipeIds]);

  useEffect(() => {
    try {
      const savedTags = window.localStorage.getItem(RECIPE_TAG_FILTERS_STORAGE_KEY);
      const savedSort = window.localStorage.getItem(RECIPE_SORT_STORAGE_KEY);
      const savedDiscoveryFilter = window.localStorage.getItem(RECIPE_DISCOVERY_FILTER_STORAGE_KEY);

      if (savedTags) setSelectedTagFilters(JSON.parse(savedTags));
      if (savedSort === "alphabetical" || savedSort === "rarity" || savedSort === "tag") {
        setRecipeSort(savedSort);
      }
      if (
        savedDiscoveryFilter === "all" ||
        savedDiscoveryFilter === "discovered" ||
        savedDiscoveryFilter === "undiscovered"
      ) {
        setRecipeDiscoveryFilter(savedDiscoveryFilter);
      }
    } catch {
      setSelectedTagFilters([]);
      setRecipeSort("alphabetical");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RECIPE_TAG_FILTERS_STORAGE_KEY, JSON.stringify(selectedTagFilters));
  }, [selectedTagFilters]);

  useEffect(() => {
    window.localStorage.setItem(RECIPE_SORT_STORAGE_KEY, recipeSort);
  }, [recipeSort]);

  useEffect(() => {
    window.localStorage.setItem(RECIPE_DISCOVERY_FILTER_STORAGE_KEY, recipeDiscoveryFilter);
  }, [recipeDiscoveryFilter]);

  useEffect(() => {
    setPhaseTouchedMaterial("none");
  }, [selectedRecipeId]);

  const materialMap = useMemo(() => {
    const map = new Map<string, number>();
    materials.forEach((material) => map.set(normalizeName(material.name), material.qty));
    return map;
  }, [materials]);

  const discoveredMaterialNames = useMemo(() => {
    return new Set([
      ...materials
        .filter((material) => material.qty > 0)
        .map((material) => normalizeName(material.name)),
      ...manuallyDiscoveredMaterials.map((name) => normalizeName(name)),
    ]);
  }, [materials, manuallyDiscoveredMaterials]);

  function markMaterialDiscovered(name: string, discovered = true) {
    const normalized = normalizeName(name);
    setManuallyDiscoveredMaterials((current) => {
      const existing = new Set(current.map((item) => normalizeName(item)));
      if (discovered) {
        if (existing.has(normalized)) return current;
        return [...current, name];
      }
      return current.filter((item) => normalizeName(item) !== normalized);
    });
  }

  function markMaterialsDiscovered(names: string[]) {
    setManuallyDiscoveredMaterials((current) => {
      const existing = new Set(current.map((item) => normalizeName(item)));
      const next = [...current];
      names.forEach((name) => {
        if (!existing.has(normalizeName(name))) {
          existing.add(normalizeName(name));
          next.push(name);
        }
      });
      return next;
    });
  }

  function markRecipeDiscovered(recipeId: string, discovered: boolean) {
    if (!adminUnlocked) return;

    setManuallyDiscoveredRecipeIds((current) => {
      const next = new Set(current);
      if (discovered) next.add(recipeId);
      else next.delete(recipeId);
      return [...next];
    });

    setManuallyHiddenRecipeIds((current) => {
      const next = new Set(current);
      if (discovered) next.delete(recipeId);
      else next.add(recipeId);
      return [...next];
    });
  }

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) || recipes[0];
  const selectedCharacter =
    characters.find((character) => character.id === selectedCharacterId) || characters[0];

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((recipe) => recipe.tags.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [recipes]);

  const managedTags = useMemo(() => {
    const existing = new Set(allTags);
    return MANAGED_RECIPE_TAGS.filter((tag) => existing.has(tag));
  }, [allTags]);

  useEffect(() => {
    setAvailableRecipePage(1);
    setAllRecipePage(1);
  }, [recipeSearch, selectedTagFilters, rarityFilter, recipeSort, recipeDiscoveryFilter]);

  const recipeStatus = useMemo(() => {
    const forcedDiscovered = new Set(manuallyDiscoveredRecipeIds);
    const forcedHidden = new Set(manuallyHiddenRecipeIds);

    return recipes.map((recipe) => {
      const materialDiscovered = recipeIsDiscovered(recipe, discoveredMaterialNames);
      const discovered = forcedHidden.has(recipe.id)
        ? false
        : forcedDiscovered.has(recipe.id)
          ? true
          : materialDiscovered;

      return {
        ...recipe,
        available: canRecipe(recipe, materialMap),
        missing: missingMaterials(recipe, materialMap),
        rarityFromTags: getRarityFromTags(recipe),
        discovered,
        hiddenByDisabledTag: recipe.tags.some((tag) => disabledTags.includes(tag)),
      };
    });
  }, [recipes, materialMap, discoveredMaterialNames, manuallyDiscoveredRecipeIds, manuallyHiddenRecipeIds, disabledTags]);

  const filteredRecipeStatus = useMemo(() => {
    const search = recipeSearch.trim().toLowerCase();

    const filtered = recipeStatus.filter((recipe) => {
      const tagMatches =
        selectedTagFilters.length === 0 ||
        selectedTagFilters.every((tag) => recipe.tags.includes(tag));
      const rarityMatches = rarityFilter === "all" || getRarityFromTags(recipe) === rarityFilter;
      const discoveryMatches =
        !adminUnlocked ||
        recipeDiscoveryFilter === "all" ||
        (recipeDiscoveryFilter === "discovered" && recipe.discovered && !recipe.hiddenByDisabledTag) ||
        (recipeDiscoveryFilter === "undiscovered" && (!recipe.discovered || recipe.hiddenByDisabledTag));
      const searchText = `${recipe.name} ${recipe.description} ${recipe.category} ${recipe.rarity} ${recipe.tags.join(
        " "
      )}`.toLowerCase();
      const searchMatches = !search || searchText.includes(search);
      return tagMatches && rarityMatches && discoveryMatches && searchMatches;
    });

    const rarityRank = new Map(RARITY_ORDER.map((rarity, index) => [rarity, index]));

    return [...filtered].sort((a, b) => {
      if (recipeSort === "rarity") {
        return (rarityRank.get(getRarityFromTags(a)) ?? 999) - (rarityRank.get(getRarityFromTags(b)) ?? 999)
          || a.name.localeCompare(b.name);
      }

      if (recipeSort === "tag") {
        return (a.tags[0] || "").localeCompare(b.tags[0] || "")
          || a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });
  }, [recipeStatus, recipeSearch, selectedTagFilters, rarityFilter, recipeSort, recipeDiscoveryFilter, adminUnlocked]);

  const filteredRecipes = filteredRecipeStatus.filter((recipe) => recipe.discovered && !recipe.hiddenByDisabledTag);
  const availableRecipes = filteredRecipes.filter((recipe) => recipe.available);
  const unavailableRecipes = filteredRecipes.filter((recipe) => !recipe.available);
  const phaseCraftableRecipes = availableRecipes.filter((recipe) =>
    canCraftWithPhaseTouchedMaterial(recipe, materials, materialMap)
  );
  const visibleAvailableRecipes = showPhaseCraftableOnly ? phaseCraftableRecipes : availableRecipes;

  function unlockGM() {
    setImportLog("Use GM Sign In instead.");
  }

  useEffect(() => {
    setAdminUnlocked(Boolean(gmAuth));
  }, [gmAuth]);

  function lockGM() {
    setAdminPassword("");
    setImportLog(gmAuth ? "Use Sign Out in the GM panel to fully leave GM mode." : "GM locked.");
    if (!gmAuth) setAdminUnlocked(false);
    setActiveTab("craft");
  }

  function addMaterial() {
    if (!adminUnlocked || !newMaterial.name.trim()) return;
    markMaterialsForSupabaseSave();
    setMaterials((current) =>
      upsertMaterialList(current, [
        {
          id: crypto.randomUUID(),
          name: newMaterial.name.trim(),
          qty: Math.max(0, numberValue(newMaterial.qty, 0)),
          tier: getMaterialTier(newMaterial.name.trim()),
        },
      ])
    );
    setNewMaterial({ name: "", qty: 1 });
  }

  function importMaterials() {
    if (!adminUnlocked) return;
    const parsed = parseInventoryText(bulkMaterials);
    markMaterialsForSupabaseSave();
    markMaterialsDiscovered(parsed.map((material) => material.name));
    setMaterials((current) => upsertMaterialList(current, parsed));
    setImportLog(`Imported or updated ${parsed.length} material rows. Saved permanently in this browser.`);
    setBulkMaterials("");
  }

  function resetMaterialsToStartingInventory() {
    if (!adminUnlocked) return;
    markMaterialsForSupabaseSave();
    setMaterials([]);
    setManuallyDiscoveredMaterials([]);
    setManuallyDiscoveredRecipeIds([]);
    setManuallyHiddenRecipeIds([]);
    window.localStorage.removeItem("artisan-codex-discovered-materials");
    window.localStorage.removeItem(DISCOVERED_RECIPES_STORAGE_KEY);
    window.localStorage.removeItem(HIDDEN_RECIPES_STORAGE_KEY);
    setImportLog("Current campaign inventory wiped and all materials/recipes marked undiscovered.");
  }

  function exportMaterialsJson() {
    if (!adminUnlocked) return;
    const data = materials
      .filter((material) => material.qty > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((material) => `${material.name} - ${material.qty}`)
      .join("\n");

    navigator.clipboard?.writeText(data);
    setImportLog("Current campaign inventory list copied to clipboard.");
  }

  async function switchInventoryProfile(profileId: string) {
    if (!adminUnlocked) return;
    const profile = inventoryProfiles.find((item) => item.id === profileId);
    if (!profile) return;

    setIsLoadingCampaignData(true);

    try {
      const [supabaseMaterials, supabaseCraftedRows, supabaseCharacterRows] = await Promise.all([
        fetchCampaignMaterials(profile.id),
        fetchCampaignCraftedItems(profile.id),
        fetchCampaignCharacters(profile.id),
      ]);

      const activeMaterials =
        supabaseMaterials.length > 0
          ? supabaseMaterialsToLocalMaterials(supabaseMaterials)
          : profile.materials;

      const activeCraftedItems =
        supabaseCraftedRows.length > 0
          ? supabaseCraftedItemsToLocalItems(supabaseCraftedRows)
          : profile.craftedItems || [];

      const activeCharacters =
        supabaseCharacterRows.length > 0
          ? supabaseCharactersToLocalCharacters(supabaseCharacterRows)
          : profile.characters.length
            ? profile.characters
            : [defaultCharacter()];

      skipNextSupabaseSave();
      skipNextSupabaseSave();
      setActiveInventoryId(profile.id);
      setMaterials(activeMaterials);
      setCharacters(activeCharacters);
      setCraftedItems(activeCraftedItems);
      setDisabledTags(profile.disabledTags || []);
      setSelectedCharacterId((activeCharacters[0] || defaultCharacter()).id);
      setImportLog(`Switched to ${profile.name}.`);
    } catch (error) {
      console.error(error);
      setImportLog("Could not load campaign materials from Supabase.");
    } finally {
      setIsLoadingCampaignData(false);
    }
  }

  async function createInventoryProfile(copyCurrent = false) {
    if (!adminUnlocked) return;

    try {
      const name = newInventoryName.trim() || `Campaign ${inventoryProfiles.length + 1}`;
      const campaign = await createCampaign(name);
      const defaultCampaignCharacter = defaultCharacter();

      const profile: InventoryProfile = {
        id: campaign.id,
        name: campaign.name,
        materials: copyCurrent
          ? materials.map((material) => ({ ...material, id: crypto.randomUUID() }))
          : [],
        characters: copyCurrent
          ? characters.map((character) => ({
              ...character,
              id: crypto.randomUUID(),
            }))
          : [defaultCampaignCharacter],
        craftedItems: copyCurrent
          ? craftedItems.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              createdAt: new Date().toLocaleString(),
            }))
          : [],
        disabledTags: copyCurrent ? [...disabledTags] : [],
      };

      setInventoryProfiles((current) => [...current, profile]);
      setActiveInventoryId(profile.id);
      setMaterials(profile.materials);
      setCharacters(profile.characters);
      setCraftedItems(profile.craftedItems);
      setDisabledTags(profile.disabledTags);
      setSelectedCharacterId(profile.characters[0].id);
      if (profile.materials.length > 0) {
        await replaceCampaignMaterials(
          profile.id,
          profile.materials.map((material) => ({
            name: material.name,
            qty: material.qty,
            tier: material.tier ?? getMaterialTier(material.name),
          }))
        );
      }

      await replaceCampaignCharacters(
        profile.id,
        profile.characters.map(characterToSupabasePayload)
      );

      setNewInventoryName("");
      setImportLog(`Created and opened ${name}.`);
    } catch (error) {
      console.error(error);
      setImportLog("Could not create campaign in Supabase.");
    }
  }

  function renameInventoryProfile(profileId: string, name: string) {
    if (!adminUnlocked) return;
    setInventoryProfiles((current) =>
      current.map((profile) =>
        profile.id === profileId ? { ...profile, name: name || "Campaign" } : profile
      )
    );
  }

  async function deleteInventoryProfile(profileId: string) {
    if (!adminUnlocked || inventoryProfiles.length <= 1) return;

    try {
      await deleteCampaign(profileId);
    } catch (error) {
      console.error(error);
      setImportLog("Could not delete campaign from Supabase.");
      return;
    }

    setInventoryProfiles((current) => {
      const remaining = current.filter((profile) => profile.id !== profileId);
      const nextActive = activeInventoryId === profileId ? remaining[0] : current.find((profile) => profile.id === activeInventoryId) || remaining[0];

      if (nextActive) {
        setActiveInventoryId(nextActive.id);
        setMaterials(nextActive.materials);
        setCharacters(nextActive.characters.length ? nextActive.characters : [defaultCharacter()]);
        setCraftedItems(nextActive.craftedItems || []);
        setDisabledTags(nextActive.disabledTags || []);
        setSelectedCharacterId((nextActive.characters[0] || defaultCharacter()).id);
      }

      return remaining;
    });
    setImportLog("Campaign deleted.");
  }

  function toggleDisabledTag(tag: string) {
    if (!adminUnlocked) return;
    setDisabledTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  function enableAllTags() {
    if (!adminUnlocked) return;
    setDisabledTags([]);
  }

  function disableAllTags() {
    if (!adminUnlocked) return;
    setDisabledTags(managedTags);
  }

  async function addCharacter() {
    if (!newCharacter.name.trim()) return;

    const character = {
      ...newCharacter,
      id: crypto.randomUUID(),
      name: newCharacter.name.trim(),
      isActive: true,
    };

    setCharacters((current) => [...current, character]);
    setSelectedCharacterId(character.id);

    if (activeInventoryId) {
      const { error } = await supabase.from("campaign_characters").upsert(
        {
          id: character.id,
          campaign_id: activeInventoryId,
          name: character.name,
          is_admin: false,
          is_active: character.isActive,
          harvesting: character.harvesting ?? 0,
          tool_progress: {
            character,
          },
        },
        { onConflict: "id" }
      );

      if (error) {
        console.warn("Failed to save new character to Supabase.", error);
        setImportLog("Warning: character was added locally, but Supabase sync failed.");
        markCharactersForSupabaseSave();
      } else {
        setImportLog(`Character "${character.name}" added to the shared campaign.`);
        shouldSaveCharactersRef.current = false;
      }
    } else {
      markCharactersForSupabaseSave();
    }

    setNewCharacter({
      id: crypto.randomUUID(),
      name: "",
      isActive: true,
      harvesting: 0,
      stats: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      tools: TOOL_OPTIONS.reduce((acc, tool) => {
        acc[tool] = "none";
        return acc;
      }, {} as Record<string, ProficiencyLevel>),
      ownedTools: buildToolOwnership(false),
      brokenTools: buildToolOwnership(false),
      progressPoints: {},
      toolProgress: buildToolProgress(false),
    });
  }

  function removeCharacter(id: string) {
    markCharactersForSupabaseSave();
    setCharacters((current) => current.filter((character) => character.id !== id));
    if (selectedCharacterId === id && characters.length > 1) {
      const replacement = characters.find((character) => character.id !== id);
      if (replacement) setSelectedCharacterId(replacement.id);
    }
  }

  function updateCharacterToolOwned(characterId: string, tool: string, owned: boolean) {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId
          ? {
              ...character,
              ownedTools: { ...character.ownedTools, [tool]: owned },
              brokenTools: owned ? character.brokenTools : { ...character.brokenTools, [tool]: false },
            }
          : character
      )
    );
  }

  function updateCharacterToolBroken(characterId: string, tool: string, broken: boolean) {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId
          ? {
              ...character,
              ownedTools: broken ? { ...character.ownedTools, [tool]: true } : character.ownedTools,
              brokenTools: { ...character.brokenTools, [tool]: broken },
            }
          : character
      )
    );
  }

  function applyTrainingToCharacter(characterId: string, tool: string, trainingType: "regular" | "expert") {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== characterId) return character;
        const currentProgress = character.toolProgress?.[tool] ?? emptyToolProgress();
        const nextProgress =
          trainingType === "regular"
            ? applyRegularTraining(currentProgress)
            : applyExpertTraining(currentProgress);

        return {
          ...character,
          tools: {
            ...character.tools,
            [tool]: nextProgress.pp >= 10 ? "proficient" : character.tools[tool] ?? "none",
          },
          toolProgress: {
            ...character.toolProgress,
            [tool]: {
              ...nextProgress,
              proficient: nextProgress.pp >= 10 || nextProgress.proficient,
            },
          },
        };
      })
    );
  }

  function updateCharacterActive(characterId: string, isActive: boolean) {
    if (!adminUnlocked) return;

    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, isActive } : character
      )
    );
  }

  function updateCharacterHarvesting(characterId: string, value: number) {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, harvesting: value } : character
      )
    );
  }

  function updateCharacterStat(characterId: string, stat: Stat, value: number) {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId
          ? { ...character, stats: { ...character.stats, [stat]: value } }
          : character
      )
    );
  }

  function updateCharacterTool(characterId: string, tool: string, level: ProficiencyLevel) {
    if (!adminUnlocked) return;
    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== characterId) return character;
        const currentProgress = character.toolProgress?.[tool] ?? emptyToolProgress();
        return {
          ...character,
          tools: { ...character.tools, [tool]: level },
          toolProgress: {
            ...character.toolProgress,
            [tool]: {
              ...currentProgress,
              proficient: level !== "none" || currentProgress.pp >= 10,
              pp: level !== "none" && currentProgress.pp < 10 ? 10 : currentProgress.pp,
            },
          },
        };
      })
    );
  }

  function addToolImprovement(characterId: string, tool: string, improvement: string) {
    if (!improvement || improvement === "select") return;

    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== characterId) return character;

        const currentProgress = character.toolProgress?.[tool] ?? emptyToolProgress();
        const selectedImprovements = currentProgress.specializations || [];
        const slots = improvementSlotsForPp(currentProgress.pp);

        const alreadyHasMastery = selectedImprovements.some(isMasteryImprovement);

        if (
          selectedImprovements.includes(improvement) ||
          selectedImprovements.length >= slots ||
          (isMasteryImprovement(improvement) && alreadyHasMastery)
        ) {
          return character;
        }

        return {
          ...character,
          toolProgress: {
            ...character.toolProgress,
            [tool]: {
              ...currentProgress,
              specializations: [...selectedImprovements, improvement],
            },
          },
        };
      })
    );
  }

  function adjustToolPp(characterId: string, tool: string, amount: number) {
    if (!adminUnlocked || !Number.isFinite(amount) || amount === 0) return;

    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== characterId) return character;

        const currentProgress = character.toolProgress?.[tool] ?? emptyToolProgress();
        const nextPp = Math.max(0, currentProgress.pp + amount);

        return {
          ...character,
          tools: {
            ...character.tools,
            [tool]: nextPp >= 10 ? "proficient" : character.tools[tool] ?? "none",
          },
          toolProgress: {
            ...character.toolProgress,
            [tool]: {
              ...currentProgress,
              pp: nextPp,
              proficient: nextPp >= 10 || currentProgress.proficient,
            },
          },
        };
      })
    );
  }

  useEffect(() => {
    if (!activeInventoryId) {
      setSharedLootResults([]);
      return;
    }

    let cancelled = false;

    async function loadLootLog() {
      try {
        const rows = await fetchCampaignLootLog(activeInventoryId);
        if (!cancelled) {
          setSharedLootResults(rows.map((row) => supabaseLootLogToLocal(row, characters)));
        }
      } catch (error) {
        console.warn("Failed to load shared loot log from Supabase.", error);
      }
    }

    loadLootLog();

    const channel = supabase
      .channel(`campaign-loot-log-${activeInventoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_loot_log",
          filter: `campaign_id=eq.${activeInventoryId}`,
        },
        () => {
          loadLootLog();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeInventoryId, characters]);

  function recordSharedLootResult(result: LootResultItem) {
    if (!activeInventoryId) return;

    const activeEntry = creatureLootQueue.find((entry) => entry.id === activeCreatureQueueId);

    insertCampaignLootLog({
      campaignId: activeInventoryId,
      characterId: lootCharacterId || null,
      creatureQueueId: activeCreatureQueueId || null,
      creatureTableId: lootTableId,
      creatureLabel: activeEntry?.creatureLabel || getLootTable(lootTableId).label,
      creatureTier: lootTier,
      lootQuality: result.quality,
      lootName: result.name,
      qty: result.qty,
      kind: result.kind,
      rollText: result.rollText || null,
    }).catch((error) => {
      console.warn("Failed to save shared loot result to Supabase.", error);
      setImportLog("Loot was added locally, but the shared loot log failed to sync.");
    });
  }

  function addCreatureToLootQueue() {
    if (!adminUnlocked || !activeInventoryId) return;

    const table = getLootTable(newLootCreatureTableId);
    const qty = Math.max(1, Math.floor(newLootCreatureQty || 1));

    insertCampaignLootCreature({
      campaignId: activeInventoryId,
      creatureTableId: table.id,
      creatureLabel: table.label,
      creatureTier: newLootCreatureTier,
      qty,
    })
      .then((row) => {
        const entry = supabaseLootCreatureToLocal(row);
        setCreatureLootQueue((current) => [...current.filter((item) => item.id !== entry.id), entry]);
        setSelectedCreatureQueueId((current) => current || entry.id);
        setImportLog(`Added ${qty}× ${table.label} to the shared looting table.`);
      })
      .catch((error) => {
        console.warn("Failed to add creature to Supabase loot queue.", error);
        setImportLog("Failed to add creature to the shared looting table. Check the browser console.");
      });
  }

  function removeCreatureFromLootQueue(entryId: string) {
    if (!adminUnlocked) return;

    deleteCampaignLootCreature(entryId)
      .then(() => {
        setCreatureLootQueue((current) => current.filter((entry) => entry.id !== entryId));
        if (selectedCreatureQueueId === entryId) setSelectedCreatureQueueId("");
      })
      .catch((error) => {
        console.warn("Failed to remove creature from Supabase loot queue.", error);
        setImportLog("Failed to remove creature from the shared looting table. Check the browser console.");
      });
  }

  function startHarvesting() {
    const selectedQueueEntry = creatureLootQueue.find((entry) => entry.id === selectedCreatureQueueId);
    if (!selectedQueueEntry || harvestStarted) return;

    const rule = creatureTierRules[selectedQueueEntry.creatureTier];
    setLootTier(selectedQueueEntry.creatureTier);
    setLootTableId(selectedQueueEntry.creatureTableId);
    setActiveCreatureQueueId(selectedQueueEntry.id);
    setHarvestStarted(true);
    setHarvestAttributeFlags({ firstFailIgnored: false, scavengerEyeUsed: false, masterworkInstinctUsed: false });
    setHarvestAttemptsRemaining(rule.attempts);
    setHarvestDc(rule.dc);
    setLootQuality("unrolled");
    setTargetLootName("random");
    setTargetSpecificLoot(false);
    setPendingLootRolls(0);
    setDoubleNextLoot(false);
    setHarvestStep("attempt");
    setHarvestLog([`Started harvesting ${selectedQueueEntry.creatureLabel}. Attempts: ${rule.attempts}, DC ${rule.dc}.`]);
  }

  function newCreature() {
    if (activeCreatureQueueId) {
      const activeEntry = creatureLootQueue.find((entry) => entry.id === activeCreatureQueueId);

      if (activeEntry) {
        decrementCampaignLootCreature(activeEntry.id, activeEntry.qty).catch((error) => {
          console.warn("Failed to decrement creature loot queue in Supabase.", error);
          setImportLog("Warning: creature was finished locally, but shared loot queue sync failed.");
        });
      }

      setCreatureLootQueue((current) =>
        current.flatMap((entry) => {
          if (entry.id !== activeCreatureQueueId) return [entry];

          const remainingQty = entry.qty - 1;
          if (remainingQty <= 0) return [];
          return [{ ...entry, qty: remainingQty }];
        })
      );
    }

    setHarvestStarted(false);
    setHarvestAttributeFlags({ firstFailIgnored: false, scavengerEyeUsed: false, masterworkInstinctUsed: false });
    setActiveCreatureQueueId("");
    setHarvestAttemptsRemaining(0);
    setHarvestDc(creatureTierRules[lootTier].dc);
    setLootQuality("unrolled");
    setTargetLootName("random");
    setTargetSpecificLoot(false);
    setLootResults([]);
    setHarvestLog([]);
    setPendingLootRolls(0);
    setDoubleNextLoot(false);
    setHarvestStep("setup");
  }

  function getTargetedLootSelection(quality: LootQuality) {
    if (!targetSpecificLoot || targetLootName === "random") return null;

    const table = getLootTable(lootTableId);
    const entry = (table.tables[quality] || []).find((item) => item.name === targetLootName);

    return entry ? { entry, quality } : null;
  }

  function lootingAttempt() {
    if (!harvestStarted || harvestAttemptsRemaining <= 0 || harvestStep !== "attempt") return;

    const character = characters.find((item) => item.id === lootCharacterId) || characters[0];
    const harvestingAttributeIds = CRAFTING_ATTRIBUTE_IDS;
    const hasKeenHarvester = characterHasAttribute(character?.id, harvestingAttributeIds.keenHarvester);
    const hasPhaseExtractor = characterHasAttribute(character?.id, harvestingAttributeIds.phaseExtractor) && currentLootTableLooksLike("phase", "dimensional");
    const hasDragonSense = characterHasAttribute(character?.id, harvestingAttributeIds.dragonSense) && currentLootTableLooksLike("dragon", "draconic");
    const harvestAdvantage = hasKeenHarvester || hasPhaseExtractor || hasDragonSense;

    let roll = Math.floor(Math.random() * 20) + 1;
    let secondHarvestRoll: number | undefined;
    if (harvestAdvantage) {
      secondHarvestRoll = Math.floor(Math.random() * 20) + 1;
      roll = Math.max(roll, secondHarvestRoll);
    }

    const harvestingBonus = character?.harvesting ?? 0;
    const hasCriticalAnatomy = characterHasAttribute(character?.id, harvestingAttributeIds.criticalAnatomy);
    const baseDc = Math.min(20, harvestDc);
    const currentDcBeforeAttribute = targetSpecificLoot ? Math.min(22, baseDc + 2) : baseDc;
    const currentDc = hasCriticalAnatomy ? Math.max(8, currentDcBeforeAttribute - 2) : currentDcBeforeAttribute;
    const total = roll + harvestingBonus;
    const advantageText = harvestAdvantage ? ` Advantage roll${secondHarvestRoll ? ` (${roll}/${secondHarvestRoll})` : ""}.` : "";
    const dcText = hasCriticalAnatomy ? ` Critical Anatomy reduced DC from ${currentDcBeforeAttribute} to ${currentDc}.` : "";

    if (roll === 1) {
      const hasCantLeaveIt = characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.cantLeaveIt);
      const loss = hasCantLeaveIt ? 1 : 2;
      const nextAttempts = Math.max(0, harvestAttemptsRemaining - loss);
      setHarvestAttemptsRemaining(nextAttempts);
      setHarvestStep(nextAttempts <= 0 ? "setup" : "attempt");
      setHarvestLog((current) => [
        `${hasCantLeaveIt ? "Can't Leave It softened the Nat 1: " : "Critical failure: "}${character?.name || "Harvester"} rolled Nat 1 (${total}) vs DC ${currentDc}. Lose ${loss} attempt${loss === 1 ? "" : "s"}. ${nextAttempts} remaining.${advantageText}${dcText}`,
        ...current,
      ]);
      return;
    }

    if (roll === 20) {
      setPendingLootRolls(characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.keenHarvester) ? 3 : 2);
      setDoubleNextLoot(true);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Critical success: ${character?.name || "Harvester"} rolled Nat 20 vs DC ${currentDc}. Gain ${characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.keenHarvester) ? 3 : 2} loot rolls, double the first item found, and the DC stays ${baseDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}${advantageText}${dcText}`,
        ...current,
      ]);
      return;
    }

    if (total >= currentDc + 5) {
      const nextDc = Math.min(20, baseDc + 1);
      setHarvestDc(nextDc);
      setPendingLootRolls(2 + (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester) ? 1 : 0));
      setDoubleNextLoot(false);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Great success: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. Gain ${2 + (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester) ? 1 : 0)} loot rolls. Next base DC ${nextDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}${advantageText}${dcText}`,
        ...current,
      ]);
      return;
    }

    if (total >= currentDc) {
      const nextDc = Math.min(20, baseDc + 1);
      setHarvestDc(nextDc);
      setPendingLootRolls(1 + (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester) ? 1 : 0));
      setDoubleNextLoot(false);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Success: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. Gain ${1 + (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester) ? 1 : 0)} loot roll${characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester) ? "s" : ""}. Next base DC ${nextDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}${advantageText}${dcText}`,
        ...current,
      ]);
      return;
    }

    const hasKeenFirstFail = characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.keenHarvester) && !harvestAttributeFlags.firstFailIgnored;
    const nextAttemptsAfterFailure = hasKeenFirstFail ? harvestAttemptsRemaining : Math.max(0, harvestAttemptsRemaining - 1);
    let nextDcAfterFailure = harvestDc;
    let nextStepAfterFailure: "setup" | "attempt" = nextAttemptsAfterFailure <= 0 ? "setup" : "attempt";
    let extraFailureText = hasKeenFirstFail ? " Keen Harvester ignored this creature's first failed Harvesting check." : "";

    if (
      !hasKeenFirstFail &&
      nextAttemptsAfterFailure <= 0 &&
      characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.scavengersEye) &&
      !harvestAttributeFlags.scavengerEyeUsed
    ) {
      nextDcAfterFailure = 10;
      nextStepAfterFailure = "attempt";
      extraFailureText += " Scavenger's Eye grants one final DC 10 bonus harvesting check.";
      setHarvestAttributeFlags((current) => ({ ...current, scavengerEyeUsed: true }));
    }

    if (hasKeenFirstFail) {
      setHarvestAttributeFlags((current) => ({ ...current, firstFailIgnored: true }));
    }

    setHarvestAttemptsRemaining(nextStepAfterFailure === "attempt" && nextAttemptsAfterFailure <= 0 ? 1 : nextAttemptsAfterFailure);
    setHarvestDc(nextDcAfterFailure);
    setHarvestStep(nextStepAfterFailure);
    setHarvestLog((current) => [
      `Failure: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. ${hasKeenFirstFail ? "No attempt lost." : `Lose 1 attempt. ${nextAttemptsAfterFailure} remaining.`}${extraFailureText}${advantageText}${dcText}`,
      ...current,
    ]);
  }

  function rollLootQualityOnly() {
    if (!harvestStarted || harvestAttemptsRemaining <= 0 || harvestStep !== "quality" || pendingLootRolls <= 0) return;

    const character = characters.find((item) => item.id === lootCharacterId) || characters[0];
    let quality = rollWeightedLootQuality(lootTier);

    if (quality === "none" && characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester)) {
      quality = "common";
    }

    if (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.phaseExtractor)) {
      quality = improveLootQualityOnce(quality, ["phase", "dimensional"]);
    }

    if (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.dragonSense)) {
      quality = improveLootQualityOnce(quality, ["dragon", "draconic"]);
    }

    setLootQuality(quality);

    if (quality === "none") {
      const remainingRolls = Math.max(0, pendingLootRolls - 1);
      setPendingLootRolls(remainingRolls);
      setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
      const result: LootResultItem = { name: "No Loot", qty: 0, kind: "none", quality: "none" };
      setLootResults((current) => [result, ...current]);
      recordSharedLootResult(result);
      setHarvestLog((current) => [
        `Loot quality rolled: No Loot. Skipping Roll Loot. ${remainingRolls} pending loot roll${remainingRolls === 1 ? "" : "s"} remaining.`,
        ...current,
      ]);
      return;
    }

    setHarvestStep("loot");
    setHarvestLog((current) => [
      `Loot quality rolled: ${quality} loot.`,
      ...current,
    ]);
  }

  function addLootToInventory() {
    if (!harvestStarted || harvestAttemptsRemaining <= 0 || harvestStep !== "loot" || pendingLootRolls <= 0) return;

    const table = getLootTable(lootTableId);
    const character = characters.find((item) => item.id === lootCharacterId) || characters[0];
    let quality = lootQuality === "unrolled" ? rollWeightedLootQuality(lootTier) : lootQuality;

    if (quality === "none" && characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.efficientHarvester)) {
      quality = "common";
    }

    if (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.phaseExtractor)) {
      quality = improveLootQualityOnce(quality, ["phase", "dimensional"]);
    }

    if (characterHasAttribute(character?.id, CRAFTING_ATTRIBUTE_IDS.dragonSense)) {
      quality = improveLootQualityOnce(quality, ["dragon", "draconic"]);
    }
    const targetSelection = quality === "none" ? null : getTargetedLootSelection(quality);

    if (quality === "none") {
      const result: LootResultItem = { name: "No Loot", qty: 0, kind: "none", quality: "none" };
      setLootQuality("none");
      setLootResults((current) => [result, ...current]);
      recordSharedLootResult(result);
      const remainingRolls = Math.max(0, pendingLootRolls - 1);
      setPendingLootRolls(remainingRolls);
      setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
      setHarvestLog((current) => [
        `No Loot found. ${remainingRolls} pending loot roll${remainingRolls === 1 ? "" : "s"} remaining.`,
        ...current,
      ]);
      return;
    }

    const entries = table.tables[quality] || [];
    if (entries.length === 0) {
      const result: LootResultItem = { name: "No entries for this table.", qty: 0, kind: "none", quality };
      setLootResults((current) => [result, ...current]);
      recordSharedLootResult(result);
      const remainingRolls = Math.max(0, pendingLootRolls - 1);
      setPendingLootRolls(remainingRolls);
      setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
      return;
    }

    const entry =
      targetSelection && targetSelection.quality === quality
        ? targetSelection.entry
        : entries[Math.floor(Math.random() * entries.length)];

    const baseQty = rollDiceExpression(entry.amount);
    const shouldDouble = doubleNextLoot;
    const result: LootResultItem = {
      name: entry.name,
      qty: (Number(baseQty) || 1) * (shouldDouble ? 2 : 1),
      kind: entry.kind || "material",
      quality,
      rollText: entry.amount ? `${entry.amount} rolled ${Number(baseQty) || 1}${shouldDouble ? " and doubled" : ""}` : undefined,
    };

    setLootQuality("unrolled");
    setLootResults((current) => [result, ...current]);
    recordSharedLootResult(result);
    markMaterialDiscovered(entry.name, true);

    const remainingRolls = Math.max(0, pendingLootRolls - 1);
    setPendingLootRolls(remainingRolls);
    setDoubleNextLoot(false);
    if (targetSelection) setTargetLootName("random");
    setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
    setHarvestLog((current) => [
      `Loot found: ${result.qty}× ${result.name}${shouldDouble ? " (doubled from critical success)" : ""}. ${remainingRolls} pending loot roll${remainingRolls === 1 ? "" : "s"} remaining.`,
      ...current,
    ]);

    if ((entry.kind || "material") === "material") {
      markMaterialsForSupabaseSave();
      setMaterials((current) =>
        upsertMaterialList(current, [{ id: crypto.randomUUID(), name: entry.name, qty: result.qty, tier: getMaterialTier(entry.name) }])
      );
    } else {
      const lootedItem: CraftedItem = {
        id: crypto.randomUUID(),
        name: entry.name,
        type: entry.kind || "item",
        rarity: quality === "epic" ? "epic" : quality === "rare" ? "rare" : "common",
        tags: ["looted", table.family, quality],
        quality: "Normal",
        crafter: "Looted",
        rollTotal: 0,
        naturalRoll: 0,
      };
      setCraftedItems((current) => [lootedItem, ...current]);
    }
  }

  function passDay() {
    if (!adminUnlocked) return;

    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => ({
        ...character,
        toolProgress: Object.fromEntries(
          TOOL_OPTIONS.map((tool) => {
            const progress = character.toolProgress?.[tool] ?? emptyToolProgress();

            return [
              tool,
              {
                ...progress,
                craftsTodayByCategory: {},
              },
            ];
          })
        ) as Record<string, ToolProgress>,
      }))
    );

    setImportLog("A new crafting day has begun. Daily craft counts reset, PP gain is available again, and daily-limit advantage has been removed.");
  }

  async function craftSelectedRecipe(recipeOverride?: Recipe) {
    const recipe = recipeOverride || selectedRecipe;
    if (!recipe || !selectedCharacter) return;

    if (!selectedCharacter.ownedTools?.[recipe.tool]) {
      setLastRoll({
        recipeName: recipe.name,
        naturalRoll: 0,
        total: 0,
        quality: "Failed",
        ppGained: 0,
        title: "Missing Tool",
        message: `${selectedCharacter.name} does not own ${recipe.tool}'s Tools and cannot craft ${recipe.name}.`,
      });
      return;
    }

    if (selectedCharacter.brokenTools?.[recipe.tool]) {
      setLastRoll({
        recipeName: recipe.name,
        naturalRoll: 0,
        total: 0,
        quality: "Failed",
        ppGained: 0,
        title: "Broken Tool",
        message: `${selectedCharacter.name}'s ${recipe.tool}'s Tools are broken and must be repaired or replaced before crafting.`,
      });
      return;
    }

    if (!canRecipe(recipe, materialMap)) {
      setLastRoll({
        recipeName: recipe.name,
        naturalRoll: 0,
        total: 0,
        quality: "Failed",
        ppGained: 0,
        title: "Missing Materials",
        message: `You do not have enough materials to craft ${recipe.name}.`,
      });
      return;
    }

    const selectedPhaseMaterial = phaseTouchedMaterial !== "none" ? phaseTouchedMaterial : "";
    const usingPhaseTouched = Boolean(selectedPhaseMaterial);
    const phaseMaterialAvailable = !usingPhaseTouched || (materialMap.get(normalizeName(selectedPhaseMaterial)) || 0) > 0;
    const resolvedTagMaterials = (recipe.materials as RecipeMaterialWithTag[])
      .map((required) => normalizeRequirement(required))
      .filter((required) => required.tagRequirement)
      .map((required) => ({ required, selected: firstAvailableMaterialForRequirement(required, materialMap) }));

    if (usingPhaseTouched && !phaseMaterialAvailable) {
      setLastRoll({
        recipeName: recipe.name,
        naturalRoll: 0,
        total: 0,
        quality: "Failed",
        ppGained: 0,
        title: "Missing Phase-Touched Material",
        message: `You selected ${selectedPhaseMaterial}, but none are available.`,
      });
      return;
    }

    if (
      usingPhaseTouched &&
      !isCompatiblePhaseTouchedMaterial(recipe, selectedPhaseMaterial, materials, materialMap)
    ) {
      const compatibleNames = getCompatiblePhaseTouchedMaterials(recipe, materials, materialMap)
        .map((material) => material.name)
        .join(", ");

      setLastRoll({
        recipeName: recipe.name,
        naturalRoll: 0,
        total: 0,
        quality: "Failed",
        ppGained: 0,
        title: "Wrong Phase-Touched Material",
        message: compatibleNames
          ? `${selectedPhaseMaterial} does not match this recipe. Use one of: ${compatibleNames}.`
          : `This recipe does not have a matching Phase-Touched material available.`,
      });
      return;
    }

    const hasCraftingAttribute = (cardId: number) => characterHasAttribute(selectedCharacter.id, cardId);
    const hasToolAffinity = Object.entries(ATTRIBUTE_TOOL_AFFINITY).some(([cardId, tools]) =>
      hasCraftingAttribute(Number(cardId)) && tools.includes(recipe.tool)
    );

    const toolProgress = selectedCharacter.toolProgress?.[recipe.tool] ?? emptyToolProgress();
    const craftsToday = toolProgress.craftsTodayByCategory?.[recipe.category] ?? 0;
    const selectedImprovements = toolProgress.specializations || [];
    const hasAdvantageMastery = selectedImprovements.includes("Mastery: Advantage on crafting rolls");
    const hasDcReductionMastery = selectedImprovements.includes("Mastery: Reduce crafting DC by 1");
    const hasNearFailureMastery = selectedImprovements.includes("Mastery: Treat failures within 2 of DC as Normal");
    const hasCloseEnough = hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.closeEnough);
    const hasTinkerNearFailure = hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.tinkersGift) && recipe.tool === "Tinker";
    const hasMaterialMemoryDc = hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.materialMemory) && craftsToday === 0;
    const hasLeatherworkerDc =
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.leatherworkerHands) &&
      recipe.tool === "Leatherworker" &&
      recipe.materials.some((material) => /spider|hide|chitin|leather|creature/i.test(normalizeRequirement(material as RecipeMaterialWithTag).name));
    const hasChitinCraftDc =
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.chitinCraft) &&
      recipe.materials.some((material) => /chitin|spider/i.test(normalizeRequirement(material as RecipeMaterialWithTag).name));
    const baseAttributeDcReduction =
      (hasDcReductionMastery ? 1 : 0) +
      (hasMaterialMemoryDc ? 2 : 0) +
      (hasLeatherworkerDc ? 1 : 0) +
      (hasChitinCraftDc ? 2 : 0);
    const adjustedDc = Math.max(1, recipe.dc - baseAttributeDcReduction);
    const dailyAdvantage = shouldGainAdvantageFromDailyCategoryLimit(craftsToday);
    const hasStormReaderAdvantage =
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.stormReader) &&
      recipe.materials.some((material) => /blue[- ]?dragon|storm|lightning/i.test(normalizeRequirement(material as RecipeMaterialWithTag).name));
    const effectiveRollMode = dailyAdvantage || hasAdvantageMastery || hasStormReaderAdvantage ? "advantage" : rollMode;

    const toolLevel = hasToolAffinity
      ? "proficient"
      : selectedCharacter.tools[recipe.tool] || (toolProgress.proficient ? "proficient" : "none");
    const proficiencyBonus = PROFICIENCY_BONUS[toolLevel] || 0;
    const statBonus = selectedCharacter.stats[recipe.stat] || 0;
    const plusTwo = assistantBonus === "plus2" ? 2 : 0;

    let naturalRoll = 10;
    let secondRoll: number | undefined;

    if (!npcCraft) {
      naturalRoll = Math.floor(Math.random() * 20) + 1;
      if (effectiveRollMode === "advantage") {
        secondRoll = Math.floor(Math.random() * 20) + 1;
        naturalRoll = Math.max(naturalRoll, secondRoll);
      }
    }

    const total = npcCraft ? adjustedDc : naturalRoll + statBonus + proficiencyBonus + plusTwo;
    let craftResult = npcCraft
      ? {
          type: "success",
          title: "NPC Crafting Complete",
          quality: "Normal" as CraftQualityOrFailed,
          ppGain: 0,
          materialsConsumed: "normal",
          itemCreated: true,
          message: "NPC crafted a Normal version. No roll required. Materials consumed.",
        }
      : calculateCraftResult({
          naturalRoll,
          total,
          dc: adjustedDc,
          categoryCraftsToday: craftsToday,
          isFirstTimeItemType: hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.materialMemory) || !selectedCharacter.progressPoints?.[recipe.category],
        });

    if (
      (hasNearFailureMastery || hasCloseEnough || hasTinkerNearFailure) &&
      !npcCraft &&
      craftResult.quality === "Flawed" &&
      total >= adjustedDc - 2
    ) {
      craftResult = {
        ...craftResult,
        type: "success",
        title: hasCloseEnough ? "Close Enough" : hasTinkerNearFailure ? "Tinker's Gift" : "Mastery Recovery",
        quality: "Normal" as CraftQualityOrFailed,
        ppGain: Math.max(craftResult.ppGain, 1),
        materialsConsumed: "normal",
        itemCreated: true,
        message: `${hasCloseEnough ? "Close Enough" : hasTinkerNearFailure ? "Tinker's Gift" : "Mastery"} applied: a near failure within 2 of the DC becomes a Normal success.`,
      };
    }

    if (
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.masterworkInstinct) &&
      !harvestAttributeFlags.masterworkInstinctUsed &&
      craftResult.quality === "Normal" &&
      craftResult.itemCreated
    ) {
      craftResult = {
        ...craftResult,
        quality: "Superior" as CraftQualityOrFailed,
        title: "Masterwork Instinct",
        message: `${craftResult.message} Masterwork Instinct upgraded this Normal result to Superior.`,
      };
      setHarvestAttributeFlags((current) => ({ ...current, masterworkInstinctUsed: true }));
    }

    if (
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.alchemicalBloodline) &&
      ["potion", "poison"].some((word) => recipe.category.toLowerCase().includes(word) || recipe.tags.some((tag) => tag.toLowerCase().includes(word))) &&
      craftResult.quality === "Normal" &&
      craftResult.itemCreated &&
      Math.floor(Math.random() * 6) + 1 >= 5
    ) {
      craftResult = {
        ...craftResult,
        quality: "Superior" as CraftQualityOrFailed,
        title: "Alchemical Bloodline",
        message: `${craftResult.message} Alchemical Bloodline upgraded this Normal alchemical result to Superior.`,
      };
    }

    if (
      hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.perfectionist) &&
      craftResult.quality === "Superior"
    ) {
      craftResult = {
        ...craftResult,
        ppGain: craftResult.ppGain + 1,
        message: `${craftResult.message} Perfectionist grants +1 additional PP on Superior results.`,
      };
    }

    if (
      (hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.masteryFastTrack) || hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.dailyGrind)) &&
      craftResult.itemCreated &&
      craftResult.quality !== "Failed"
    ) {
      craftResult = {
        ...craftResult,
        ppGain: craftResult.ppGain + 1,
        message: `${craftResult.message} ${hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.masteryFastTrack) ? "Mastery Fast-Track" : "Daily Grind"} grants +1 additional PP.`,
      };
    }

    let quality = craftResult.quality;
    const outcome = quality === "Failed" ? undefined : getOutcome(recipe, quality as CraftQuality);
    let createdMaterials = parseCreatedMaterialsFromOutcome(outcome?.effect);
    const materialRecipe = recipe.category === "material-refinement" || recipe.tags.includes("material-creation");
    const genericInfusionPrefix = getGenericInfusionPrefixFromEffects(outcome?.effect);
    if (genericInfusionPrefix && resolvedTagMaterials[0]?.selected) {
      const qty = quality === "Superior" ? 2 : quality === "Normal" ? 1 : 0;
      if (qty > 0) {
        createdMaterials = [
          {
            name:
              genericInfusionPrefix === "Phase-Touched"
                ? getPhaseTouchedCounterpart(resolvedTagMaterials[0].selected.name)
                : genericInfusionOutputName(genericInfusionPrefix, resolvedTagMaterials[0].selected.name),
            qty,
          },
        ];
      }
    }

    const infusedMaterialName = selectedPhaseMaterial || resolvedTagMaterials.find((item) =>
      getInfusionPrefixForMaterialName(item.selected?.name || "")
    )?.selected?.name || "";
    const phaseEffect = infusedMaterialName
      ? getInfusedEffectForCategory(infusedMaterialName, recipe.category) || (usingPhaseTouched ? getPhaseTouchedEffectForCategory(recipe.category) : null)
      : null;

    markMaterialsForSupabaseSave();
    setMaterials((current) => {
      let next = current.map((material) => ({ ...material }));

      const consumeMaterial = (name: string, qty: number) => {
        const index = next.findIndex((m) => normalizeName(m.name) === normalizeName(name));
        if (index >= 0) next[index] = { ...next[index], qty: Math.max(0, next[index].qty - qty) };
      };

      (recipe.materials as RecipeMaterialWithTag[]).forEach((rawRequired) => {
        const required = normalizeRequirement(rawRequired);

        if (required.tagRequirement) {
          const resolved = resolvedTagMaterials.find((item) =>
            item.required.name === required.name && item.required.tagRequirement === required.tagRequirement
          );
          if (resolved?.selected) consumeMaterial(resolved.selected.name, required.qty);
          return;
        }

        const natTwentyPreservedMaterials = naturalRoll === 20
          ? recipe.materials
              .map((m) => {
                const normalized = normalizeRequirement(m as RecipeMaterialWithTag);
                const selected = firstAvailableMaterialForRequirement(normalized, materialMap);
                return { name: selected?.name || normalized.name, tier: selected?.tier ?? getMaterialTier(normalized.name) ?? 0 };
              })
              .sort((a, b) => b.tier - a.tier)
              .slice(0, hasCraftingAttribute(CRAFTING_ATTRIBUTE_IDS.natTwentyFrugal) ? 2 : 1)
              .map((item) => normalizeName(item.name))
          : [];

        const shouldKeepOnNat20 = natTwentyPreservedMaterials.includes(normalizeName(required.name));

        if (!shouldKeepOnNat20) consumeMaterial(required.name, required.qty);
      });

      if (usingPhaseTouched) consumeMaterial(selectedPhaseMaterial, 1);

      if (materialRecipe && createdMaterials.length > 0 && craftResult.itemCreated) {
        next = upsertMaterialList(
          next,
          createdMaterials.map((material) => ({
            id: crypto.randomUUID(),
            name: material.name,
            qty: material.qty,
            tier: getMaterialTier(material.name),
          }))
        );
      }

      return next;
    });

    if (!materialRecipe && craftResult.itemCreated && quality !== "Failed") {
      const craftedItem: CraftedItem = {
        id: crypto.randomUUID(),
        name: infusedMaterialName
          ? `${getInfusionPrefixForMaterialName(infusedMaterialName) === "phase" ? "Phase-Touched" : "Storm-Touched"} ${recipe.name}`
          : recipe.name,
        type: recipe.category,
        rarity: getRarityFromTags(recipe),
        tags: infusedMaterialName
          ? [
              ...new Set([
                ...recipe.tags,
                getInfusionPrefixForMaterialName(infusedMaterialName) === "phase" ? "phase-touched" : "storm-touched",
                getInfusionPrefixForMaterialName(infusedMaterialName) === "phase" ? "phase" : "storm",
              ]),
            ]
          : recipe.tags,
        quality,
        crafter: selectedCharacter.name,
        rollTotal: total,
        naturalRoll,
        effect: outcome?.effect,
        statBlock: outcome?.statBlock,
        phaseTouched: Boolean(infusedMaterialName),
        phaseTouchedMaterial: infusedMaterialName || undefined,
        phaseTouchedEffect: phaseEffect
          ? { name: phaseEffect.name, description: phaseEffect.description, effect: phaseEffect.effect }
          : undefined,
      };

      setCraftedItems((current) => [craftedItem, ...current]);

      if (activeInventoryId) {
        try {
          const savedItem = await insertCraftedItem({
            campaignId: activeInventoryId,
            characterId: null,
            recipeId: recipe.id,
            name: craftedItem.name,
            rarity: craftedItem.rarity,
            category: craftedItem.type,
            quality: craftedItem.quality,
            description: recipe.description,
            effect: craftedItem.effect || [],
            statBlock: craftedItem.statBlock,
            phaseEffect: craftedItem.phaseTouchedEffect || null,
          });

          setCraftedItems((current) =>
            current.map((item) =>
              item.id === craftedItem.id ? { ...item, id: savedItem.id } : item
            )
          );
        } catch (error) {
          console.warn("Failed to save crafted item to Supabase.", error);
          setImportLog("Warning: crafted item saved locally, but Supabase crafted item sync failed. Check the browser console for the Supabase error details.");
        }
      }
    }

    const brokeToolOnNatOne = !npcCraft && naturalRoll === 1;

    markCharactersForSupabaseSave();
    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== selectedCharacter.id) return character;
        const currentProgress = character.toolProgress?.[recipe.tool] ?? emptyToolProgress();
        const startingPpFromAffinity = hasToolAffinity ? Math.max(currentProgress.pp, 10) : currentProgress.pp;
        const nextPp = Math.max(0, startingPpFromAffinity + craftResult.ppGain);
        return {
          ...character,
          tools: {
            ...character.tools,
            [recipe.tool]: nextPp >= 10 ? "proficient" : character.tools[recipe.tool] ?? "none",
          },
          progressPoints: {
            ...character.progressPoints,
            [recipe.category]: (character.progressPoints[recipe.category] || 0) + craftResult.ppGain,
          },
          brokenTools: brokeToolOnNatOne
            ? { ...character.brokenTools, [recipe.tool]: true }
            : character.brokenTools,
          toolProgress: {
            ...character.toolProgress,
            [recipe.tool]: {
              ...currentProgress,
              pp: nextPp,
              proficient: nextPp >= 10 || currentProgress.proficient,
              craftsTodayByCategory: {
                ...currentProgress.craftsTodayByCategory,
                [recipe.category]: craftsToday + 1,
              },
            },
          },
        };
      })
    );

    setLastRoll({
      recipeName: recipe.name,
      naturalRoll,
      secondRoll,
      total,
      quality,
      ppGained: craftResult.ppGain,
      title: craftResult.title,
      result: craftResult as CraftResultSummary,
      phaseTouchedEffect: phaseEffect?.name,
      message: `${craftResult.message}${brokeToolOnNatOne ? ` Natural 1: ${recipe.tool}'s Tools broke.` : ""}${dailyAdvantage ? " Daily category limit reached: advantage applied." : ""}${baseAttributeDcReduction ? ` Attribute DC reduction applied: -${baseAttributeDcReduction}.` : ""}${hasToolAffinity ? ` Tool Affinity applied: ${recipe.tool} treated as proficient with at least 10 PP.` : ""}${hasStormReaderAdvantage ? " Storm Reader applied: advantage on this crafting roll." : ""}${materialRecipe && createdMaterials.length > 0 ? ` Added material output to inventory: ${createdMaterials.map((m) => `${m.qty}× ${m.name}`).join(", ")}.` : ""}`,
    });
  }

  return (
    <div
      className="min-h-screen text-[#f3dfb5] p-6 md:p-8"
      style={{
        backgroundColor: "#1f1e1a",
        backgroundImage:
          "radial-gradient(circle at top left, rgba(210,173,95,0.20), transparent 32%), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "auto, 42px 42px, 42px 42px",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-7">
        <header className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-serif font-bold tracking-tight"
            style={{ color: "#fff0c7", textShadow: "0 2px 0 #5c3b1d" }}
          >
            The Artisan’s Codex
          </motion.h1>
          <p className="max-w-4xl text-lg md:text-xl leading-relaxed text-[#e7c75e] font-serif">
            Forge your legend through crafting, looting, and discovery. Explore recipes, track materials, uncover treasures, plan powerful upgrades, and reveal everything your character can create.
          </p>
        </header>

        <nav className="flex flex-wrap gap-3">
          {tabs.map(([id, label, Icon]) => (
            <Button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`font-serif text-base rounded-xl border ${
                activeTab === id
                  ? "bg-[#171717] text-[#fff0c7] border-[#d2ad5f] shadow-[0_0_0_2px_rgba(210,173,95,0.25)]"
                  : "bg-[#ead6ad] text-[#251b10] border-[#b99b62] hover:bg-[#f4e3bd]"
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </Button>
          ))}
        </nav>

        {(activeTab === "available" || activeTab === "recipes") && (
          <RecipeFilters
            allTags={allTags}
            search={recipeSearch}
            setSearch={setRecipeSearch}
            selectedTagFilters={selectedTagFilters}
            setSelectedTagFilters={setSelectedTagFilters}
            tagSearch={tagSearch}
            setTagSearch={setTagSearch}
            rarityFilter={rarityFilter}
            setRarityFilter={setRarityFilter}
            recipeSort={recipeSort}
            setRecipeSort={setRecipeSort}
            recipeDiscoveryFilter={recipeDiscoveryFilter}
            setRecipeDiscoveryFilter={setRecipeDiscoveryFilter}
            adminUnlocked={adminUnlocked}
          />
        )}

        {activeTab === "craft" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-7">
            <CraftPanel
              characters={characters}
              recipes={recipes}
              materialMap={materialMap}
              selectedCharacterId={selectedCharacterId}
              setSelectedCharacterId={setSelectedCharacterId}
              selectedRecipeId={selectedRecipeId}
              setSelectedRecipeId={setSelectedRecipeId}
              rollMode={rollMode}
              setRollMode={setRollMode}
              assistantBonus={assistantBonus}
              setAssistantBonus={setAssistantBonus}
              npcCraft={npcCraft}
              setNpcCraft={setNpcCraft}
              lastRoll={lastRoll}
              craftSelectedRecipe={craftSelectedRecipe}
              materials={materials}
              phaseTouchedMaterial={phaseTouchedMaterial}
              setPhaseTouchedMaterial={setPhaseTouchedMaterial}
              characterAttributeAssignments={characterAttributeAssignments}
            />
            <CraftedItemList items={craftedItems} setItems={setCraftedItems} />
          </div>
        )}

        {activeTab === "available" && (
          <RecipeGrid
            title="Currently Available to Craft"
            recipes={visibleAvailableRecipes}
            materialMap={materialMap}
            onCraft={(recipe) => { setSelectedRecipeId(recipe.id); setActiveTab("craft"); }}
            phaseToggle={{
              enabled: showPhaseCraftableOnly,
              setEnabled: setShowPhaseCraftableOnly,
              count: phaseCraftableRecipes.length,
            }}
            page={availableRecipePage}
            setPage={setAvailableRecipePage}
            adminUnlocked={adminUnlocked}
            markRecipeDiscovered={markRecipeDiscovered}
          />
        )}

        {activeTab === "recipes" && (
          <RecipeGrid
            title="All Recipes"
            recipes={adminUnlocked ? filteredRecipeStatus : [...availableRecipes, ...unavailableRecipes]}
            materialMap={materialMap}
            onCraft={(recipe) => { setSelectedRecipeId(recipe.id); setActiveTab("craft"); }}
            showMissing
            page={allRecipePage}
            setPage={setAllRecipePage}
            adminUnlocked={adminUnlocked}
            markRecipeDiscovered={markRecipeDiscovered}
          />
        )}

        {activeTab === "materials" && (
          <MaterialsPanel
            materials={materials}
            adminUnlocked={adminUnlocked}
            discoveredMaterialNames={discoveredMaterialNames}
            markMaterialDiscovered={markMaterialDiscovered}
          />
        )}

        {activeTab === "characters" && (
          <CharactersPanel
            characters={characters}
            newCharacter={newCharacter}
            setNewCharacter={setNewCharacter}
            addCharacter={addCharacter}
            removeCharacter={removeCharacter}
            adminUnlocked={adminUnlocked}
            applyTrainingToCharacter={applyTrainingToCharacter}
            updateCharacterStat={updateCharacterStat}
            updateCharacterHarvesting={updateCharacterHarvesting}
            updateCharacterActive={updateCharacterActive}
            updateCharacterTool={updateCharacterTool}
            updateCharacterToolOwned={updateCharacterToolOwned}
            updateCharacterToolBroken={updateCharacterToolBroken}
          />
        )}

        {activeTab === "advancement" && (
          <AdvancementPanel
            characters={characters}
            addToolImprovement={addToolImprovement}
            adminUnlocked={adminUnlocked}
            adjustToolPp={adjustToolPp}
          />
        )}

        {activeTab === "attributes" && (
          <AttributeCardsPanel
            campaignId={activeInventoryId}
            characters={characters}
            adminUnlocked={adminUnlocked}
          />
        )}

        {activeTab === "looting" && (
          <LootingPanel
            lootTier={lootTier}
            setLootTier={setLootTier}
            lootTableId={lootTableId}
            setLootTableId={setLootTableId}
            lootQuality={lootQuality}
            setLootQuality={setLootQuality}
            targetLootName={targetLootName}
            setTargetLootName={setTargetLootName}
            targetSpecificLoot={targetSpecificLoot}
            setTargetSpecificLoot={setTargetSpecificLoot}
            lootResults={lootResults}
            sharedLootResults={sharedLootResults}
            adminUnlocked={adminUnlocked}
            creatureLootQueue={creatureLootQueue}
            selectedCreatureQueueId={selectedCreatureQueueId}
            setSelectedCreatureQueueId={setSelectedCreatureQueueId}
            newLootCreatureTier={newLootCreatureTier}
            setNewLootCreatureTier={setNewLootCreatureTier}
            newLootCreatureTableId={newLootCreatureTableId}
            setNewLootCreatureTableId={setNewLootCreatureTableId}
            newLootCreatureQty={newLootCreatureQty}
            setNewLootCreatureQty={setNewLootCreatureQty}
            addCreatureToLootQueue={addCreatureToLootQueue}
            removeCreatureFromLootQueue={removeCreatureFromLootQueue}
            characters={characters}
            lootCharacterId={lootCharacterId}
            setLootCharacterId={setLootCharacterId}
            harvestStarted={harvestStarted}
            harvestAttemptsRemaining={harvestAttemptsRemaining}
            harvestDc={harvestDc}
            harvestLog={harvestLog}
            harvestStep={harvestStep}
            pendingLootRolls={pendingLootRolls}
            doubleNextLoot={doubleNextLoot}
            startHarvesting={startHarvesting}
            newCreature={newCreature}
            lootingAttempt={lootingAttempt}
            rollLootQualityOnly={rollLootQualityOnly}
            addLootToInventory={addLootToInventory}
            characterAttributeAssignments={characterAttributeAssignments}
          />
        )}

        {activeTab === "craftingRules" && <RulesPanel />}

        {activeTab === "lootingRules" && <LootingRulesPanel />}

        {activeTab === "admin" && (
          <GMPanel
            adminUnlocked={adminUnlocked}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            unlockGM={unlockGM}
            lockGM={lockGM}
            gmAuth={gmAuth}
            setGmAuth={setGmAuth}
            newMaterial={newMaterial}
            setNewMaterial={setNewMaterial}
            addMaterial={addMaterial}
            bulkMaterials={bulkMaterials}
            setBulkMaterials={setBulkMaterials}
            importMaterials={importMaterials}
            resetMaterialsToStartingInventory={resetMaterialsToStartingInventory}
            exportMaterialsJson={exportMaterialsJson}
            importLog={importLog}
            inventoryProfiles={inventoryProfiles}
            activeInventoryId={activeInventoryId}
            switchInventoryProfile={switchInventoryProfile}
            newInventoryName={newInventoryName}
            setNewInventoryName={setNewInventoryName}
            createInventoryProfile={createInventoryProfile}
            renameInventoryProfile={renameInventoryProfile}
            deleteInventoryProfile={deleteInventoryProfile}
            allTags={managedTags}
            disabledTags={disabledTags}
            toggleDisabledTag={toggleDisabledTag}
            enableAllTags={enableAllTags}
            disableAllTags={disableAllTags}
            passDay={passDay}
          />
        )}
      </div>
    </div>
  );
}

function ParchmentCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`rounded-2xl shadow-2xl border-2 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${PANEL.parchmentLight}, ${PANEL.parchment})`,
        borderColor: "#9a7b45",
        color: PANEL.ink,
      }}
    >
      <CardContent className="p-6 md:p-8">{children}</CardContent>
    </Card>
  );
}

function FantasyInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`bg-[#f2dfb9] border-[#9a7b45] text-[#251b10] placeholder:text-[#7c6748] font-serif ${props.className || ""}`}
    />
  );
}

function FantasySelect({
  value,
  onValueChange,
  children,
  placeholder,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full min-w-0 bg-[#f2dfb9] border-[#9a7b45] text-[#251b10] font-serif disabled:opacity-60">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function RequiredMaterialsPanel({
  recipe,
  materialMap,
}: {
  recipe: Recipe;
  materialMap: Map<string, number>;
}) {
  const requirements = recipe.materials as RecipeMaterialWithTag[];

  return (
    <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 font-serif">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7b5524]">
        Materials being used
      </p>
      <div className="space-y-2">
        {requirements.length === 0 ? (
          <p className="text-sm">No materials required.</p>
        ) : (
          requirements.map((required, index) => {
            const available = availableQtyForRequirement(required, materialMap);
            const enough = available >= required.qty;
            const label = required.tagRequirement
              ? `${required.name} (${required.tagRequirement})`
              : required.name;

            return (
              <div
                key={`${required.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: enough ? "#9a7b45" : "#a40000",
                  background: enough ? "#f7e7c5" : "#f7d6d2",
                }}
              >
                <span>{label}</span>
                <strong className={enough ? "text-[#251b10]" : "text-[#a40000]"}>
                  {available}/{required.qty}
                </strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


function CharacterAttributeEffectList({
  characterId,
  assignments,
  attributeIds,
  title,
}: {
  characterId: string;
  assignments: CharacterAttributeAssignmentRow[];
  attributeIds: number[];
  title: string;
}) {
  const assignedIds = new Set(
    assignments
      .filter((assignment) => assignment.character_id === characterId)
      .map((assignment) => Number(assignment.card_id))
  );

  const activeAttributes = attributeIds
    .filter((cardId) => assignedIds.has(Number(cardId)))
    .map((cardId) => CRAFTING_ATTRIBUTE_EFFECT_META[cardId])
    .filter((attribute): attribute is AttributeEffectMeta => Boolean(attribute));

  if (activeAttributes.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-3 text-[#251b10]">
      <p className="mb-2 font-bold">{title}</p>
      <div className="space-y-2">
        {activeAttributes.map((attribute) => (
          <div key={attribute.id} className="rounded-lg border border-[#b99b62] bg-[#f2dfb9] p-2">
            <p className="font-bold">{attribute.name}</p>
            <p className="text-sm">{attribute.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


function CraftPanel(props: {
  characters: Character[];
  recipes: Recipe[];
  materialMap: Map<string, number>;
  selectedCharacterId: string;
  setSelectedCharacterId: (id: string) => void;
  selectedRecipeId: string;
  setSelectedRecipeId: (id: string) => void;
  rollMode: "normal" | "advantage";
  setRollMode: (value: "normal" | "advantage") => void;
  assistantBonus: "none" | "plus2";
  setAssistantBonus: (value: "none" | "plus2") => void;
  npcCraft: boolean;
  setNpcCraft: (value: boolean) => void;
  lastRoll: {
    recipeName: string;
    naturalRoll: number;
    secondRoll?: number;
    total: number;
    quality: CraftQualityOrFailed;
    ppGained: number;
    message: string;
    title?: string;
    phaseTouchedEffect?: string;
    result?: CraftResultSummary;
  } | null;
  craftSelectedRecipe: () => void;
  materials: Material[];
  phaseTouchedMaterial: string;
  setPhaseTouchedMaterial: (value: string) => void;
  characterAttributeAssignments: CharacterAttributeAssignmentRow[];
}) {
  const selectedRecipe =
    props.recipes.find((recipe) => recipe.id === props.selectedRecipeId) || props.recipes[0];

  const selectedCharacter =
    props.characters.find((character) => character.id === props.selectedCharacterId) ||
    props.characters[0];

  if (!selectedRecipe || !selectedCharacter) {
    return <ParchmentCard>No recipes or characters loaded.</ParchmentCard>;
  }

  const hasRequiredTool = Boolean(selectedCharacter.ownedTools?.[selectedRecipe.tool]);
  const requiredToolBroken = Boolean(selectedCharacter.brokenTools?.[selectedRecipe.tool]);
  const materialsAvailable = canRecipe(selectedRecipe, props.materialMap);
  const available = materialsAvailable && hasRequiredTool && !requiredToolBroken;
  const missing = missingMaterials(selectedRecipe, props.materialMap);
  const rarityColor = getRarityColor(selectedRecipe);
  const rarity = getRarityFromTags(selectedRecipe);
  const canUsePhaseTouched = canApplyPhaseTouchedEffect(selectedRecipe) && !recipeAlreadyPhaseTouched(selectedRecipe);
  const phaseTouchedMaterials = canUsePhaseTouched
    ? getCompatiblePhaseTouchedMaterials(selectedRecipe, props.materials, props.materialMap)
    : [];
  const selectedPhaseMaterialIsCompatible =
    props.phaseTouchedMaterial === "none" ||
    isCompatiblePhaseTouchedMaterial(
      selectedRecipe,
      props.phaseTouchedMaterial,
      props.materials,
      props.materialMap
    );
  const selectedToolProgress = selectedCharacter.toolProgress?.[selectedRecipe.tool] ?? emptyToolProgress();
  const craftsToday = selectedToolProgress.craftsTodayByCategory?.[selectedRecipe.category] ?? 0;

  useEffect(() => {
    if (props.phaseTouchedMaterial !== "none" && !selectedPhaseMaterialIsCompatible) {
      props.setPhaseTouchedMaterial("none");
    }
  }, [props.phaseTouchedMaterial, selectedPhaseMaterialIsCompatible, props.setPhaseTouchedMaterial]);

  return (
    <ParchmentCard>
      <div className="space-y-6 font-serif">
        <div className="flex items-center gap-3">
          <Dice5 className="w-8 h-8" />
          <h2 className="text-3xl font-bold">Craft Item</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FantasySelect value={props.selectedCharacterId} onValueChange={props.setSelectedCharacterId}>
            {props.characters.map((character) => (
              <SelectItem key={character.id} value={character.id}>
                {character.name}
              </SelectItem>
            ))}
          </FantasySelect>

          <RequiredMaterialsPanel recipe={selectedRecipe} materialMap={props.materialMap} />

          <FantasySelect value={props.rollMode} onValueChange={(v) => props.setRollMode(v as "normal" | "advantage")}>
            <SelectItem value="normal">Normal Roll</SelectItem>
            <SelectItem value="advantage">Advantage</SelectItem>
          </FantasySelect>

          <FantasySelect value={props.assistantBonus} onValueChange={(v) => props.setAssistantBonus(v as "none" | "plus2")}>
            <SelectItem value="none">No +2 Assistant Bonus</SelectItem>
            <SelectItem value="plus2">Assistant +2 Bonus</SelectItem>
          </FantasySelect>
        </div>

        <CharacterAttributeEffectList
          characterId={selectedCharacter.id}
          assignments={props.characterAttributeAssignments}
          attributeIds={CRAFTING_ATTRIBUTE_EFFECT_IDS}
          title="Active crafting attributes for this character"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <label className="flex items-center gap-3 text-sm rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3">
            <input
              type="checkbox"
              checked={props.npcCraft}
              onChange={(event) => props.setNpcCraft(event.target.checked)}
            />
            NPC craft as Normal version, no roll
          </label>

          <div className="space-y-1">
            <FantasySelect
              value={props.phaseTouchedMaterial}
              onValueChange={props.setPhaseTouchedMaterial}
            >
              <SelectItem value="none">No Phase-Touched material</SelectItem>
              {canUsePhaseTouched && phaseTouchedMaterials.map((material) => (
                <SelectItem key={material.id} value={material.name}>
                  {material.name} ({material.qty})
                </SelectItem>
              ))}
            </FantasySelect>
            <p className="text-xs">
              {canUsePhaseTouched
                ? phaseTouchedMaterials.length > 0
                  ? "Optional: consume a matching Phase-Touched version of one required material to add the Phase-Touched effect."
                  : "No matching Phase-Touched version of this recipe’s required materials is available."
                : "This recipe is already Phase-Touched or cannot receive a Phase-Touched effect."}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border-4 p-5 space-y-3"
          style={{ borderColor: rarityColor, background: "rgba(255,255,255,0.28)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-3xl font-bold" style={{ color: rarityColor }}>
              {selectedRecipe.name}
            </h3>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: rarityColor, color: rarity === "common" ? "#111" : "white" }}
            >
              {RARITY_LABELS[rarity]}
            </span>
          </div>

          <p className="text-xl">
            <strong>DC {selectedRecipe.dc}</strong> • {selectedRecipe.time} • d20 +{" "}
            <strong>{selectedRecipe.stat}</strong> + <strong>{selectedRecipe.tool}</strong>
          </p>

          <p>
            <strong>Materials:</strong> {materialText(selectedRecipe.materials)}
          </p>

          <p className="text-sm">
            <strong>{selectedRecipe.tool} PP:</strong> {selectedToolProgress.pp} • Crafts today in {selectedRecipe.category}: {craftsToday}/5
            {craftsToday >= 5 ? " • Daily limit reached: advantage applies, no PP gained" : ""}
          </p>

          {selectedToolProgress.specializations?.length > 0 && (
            <p className="text-sm">
              <strong>Active {selectedRecipe.tool} improvements:</strong>{" "}
              {selectedToolProgress.specializations.join(", ")}
            </p>
          )}

          {!hasRequiredTool && (
            <p className="text-red-800 font-bold">Missing Tool: {selectedRecipe.tool}'s Tools</p>
          )}

          {hasRequiredTool && requiredToolBroken && (
            <p className="text-red-800 font-bold">Broken Tool: {selectedRecipe.tool}'s Tools</p>
          )}

          {!materialsAvailable && missing.length > 0 && (
            <p className="text-red-800 font-bold">
              Missing: {missing.map((m) => `${m.needed - m.available}× ${m.name}`).join(", ")}
            </p>
          )}

          <p className="leading-relaxed">{selectedRecipe.description}</p>

          <NormalOutcomePreview recipe={selectedRecipe} />

          <div className="flex flex-wrap gap-2">
            {selectedRecipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-2 py-1 text-xs"
                style={{ borderColor: rarityColor }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <Button
          onClick={() => props.craftSelectedRecipe()}
          disabled={!available}
          className="w-full py-7 text-xl font-serif bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] border border-[#9a7b45]"
        >
          <Dice5 className="w-5 h-5 mr-3" />
          Roll d20 and Craft
        </Button>

        {!available && (
          <p className="text-lg">
            {!hasRequiredTool
              ? `Missing required tool: ${selectedRecipe.tool}'s Tools.`
              : requiredToolBroken
                ? `Required tool is broken: ${selectedRecipe.tool}'s Tools.`
                : "Not enough materials to craft this item."}
          </p>
        )}

        {props.lastRoll && (
          <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
            <h3 className="text-xl font-bold">
              {props.lastRoll.title || "Crafting Result"}: {props.lastRoll.recipeName} — {props.lastRoll.quality}
            </h3>
            <p>
              Natural roll: {props.lastRoll.naturalRoll}
              {props.lastRoll.secondRoll ? ` / ${props.lastRoll.secondRoll}` : ""} • Total:{" "}
              {props.lastRoll.total} • PP: {props.lastRoll.ppGained >= 0 ? "+" : ""}
              {props.lastRoll.ppGained}
            </p>
            <p>{props.lastRoll.message}</p>
            {props.lastRoll.phaseTouchedEffect && (
              <p className="mt-2 font-bold">Phase-Touched Effect: {props.lastRoll.phaseTouchedEffect}</p>
            )}
          </div>
        )}
      </div>
    </ParchmentCard>
  );
}

function CraftedItemList({
  items,
  setItems,
}: {
  items: CraftedItem[];
  setItems: React.Dispatch<React.SetStateAction<CraftedItem[]>>;
}) {
  return (
    <ParchmentCard>
      <div className="space-y-4 font-serif">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8" />
          <h2 className="text-3xl font-bold">Crafted Item List</h2>
        </div>

        {items.length === 0 && <p className="text-lg">No crafted items yet.</p>}

        <div className="space-y-3">
          {items.map((item) => {
            const color = rarityColors[item.rarity] || rarityColors.common;
            return (
              <div
                key={item.id}
                className="rounded-xl border-2 p-4 flex justify-between gap-3"
                style={{ borderColor: color, background: "rgba(255,255,255,0.25)" }}
              >
                <div>
                  <h3 className="text-xl font-bold" style={{ color }}>
                    {item.name} ({item.type}) — {item.quality}
                  </h3>
                  <p className="text-sm">
                    Crafter: {item.crafter} • Roll: {item.rollTotal} • Natural: {item.naturalRoll}
                  </p>
                  {item.statBlock && <p className="font-bold mt-2">Stat Block: {item.statBlock}</p>}
                  {item.effect && item.effect.length > 0 && (
                    <ul className="list-disc ml-5 mt-2">
                      {item.effect.map((effect) => (
                        <li key={effect}>{effect}</li>
                      ))}
                    </ul>
                  )}
                  {item.phaseTouchedEffect && (
                    <div className="mt-3 rounded-lg border border-[#9a7b45] bg-[#e0c392] p-3">
                      <p className="font-bold">{item.phaseTouchedEffect.name}</p>
                      {item.phaseTouchedEffect.description && <p className="text-sm">{item.phaseTouchedEffect.description}</p>}
                      <ul className="list-disc ml-5 mt-1 text-sm">
                        {item.phaseTouchedEffect.effect.map((effect) => (
                          <li key={effect}>{effect}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    setItems((current) => current.filter((i) => i.id !== item.id));
                    deleteCraftedItem(item.id).catch((error) => {
                      console.warn("Failed to delete crafted item from Supabase.", error);
                    });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </ParchmentCard>
  );
}

function RecipeFilters(props: {
  allTags: string[];
  search: string;
  setSearch: (value: string) => void;
  selectedTagFilters: string[];
  setSelectedTagFilters: (value: string[]) => void;
  tagSearch: string;
  setTagSearch: (value: string) => void;
  rarityFilter: string;
  setRarityFilter: (value: string) => void;
  recipeSort: "alphabetical" | "rarity" | "tag";
  setRecipeSort: (value: "alphabetical" | "rarity" | "tag") => void;
  recipeDiscoveryFilter: "all" | "discovered" | "undiscovered";
  setRecipeDiscoveryFilter: (value: "all" | "discovered" | "undiscovered") => void;
  adminUnlocked: boolean;
}) {
  const searchedTags = props.allTags.filter((tag) =>
    tag.toLowerCase().includes(props.tagSearch.trim().toLowerCase())
  );

  function toggleTag(tag: string) {
    props.setSelectedTagFilters(
      props.selectedTagFilters.includes(tag)
        ? props.selectedTagFilters.filter((item) => item !== tag)
        : [...props.selectedTagFilters, tag]
    );
  }

  return (
    <ParchmentCard>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_190px_190px_210px] gap-3">
          <FantasyInput
            placeholder="Search recipes, tags, rarity, type..."
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
          />

          <FantasySelect value={props.rarityFilter} onValueChange={props.setRarityFilter}>
            <SelectItem value="all">All rarities</SelectItem>
            {RARITY_ORDER.map((rarity) => (
              <SelectItem key={rarity} value={rarity}>
                {RARITY_LABELS[rarity]}
              </SelectItem>
            ))}
          </FantasySelect>

          <FantasySelect value={props.recipeSort} onValueChange={(value) => props.setRecipeSort(value as "alphabetical" | "rarity" | "tag")}>
            <SelectItem value="alphabetical">Sort: A–Z</SelectItem>
            <SelectItem value="rarity">Sort: Rarity</SelectItem>
            <SelectItem value="tag">Sort: Tag</SelectItem>
          </FantasySelect>

          {props.adminUnlocked ? (
            <FantasySelect
              value={props.recipeDiscoveryFilter}
              onValueChange={(value) => props.setRecipeDiscoveryFilter(value as "all" | "discovered" | "undiscovered")}
            >
              <SelectItem value="all">All discovery states</SelectItem>
              <SelectItem value="discovered">Discovered only</SelectItem>
              <SelectItem value="undiscovered">Undiscovered / hidden only</SelectItem>
            </FantasySelect>
          ) : (
            <div />
          )}
        </div>

        <details className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3">
          <summary className="cursor-pointer font-bold">
            Tags {props.selectedTagFilters.length > 0 ? `(${props.selectedTagFilters.length} selected)` : ""}
          </summary>

          <div className="mt-3 space-y-3">
            <FantasyInput
              placeholder="Search tags..."
              value={props.tagSearch}
              onChange={(event) => props.setTagSearch(event.target.value)}
            />

            {props.selectedTagFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {props.selectedTagFilters.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="rounded-full border border-[#9a7b45] bg-[#fff0c7] px-3 py-1 text-xs font-bold"
                  >
                    {tag} ×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => props.setSelectedTagFilters([])}
                  className="rounded-full border border-red-700 bg-red-100 px-3 py-1 text-xs font-bold text-red-800"
                >
                  Clear tags
                </button>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto rounded-lg border border-[#9a7b45] bg-[#ead6ad] p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {searchedTags.map((tag) => (
                <label key={tag} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#fff0c7]">
                  <input
                    type="checkbox"
                    checked={props.selectedTagFilters.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))}

              {searchedTags.length === 0 && (
                <p className="text-sm col-span-full">No tags match that search.</p>
              )}
            </div>
          </div>
        </details>
      </div>
    </ParchmentCard>
  );
}

function RecipeGrid({
  title,
  recipes,
  materialMap,
  onCraft,
  showMissing = false,
  phaseToggle,
  page = 1,
  setPage,
  adminUnlocked = false,
  markRecipeDiscovered,
}: {
  title: string;
  recipes: (Recipe & { available?: boolean; discovered?: boolean; hiddenByDisabledTag?: boolean; missing?: { name: string; needed: number; available: number }[] })[];
  materialMap: Map<string, number>;
  onCraft: (recipe: Recipe) => void;
  showMissing?: boolean;
  phaseToggle?: {
    enabled: boolean;
    setEnabled: (value: boolean) => void;
    count: number;
  };
  page?: number;
  setPage?: (page: number) => void;
  adminUnlocked?: boolean;
  markRecipeDiscovered?: (recipeId: string, discovered: boolean) => void;
}) {
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(recipes.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRecipes = recipes.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <ParchmentCard>
      <div className="space-y-5 font-serif">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            <div>
              <h2 className="text-3xl font-bold">{title}</h2>
              <p className="text-sm">{recipes.length} recipes • Page {safePage} of {totalPages}</p>
            </div>
          </div>

          {phaseToggle && (
            <button
              type="button"
              onClick={() => phaseToggle.setEnabled(!phaseToggle.enabled)}
              className="w-fit rounded-full border px-4 py-2 text-sm font-bold transition"
              style={{
                borderColor: phaseToggle.enabled ? "#30c7d9" : "#9a7b45",
                background: phaseToggle.enabled ? "#d7fbff" : "#f2dfb9",
                color: PANEL.ink,
              }}
            >
              {phaseToggle.enabled ? "Showing Phase-Touched Crafting" : "Show Phase-Touched Crafting"}
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                {phaseToggle.count}
              </span>
            </button>
          )}
        </div>

        {phaseToggle?.enabled && recipes.length === 0 && (
          <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-sm">
            No currently available recipes have a matching Phase-Touched version of a required material.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {pageRecipes.map((recipe) => {
            const available = recipe.available ?? canRecipe(recipe, materialMap);
            const color = getRarityColor(recipe);
            const rarity = getRarityFromTags(recipe);
            const missing = recipe.missing ?? missingMaterials(recipe, materialMap);
            const hiddenToPlayers = recipe.discovered === false || recipe.hiddenByDisabledTag === true;

            return (
              <div
                key={recipe.id}
                className="rounded-2xl overflow-hidden border-4 shadow-xl"
                style={{
                  borderColor: hiddenToPlayers ? "#c97716" : color,
                  background: hiddenToPlayers ? "#f5c16c" : PANEL.parchment,
                  color: PANEL.ink,
                }}
              >
                <div className="px-4 pt-3 pb-2 border-b-4" style={{ borderColor: color, background: PANEL.parchmentLight }}>
                  <h3 className="text-2xl font-bold leading-tight">{recipe.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <div
                      className="w-fit rounded-full border px-3 py-0.5 text-[11px] font-bold"
                      style={{ borderColor: hiddenToPlayers ? "#c97716" : color, background: "#f8e8c2" }}
                    >
                      {RARITY_LABELS[rarity]} {recipe.category}
                    </div>
                    {hiddenToPlayers && (
                      <div className="w-fit rounded-full border border-[#c97716] bg-[#ffe0a3] px-3 py-0.5 text-[11px] font-bold text-[#7a3f00]">
                        Hidden from players
                      </div>
                    )}
                    {adminUnlocked && markRecipeDiscovered && (
                      <label className="flex items-center gap-1 rounded-full border border-[#9a7b45] bg-[#fff3cc] px-3 py-0.5 text-[11px] font-bold">
                        <input
                          type="checkbox"
                          checked={recipe.discovered !== false}
                          onChange={(event) => markRecipeDiscovered(recipe.id, event.target.checked)}
                        />
                        Discovered
                      </label>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2 min-h-[360px]" style={{ background: hiddenToPlayers ? "#f8d08a" : undefined }}>
                  <p className="text-sm font-bold">
                    DC {recipe.dc} • {recipe.time} • {recipe.tool} ({recipe.stat})
                  </p>
                  <p className="text-sm leading-relaxed line-clamp-4">{recipe.description}</p>
                  <p className="text-xs">
                    <strong>Materials:</strong> {materialText(recipe.materials)}
                  </p>

                  <NormalOutcomePreview recipe={recipe} compact />

                  {showMissing && !available && missing.length > 0 && (
                    <p className="text-xs text-red-800 font-bold">
                      Missing: {missing.map((m) => `${m.needed - m.available}× ${m.name}`).join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border px-2 py-0.5 text-[10px]"
                        style={{ borderColor: color, background: "rgba(255,255,255,0.35)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-t-4" style={{ borderColor: color, background: PANEL.parchmentLight }}>
                  <Button
                    disabled={!available}
                    onClick={() => onCraft(recipe)}
                    className="w-full bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
                  >
                    {available ? "Craft This" : "Unavailable"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button
              disabled={safePage <= 1}
              onClick={() => setPage?.(1)}
              className="min-w-10 bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-40"
            >
              «
            </Button>
            <Button
              disabled={safePage <= 1}
              onClick={() => setPage?.(safePage - 1)}
              className="min-w-10 bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-40"
            >
              ‹
            </Button>

            {Array.from({ length: totalPages })
              .map((_, index) => index + 1)
              .filter((pageNumber) =>
                pageNumber === 1 ||
                pageNumber === totalPages ||
                Math.abs(pageNumber - safePage) <= 2
              )
              .map((pageNumber, index, visiblePages) => {
                const previousPage = visiblePages[index - 1];
                const showGap = previousPage && pageNumber - previousPage > 1;

                return (
                  <React.Fragment key={pageNumber}>
                    {showGap && <span className="px-2 font-bold">…</span>}
                    <Button
                      onClick={() => setPage?.(pageNumber)}
                      className={`min-w-10 ${
                        pageNumber === safePage
                          ? "bg-[#171717] text-[#fff0c7] border border-[#d2ad5f]"
                          : "bg-[#ead6ad] text-[#251b10] border border-[#b99b62] hover:bg-[#f4e3bd]"
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  </React.Fragment>
                );
              })}

            <Button
              disabled={safePage >= totalPages}
              onClick={() => setPage?.(safePage + 1)}
              className="min-w-10 bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-40"
            >
              ›
            </Button>
            <Button
              disabled={safePage >= totalPages}
              onClick={() => setPage?.(totalPages)}
              className="min-w-10 bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-40"
            >
              »
            </Button>
          </div>
        )}
      </div>
    </ParchmentCard>
  );
}

function MaterialsPanel({
  materials,
  adminUnlocked,
  discoveredMaterialNames,
  markMaterialDiscovered,
}: {
  materials: Material[];
  adminUnlocked: boolean;
  discoveredMaterialNames: Set<string>;
  markMaterialDiscovered: (name: string, discovered: boolean) => void;
}) {
  const grouped = RARITY_ORDER; // just prevents unused false positives in some editors
  void grouped;

  const materialMap = new Map(
    materials.map((material) => [normalizeMaterialName(material.name), material])
  );

  const byTier = materialTiers.map((tier) => {
    const tierMaterials = adminUnlocked
      ? tier.names.map((name) => {
          const existing = materialMap.get(normalizeMaterialName(name));
          return (
            existing || {
              id: `tier-${tier.tier}-${name}`,
              name,
              qty: 0,
              tier: tier.tier,
            }
          );
        })
      : materials.filter((m) => m.tier === tier.tier && m.qty > 0);

    return {
      ...tier,
      materials: tierMaterials,
    };
  });

  const knownTierNames = new Set(
    materialTiers.flatMap((tier) => tier.names.map((name) => normalizeMaterialName(name)))
  );

  const unknown = materials.filter(
    (material) =>
      !knownTierNames.has(normalizeMaterialName(material.name)) &&
      (adminUnlocked || material.qty > 0)
  );

  return (
    <div className="space-y-6">
      <ParchmentCard>
        <div className="space-y-2 font-serif">
          <div className="flex items-center gap-3">
            <Boxes className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Material Inventory</h2>
          </div>
          {adminUnlocked && (
            <p className="text-sm">
              GM view shows every known material, including materials currently at 0.
            </p>
          )}
        </div>
      </ParchmentCard>

      {byTier.map((tier) => (
        <ParchmentCard key={tier.tier}>
          <div className="space-y-4 font-serif">
            <h3 className="text-2xl font-bold">{tier.label}</h3>
            {tier.materials.length === 0 ? (
              <p>No materials in this tier.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {tier.materials.map((material) => (
                  <div
                    key={`${tier.tier}-${material.name}-${material.id}`}
                    className="rounded-xl border px-3 py-2 flex justify-between"
                    style={{
                      borderColor: material.qty > 0 ? "#9a7b45" : "#c8ad77",
                      background: material.qty > 0 ? "#f2dfb9" : "#ead6ad",
                      opacity: material.qty > 0 ? 1 : 0.65,
                    }}
                  >
                    <span>{material.name}</span>
                    <div className="flex items-center gap-3">
                      {adminUnlocked && (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={discoveredMaterialNames.has(normalizeName(material.name))}
                            onChange={(event) => markMaterialDiscovered(material.name, event.target.checked)}
                          />
                          Discovered
                        </label>
                      )}
                      <strong>{material.qty}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ParchmentCard>
      ))}

      {unknown.length > 0 && (
        <ParchmentCard>
          <div className="space-y-4 font-serif">
            <h3 className="text-2xl font-bold">Unmatched / Custom Materials</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {unknown.map((material) => (
                <div
                  key={material.id}
                  className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] px-3 py-2 flex justify-between"
                >
                  <span>{material.name}</span>
                  <strong>{material.qty}</strong>
                </div>
              ))}
            </div>
          </div>
        </ParchmentCard>
      )}
    </div>
  );
}

function CharactersPanel({
  characters,
  newCharacter,
  setNewCharacter,
  addCharacter,
  removeCharacter,
  adminUnlocked,
  applyTrainingToCharacter,
  updateCharacterStat,
  updateCharacterHarvesting,
  updateCharacterActive,
  updateCharacterTool,
  updateCharacterToolOwned,
  updateCharacterToolBroken,
}: {
  characters: Character[];
  newCharacter: Character;
  setNewCharacter: React.Dispatch<React.SetStateAction<Character>>;
  addCharacter: () => void;
  removeCharacter: (id: string) => void;
  adminUnlocked: boolean;
  applyTrainingToCharacter: (characterId: string, tool: string, trainingType: "regular" | "expert") => void;
  updateCharacterStat: (characterId: string, stat: Stat, value: number) => void;
  updateCharacterHarvesting: (characterId: string, value: number) => void;
  updateCharacterActive: (characterId: string, isActive: boolean) => void;
  updateCharacterTool: (characterId: string, tool: string, level: ProficiencyLevel) => void;
  updateCharacterToolOwned: (characterId: string, tool: string, owned: boolean) => void;
  updateCharacterToolBroken: (characterId: string, tool: string, broken: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
      <ParchmentCard>
        <div className="space-y-5 font-serif">
          <div className="flex items-center gap-3">
            <UserRound className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Add Character</h2>
          </div>

          <FantasyInput
            placeholder="Character name"
            value={newCharacter.name}
            onChange={(event) =>
              setNewCharacter((current) => ({ ...current, name: event.target.value }))
            }
          />

          <label className="space-y-1 block">
            <strong>Harvesting</strong>
            <FantasyInput
              type="number"
              value={newCharacter.harvesting}
              onChange={(event) =>
                setNewCharacter((current) => ({ ...current, harvesting: numberValue(event.target.value) }))
              }
            />
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {STATS.map((stat) => (
              <label key={stat} className="space-y-1">
                <strong>{stat}</strong>
                <FantasyInput
                  type="number"
                  value={newCharacter.stats[stat]}
                  onChange={(event) =>
                    setNewCharacter((current) => ({
                      ...current,
                      stats: { ...current.stats, [stat]: numberValue(event.target.value) },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-[#9a7b45] bg-[#e0c392] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOOL_OPTIONS.map((tool) => (
              <div key={tool} className="grid grid-cols-[140px_1fr] items-center gap-3">
                <strong>{tool}:</strong>
                <FantasySelect
                  value={newCharacter.tools[tool] || "none"}
                  onValueChange={(value) =>
                    setNewCharacter((current) => ({
                      ...current,
                      tools: { ...current.tools, [tool]: value as ProficiencyLevel },
                    }))
                  }
                >
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="proficient">Proficient</SelectItem>
                  <SelectItem value="expertise">Expertise</SelectItem>
                </FantasySelect>
              </div>
            ))}
          </div>

          <Button
            onClick={addCharacter}
            className="w-full py-6 text-lg bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Character
          </Button>
        </div>
      </ParchmentCard>

      <ParchmentCard>
        <div className="space-y-4 font-serif">
          <div className="flex items-center gap-3">
            <UserRound className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Characters</h2>
          </div>

          {characters.filter((character) => adminUnlocked || character.isActive !== false).map((character) => (
            <div
              key={character.id}
              className="rounded-xl border border-[#9a7b45] p-4 space-y-4"
              style={{ background: character.isActive === false ? "#f5c16c" : "#f2dfb9" }}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">{character.name}</h3>
                  {!adminUnlocked && (
                    <p className="text-sm">GM unlock required to edit character stats, tools, PP, and training.</p>
                  )}
                </div>

                {characters.length > 1 && adminUnlocked && (
                  <Button variant="destructive" size="icon" onClick={() => removeCharacter(character.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {adminUnlocked && (
                <label className="flex items-center gap-2 rounded-xl border border-[#9a7b45] bg-[#ead6ad] px-3 py-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={character.isActive !== false}
                    onChange={(event) => updateCharacterActive(character.id, event.target.checked)}
                  />
                  Active in party
                  {character.isActive === false && <span className="text-[#7a3f00]">(hidden from players)</span>}
                </label>
              )}

              <label className="space-y-1 block">
                <strong>Harvesting</strong>
                <FantasyInput
                  type="number"
                  value={character.harvesting}
                  disabled={!adminUnlocked}
                  onChange={(event) => updateCharacterHarvesting(character.id, numberValue(event.target.value))}
                />
              </label>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STATS.map((stat) => (
                  <label key={stat} className="space-y-1">
                    <strong>{stat}</strong>
                    <FantasyInput
                      type="number"
                      value={character.stats[stat]}
                      disabled={!adminUnlocked}
                      onChange={(event) => updateCharacterStat(character.id, stat, numberValue(event.target.value))}
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {TOOL_OPTIONS.map((tool) => {
                  const progress = character.toolProgress?.[tool] ?? emptyToolProgress();
                  const regularCost = getRegularTrainingCost(progress.regularTrainingUsed);
                  return (
                    <div key={tool} className="rounded-lg border border-[#9a7b45] bg-[#e0c392] p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-[130px_1fr] gap-2 items-center">
                        <strong>{tool}</strong>
                        <FantasySelect
                          value={character.tools[tool] || "none"}
                          onValueChange={(value) => updateCharacterTool(character.id, tool, value as ProficiencyLevel)}
                        >
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="proficient">Proficient</SelectItem>
                          <SelectItem value="expertise">Expertise</SelectItem>
                        </FantasySelect>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(character.ownedTools?.[tool])}
                            disabled={!adminUnlocked}
                            onChange={(event) => updateCharacterToolOwned(character.id, tool, event.target.checked)}
                          />
                          Owns tool
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(character.brokenTools?.[tool])}
                            disabled={!adminUnlocked || !character.ownedTools?.[tool]}
                            onChange={(event) => updateCharacterToolBroken(character.id, tool, event.target.checked)}
                          />
                          Broken
                        </label>
                      </div>
                      <p className="text-sm">
                        PP: <strong>{progress.pp}</strong> • Regular Training: {progress.regularTrainingUsed}/5 • Expert Training: {progress.expertTrainingUsed}/5
                        {progress.pp >= 10 ? " • Proficiency unlocked" : ""}
                        {progress.pp >= 25 ? " • Advancement choice available" : ""}
                      </p>
                      {adminUnlocked && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={progress.regularTrainingUsed >= 5}
                            onClick={() => applyTrainingToCharacter(character.id, tool, "regular")}
                            className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
                          >
                            Regular Training +2 PP{regularCost !== null ? ` (${regularCost} gp)` : ""}
                          </Button>
                          <Button
                            size="sm"
                            disabled={progress.expertTrainingUsed >= 5}
                            onClick={() => applyTrainingToCharacter(character.id, tool, "expert")}
                            className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]"
                          >
                            Expert Training +3 PP (50 gp)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ParchmentCard>
    </div>
  );
}


function AdvancementPanel({
  characters,
  addToolImprovement,
  adminUnlocked,
  adjustToolPp,
}: {
  characters: Character[];
  addToolImprovement: (characterId: string, tool: string, improvement: string) => void;
  adminUnlocked: boolean;
  adjustToolPp: (characterId: string, tool: string, amount: number) => void;
}) {
  return (
    <div className="space-y-6">
      <ParchmentCard>
        <div className="space-y-3 font-serif">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8" />
            <h2 className="text-3xl font-bold">PP Improvements</h2>
          </div>
          <p>
            At <strong>10 PP</strong>, the character gains proficiency. At <strong>25 PP</strong>
            and every additional <strong>25 PP</strong>, choose one specialization or mastery.
            Each tool can only take <strong>one mastery</strong>, but may eventually learn all of its specializations.
          </p>
        </div>
      </ParchmentCard>

      {characters.filter((character) => adminUnlocked || character.isActive !== false).map((character) => (
        <ParchmentCard key={character.id}>
          <div className="space-y-4 font-serif">
            <h3 className="text-2xl font-bold">{character.name}</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {TOOL_OPTIONS.map((tool) => {
                const progress = character.toolProgress?.[tool] ?? emptyToolProgress();
                const selected = progress.specializations || [];
                const slots = improvementSlotsForPp(progress.pp);
                const hasMastery = selected.some(isMasteryImprovement);
                const availableOptions = toolImprovementOptions(tool).filter(
                  (option) => !selected.includes(option) && (!isMasteryImprovement(option) || !hasMastery)
                );
                const canChoose = slots > selected.length && availableOptions.length > 0;

                return (
                  <div
                    key={`${character.id}-${tool}-advancement`}
                    className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xl font-bold">{tool}</h4>
                      <span className="rounded-full border border-[#9a7b45] px-3 py-1 text-sm font-bold">
                        {progress.pp} PP
                      </span>
                    </div>

                    {adminUnlocked && (
                      <div className="flex flex-wrap gap-2">
                        {[-10, -5, -1, 1, 5, 10].map((amount) => (
                          <Button
                            key={`${character.id}-${tool}-pp-${amount}`}
                            type="button"
                            onClick={() => adjustToolPp(character.id, tool, amount)}
                            className={`px-3 py-1 text-xs ${
                              amount > 0
                                ? "bg-green-100 hover:bg-green-200 text-green-800"
                                : "bg-red-100 hover:bg-red-200 text-red-800"
                            }`}
                          >
                            {amount > 0 ? `+${amount}` : amount} PP
                          </Button>
                        ))}
                      </div>
                    )}

                    <p className="text-sm">
                      Proficiency: <strong>{progress.pp >= 10 || progress.proficient ? "Unlocked" : "Locked"}</strong>
                      {" "}• Improvement slots: <strong>{selected.length}/{slots}</strong>
                    </p>

                    {selected.length > 0 ? (
                      <ul className="list-disc ml-5 text-sm">
                        {selected.map((item) => (
                          <li key={`${character.id}-${tool}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm italic">No specializations or masteries selected yet.</p>
                    )}

                    {canChoose ? (
                      <FantasySelect
                        value="select"
                        onValueChange={(value) => addToolImprovement(character.id, tool, value)}
                      >
                        <SelectItem value="select">Choose improvement</SelectItem>
                        {availableOptions.map((option) => (
                          <SelectItem key={`${tool}-${option}`} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </FantasySelect>
                    ) : (
                      <p className="text-xs">
                        {slots === 0
                          ? "Reach 25 PP to choose the first specialization or mastery."
                          : "No improvement slot currently available."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ParchmentCard>
      ))}
    </div>
  );
}


function LootingPanel({
  lootTier,
  setLootTier,
  lootTableId,
  setLootTableId,
  lootQuality,
  setLootQuality,
  targetLootName,
  setTargetLootName,
  targetSpecificLoot,
  setTargetSpecificLoot,
  lootResults,
  sharedLootResults,
  adminUnlocked,
  creatureLootQueue,
  selectedCreatureQueueId,
  setSelectedCreatureQueueId,
  newLootCreatureTier,
  setNewLootCreatureTier,
  newLootCreatureTableId,
  setNewLootCreatureTableId,
  newLootCreatureQty,
  setNewLootCreatureQty,
  addCreatureToLootQueue,
  removeCreatureFromLootQueue,
  characters,
  lootCharacterId,
  setLootCharacterId,
  harvestStarted,
  harvestAttemptsRemaining,
  harvestDc,
  harvestLog,
  harvestStep,
  pendingLootRolls,
  doubleNextLoot,
  startHarvesting,
  newCreature,
  lootingAttempt,
  rollLootQualityOnly,
  addLootToInventory,
  characterAttributeAssignments,
}: {
  lootTier: CreatureTier;
  setLootTier: (tier: CreatureTier) => void;
  lootTableId: string;
  setLootTableId: (id: string) => void;
  lootQuality: LootQuality | "none" | "unrolled";
  setLootQuality: (quality: LootQuality | "none" | "unrolled") => void;
  targetLootName: string;
  setTargetLootName: (name: string) => void;
  targetSpecificLoot: boolean;
  setTargetSpecificLoot: (value: boolean) => void;
  lootResults: LootResultItem[];
  sharedLootResults: SharedLootResultItem[];
  adminUnlocked: boolean;
  creatureLootQueue: CreatureLootQueueEntry[];
  selectedCreatureQueueId: string;
  setSelectedCreatureQueueId: (id: string) => void;
  newLootCreatureTier: CreatureTier;
  setNewLootCreatureTier: (tier: CreatureTier) => void;
  newLootCreatureTableId: string;
  setNewLootCreatureTableId: (id: string) => void;
  newLootCreatureQty: number;
  setNewLootCreatureQty: (qty: number) => void;
  addCreatureToLootQueue: () => void;
  removeCreatureFromLootQueue: (entryId: string) => void;
  characters: Character[];
  lootCharacterId: string;
  setLootCharacterId: (id: string) => void;
  harvestStarted: boolean;
  harvestAttemptsRemaining: number;
  harvestDc: number;
  harvestLog: string[];
  harvestStep: "setup" | "attempt" | "quality" | "loot";
  pendingLootRolls: number;
  doubleNextLoot: boolean;
  startHarvesting: () => void;
  newCreature: () => void;
  lootingAttempt: () => void;
  rollLootQualityOnly: () => void;
  addLootToInventory: () => void;
  characterAttributeAssignments: CharacterAttributeAssignmentRow[];
}) {
  const selectedTable = getLootTable(lootTableId);
  const selectedQueueEntry = creatureLootQueue.find((entry) => entry.id === selectedCreatureQueueId);
  const activeTable = harvestStarted ? selectedTable : selectedQueueEntry ? getLootTable(selectedQueueEntry.creatureTableId) : selectedTable;
  const activeTier = harvestStarted ? lootTier : selectedQueueEntry?.creatureTier || lootTier;
  const targetEntries = lootQuality !== "none" && lootQuality !== "unrolled" ? activeTable.tables[lootQuality] || [] : [];
  const tierRule = creatureTierRules[activeTier];
  const depleted = harvestStarted && harvestAttemptsRemaining <= 0;
  const canAttempt = harvestStarted && !depleted && harvestStep === "attempt";
  const canRollQuality = harvestStarted && !depleted && harvestStep === "quality" && pendingLootRolls > 0;
  const canRollLoot = harvestStarted && !depleted && harvestStep === "loot" && pendingLootRolls > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-7">
      <ParchmentCard>
        <div className="space-y-5 font-serif">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8" />
              <h2 className="text-3xl font-bold">Looting</h2>
            </div>
            <Button onClick={newCreature} disabled={!harvestStarted} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50">
              Finish / New Creature
            </Button>
          </div>

          <p>
            Players loot from the GM-created looting table. When a creature is fully harvested,
            press Finish / New Creature to remove it from the table.
          </p>

          {adminUnlocked && (
            <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-4">
              <h3 className="text-xl font-bold">GM: Add Creature to Looting Table</h3>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_140px] gap-3 items-end">
                <label className="space-y-1">
                  <strong>Creature Tier</strong>
                  <FantasySelect value={newLootCreatureTier} onValueChange={(value) => setNewLootCreatureTier(value as CreatureTier)}>
                    {Object.entries(creatureTierRules).map(([id, rule]) => (
                      <SelectItem key={id} value={id}>{rule.label}</SelectItem>
                    ))}
                  </FantasySelect>
                </label>

                <label className="space-y-1">
                  <strong>Creature Table</strong>
                  <FantasySelect value={newLootCreatureTableId} onValueChange={setNewLootCreatureTableId}>
                    {lootTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>{table.label}</SelectItem>
                    ))}
                  </FantasySelect>
                </label>

                <label className="space-y-1">
                  <strong>Amount</strong>
                  <FantasyInput
                    type="number"
                    min={1}
                    value={newLootCreatureQty}
                    onChange={(event) => setNewLootCreatureQty(numberValue(event.target.value))}
                  />
                </label>

                <div className="flex items-end min-w-0">
                  <Button onClick={addCreatureToLootQueue} className="w-full whitespace-nowrap bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
                    Add Creature
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3">
            <h3 className="text-xl font-bold">Shared Creatures Available to Loot</h3>

            {creatureLootQueue.length === 0 ? (
              <p>No shared creatures are currently available to loot.</p>
            ) : (
              <div className="space-y-2">
                {creatureLootQueue.map((entry) => {
                  const selected = selectedCreatureQueueId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 rounded-xl border p-3"
                      style={{
                        borderColor: selected ? PANEL.gold : "#9a7b45",
                        background: selected ? "#fff0c7" : "#ead6ad",
                      }}
                    >
                      <button
                        type="button"
                        disabled={harvestStarted}
                        onClick={() => setSelectedCreatureQueueId(entry.id)}
                        className="text-left font-bold disabled:opacity-70"
                      >
                        {entry.creatureLabel} ×{entry.qty}
                        <span className="block text-xs font-normal">
                          {creatureTierRules[entry.creatureTier].label}
                        </span>
                      </button>

                      <Button
                        disabled={harvestStarted || !selected}
                        onClick={startHarvesting}
                        className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50"
                      >
                        Start Harvesting
                      </Button>

                      {adminUnlocked && (
                        <Button
                          disabled={harvestStarted}
                          onClick={() => removeCreatureFromLootQueue(entry.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <label className="space-y-1 block">
            <strong>Harvester</strong>
            <FantasySelect value={lootCharacterId} onValueChange={setLootCharacterId} disabled={harvestStarted}>
              {characters.filter((character) => adminUnlocked || character.isActive !== false).map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name} (Harvesting +{character.harvesting ?? 0})
                </SelectItem>
              ))}
            </FantasySelect>
          </label>

          <CharacterAttributeEffectList
            characterId={lootCharacterId}
            assignments={characterAttributeAssignments}
            attributeIds={HARVESTING_ATTRIBUTE_EFFECT_IDS}
            title="Active harvesting attributes for this character"
          />

          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4">
            <p><strong>Current Creature:</strong> {harvestStarted ? activeTable.label : selectedQueueEntry?.creatureLabel || "None selected"}</p>
            <p><strong>Creature Tier:</strong> {tierRule.label}</p>
            <p><strong>Current DC:</strong> {harvestStarted ? Math.min(targetSpecificLoot && canAttempt ? 22 : 20, harvestDc + (targetSpecificLoot && canAttempt ? 2 : 0)) : tierRule.dc}</p>
            <p><strong>Harvest Attempts:</strong> {harvestStarted ? harvestAttemptsRemaining : tierRule.attempts}</p>
            <p><strong>Current Step:</strong> {harvestStarted ? harvestStep : "setup"}</p>
            <p><strong>Pending Loot Rolls:</strong> {pendingLootRolls}{doubleNextLoot ? " • next loot doubled" : ""}</p>
            <p><strong>Loot Weights:</strong> No Loot {tierRule.weights.noLoot}, Common {tierRule.weights.common}, Rare {tierRule.weights.rare}, Epic {tierRule.weights.epic}</p>
            {depleted && <p className="mt-2 font-bold text-red-800">This creature is depleted. Press Finish / New Creature.</p>}
          </div>

          {harvestStarted && !depleted && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3">
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={targetSpecificLoot}
                  disabled={!canAttempt}
                  onChange={(event) => {
                    setTargetSpecificLoot(event.target.checked);
                    setTargetLootName("random");
                  }}
                />
                Target a specific material/item on this attempt (+2 DC, max 22)
              </label>
              <p className="text-xs mt-1">
                Roll quality first. If the attempt succeeds, choose the exact result from that rarity before rolling loot.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={lootingAttempt}
              disabled={!canAttempt}
              className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50"
            >
              Looting Attempt
            </Button>
            <Button
              onClick={rollLootQualityOnly}
              disabled={!canRollQuality}
              className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50"
            >
              Roll Quality
            </Button>
            <Button
              onClick={addLootToInventory}
              disabled={!canRollLoot}
              className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50"
            >
              Roll Loot
            </Button>
          </div>

          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4">
            <p><strong>Current Loot Quality:</strong> {lootQuality === "unrolled" ? "Not rolled yet" : lootQuality === "none" ? "No Loot" : `${lootQuality[0].toUpperCase()}${lootQuality.slice(1)} Loot`}</p>
          </div>

          {targetSpecificLoot && canRollLoot && lootQuality !== "none" && lootQuality !== "unrolled" && (
            <label className="space-y-1 block">
              <strong>Choose Target Result from {lootQuality} table</strong>
              <FantasySelect value={targetLootName} onValueChange={setTargetLootName}>
                <SelectItem value="random">Choose randomly instead</SelectItem>
                {targetEntries.map((entry) => (
                  <SelectItem key={entry.name} value={entry.name}>
                    {entry.name}{entry.amount ? ` (${entry.amount})` : ""}
                  </SelectItem>
                ))}
              </FantasySelect>
            </label>
          )}
        </div>
      </ParchmentCard>

      <ParchmentCard>
        <div className="space-y-4 font-serif">
          <h2 className="text-3xl font-bold">Loot Results</h2>
          {lootResults.length === 0 ? (
            <p>No loot rolled yet.</p>
          ) : (
            <div className="space-y-3">
              {lootResults.map((result, index) => (
                <div key={`${result.name}-${index}`} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 flex justify-between gap-3">
                  <div>
                    <strong>{result.name}</strong>
                    <p className="text-sm">{result.kind} • {result.quality}</p>
                    {result.rollText && <p className="text-xs font-bold">{result.rollText}</p>}
                  </div>
                  <strong>{result.qty > 0 ? `×${result.qty}` : ""}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-2">
            <h3 className="text-xl font-bold">Shared Campaign Loot Log</h3>
            {sharedLootResults.length === 0 ? (
              <p className="text-sm">No shared loot results yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {sharedLootResults.map((result) => (
                  <div key={result.id} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 flex justify-between gap-3">
                    <div>
                      <strong>{result.name}</strong>
                      <p className="text-sm">
                        {result.kind} • {result.quality}
                        {result.characterName ? ` • ${result.characterName}` : ""}
                        {result.creatureLabel ? ` • ${result.creatureLabel}` : ""}
                      </p>
                      {result.rollText && <p className="text-xs font-bold">{result.rollText}</p>}
                    </div>
                    <strong>{result.qty > 0 ? `×${result.qty}` : ""}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {harvestLog.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-xl font-bold">Harvest Log</h3>
              {harvestLog.map((entry, index) => (
                <div key={`${entry}-${index}`} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 text-sm">
                  {entry}
                </div>
              ))}
            </div>
          )}
        </div>
      </ParchmentCard>
    </div>
  );
}

function RulesPanel() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
      <ParchmentCard className="xl:col-span-2">
        <div className="space-y-5 font-serif">
          <div className="flex items-center gap-3">
            <ScrollText className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Crafting Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRAFTING_RULES.map((rule) => (
              <div key={rule.title} className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
                <h3 className="text-xl font-bold">{rule.title}</h3>
                <p className="text-sm leading-relaxed">{rule.body}</p>
              </div>
            ))}
          </div>
        </div>
      </ParchmentCard>

      <ParchmentCard>
        <div className="space-y-4 font-serif">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Tool Specializations</h2>
          </div>

          <p className="text-sm">
            Specializations are unlocked at 25 PP or later milestones. Players may have multiple
            specializations, but only one applies per craft or item use.
          </p>

          {SPECIALIZATIONS.map((specialization) => (
            <div key={specialization} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 text-sm">
              {specialization}
            </div>
          ))}
        </div>
      </ParchmentCard>
    </div>
  );
}


function LootingRulesPanel() {
  const lootTierRows = Object.entries(creatureTierRules);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
      <ParchmentCard className="xl:col-span-2">
        <div className="space-y-5 font-serif">
          <div className="flex items-center gap-3">
            <Dice5 className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Looting Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Harvest Attempt Pool</h3>
              <p className="text-sm leading-relaxed">
                Each creature has a finite pool of Harvest Attempts. Success preserves the corpse.
                Failure degrades it. Harvesting ends when attempts reach 0.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Harvesting Roll</h3>
              <p className="text-sm leading-relaxed">
                Roll d20 + Harvesting against the current Harvest DC. The normal DC caps at 20.
                Targeted harvesting is chosen before the Looting Attempt and raises that attempt's DC by +2, up to 22. If the attempt succeeds, roll loot quality first, then choose the exact result from that rarity table before Roll Loot.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Success</h3>
              <p className="text-sm leading-relaxed">
                Meeting the DC grants 1 loot roll, consumes no Harvest Attempts, and increases
                the next Harvest DC by +1.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Great Success</h3>
              <p className="text-sm leading-relaxed">
                Beating the DC by 5 or more grants 2 loot rolls, consumes no Harvest Attempts,
                and increases the next Harvest DC by +1.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Critical Success</h3>
              <p className="text-sm leading-relaxed">
                A natural 20 grants 2 loot rolls, doubles the first item found, and does not
                increase the Harvest DC.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
              <h3 className="text-xl font-bold">Failure / Critical Failure</h3>
              <p className="text-sm leading-relaxed">
                Failure loses 1 Harvest Attempt. A natural 1 loses 2 Harvest Attempts.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4 md:col-span-2">
              <h3 className="text-xl font-bold">No Loot</h3>
              <p className="text-sm leading-relaxed">
                If loot quality rolls No Loot, Roll Loot is skipped. If another loot roll is pending
                from a natural 20 or great success, the flow returns to Roll Quality; otherwise it
                returns to Looting Attempt.
              </p>
            </div>
          </div>
        </div>
      </ParchmentCard>

      <ParchmentCard>
        <div className="space-y-4 font-serif">
          <h2 className="text-2xl font-bold">Creature Tier Table</h2>

          {lootTierRows.map(([tier, rule]) => (
            <div key={tier} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 text-sm">
              <h3 className="font-bold">{rule.label}</h3>
              <p>Attempts: {rule.attempts}</p>
              <p>Starting DC: {rule.dc}</p>
              <p>
                Weights: No Loot {rule.weights.noLoot}, Common {rule.weights.common},
                Rare {rule.weights.rare}, Epic {rule.weights.epic}
              </p>
            </div>
          ))}
        </div>
      </ParchmentCard>
    </div>
  );
}

function GMPanel(props: {
  adminUnlocked: boolean;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  unlockGM: () => void;
  lockGM: () => void;
  gmAuth: GmAuthState | null;
  setGmAuth: (state: GmAuthState | null) => void;
  newMaterial: { name: string; qty: number };
  setNewMaterial: React.Dispatch<React.SetStateAction<{ name: string; qty: number }>>;
  addMaterial: () => void;
  bulkMaterials: string;
  setBulkMaterials: (value: string) => void;
  importMaterials: () => void;
  resetMaterialsToStartingInventory: () => void;
  exportMaterialsJson: () => void;
  importLog: string;
  inventoryProfiles: InventoryProfile[];
  activeInventoryId: string;
  switchInventoryProfile: (profileId: string) => void;
  newInventoryName: string;
  setNewInventoryName: (value: string) => void;
  createInventoryProfile: (copyCurrent?: boolean) => void;
  renameInventoryProfile: (profileId: string, name: string) => void;
  deleteInventoryProfile: (profileId: string) => void;
  allTags: string[];
  disabledTags: string[];
  toggleDisabledTag: (tag: string) => void;
  enableAllTags: () => void;
  disableAllTags: () => void;
  passDay: () => void;
}) {
  return (
    <ParchmentCard>
      <div className="space-y-5 font-serif">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-8 h-8" />
            <h2 className="text-3xl font-bold">GM Panel</h2>
          </div>

          {props.adminUnlocked && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={props.passDay}
                className="w-fit bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]"
              >
                Pass Day
              </Button>
            </div>
          )}
        </div>

        <GmLoginPanel onAuthChange={props.setGmAuth} />

        <CreateGmPanel isSiteAdmin={Boolean(props.gmAuth?.isSiteAdmin)} />

        {props.gmAuth && (
          <div className="rounded-xl border border-[#9a7b45] bg-[#ead6ad] p-3 text-[#251b10]">
            <strong>GM:</strong> {props.gmAuth.displayName}
            {props.gmAuth.isSiteAdmin && (
              <span className="ml-2 text-[#7a3f00]">(Site Admin)</span>
            )}
          </div>
        )}

        {!props.adminUnlocked ? (
          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-sm">
            Sign in above to unlock GM tools.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Campaigns</h3>
                  <p className="text-sm">Create separate campaigns. Each campaign has its own recipe tag visibility, players, crafted items, and material inventory.</p>
                </div>
                <FantasySelect value={props.activeInventoryId} onValueChange={props.switchInventoryProfile}>
                  {props.inventoryProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </FantasySelect>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
                <FantasyInput
                  placeholder="New campaign name"
                  value={props.newInventoryName}
                  onChange={(event) => props.setNewInventoryName(event.target.value)}
                />
                <Button onClick={() => props.createInventoryProfile(false)} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
                  New Campaign
                </Button>
                <Button onClick={() => props.createInventoryProfile(true)} className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]">
                  Copy Current Campaign
                </Button>
              </div>

              <div className="space-y-2">
                {props.inventoryProfiles.map((profile) => {
                  const isActive = profile.id === props.activeInventoryId;

                  return (
                    <div key={profile.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-xl border border-[#b99b62] p-3">
                      <button
                        type="button"
                        onClick={() => props.switchInventoryProfile(profile.id)}
                        className="rounded-xl border px-4 py-2 text-left font-bold transition"
                        style={{
                          borderColor: isActive ? "#4b3115" : "#b99b62",
                          background: isActive ? "#4b3115" : "#f7e7c5",
                          color: isActive ? "#fff0c7" : "#251b10",
                        }}
                      >
                        {profile.name}
                        {isActive ? "  • Active" : ""}
                      </button>
                      <Button
                        onClick={() => props.deleteInventoryProfile(profile.id)}
                        disabled={props.inventoryProfiles.length <= 1}
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Campaign Recipe Visibility</h3>
                  <p className="text-sm">Only main recipe groups and weapon tags are shown here to keep campaign controls clean.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={props.enableAllTags} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
                    Show All
                  </Button>
                  <Button onClick={props.disableAllTags} className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]">
                    Hide All
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {props.allTags.map((tag) => {
                  const disabled = props.disabledTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => props.toggleDisabledTag(tag)}
                      className="rounded-full border px-3 py-1 text-sm font-bold"
                      style={{
                        borderColor: disabled ? "#9a1b1b" : "#9a7b45",
                        background: disabled ? "#f3c1b8" : "#f7e7c5",
                        color: "#251b10",
                      }}
                    >
                      {disabled ? "Hidden: " : "Visible: "}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
              <FantasyInput
                placeholder="Material name"
                value={props.newMaterial.name}
                onChange={(event) =>
                  props.setNewMaterial((current) => ({ ...current, name: event.target.value }))
                }
              />
              <FantasyInput
                type="number"
                value={props.newMaterial.qty}
                onChange={(event) =>
                  props.setNewMaterial((current) => ({
                    ...current,
                    qty: numberValue(event.target.value),
                  }))
                }
              />
              <Button onClick={props.addMaterial} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold">Bulk Material Import</h3>
              <Textarea
                rows={12}
                className="bg-[#f2dfb9] border-[#9a7b45] text-[#251b10] font-serif"
                placeholder={"Scrap Steel -- 6\nWebbing Bundle - 28\nPhase Core: 1"}
                value={props.bulkMaterials}
                onChange={(event) => props.setBulkMaterials(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={props.importMaterials} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Materials
                </Button>
                <Button onClick={props.exportMaterialsJson} className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]">
                  Export Current Campaign Inventory
                </Button>
                <Button onClick={props.resetMaterialsToStartingInventory} variant="destructive">
                  Wipe Current Inventory
                </Button>
              </div>
              <p className="text-sm">
                Inventory changes are saved permanently in this browser and tied to the selected campaign.
              </p>
            </div>
          </div>
        )}

        {props.importLog && <p className="font-bold">{props.importLog}</p>}
      </div>
    </ParchmentCard>
  );
}
