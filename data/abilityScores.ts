import attributeCardsJson from "./attributes/attributeCards.json";

// Ability scores, race-card bonuses and the modifiers derived from them.
// Race cards carry "statBonuses" (fixed) and optional "statChoices" (subraces
// or "pick N abilities") in attributeCards.json, so new races need no code.

export type Stat = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export const STAT_KEYS: Stat[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export type StatChoice = {
  label: string;
  // Pick one named option (e.g. a subrace)...
  options?: { label: string; bonuses: Partial<Record<Stat, number>> }[];
  // ...or pick N abilities that each get `amount`.
  pick?: number;
  amount?: number;
  exclude?: Stat[];
};

export type StatCard = {
  id: number;
  name: string;
  tags: string[];
  statBonuses?: Partial<Record<Stat, number>>;
  statChoices?: StatChoice[];
};

const statCards = new Map<number, StatCard>(
  (attributeCardsJson as StatCard[])
    .filter((card) => card.statBonuses || card.statChoices)
    .map((card) => [Number(card.id), card])
);

export function scoreToModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function emptyStats(value = 0): Record<Stat, number> {
  return { STR: value, DEX: value, CON: value, INT: value, WIS: value, CHA: value };
}

export function choiceKey(cardId: number, index: number) {
  return `${cardId}-${index}`;
}

export type AppliedStatCard = {
  card: StatCard;
  // True when a "Race Base Score" card is also assigned: its boosted bonuses
  // replace this plain race card's, so they aren't counted twice.
  ignored: boolean;
};

export function statCardsFor(cardIds: number[]): AppliedStatCard[] {
  const cards = [...new Set(cardIds)]
    .map((id) => statCards.get(Number(id)))
    .filter((card): card is StatCard => Boolean(card));
  const hasBaseScore = cards.some((card) => card.tags.includes("Race Base Score"));
  return cards.map((card) => ({ card, ignored: hasBaseScore && card.tags.includes("Race") }));
}

function formatBonuses(bonuses: Partial<Record<Stat, number>>) {
  return STAT_KEYS.filter((stat) => bonuses[stat])
    .map((stat) => `${(bonuses[stat] ?? 0) > 0 ? "+" : ""}${bonuses[stat]} ${stat}`)
    .join(", ");
}

// Total ability score bonus from a character's cards, plus readable lines.
export function cardStatBonuses(
  cardIds: number[],
  choices: Record<string, string[]> | undefined
): { total: Record<Stat, number>; lines: string[]; unmadeChoices: number } {
  const total = emptyStats();
  const lines: string[] = [];
  let unmadeChoices = 0;

  for (const { card, ignored } of statCardsFor(cardIds)) {
    if (ignored) {
      lines.push(`${card.name}: covered by the Base Score card`);
      continue;
    }
    const cardTotal: Partial<Record<Stat, number>> = { ...(card.statBonuses || {}) };

    (card.statChoices || []).forEach((choice, index) => {
      const selected = choices?.[choiceKey(card.id, index)] || [];
      if (choice.options) {
        const option = choice.options.find((item) => item.label === selected[0]);
        if (!option) {
          unmadeChoices += 1;
          return;
        }
        for (const stat of STAT_KEYS) {
          if (option.bonuses[stat]) cardTotal[stat] = (cardTotal[stat] ?? 0) + (option.bonuses[stat] ?? 0);
        }
      } else if (choice.pick) {
        const picked = selected
          .filter((stat): stat is Stat => STAT_KEYS.includes(stat as Stat) && !(choice.exclude || []).includes(stat as Stat))
          .slice(0, choice.pick);
        if (picked.length < choice.pick) unmadeChoices += 1;
        for (const stat of picked) cardTotal[stat] = (cardTotal[stat] ?? 0) + (choice.amount ?? 1);
      }
    });

    for (const stat of STAT_KEYS) total[stat] += cardTotal[stat] ?? 0;
    const text = formatBonuses(cardTotal);
    if (text) lines.push(`${card.name}: ${text}`);
  }

  return { total, lines, unmadeChoices };
}

// Flat proficiency scale the codex already uses for tools.
export const SKILL_PROFICIENCY_BONUS = { none: 0, proficient: 2, expertise: 4 } as const;
export type SkillProficiency = keyof typeof SKILL_PROFICIENCY_BONUS;

export function harvestingTotal(wisModifier: number, proficiency: SkillProficiency, bonus: number) {
  return wisModifier + SKILL_PROFICIENCY_BONUS[proficiency] + bonus;
}
