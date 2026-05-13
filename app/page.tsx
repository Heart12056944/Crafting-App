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
  recipeAlreadyPhaseTouched,
} from "@/data/phaseEffects";

import { fetchCampaigns, createCampaign, deleteCampaign } from "@/lib/supabaseCampaigns";
import { fetchCampaignMaterials, replaceCampaignMaterials } from "@/lib/supabaseMaterials";
import { fetchCampaignCraftedItems, insertCraftedItem, deleteCraftedItem } from "@/lib/supabaseCraftedItems";
import { fetchCampaignCharacters, replaceCampaignCharacters } from "@/lib/supabaseCharacters";
import { creatureTierRules, lootTables, rollDiceExpression, rollWeightedLootQuality, getLootTable, type CreatureTier, type LootQuality } from "@/data/lootTables";
import { supabase } from "@/lib/supabaseClient";

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

type TabId = "craft" | "available" | "recipes" | "materials" | "characters" | "advancement" | "looting" | "craftingRules" | "lootingRules" | "admin";

const tabs = [
  ["craft", "Craft", Hammer],
  ["available", "Available", BookOpen],
  ["recipes", "All Recipes", ClipboardList],
  ["materials", "Materials", FlaskConical],
  ["characters", "Characters", UserRound],
  ["advancement", "PP Improvements", Wrench],
  ["looting", "Looting", Package],
  ["craftingRules", "Crafting Rules", ScrollText],
  ["lootingRules", "Looting Rules", Dice5],
  ["admin", "Admin", KeyRound],
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
] as const;

const MANAGED_RECIPE_TAGS = [...MAIN_RECIPE_TAGS, ...WEAPON_RECIPE_TAGS];

const MATERIALS_STORAGE_KEY = "artisan-codex-materials";
const INVENTORY_PROFILES_STORAGE_KEY = "artisan-codex-inventory-profiles";
const ACTIVE_INVENTORY_STORAGE_KEY = "artisan-codex-active-inventory";
const DISABLED_TAGS_STORAGE_KEY = "artisan-codex-disabled-tags";
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

function materialText(materials: Recipe["materials"]) {
  return (materials as RecipeMaterialWithTag[]).map((m) =>
    m.tagRequirement ? `${m.qty}× ${m.name} (${m.tagRequirement})` : `${m.qty}× ${m.name}`
  ).join(", ");
}

function getRarityFromTags(recipe: Recipe): Rarity {
  const found = RARITY_ORDER.find((rarity) => recipe.tags.includes(rarity));
  return found || recipe.rarity || "common";
}

function getRarityColor(recipe: Recipe): string {
  return rarityColors[getRarityFromTags(recipe)] || rarityColors.common;
}


function availableQtyForRequirement(required: RecipeMaterialWithTag, materialMap: Map<string, number>) {
  if (!required.tagRequirement) return materialMap.get(normalizeName(required.name)) || 0;

  return getMaterialsByTag(required.tagRequirement).reduce((total, entry) => {
    return total + (materialMap.get(normalizeName(entry.name)) || 0);
  }, 0);
}

function firstAvailableMaterialForTag(tagRequirement: string, materialMap: Map<string, number>) {
  return getMaterialsByTag(tagRequirement).find((entry) => {
    const qty = materialMap.get(normalizeName(entry.name)) || 0;
    return qty > 0;
  });
}

function canRecipe(recipe: Recipe, materialMap: Map<string, number>) {
  return (recipe.materials as RecipeMaterialWithTag[]).every(
    (required) => availableQtyForRequirement(required, materialMap) >= required.qty
  );
}

function missingMaterials(recipe: Recipe, materialMap: Map<string, number>) {
  return (recipe.materials as RecipeMaterialWithTag[])
    .map((required) => {
      const available = availableQtyForRequirement(required, materialMap);
      const label = required.tagRequirement ? `${required.name} (${required.tagRequirement})` : required.name;
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
    tool_progress: Record<string, unknown>;
  }[]
): Character[] {
  return rows.map((row) => {
    const stored = row.tool_progress?.character as Partial<Character> | undefined;
    return normalizeCharacter({
      ...(stored || {}),
      id: row.id,
      name: stored?.name || row.name,
    });
  });
}

function characterToSupabasePayload(character: Character) {
  return {
    id: character.id,
    name: character.name,
    data: {
      character,
    } as Record<string, unknown>,
  };
}

function defaultCharacter(): Character {
  return {
    id: crypto.randomUUID(),
    name: "Admin Crafter",
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
  const [tagFilter, setTagFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [availableRecipePage, setAvailableRecipePage] = useState(1);
  const [allRecipePage, setAllRecipePage] = useState(1);
  const [manuallyDiscoveredMaterials, setManuallyDiscoveredMaterials] = useState<string[]>([]);
  const [lootTier, setLootTier] = useState<CreatureTier>("common");
  const [lootTableId, setLootTableId] = useState(lootTables[0]?.id || "skeleton");
  const [lootQuality, setLootQuality] = useState<LootQuality | "none" | "unrolled">("unrolled");
  const [targetLootName, setTargetLootName] = useState("random");
  const [targetSpecificLoot, setTargetSpecificLoot] = useState(false);
  const [lootResults, setLootResults] = useState<LootResultItem[]>([]);
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
                ? profile.characters.map((character) => ({
                    ...character,
                    id: character.id || crypto.randomUUID(),
                    toolProgress: character.toolProgress || buildToolProgress(false),
                  }))
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

  const recipeStatus = useMemo(() => {
    return recipes.map((recipe) => ({
      ...recipe,
      available: canRecipe(recipe, materialMap),
      missing: missingMaterials(recipe, materialMap),
      rarityFromTags: getRarityFromTags(recipe),
      discovered: recipeIsDiscovered(recipe, discoveredMaterialNames),
    }));
  }, [recipes, materialMap, discoveredMaterialNames]);

  const filteredRecipes = useMemo(() => {
    const search = recipeSearch.trim().toLowerCase();

    return recipeStatus.filter((recipe) => {
      const hiddenByDisabledTag = recipe.tags.some((tag) => disabledTags.includes(tag));
      const tagMatches = tagFilter === "all" || recipe.tags.includes(tagFilter);
      const rarityMatches = rarityFilter === "all" || getRarityFromTags(recipe) === rarityFilter;
      const searchText = `${recipe.name} ${recipe.description} ${recipe.category} ${recipe.rarity} ${recipe.tags.join(
        " "
      )}`.toLowerCase();
      const searchMatches = !search || searchText.includes(search);
      return recipe.discovered && !hiddenByDisabledTag && tagMatches && rarityMatches && searchMatches;
    });
  }, [recipeStatus, recipeSearch, tagFilter, rarityFilter, disabledTags]);

  const availableRecipes = filteredRecipes.filter((recipe) => recipe.available);
  const unavailableRecipes = filteredRecipes.filter((recipe) => !recipe.available);
  const phaseCraftableRecipes = availableRecipes.filter((recipe) =>
    canCraftWithPhaseTouchedMaterial(recipe, materials, materialMap)
  );
  const visibleAvailableRecipes = showPhaseCraftableOnly ? phaseCraftableRecipes : availableRecipes;

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setImportLog("Admin unlocked.");
    } else {
      setImportLog("Incorrect password.");
    }
  }

  function lockAdmin() {
    setAdminUnlocked(false);
    setAdminPassword("");
    setImportLog("Admin locked.");
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
    window.localStorage.removeItem("artisan-codex-discovered-materials");
    setImportLog("Current campaign inventory wiped and all materials marked undiscovered.");
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

  function addCharacter() {
    if (!newCharacter.name.trim()) return;
    markCharactersForSupabaseSave();
    const character = {
      ...newCharacter,
      id: crypto.randomUUID(),
      name: newCharacter.name.trim(),
    };
    setCharacters((current) => [...current, character]);
    setSelectedCharacterId(character.id);
    setNewCharacter({
      id: crypto.randomUUID(),
      name: "",
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

  function startHarvesting() {
    const rule = creatureTierRules[lootTier];
    setHarvestStarted(true);
    setHarvestAttemptsRemaining(rule.attempts);
    setHarvestDc(rule.dc);
    setLootQuality("unrolled");
    setTargetLootName("random");
    setTargetSpecificLoot(false);
    setPendingLootRolls(0);
    setDoubleNextLoot(false);
    setHarvestStep("attempt");
    setHarvestLog([`Started harvesting ${getLootTable(lootTableId).label}. Attempts: ${rule.attempts}, DC ${rule.dc}.`]);
  }

  function newCreature() {
    setHarvestStarted(false);
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
    const roll = Math.floor(Math.random() * 20) + 1;
    const harvestingBonus = character?.harvesting ?? 0;
    const baseDc = Math.min(20, harvestDc);
    const currentDc = targetSpecificLoot ? Math.min(22, baseDc + 2) : baseDc;
    const total = roll + harvestingBonus;

    if (roll === 1) {
      const nextAttempts = Math.max(0, harvestAttemptsRemaining - 2);
      setHarvestAttemptsRemaining(nextAttempts);
      setHarvestStep(nextAttempts <= 0 ? "setup" : "attempt");
      setHarvestLog((current) => [
        `Critical failure: ${character?.name || "Harvester"} rolled Nat 1 (${total}) vs DC ${currentDc}. Lose 2 attempts. ${nextAttempts} remaining.`,
        ...current,
      ]);
      return;
    }

    if (roll === 20) {
      setPendingLootRolls(2);
      setDoubleNextLoot(true);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Critical success: ${character?.name || "Harvester"} rolled Nat 20 vs DC ${currentDc}. Gain 2 loot rolls, double the first item found, and the DC stays ${baseDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}`,
        ...current,
      ]);
      return;
    }

    if (total >= currentDc + 5) {
      const nextDc = Math.min(20, baseDc + 1);
      setHarvestDc(nextDc);
      setPendingLootRolls(2);
      setDoubleNextLoot(false);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Great success: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. Gain 2 loot rolls. Next base DC ${nextDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}`,
        ...current,
      ]);
      return;
    }

    if (total >= currentDc) {
      const nextDc = Math.min(20, baseDc + 1);
      setHarvestDc(nextDc);
      setPendingLootRolls(1);
      setDoubleNextLoot(false);
      setLootQuality("unrolled");
      setHarvestStep("quality");
      setHarvestLog((current) => [
        `Success: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. Gain 1 loot roll. Next base DC ${nextDc}.${targetSpecificLoot ? " Targeted harvest active." : ""}`,
        ...current,
      ]);
      return;
    }

    const nextAttempts = Math.max(0, harvestAttemptsRemaining - 1);
    setHarvestAttemptsRemaining(nextAttempts);
    setHarvestStep(nextAttempts <= 0 ? "setup" : "attempt");
    setHarvestLog((current) => [
      `Failure: ${character?.name || "Harvester"} rolled ${roll} + ${harvestingBonus} = ${total} vs DC ${currentDc}. Lose 1 attempt. ${nextAttempts} remaining.`,
      ...current,
    ]);
  }

  function rollLootQualityOnly() {
    if (!harvestStarted || harvestAttemptsRemaining <= 0 || harvestStep !== "quality" || pendingLootRolls <= 0) return;

    const quality = rollWeightedLootQuality(lootTier);
    setLootQuality(quality);

    if (quality === "none") {
      const remainingRolls = Math.max(0, pendingLootRolls - 1);
      setPendingLootRolls(remainingRolls);
      setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
      setLootResults((current) => [
        { name: "No Loot", qty: 0, kind: "none", quality: "none" },
        ...current,
      ]);
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
    const quality = lootQuality === "unrolled" ? rollWeightedLootQuality(lootTier) : lootQuality;
    const targetSelection = quality === "none" ? null : getTargetedLootSelection(quality);

    if (quality === "none") {
      setLootQuality("none");
      setLootResults((current) => [{ name: "No Loot", qty: 0, kind: "none", quality: "none" }, ...current]);
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
      setLootResults((current) => [{ name: "No entries for this table.", qty: 0, kind: "none", quality }, ...current]);
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
    markMaterialDiscovered(entry.name, true);

    const remainingRolls = Math.max(0, pendingLootRolls - 1);
    setPendingLootRolls(remainingRolls);
    setDoubleNextLoot(false);
    if (targetSelection) setTargetLootName("random");
    setHarvestStep(remainingRolls > 0 ? "quality" : "attempt");
    const lootFoundMessage = result.rollText
      ? `Loot found: ${result.name}. ${result.rollText}. Quantity found: ${result.qty}.`
      : `Loot found: ${result.name}. Quantity found: ${result.qty}.`;

    setHarvestLog((current) => [
      `${lootFoundMessage} ${remainingRolls} pending loot roll${remainingRolls === 1 ? "" : "s"} remaining.`,
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
      .filter((required) => required.tagRequirement)
      .map((required) => ({ required, selected: firstAvailableMaterialForTag(required.tagRequirement!, materialMap) }));

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

    const toolProgress = selectedCharacter.toolProgress?.[recipe.tool] ?? emptyToolProgress();
    const craftsToday = toolProgress.craftsTodayByCategory?.[recipe.category] ?? 0;
    const selectedImprovements = toolProgress.specializations || [];
    const hasAdvantageMastery = selectedImprovements.includes("Mastery: Advantage on crafting rolls");
    const hasDcReductionMastery = selectedImprovements.includes("Mastery: Reduce crafting DC by 1");
    const hasNearFailureMastery = selectedImprovements.includes("Mastery: Treat failures within 2 of DC as Normal");
    const adjustedDc = hasDcReductionMastery ? Math.max(1, recipe.dc - 1) : recipe.dc;
    const dailyAdvantage = shouldGainAdvantageFromDailyCategoryLimit(craftsToday);
    const effectiveRollMode = dailyAdvantage || hasAdvantageMastery ? "advantage" : rollMode;

    const toolLevel = selectedCharacter.tools[recipe.tool] || (toolProgress.proficient ? "proficient" : "none");
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
          isFirstTimeItemType: !selectedCharacter.progressPoints?.[recipe.category],
        });

    if (
      hasNearFailureMastery &&
      !npcCraft &&
      craftResult.quality === "Flawed" &&
      total >= adjustedDc - 2
    ) {
      craftResult = {
        ...craftResult,
        type: "success",
        title: "Mastery Recovery",
        quality: "Normal" as CraftQualityOrFailed,
        ppGain: Math.max(craftResult.ppGain, 1),
        materialsConsumed: "normal",
        itemCreated: true,
        message: "Mastery applied: a near failure within 2 of the DC becomes a Normal success.",
      };
    }

    let quality = craftResult.quality;
    const outcome = quality === "Failed" ? undefined : getOutcome(recipe, quality as CraftQuality);
    let createdMaterials = parseCreatedMaterialsFromOutcome(outcome?.effect);
    const materialRecipe = recipe.category === "material-refinement" || recipe.tags.includes("material-creation");
    const genericPhaseOutput = outcome?.effect?.some((line) =>
      line.toLowerCase().includes("phase-touched") &&
      (line.toLowerCase().includes("base material") ||
        line.toLowerCase().includes("advanced material") ||
        line.toLowerCase().includes("high-end material") ||
        line.toLowerCase().includes("master material") ||
        line.toLowerCase().includes("version of the base material") ||
        line.toLowerCase().includes("phase-touched material"))
    );
    if (genericPhaseOutput && resolvedTagMaterials[0]?.selected) {
      const qty = quality === "Superior" ? 2 : quality === "Normal" ? 1 : 0;
      if (qty > 0) {
        createdMaterials = [
          { name: getPhaseTouchedCounterpart(resolvedTagMaterials[0].selected.name), qty },
        ];
      }
    }
    const phaseEffect = usingPhaseTouched ? getPhaseTouchedEffectForCategory(recipe.category) : null;

    markMaterialsForSupabaseSave();
    setMaterials((current) => {
      let next = current.map((material) => ({ ...material }));

      const consumeMaterial = (name: string, qty: number) => {
        const index = next.findIndex((m) => normalizeName(m.name) === normalizeName(name));
        if (index >= 0) next[index] = { ...next[index], qty: Math.max(0, next[index].qty - qty) };
      };

      (recipe.materials as RecipeMaterialWithTag[]).forEach((required) => {
        if (required.tagRequirement) {
          const resolved = resolvedTagMaterials.find((item) => item.required === required);
          if (resolved?.selected) consumeMaterial(resolved.selected.name, required.qty);
          return;
        }

        const shouldKeepRarestOnNat20 =
          naturalRoll === 20 &&
          recipe.materials
            .map((m) => ({ ...m, tier: getMaterialTier(m.name) ?? 0 }))
            .sort((a, b) => b.tier - a.tier)[0]?.name === required.name;

        if (!shouldKeepRarestOnNat20) consumeMaterial(required.name, required.qty);
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
        name: usingPhaseTouched ? `Phase-Touched ${recipe.name}` : recipe.name,
        type: recipe.category,
        rarity: getRarityFromTags(recipe),
        tags: usingPhaseTouched ? [...new Set([...recipe.tags, "phase-touched", "phase"])] : recipe.tags,
        quality,
        crafter: selectedCharacter.name,
        rollTotal: total,
        naturalRoll,
        effect: outcome?.effect,
        statBlock: outcome?.statBlock,
        phaseTouched: usingPhaseTouched,
        phaseTouchedMaterial: selectedPhaseMaterial || undefined,
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

    setCharacters((current) =>
      current.map((character) => {
        if (character.id !== selectedCharacter.id) return character;
        const currentProgress = character.toolProgress?.[recipe.tool] ?? emptyToolProgress();
        const nextPp = Math.max(0, currentProgress.pp + craftResult.ppGain);
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
      message: `${craftResult.message}${brokeToolOnNatOne ? ` Natural 1: ${recipe.tool}'s Tools broke.` : ""}${dailyAdvantage ? " Daily category limit reached: advantage applied, no PP gained." : ""}${materialRecipe && createdMaterials.length > 0 ? ` Added material output to inventory: ${createdMaterials.map((m) => `${m.qty}× ${m.name}`).join(", ")}.` : ""}`,
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
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            rarityFilter={rarityFilter}
            setRarityFilter={setRarityFilter}
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
          />
        )}

        {activeTab === "recipes" && (
          <RecipeGrid
            title="All Recipes"
            recipes={[...availableRecipes, ...unavailableRecipes]}
            materialMap={materialMap}
            onCraft={(recipe) => { setSelectedRecipeId(recipe.id); setActiveTab("craft"); }}
            showMissing
            page={allRecipePage}
            setPage={setAllRecipePage}
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
            updateCharacterTool={updateCharacterTool}
            updateCharacterToolOwned={updateCharacterToolOwned}
            updateCharacterToolBroken={updateCharacterToolBroken}
          />
        )}

        {activeTab === "advancement" && (
          <AdvancementPanel
            characters={characters}
            addToolImprovement={addToolImprovement}
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
          />
        )}

        {activeTab === "craftingRules" && <RulesPanel />}

        {activeTab === "lootingRules" && <LootingRulesPanel />}

        {activeTab === "admin" && (
          <AdminPanel
            adminUnlocked={adminUnlocked}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            unlockAdmin={unlockAdmin}
            lockAdmin={lockAdmin}
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
      <SelectTrigger className="bg-[#f2dfb9] border-[#9a7b45] text-[#251b10] font-serif disabled:opacity-60">
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
  tagFilter: string;
  setTagFilter: (value: string) => void;
  rarityFilter: string;
  setRarityFilter: (value: string) => void;
}) {
  return (
    <ParchmentCard>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-3">
        <FantasyInput
          placeholder="Search recipes, tags, rarity, type..."
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
        />

        <FantasySelect value={props.tagFilter} onValueChange={props.setTagFilter}>
          <SelectItem value="all">All tags</SelectItem>
          {props.allTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </FantasySelect>

        <FantasySelect value={props.rarityFilter} onValueChange={props.setRarityFilter}>
          <SelectItem value="all">All rarities</SelectItem>
          {RARITY_ORDER.map((rarity) => (
            <SelectItem key={rarity} value={rarity}>
              {RARITY_LABELS[rarity]}
            </SelectItem>
          ))}
        </FantasySelect>
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
}: {
  title: string;
  recipes: (Recipe & { available?: boolean; missing?: { name: string; needed: number; available: number }[] })[];
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

            return (
              <div
                key={recipe.id}
                className="rounded-2xl overflow-hidden border-4 shadow-xl"
                style={{ borderColor: color, background: PANEL.parchment, color: PANEL.ink }}
              >
                <div className="px-4 pt-3 pb-2 border-b-4" style={{ borderColor: color, background: PANEL.parchmentLight }}>
                  <h3 className="text-2xl font-bold leading-tight">{recipe.name}</h3>
                  <div
                    className="mt-1 w-fit rounded-full border px-3 py-0.5 text-[11px] font-bold"
                    style={{ borderColor: color, background: "#f8e8c2" }}
                  >
                    {RARITY_LABELS[rarity]} {recipe.category}
                  </div>
                </div>

                <div className="p-4 space-y-2 min-h-[360px]">
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
              Admin view shows every known material, including materials currently at 0.
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

          {characters.map((character) => (
            <div
              key={character.id}
              className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-4"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">{character.name}</h3>
                  {!adminUnlocked && (
                    <p className="text-sm">Admin unlock required to edit character stats, tools, PP, and training.</p>
                  )}
                </div>

                {characters.length > 1 && adminUnlocked && (
                  <Button variant="destructive" size="icon" onClick={() => removeCharacter(character.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

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
}: {
  characters: Character[];
  addToolImprovement: (characterId: string, tool: string, improvement: string) => void;
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

      {characters.map((character) => (
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
}) {
  const selectedTable = getLootTable(lootTableId);
  const usableQuality = lootQuality === "unrolled" || lootQuality === "none" ? "common" : lootQuality;
  const targetEntries = lootQuality !== "none" && lootQuality !== "unrolled" ? selectedTable.tables[lootQuality] || [] : [];
  const tierRule = creatureTierRules[lootTier];
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
            <Button onClick={newCreature} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
              New Creature
            </Button>
          </div>

          <p>
            Choose the creature tier and creature table, then start harvesting. Once started,
            the creature setup locks until New Creature is pressed.
          </p>

          <label className="space-y-1 block">
            <strong>Harvester</strong>
            <FantasySelect value={lootCharacterId} onValueChange={setLootCharacterId} disabled={harvestStarted}>
              {characters.map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name} (Harvesting +{character.harvesting ?? 0})
                </SelectItem>
              ))}
            </FantasySelect>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <strong>Creature Tier</strong>
              <FantasySelect
                value={lootTier}
                disabled={harvestStarted}
                onValueChange={(value) => {
                  setLootTier(value as CreatureTier);
                  setLootQuality("unrolled");
                  setTargetLootName("random");
                }}
              >
                {Object.entries(creatureTierRules).map(([id, rule]) => (
                  <SelectItem key={id} value={id}>{rule.label}</SelectItem>
                ))}
              </FantasySelect>
            </label>

            <label className="space-y-1">
              <strong>Creature Table</strong>
              <FantasySelect
                value={lootTableId}
                disabled={harvestStarted}
                onValueChange={(value) => {
                  setLootTableId(value);
                  setTargetLootName("random");
                }}
              >
                {lootTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>{table.label}</SelectItem>
                ))}
              </FantasySelect>
            </label>
          </div>

          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4">
            <p><strong>Current DC:</strong> {harvestStarted ? Math.min(targetSpecificLoot && canAttempt ? 22 : 20, harvestDc + (targetSpecificLoot && canAttempt ? 2 : 0)) : tierRule.dc}</p>
            <p><strong>Harvest Attempts:</strong> {harvestStarted ? harvestAttemptsRemaining : tierRule.attempts}</p>
            <p><strong>Current Step:</strong> {harvestStarted ? harvestStep : "setup"}</p>
            <p><strong>Pending Loot Rolls:</strong> {pendingLootRolls}{doubleNextLoot ? " • next loot doubled" : ""}</p>
            <p><strong>Loot Weights:</strong> No Loot {tierRule.weights.noLoot}, Common {tierRule.weights.common}, Rare {tierRule.weights.rare}, Epic {tierRule.weights.epic}</p>
            {depleted && <p className="mt-2 font-bold text-red-800">This creature is depleted. Press New Creature to continue.</p>}
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
                Roll quality first. If the attempt succeeds, you choose the exact result from that rarity before rolling loot.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={startHarvesting}
              disabled={harvestStarted}
              className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
            >
              Start Harvesting
            </Button>
            <Button
              onClick={lootingAttempt}
              disabled={!canAttempt}
              className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
            >
              Looting Attempt
            </Button>
            <Button
              onClick={rollLootQualityOnly}
              disabled={!canRollQuality}
              className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
            >
              Roll Quality
            </Button>
            <Button
              onClick={addLootToInventory}
              disabled={!canRollLoot}
              className="bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]"
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

function AdminPanel(props: {
  adminUnlocked: boolean;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  unlockAdmin: () => void;
  lockAdmin: () => void;
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
            <h2 className="text-3xl font-bold">Admin Panel</h2>
          </div>

          {props.adminUnlocked && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={props.passDay}
                className="w-fit bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]"
              >
                Pass Day
              </Button>
              <Button
                onClick={props.lockAdmin}
                className="w-fit bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]"
              >
                Leave Admin
              </Button>
            </div>
          )}
        </div>

        {!props.adminUnlocked ? (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <FantasyInput
              type="password"
              placeholder="Admin password"
              value={props.adminPassword}
              onChange={(event) => props.setAdminPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.unlockAdmin();
                }
              }}
            />
            <Button onClick={props.unlockAdmin} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
              Unlock
            </Button>
            <p className="text-sm md:col-span-2">
              Enter the admin password to unlock campaign management.
            </p>
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
