// Coin maths for purses and shops. Purses hold real coins (cp, sp, ep, gp, pp);
// prices and values are worked in copper (1 gp = 100 cp).

export const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"] as const;
export type CoinKey = (typeof COIN_KEYS)[number];
export type Coins = Record<CoinKey, number>;

export const COIN_VALUE_CP: Coins = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
export const COIN_NAMES: Record<CoinKey, string> = {
  pp: "Platinum",
  gp: "Gold",
  ep: "Electrum",
  sp: "Silver",
  cp: "Copper",
};

export function emptyCoins(): Coins {
  return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
}

export function coinsToCp(coins: Partial<Coins>): number {
  return COIN_KEYS.reduce((sum, key) => sum + (coins[key] || 0) * COIN_VALUE_CP[key], 0);
}

// "3 gp 5 sp", for prices and values. Uses gold, silver and copper only.
export function formatCp(totalCp: number): string {
  const cp = Math.max(0, Math.round(totalCp));
  if (cp === 0) return "0 cp";
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  const rest = cp % 10;
  return [gp ? `${gp.toLocaleString()} gp` : "", sp ? `${sp} sp` : "", rest ? `${rest} cp` : ""].filter(Boolean).join(" ");
}

// "1 pp, 7 gp, 3 sp", for what is actually in a purse.
export function formatCoins(coins: Partial<Coins>): string {
  const parts = COIN_KEYS.filter((key) => (coins[key] || 0) !== 0).map((key) => `${coins[key]} ${key}`);
  return parts.length ? parts.join(", ") : "empty";
}

// Coins for a payout (selling): gold, silver and copper, fewest coins.
export function changeForCp(totalCp: number): Coins {
  let rest = Math.max(0, Math.round(totalCp));
  const coins = emptyCoins();
  for (const key of ["gp", "sp", "cp"] as const) {
    coins[key] = Math.floor(rest / COIN_VALUE_CP[key]);
    rest -= coins[key] * COIN_VALUE_CP[key];
  }
  return coins;
}

// How a purse pays a price, as coin changes (negative = handed over,
// positive = change received). Pays exactly with the largest coins when it can;
// otherwise hands over the fewest coins that cover it and takes change back in
// gold, silver and copper. Returns null if the purse can't afford it.
export function paymentPlan(purse: Coins, priceCp: number): Coins | null {
  const price = Math.max(0, Math.round(priceCp));
  if (coinsToCp(purse) < price) return null;
  const delta = emptyCoins();
  if (price === 0) return delta;

  // 1. Exact payment, largest coins first.
  let rest = price;
  const exact = emptyCoins();
  for (const key of COIN_KEYS) {
    exact[key] = Math.min(purse[key], Math.floor(rest / COIN_VALUE_CP[key]));
    rest -= exact[key] * COIN_VALUE_CP[key];
  }
  if (rest === 0) {
    for (const key of COIN_KEYS) delta[key] = -exact[key];
    return delta;
  }

  // 2. Cover it from the smallest coins up...
  const spend = emptyCoins();
  let paid = 0;
  for (const key of [...COIN_KEYS].reverse()) {
    if (paid >= price) break;
    const need = Math.ceil((price - paid) / COIN_VALUE_CP[key]);
    spend[key] = Math.min(purse[key], need);
    paid += spend[key] * COIN_VALUE_CP[key];
  }
  // ...then hand back any small coins that turned out not to be needed.
  for (const key of [...COIN_KEYS].reverse()) {
    while (spend[key] > 0 && paid - COIN_VALUE_CP[key] >= price) {
      spend[key] -= 1;
      paid -= COIN_VALUE_CP[key];
    }
  }

  const change = changeForCp(paid - price);
  for (const key of COIN_KEYS) delta[key] = change[key] - spend[key];
  return delta;
}
