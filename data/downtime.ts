// Downtime: what a character does with a day the party isn't adventuring.
// Set on the My Character tab; worked through on Pass Day.

export type DowntimeActivity = "none" | "training" | "work" | "recuperate" | "research" | "carousing";

export type Downtime = {
  activity: DowntimeActivity;
  // Training: the tool to learn. Research: the topic.
  target?: string;
  daysDone?: number;
};

export const DOWNTIME_ACTIVITIES: { id: DowntimeActivity; label: string; description: string; costCp: number }[] = [
  { id: "none", label: "Adventuring", description: "No downtime: the character is busy with the party.", costCp: 0 },
  {
    id: "training",
    label: "Training",
    description: "Learn a tool proficiency from a teacher: 5 gp a day, for (10 − INT modifier) workweeks of 5 days, less with a training yard.",
    costCp: 500,
  },
  {
    id: "work",
    label: "Working",
    description: "Earn coin with your best ability: a d20 roll each day pays 1 sp (under 10), 5 sp (10–14), 1 gp (15–20) or 2 gp (21+).",
    costCp: 0,
  },
  {
    id: "recuperate",
    label: "Recuperating",
    description: "Bed rest: advantage on saves against disease, and injuries heal a day faster.",
    costCp: 0,
  },
  {
    id: "research",
    label: "Researching",
    description: "Dig into a topic: 1 gp a day for books and bribes. Each day's INT roll (plus a library) goes in the journal for the GM to answer.",
    costCp: 100,
  },
  {
    id: "carousing",
    label: "Carousing",
    description: "Drink, gamble and make friends: 1 gp a day. A CHA roll each day can make contacts, or trouble.",
    costCp: 100,
  },
];

export function trainingDaysNeeded(intModifier: number, discount: number) {
  const workweeks = Math.max(1, 10 - intModifier);
  return Math.max(1, Math.ceil(workweeks * 5 * (1 - discount)));
}

export function workPayCp(total: number) {
  if (total >= 21) return 200;
  if (total >= 15) return 100;
  if (total >= 10) return 50;
  return 10;
}

export function carousingResult(total: number) {
  if (total <= 5) return "made an enemy, or got into a fight (GM's call)";
  if (total <= 10) return "had a good night and nothing more";
  if (total <= 15) return "made a friendly contact";
  if (total <= 20) return "made two friendly contacts";
  return "made three friendly contacts, one of them well placed";
}
