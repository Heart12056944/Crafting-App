// Prices that react. Each shop remembers how much of each item the party has
// recently bought from it and sold to it. Buying a lot pushes the price up;
// selling a lot floods the market and the shop pays less. The effect fades by
// one unit a day.

export type MarketEntry = { bought?: number; sold?: number; day?: number };
export type Market = Record<string, MarketEntry>;

export function marketPressure(entry: MarketEntry | undefined, today: number) {
  if (!entry) return { bought: 0, sold: 0 };
  const elapsed = Math.max(0, today - (entry.day ?? today));
  return { bought: Math.max(0, (entry.bought ?? 0) - elapsed), sold: Math.max(0, (entry.sold ?? 0) - elapsed) };
}

// 1 = normal. Each recent purchase +4%, each recent sale −6%, between ×0.5 and ×1.75.
export function marketFactor(market: Market | undefined, item: string, today: number) {
  const { bought, sold } = marketPressure(market?.[item], today);
  return Math.max(0.5, Math.min(1.75, 1 + 0.04 * bought - 0.06 * sold));
}

export function marketNote(factor: number) {
  if (factor >= 1.15) return "in demand: prices up";
  if (factor > 1.001) return "selling fast";
  if (factor <= 0.8) return "flooded: prices down";
  if (factor < 0.999) return "plenty about";
  return "";
}

// standing: the faction discount (0.1 = 10% off; negative = a surcharge).
export function buyPriceCp(baseCp: number, factor: number, standing: number) {
  return Math.max(1, Math.round(baseCp * factor * (1 - standing)));
}

// Friendly factions pay a little more for what you sell; unfriendly ones less.
export function sellPriceCp(baseSellCp: number, factor: number, standing: number) {
  return Math.max(1, Math.floor(baseSellCp * factor * (1 + standing / 2)));
}
