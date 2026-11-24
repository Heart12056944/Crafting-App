// Lingering injuries and diseases. Both live on the character
// (character.afflictions) and are worked through on Pass Day.

export type InjuryDef = {
  key: string;
  name: string;
  effect: string;
  // Days of rest to heal; null = permanent (or needs powerful magic such as Regenerate).
  healDays: number | null;
};

export type DiseaseDef = {
  key: string;
  name: string;
  caughtFrom: string;
  dc: number;
  // What it does at stage 1, 2 and 3.
  stages: [string, string, string];
  // Items that cure it outright, and items that give advantage on the next save.
  cures: string[];
  helps: string[];
};

export type Affliction = {
  id: string;
  type: "injury" | "disease";
  key: string;
  since: number;
  // Injuries: days of rest left.
  daysLeft?: number | null;
  // Diseases: current stage (1-3), saves made in a row, and advantage on the next save.
  stage?: number;
  successes?: number;
  helped?: boolean;
};

// Lingering injuries (roll a d20 when a character drops to 0 HP or takes a
// critical hit, if the table uses them).
export const INJURY_TABLE: { min: number; max: number; injury: InjuryDef }[] = [
  {
    min: 1,
    max: 1,
    injury: { key: "lost-eye", name: "Lost an eye", effect: "Disadvantage on Perception checks that rely on sight and on ranged attack rolls.", healDays: null },
  },
  {
    min: 2,
    max: 2,
    injury: { key: "lost-hand", name: "Lost a hand", effect: "You can no longer hold anything with two hands, and only one object at a time.", healDays: null },
  },
  {
    min: 3,
    max: 3,
    injury: { key: "lost-foot", name: "Lost a foot", effect: "Speed halved; you need a cane or crutch, and fall prone after the Dash action.", healDays: null },
  },
  {
    min: 4,
    max: 4,
    injury: { key: "limp", name: "Limp", effect: "Speed −5 ft. After Dash, DC 10 DEX save or fall prone.", healDays: 14 },
  },
  {
    min: 5,
    max: 7,
    injury: { key: "internal", name: "Internal injury", effect: "When you try an action in combat, DC 15 CON save or lose the action.", healDays: 10 },
  },
  {
    min: 8,
    max: 10,
    injury: { key: "broken-ribs", name: "Broken ribs", effect: "When you try an action in combat, DC 10 CON save or lose the action.", healDays: 7 },
  },
  {
    min: 11,
    max: 13,
    injury: { key: "horrible-scar", name: "Horrible scar", effect: "Disadvantage on Persuasion, advantage on Intimidation.", healDays: null },
  },
  {
    min: 14,
    max: 16,
    injury: { key: "festering", name: "Festering wound", effect: "HP maximum −1 each day until healed; it can turn into wound fever.", healDays: 10 },
  },
  {
    min: 17,
    max: 20,
    injury: { key: "minor-scar", name: "Minor scar", effect: "No lasting effect; a story to tell.", healDays: 0 },
  },
];

export const INJURIES: InjuryDef[] = INJURY_TABLE.map((row) => row.injury);

export function rollInjury() {
  const roll = Math.floor(Math.random() * 20) + 1;
  return { roll, injury: INJURY_TABLE.find((row) => roll >= row.min && roll <= row.max)!.injury };
}

export const DISEASES: DiseaseDef[] = [
  {
    key: "grave-rot",
    name: "Grave rot",
    caughtFrom: "Bites and scratches from the Brainless and other undead.",
    dc: 13,
    stages: [
      "The wound greys and smells of the grave. −1 to CON saves.",
      "Fever and numb fingers: disadvantage on STR and DEX checks; HP maximum −1d4 each day.",
      "Grey veins spread from the wound: 1 level of exhaustion each day you fail the save.",
    ],
    cures: ["Rotbane Poultice", "Bitterleaf Draught"],
    helps: ["Stillwater Salve", "Antitoxin Tea"],
  },
  {
    key: "marsh-ague",
    name: "Marsh ague",
    caughtFrom: "Bad water and biting flies around the tarns.",
    dc: 11,
    stages: [
      "Chills in the evenings. No effect in daylight.",
      "Shaking fever: disadvantage on attack rolls and ability checks after a short rest.",
      "Delirium: disadvantage on all ability checks; 1 level of exhaustion each day you fail the save.",
    ],
    cures: ["Bitterleaf Draught"],
    helps: ["Antitoxin Tea", "Sourbell Draught"],
  },
  {
    key: "wound-fever",
    name: "Wound fever",
    caughtFrom: "Dirty claws, festering wounds and filthy blades.",
    dc: 12,
    stages: ["The wound is hot and red. −1 to attack rolls.", "Fever: disadvantage on CON saves.", "Raging fever: 1 level of exhaustion each day you fail the save."],
    cures: ["Bitterleaf Draught", "Bitterleaf Poultice"],
    helps: ["Antitoxin Tea"],
  },
  {
    key: "frostbite",
    name: "Frostbite",
    caughtFrom: "A night in extreme cold without shelter or cold-weather gear.",
    dc: 10,
    stages: ["Numb fingers and toes: −1 to DEX checks.", "Blackening skin: speed −5 ft and disadvantage on DEX checks.", "Dead flesh: lose a finger or toe (GM's call) unless cured today."],
    cures: ["Thistle Frost Balm"],
    helps: ["Cold-Water Tonic"],
  },
  {
    key: "rattle-cough",
    name: "Rattle cough",
    caughtFrom: "Cramped, cold winter quarters and sick companions.",
    dc: 11,
    stages: ["A wet cough. Disadvantage on Stealth.", "Short of breath: you can't Dash for more than 1 round.", "Fluid on the lungs: 1 level of exhaustion each day you fail the save."],
    cures: ["Bitterleaf Draught"],
    helps: ["Sleepcup", "Antitoxin Tea"],
  },
];

export const injuryByKey = new Map(INJURIES.map((injury) => [injury.key, injury]));
export const diseaseByKey = new Map(DISEASES.map((disease) => [disease.key, disease]));

// Three saves in a row cure a disease.
export const SAVES_TO_RECOVER = 3;

export function afflictionName(affliction: Affliction) {
  return affliction.type === "injury" ? injuryByKey.get(affliction.key)?.name || affliction.key : diseaseByKey.get(affliction.key)?.name || affliction.key;
}

export function afflictionEffect(affliction: Affliction) {
  if (affliction.type === "injury") return injuryByKey.get(affliction.key)?.effect || "";
  const disease = diseaseByKey.get(affliction.key);
  return disease ? disease.stages[Math.max(0, Math.min(2, (affliction.stage || 1) - 1))] : "";
}

export const newAfflictionId = () => Math.random().toString(36).slice(2, 10);

// One day passes. conMod: CON modifier; bonus: infirmary etc.; advantage: resting / treated.
export function progressAffliction(
  affliction: Affliction,
  options: { conMod: number; bonus: number; advantage: boolean; healRate: number }
): { next: Affliction | null; line: string; exhaustion: number } {
  if (affliction.type === "injury") {
    const injury = injuryByKey.get(affliction.key);
    if (!injury || injury.healDays === null || affliction.daysLeft === null) return { next: affliction, line: "", exhaustion: 0 };
    const daysLeft = Math.max(0, (affliction.daysLeft ?? injury.healDays) - options.healRate);
    if (daysLeft === 0) return { next: null, line: `${injury.name} has healed.`, exhaustion: 0 };
    return { next: { ...affliction, daysLeft }, line: "", exhaustion: 0 };
  }

  const disease = diseaseByKey.get(affliction.key);
  if (!disease) return { next: null, line: "", exhaustion: 0 };
  const first = Math.floor(Math.random() * 20) + 1;
  const second = Math.floor(Math.random() * 20) + 1;
  const advantage = options.advantage || affliction.helped;
  const natural = advantage ? Math.max(first, second) : first;
  const total = natural + options.conMod + options.bonus;
  const stage = affliction.stage || 1;
  const rollText = `${natural}${advantage ? " (adv)" : ""} ${options.conMod + options.bonus >= 0 ? "+" : "−"} ${Math.abs(options.conMod + options.bonus)} = ${total} vs DC ${disease.dc}`;
  if (total >= disease.dc) {
    const successes = (affliction.successes || 0) + 1;
    if (successes >= SAVES_TO_RECOVER) return { next: null, line: `${disease.name}: save ${rollText}. Recovered!`, exhaustion: 0 };
    return {
      next: { ...affliction, successes, helped: false, stage: Math.max(1, stage - (successes >= 2 ? 1 : 0)) },
      line: `${disease.name}: save ${rollText}, ${successes}/${SAVES_TO_RECOVER} towards recovery.`,
      exhaustion: 0,
    };
  }
  const nextStage = Math.min(3, stage + 1);
  return {
    next: { ...affliction, stage: nextStage, successes: 0, helped: false },
    line: `${disease.name}: save ${rollText}, failed. ${stage === 3 ? "It holds at its worst" : `Now stage ${nextStage}`}.`,
    exhaustion: stage === 3 ? 1 : 0,
  };
}
