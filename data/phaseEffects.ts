export type ItemCategory =
  | "weapon"
  | "armour"
  | "armor"
  | "accessory"
  | "item"
  | "consumable"
  | "potion"
  | "poison"
  | "material"
  | "weapon-upgrade"
  | "armour-upgrade"
  | "armor-upgrade"
  | "material-refinement"
  | string;

export type PhaseTouchedEffect = {
  id: string;
  name: string;
  appliesTo: "weapon" | "armour" | "accessory" | "item" | "potion" | "poison";
  description: string;
  effect: string[];
};

export const phaseStrike: PhaseTouchedEffect = {
  id: "phase-strike",
  name: "Phase Strike",
  appliesTo: "weapon",
  description:
    "The weapon briefly slips through space as it strikes, allowing part of the attack to bypass normal defenses.",
  effect: [
    "Once per turn when you hit with this weapon, deal an extra 1d4 force damage.",
    "Once per combat, you may cause one attack with this weapon to ignore half cover.",
  ],
};

export const phaseDeflection: PhaseTouchedEffect = {
  id: "phase-deflection",
  name: "Phase Deflection",
  appliesTo: "armour",
  description:
    "The armour partially phases at the moment of impact, causing attacks to glance through unstable space.",
  effect: [
    "Once per combat when you are hit by an attack, reduce the damage by 1d6.",
    "After reducing the damage, you may move 5 ft without provoking opportunity attacks.",
  ],
};

export const phaseSlipDraught: PhaseTouchedEffect = {
  id: "phase-slip-draught",
  name: "Phase Slip Draught",
  appliesTo: "potion",
  description:
    "The potion briefly loosens the drinker from physical space.",
  effect: [
    "After drinking this potion, the user may teleport 10 ft to an unoccupied space they can see.",
    "This movement does not provoke opportunity attacks.",
  ],
};

export const phaseVenom: PhaseTouchedEffect = {
  id: "phase-venom",
  name: "Phase Venom",
  appliesTo: "poison",
  description:
    "The poison disrupts the target’s position and timing.",
  effect: [
    "On hit, the target takes the poison’s normal effect and has disadvantage on its next attack roll.",
  ],
};

export const phaseAccessoryEffects: PhaseTouchedEffect[] = [
  {
    id: "phase-anchor",
    name: "Phase Anchor",
    appliesTo: "accessory",
    description:
      "The accessory stabilizes your body against spatial distortion while allowing brief controlled flickers through space.",
    effect: [
      "You gain +1 to DEX saving throws.",
      "Once per short rest, when you fail a DEX saving throw, you may reroll the save. You must use the new result.",
    ],
  },
  {
    id: "phase-slip",
    name: "Phase Slip",
    appliesTo: "accessory",
    description:
      "The accessory allows the wearer to briefly flicker out of alignment with physical space.",
    effect: [
      "Once per short rest, when a creature hits you with an opportunity attack, you may force that creature to reroll the attack. The creature must use the new result.",
    ],
  },
  {
    id: "phase-focus",
    name: "Phase Focus",
    appliesTo: "accessory",
    description:
      "The accessory sharpens the wearer’s ability to control unstable spatial energy.",
    effect: [
      "You gain +1 to Arcana checks.",
      "Once per short rest, you may gain advantage on one Arcana, Investigation, or Sleight of Hand check involving magical objects, traps, locks, mechanisms, or unstable energy.",
    ],
  },
  {
    id: "phase-step",
    name: "Phase Step",
    appliesTo: "accessory",
    description:
      "The accessory stores a small amount of spatial energy that can be released in a sudden movement.",
    effect: [
      "Once per short rest, you may teleport 10 ft to an unoccupied space you can see.",
      "This movement does not provoke opportunity attacks.",
    ],
  },
  {
    id: "phase-ward",
    name: "Phase Ward",
    appliesTo: "accessory",
    description:
      "The accessory creates a thin spatial barrier around the wearer.",
    effect: [
      "Once per combat, when you take damage, reduce that damage by 1d4.",
      "If the damage is force, lightning, poison, or psychic damage, reduce it by 1d6 instead.",
    ],
  },
];

export const stormSurge: PhaseTouchedEffect = {
  id: "storm-surge",
  name: "Storm Surge",
  appliesTo: "weapon",
  description:
    "The weapon carries a built-up charge that releases on impact.",
  effect: [
    "Once per turn on hit, deal +1d4 lightning damage.",
    "Once per combat, when you deal lightning damage with this weapon, the target loses 10 ft movement until the start of your next turn.",
  ],
};

export const stormguard: PhaseTouchedEffect = {
  id: "stormguard",
  name: "Stormguard",
  appliesTo: "armour",
  description:
    "The armour redirects electrical force across its surface.",
  effect: [
    "Once per combat when you take damage, reduce the damage by 1d6.",
    "If the damage is lightning, reduce it by 1d8 instead.",
  ],
};

export const stormchargeDraught: PhaseTouchedEffect = {
  id: "stormcharge-draught",
  name: "Stormcharge Draught",
  appliesTo: "potion",
  description:
    "The potion fills the drinker with a controlled burst of storm energy.",
  effect: [
    "After drinking this potion, the user gains +10 ft movement until the end of their next turn.",
    "Their next weapon hit before the end of their next turn deals +1d4 lightning damage.",
  ],
};

export const shockVenom: PhaseTouchedEffect = {
  id: "shock-venom",
  name: "Shock Venom",
  appliesTo: "poison",
  description:
    "The poison carries an electrical charge that disrupts movement.",
  effect: [
    "On hit, the target takes the poison’s normal effect and loses 10 ft movement until the start of your next turn.",
  ],
};

export const stormAccessoryEffects: PhaseTouchedEffect[] = [
  {
    id: "stormstep",
    name: "Stormstep",
    appliesTo: "accessory",
    description:
      "The accessory stores a short burst of storm energy for movement.",
    effect: [
      "Once per short rest, gain +10 ft movement until the end of your turn.",
    ],
  },
  {
    id: "storm-focus",
    name: "Storm Focus",
    appliesTo: "accessory",
    description:
      "The accessory sharpens your control over lightning and storm magic.",
    effect: [
      "Gain +1 to spell attack rolls for spells or effects that deal lightning or thunder damage.",
    ],
  },
  {
    id: "charged-reflex",
    name: "Charged Reflex",
    appliesTo: "accessory",
    description:
      "The accessory improves your reaction speed through small electrical pulses.",
    effect: [
      "Gain +1 to Initiative.",
      "Once per short rest, you may reroll one failed DEX saving throw. You must use the new result.",
    ],
  },
  {
    id: "storm-ward",
    name: "Storm Ward",
    appliesTo: "accessory",
    description:
      "The accessory creates a thin field of charged air around you.",
    effect: [
      "Once per combat when you are hit by a melee attack, the attacker takes 1d4 lightning damage.",
    ],
  },
  {
    id: "thunderheart",
    name: "Thunderheart",
    appliesTo: "accessory",
    description:
      "The accessory strengthens your body against pressure, shock, and disruption.",
    effect: [
      "Gain +1 to CON saving throws.",
      "Once per short rest, gain advantage on one save against being stunned, knocked prone, or forcibly moved.",
    ],
  },
];

export function isPhaseTouchedName(name: string): boolean {
  return name.toLowerCase().includes("phase-touched");
}

export function isStormTouchedName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("storm-touched") ||
    lower.includes("lightning-charged") ||
    lower.includes("tempest-touched") ||
    lower.includes("draconic-storm") ||
    lower.includes("ascendant storm-forged")
  );
}

export function getInfusionPrefixForMaterialName(name: string): "phase" | "storm" | null {
  if (isPhaseTouchedName(name)) return "phase";
  if (isStormTouchedName(name)) return "storm";
  return null;
}

export function recipeAlreadyPhaseTouched(recipe: {
  name: string;
  tags?: string[];
  materials?: { name: string }[];
}): boolean {
  const recipeName = recipe.name.toLowerCase();
  const recipeTags = (recipe.tags ?? []).map((tag) => tag.toLowerCase());
  const materialNames = (recipe.materials ?? []).map((material) =>
    material.name.toLowerCase()
  );

  return (
    recipeName.includes("phase-touched") ||
    recipeTags.some((tag) => tag.includes("phase-touched")) ||
    materialNames.some((name) => name.includes("phase-touched"))
  );
}

export function getRandomPhaseAccessoryEffect(
  rng: () => number = Math.random
): PhaseTouchedEffect {
  const index = Math.floor(rng() * phaseAccessoryEffects.length);
  return phaseAccessoryEffects[Math.max(0, Math.min(index, phaseAccessoryEffects.length - 1))];
}

export function getRandomStormAccessoryEffect(
  rng: () => number = Math.random
): PhaseTouchedEffect {
  const index = Math.floor(rng() * stormAccessoryEffects.length);
  return stormAccessoryEffects[Math.max(0, Math.min(index, stormAccessoryEffects.length - 1))];
}

function normalizeCategory(category: ItemCategory): string {
  const normalized = category.toLowerCase();
  if (normalized === "armor") return "armour";
  if (normalized === "armor-upgrade") return "armour-upgrade";
  if (normalized === "consumable") return "potion";
  return normalized;
}

export function getPhaseTouchedEffectForCategory(
  category: ItemCategory,
  rng: () => number = Math.random
): PhaseTouchedEffect | null {
  const normalized = normalizeCategory(category);

  if (normalized === "weapon" || normalized === "weapon-upgrade") return phaseStrike;
  if (normalized === "armour" || normalized === "armour-upgrade") return phaseDeflection;
  if (normalized === "potion") return phaseSlipDraught;
  if (normalized === "poison") return phaseVenom;
  if (["accessory", "item"].includes(normalized)) return getRandomPhaseAccessoryEffect(rng);
  return null;
}

export function getStormTouchedEffectForCategory(
  category: ItemCategory,
  rng: () => number = Math.random
): PhaseTouchedEffect | null {
  const normalized = normalizeCategory(category);

  if (normalized === "weapon" || normalized === "weapon-upgrade") return stormSurge;
  if (normalized === "armour" || normalized === "armour-upgrade") return stormguard;
  if (normalized === "potion") return stormchargeDraught;
  if (normalized === "poison") return shockVenom;
  if (["accessory", "item"].includes(normalized)) return getRandomStormAccessoryEffect(rng);
  return null;
}

export function getInfusedEffectForCategory(
  materialName: string,
  category: ItemCategory,
  rng: () => number = Math.random
): PhaseTouchedEffect | null {
  const infusion = getInfusionPrefixForMaterialName(materialName);

  if (infusion === "phase") return getPhaseTouchedEffectForCategory(category, rng);
  if (infusion === "storm") return getStormTouchedEffectForCategory(category, rng);
  return null;
}

export function canApplyPhaseTouchedEffect(recipe: {
  name: string;
  category: ItemCategory;
  tags?: string[];
  materials?: { name: string }[];
}): boolean {
  if (recipeAlreadyPhaseTouched(recipe)) return false;
  return getPhaseTouchedEffectForCategory(recipe.category) !== null;
}

export function formatPhaseTouchedEffect(effect: PhaseTouchedEffect): string {
  return `${effect.name}: ${effect.effect.join(" ")}`;
}
