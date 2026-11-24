// The party's base. Each facility has levels 0-3; levels give bonuses that the
// rest of the app applies on its own. Saved in campaign_discoveries (kind "homestead").

export type FacilityId = "forge" | "workshop" | "apothecary" | "kitchen" | "infirmary" | "stables" | "training-yard" | "library";

export type Facility = {
  id: FacilityId;
  name: string;
  description: string;
  // What each level gives, level 1 to 3.
  levels: [string, string, string];
  // Crafting tools that get +level to their checks.
  tools?: string[];
};

export const MAX_FACILITY_LEVEL = 3;

// Gold to reach each level (paid from the party fund).
export const UPGRADE_COST_GP = [50, 200, 500];

export const FACILITIES: Facility[] = [
  {
    id: "forge",
    name: "Forge",
    description: "Anvil, bellows and a proper hearth for metalwork.",
    levels: ["+1 to Smith, Tinker and Jeweler checks.", "+2 to those checks.", "+3 to those checks."],
    tools: ["Smith", "Tinker", "Jeweler"],
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Benches, racks and tanning frames for wood, leather and cloth.",
    levels: [
      "+1 to Carpenter, Carver, Woodcarver, Fletcher, Leatherworker, Weaver and Tattoo checks.",
      "+2 to those checks.",
      "+3 to those checks.",
    ],
    tools: ["Carpenter", "Carver", "Woodcarver", "Fletcher", "Leatherworker", "Weaver", "Tattoo Artist Needles"],
  },
  {
    id: "apothecary",
    name: "Apothecary",
    description: "Drying racks, a still and shelves of jars.",
    levels: ["+1 to Alchemist, Poisoner and Herbalism checks.", "+2 to those checks.", "+3 to those checks."],
    tools: ["Alchemist", "Poisoner", "Herbalism Kit"],
  },
  {
    id: "kitchen",
    name: "Kitchen & Smokehouse",
    description: "Ovens, a brewing corner and a smokehouse for curing.",
    levels: ["+1 to Cook's Utensils and Brewer's Supplies checks.", "+2 to those checks.", "+3 to those checks."],
    tools: ["Cook's Utensils", "Brewer's Supplies"],
  },
  {
    id: "infirmary",
    name: "Infirmary",
    description: "Clean beds, bandages and a healer's corner.",
    levels: [
      "+1 to saves against disease while resting here.",
      "+2 to disease saves; injuries heal twice as fast.",
      "+3 to disease saves; injuries heal twice as fast.",
    ],
  },
  {
    id: "stables",
    name: "Stables & Pens",
    description: "Stalls, pens and a hayloft.",
    levels: ["Room for 8 animals.", "Room for 12 animals.", "Room for 20 animals."],
  },
  {
    id: "training-yard",
    name: "Training Yard",
    description: "Practice dummies, targets and space to drill.",
    levels: ["Downtime training takes 10% fewer days.", "20% fewer days.", "30% fewer days."],
  },
  {
    id: "library",
    name: "Library",
    description: "Books, maps and a quiet desk.",
    levels: ["+1 to downtime research rolls.", "+2 to research rolls.", "+3 to research rolls."],
  },
];

export type HomesteadLevels = Partial<Record<FacilityId, number>>;

export function facilityLevel(levels: HomesteadLevels, id: FacilityId) {
  return Math.max(0, Math.min(MAX_FACILITY_LEVEL, levels[id] ?? 0));
}

// Bonus to a crafting check with this tool (recipe.tool is the bare tool name).
export function craftingFacilityBonus(levels: HomesteadLevels, tool: string) {
  const facility = FACILITIES.find((item) => item.tools?.some((name) => tool === name || tool.startsWith(`${name} `)));
  if (!facility) return null;
  const level = facilityLevel(levels, facility.id);
  return level ? { bonus: level, facility: facility.name } : null;
}

export function animalCapacity(levels: HomesteadLevels) {
  return [4, 8, 12, 20][facilityLevel(levels, "stables")];
}

export function diseaseSaveBonus(levels: HomesteadLevels) {
  return facilityLevel(levels, "infirmary");
}

export function injuryHealRate(levels: HomesteadLevels) {
  return facilityLevel(levels, "infirmary") >= 2 ? 2 : 1;
}

export function trainingDiscount(levels: HomesteadLevels) {
  return facilityLevel(levels, "training-yard") * 0.1;
}

export function researchBonus(levels: HomesteadLevels) {
  return facilityLevel(levels, "library");
}
