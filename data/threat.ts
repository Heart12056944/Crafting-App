// The threat clock: a GM-only measure (0-100) of how bad things are getting
// beyond the Wall. It rises with time (a set amount per month) and when the GM
// says so. Higher stages make undead more likely on the bounty board and post
// GM-only rumours to reveal when it suits the story.

export type ThreatStage = { min: number; name: string; note: string; undeadWeight: number; encounters: string; rumours: string[] };

export const THREAT_STAGES: ThreatStage[] = [
  {
    min: 0,
    name: "Quiet",
    note: "The dead keep to the Interior. Patrols are dull, and that's the way the Order likes it.",
    undeadWeight: 1,
    encounters: "Undead encounters are rare and alone.",
    rumours: [],
  },
  {
    min: 20,
    name: "Stirring",
    note: "More Brainless at the Wall than usual. The old patrollers say they've seen it before; they don't sound sure.",
    undeadWeight: 1.5,
    encounters: "Brainless come in twos and threes; the odd directed one among them.",
    rumours: [
      "A patrol came back a day late, swearing the Brainless they found had been waiting in a line.",
      "Shepherds on the high pastures say the ravens have gone quiet.",
    ],
  },
  {
    min: 40,
    name: "Rising",
    note: "Organised movements beyond the Wall. Directed Brainless are no longer a curiosity.",
    undeadWeight: 2,
    encounters: "Groups of Brainless led by directed ones; skeletons with old weapons and older tactics.",
    rumours: [
      "A Compact courier insists the dead tried the same gate three nights running, as if testing it.",
      "Someone has been seen walking the snowline at night in Order robes. No one in the Order is missing.",
    ],
  },
  {
    min: 60,
    name: "Surging",
    note: "Attacks are coordinated. Something is directing the dead with purpose.",
    undeadWeight: 3,
    encounters: "Raids by mixed undead forces with a clear leader; skeleton knights and mages in the field.",
    rumours: [
      "Two Wall outposts went dark on the same night, forty miles apart.",
      "A trader swears a man he dined with last spring was buried beyond the Wall years ago.",
    ],
  },
  {
    min: 80,
    name: "Breaking",
    note: "The Wall is under real pressure. Whatever drives the dead is close to its goal.",
    undeadWeight: 4,
    encounters: "Sieges, not raids. Death knights and worse take the field.",
    rumours: [
      "The ground shook in the high Thornspine, and the snow fell off a peak that has never shed it.",
      "The Vigil Fire burned low for a heartbeat last night. Everyone in the chamber felt it.",
    ],
  },
];

export function threatStage(value: number) {
  return [...THREAT_STAGES].reverse().find((stage) => value >= stage.min) || THREAT_STAGES[0];
}

export type ThreatSettings = { value: number; perMonth: number; progress: number };

export function readThreat(values: Record<string, string>): ThreatSettings {
  return {
    value: Math.max(0, Math.min(100, Number(values.value) || 0)),
    perMonth: values.perMonth !== undefined ? Math.max(0, Number(values.perMonth) || 0) : 1,
    progress: Number(values.progress) || 0,
  };
}

// Advance the clock by some days. Returns the new value, leftover progress, and any stages crossed.
export function advanceThreat(threat: ThreatSettings, days: number) {
  const gain = threat.progress + (threat.perMonth * days) / 30;
  const whole = Math.floor(gain);
  const value = Math.min(100, threat.value + whole);
  const crossed = THREAT_STAGES.filter((stage) => stage.min > threat.value && stage.min <= value);
  return { value, progress: gain - whole, crossed };
}
