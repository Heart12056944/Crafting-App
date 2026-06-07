import craftingRulesJson from "./crafting/craftingRules.json";

export type CraftingRulesContent = {
  basicCrafting: string[];
  assistedCrafting: string[];
  npcCrafting: string[];
  materialQualityInfluence: string[];
  craftingOutcomes: string[];
  phaseTouchedCrafting: string[];
  progressPoints: string[];
  proficiencyAdvancement: string[];
  masteryOptions: string[];
  training: string[];
};

export type CraftOutcomeQuality = "Superior" | "Normal" | "Flawed" | "Failed";

export type CraftResultType =
  | "critical-success"
  | "superior-success"
  | "success"
  | "flawed"
  | "major-failure"
  | "critical-failure";

export type CraftResultSummary = {
  type: CraftResultType;
  title: string;
  quality: CraftOutcomeQuality;
  ppGain: number;
  materialsConsumed: "normal" | "rarest-not-consumed" | "partial-common-loss" | "all-lost";
  itemCreated: boolean;
  message: string;
};

export type PpGainInput = {
  naturalRoll: number;
  total: number;
  dc: number;
  isFirstTimeItemType?: boolean;
  categoryCraftsToday?: number;
};

export type ToolProgress = {
  pp: number;
  regularTrainingUsed: number;
  expertTrainingUsed: number;
  craftsTodayByCategory: Record<string, number>;
  proficient: boolean;
  mastery?: "advantage" | "dc-1" | "fail-within-2-normal";
  specializations: string[];
};

export const regularTrainingCosts = [10, 15, 20, 25, 30] as const;

export const craftingRules = craftingRulesJson as unknown as CraftingRulesContent;

export function calculatePpGain({ naturalRoll, total, dc, isFirstTimeItemType = false, categoryCraftsToday = 0 }: PpGainInput): number {
  if (categoryCraftsToday >= 5) return 0;
  let pp = 0;
  if (naturalRoll === 1) pp = -2;
  else if (total >= dc + 5) pp = 2;
  else if (total >= dc) pp = 1;
  if (pp > 0 && isFirstTimeItemType) pp += 1;
  return pp;
}

export function calculateCraftResult(input: PpGainInput): CraftResultSummary {
  const { naturalRoll, total, dc } = input;
  const ppGain = calculatePpGain(input);
  const noPpDueToDailyLimit = (input.categoryCraftsToday ?? 0) >= 5;

  if (naturalRoll === 1) {
    return {
      type: "critical-failure",
      title: "Critical Failure",
      quality: "Failed",
      ppGain,
      materialsConsumed: "all-lost",
      itemCreated: false,
      message: noPpDueToDailyLimit
        ? "Natural 1. No item is created. All materials are lost and the tool may break. No PP gained because the daily category PP limit has been reached."
        : "Natural 1. No item is created. All materials are lost and the tool may break. PP gained: -2.",
    };
  }

  if (naturalRoll === 20) {
    return {
      type: total >= dc + 5 ? "critical-success" : "success",
      title: total >= dc + 5 ? "Critical Superior Craft" : "Critical Success",
      quality: total >= dc + 5 ? "Superior" : "Normal",
      ppGain,
      materialsConsumed: "rarest-not-consumed",
      itemCreated: true,
      message: "Natural 20. Item is crafted and the rarest material used is not consumed.",
    };
  }

  if (total >= dc + 5) {
    return { type: "superior-success", title: "Superior Craft", quality: "Superior", ppGain, materialsConsumed: "normal", itemCreated: true, message: `You beat the DC by 5 or more. Create a Superior item. PP gained: +${ppGain}.` };
  }

  if (total >= dc) {
    return { type: "success", title: "Success", quality: "Normal", ppGain, materialsConsumed: "normal", itemCreated: true, message: `You met the DC. Create a Normal item. PP gained: +${ppGain}.` };
  }

  if (dc - total < 5) {
    return { type: "flawed", title: "Crafting Failed — Flawed Result", quality: "Flawed", ppGain, materialsConsumed: "normal", itemCreated: true, message: "You failed by less than 5. Create a Flawed item. PP gained: 0." };
  }

  return { type: "major-failure", title: "Major Failure", quality: "Failed", ppGain, materialsConsumed: "partial-common-loss", itemCreated: false, message: "You failed by 5 or more. No item is created. Lose some common materials by DM discretion or about 50%. PP gained: 0." };
}

export function shouldGainAdvantageFromDailyCategoryLimit(categoryCraftsToday: number): boolean {
  return categoryCraftsToday >= 5;
}

export function getRegularTrainingCost(regularTrainingUsed: number): number | null {
  return regularTrainingCosts[regularTrainingUsed] ?? null;
}

export function canUseRegularTraining(progress: ToolProgress): boolean {
  return progress.regularTrainingUsed < 5;
}

export function canUseExpertTraining(progress: ToolProgress): boolean {
  return progress.expertTrainingUsed < 5;
}

export function applyRegularTraining(progress: ToolProgress): ToolProgress {
  if (!canUseRegularTraining(progress)) return progress;
  return { ...progress, pp: progress.pp + 2, regularTrainingUsed: progress.regularTrainingUsed + 1 };
}

export function applyExpertTraining(progress: ToolProgress): ToolProgress {
  if (!canUseExpertTraining(progress)) return progress;
  return { ...progress, pp: progress.pp + 3, expertTrainingUsed: progress.expertTrainingUsed + 1 };
}

export function isProficientFromPp(pp: number): boolean {
  return pp >= 10;
}

export function getAdvancementMilestones(pp: number): number[] {
  if (pp < 25) return [];
  const milestones: number[] = [25];
  for (let milestone = 50; milestone <= pp; milestone += 25) milestones.push(milestone);
  return milestones;
}

export const toolSpecializations = {
  "Alchemist / Poisoner": ["Venomcrafter", "Neurotoxin Specialist", "Hybrid Infusion Expert", "Corrosive Alchemist", "Vitality Brewer"],
  "Tinker / Firearm": ["Siege Engineer", "Precision Mechanic", "Control Systems Builder", "Overclock Engineer", "Ironblood Smith", "Hybrid Ballistics Engineer"],
  Weaver: ["Silkshaper", "Shadowweaver", "Phaseweaver", "Threadbinder", "Soulthread Weaver", "Phasecurrent Weaver"],
  Smith: ["Bonebreaker", "Armoursmith", "Edgecrafter", "Forgeheart Smith", "Composite Forge Master"],
  Leatherworker: ["Tracker Gearwright", "Venom Ward Crafter", "Beastskin Crafter", "Lifewoven Crafter", "Adaptive Skin Crafter"],
} as const;
