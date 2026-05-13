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

export const craftingRules = {
  basicCrafting: [
    "When crafting an item, make a tool-based ability check using the listed tool and associated stat.",
    "If proficient with the tool, add your proficiency bonus.",
    "If not proficient, still roll using the stat with no proficiency bonus.",
  ],
  assistedCrafting: [
    "Another character can assist with crafting if they are proficient with the required tool.",
    "The assistant may grant Advantage on the crafting roll or provide a +2 bonus.",
    "Only one assistant can provide this benefit per crafting attempt.",
  ],
  npcCrafting: [
    "Players may choose to have a shop NPC or specialist craft an item for them.",
    "The item is always crafted as a Normal version.",
    "No roll is required.",
    "Materials are still consumed as normal.",
    "Additional labour costs may apply by DM discretion or shop pricing.",
  ],
  materialQualityInfluence: [
    "Only one quality modifier applies per craft.",
    "Superior material/item: DC -2 and on success the result cannot be Flawed.",
    "Flawed material/item: DC +2 and on failure the result cannot be Normal.",
    "Normal materials: no change.",
  ],
  craftingOutcomes: [
    "Success by 5 or more: create a Superior version.",
    "Success by meeting the DC: create a Normal version.",
    "Failure below DC by less than 5: create a Flawed version.",
    "Failure by 5 or more: no item is created; lose some common materials by DM discretion or about 50%.",
    "Natural 1: critical failure; lose all materials used and tools may break.",
    "Natural 20: critical success; the rarest material used is not consumed.",
  ],
  phaseTouchedCrafting: [
    "If a crafted item uses at least one Phase-Touched material, the finished item gains one Phase-Touched effect based on the item type.",
    "Weapons gain Phase Strike.",
    "Armour gains Phase Deflection.",
    "Accessories gain Phase Anchor or another approved Phase-Touched accessory effect.",
    "A crafted item may only gain one Phase-Touched effect unless the recipe specifically allows multiple effects.",
  ],
  progressPoints: [
    "Success: +1 PP.",
    "Success by 5 or more: +2 PP.",
    "Failure: 0 PP.",
    "Critical Failure: -2 PP.",
    "First time crafting a new item type grants +1 bonus PP.",
    "Players only gain PP for the first 5 items crafted per category per day.",
    "After 5 crafts of the same category, further crafts of that category gain Advantage but no longer gain PP.",
  ],
  proficiencyAdvancement: [
    "10 PP: gain proficiency.",
    "25 PP: choose Specialization or Mastery.",
    "Every additional 25 PP: choose another Specialization or Mastery if not already chosen.",
  ],
  masteryOptions: [
    "Advantage on crafting rolls.",
    "Reduce crafting DC by 1.",
    "Treat failures within 2 of DC as Normal.",
  ],
  training: [
    "Regular Training: +2 PP per session, max 5 sessions, total max +10 PP.",
    "Regular Training cost increases each time: 10, 15, 20, 25, then 30 gp.",
    "Expert Training: +3 PP per session, max 5 sessions, total max +15 PP.",
    "Expert Training cost: 50 gp per session.",
  ],
};

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
