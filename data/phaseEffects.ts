export type ItemCategory =
  | "weapon"
  | "armour"
  | "accessory"
  | "item"
  | "consumable"
  | "poison"
  | "material"
  | "weapon-upgrade"
  | "armour-upgrade"
  | "material-refinement"
  | string;

export type PhaseTouchedEffect = {
  id: string;
  name: string;
  appliesTo: "weapon" | "armour" | "accessory" | "item";
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

export function isPhaseTouchedName(name: string): boolean {
  return name.toLowerCase().includes("phase-touched");
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

export function getPhaseTouchedEffectForCategory(
  category: ItemCategory,
  rng: () => number = Math.random
): PhaseTouchedEffect | null {
  const normalized = category.toLowerCase();

  if (normalized === "weapon" || normalized === "weapon-upgrade") return phaseStrike;
  if (normalized === "armour" || normalized === "armor" || normalized === "armour-upgrade" || normalized === "armor-upgrade") return phaseDeflection;
  if (["accessory", "item", "consumable", "poison"].includes(normalized)) return getRandomPhaseAccessoryEffect(rng);
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
