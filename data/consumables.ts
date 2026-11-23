// Works out whether a crafted item is used up, and how many uses it has, from
// its recipe and outcome text. Anything this gets wrong, the GM can adjust on
// the item in the Inventory tab.

const COUNT_WORDS =
  "servings?|uses?|shots?|drams?|small glasses|glasses|arrows?|bolts?|darts?|torches?|bombs?|charges?|doses?|flasks?|vials?|bullets?|javelins?|applications?|rations?|days of trail food|folds?|pockets?|skewers?|sausages?";

const NOT_USED_UP =
  /reusable|lantern|grapnel|grappling hook|alarm|focus|holy symbol|tattoo|lens|compass|vial frosts|fishing rod|climbing kit|crampons|snowshoes|\btent\b|bedroll|whistle|\bmap\b|cipher key|once per (short|long) rest|once per day/i;

export type ConsumableInfo = {
  consumable: boolean;
  usesPerItem: number;
};

export function consumableInfo(
  recipe: { category: string; tags: string[]; name: string },
  outcomeText: string
): ConsumableInfo {
  const text = `${recipe.name} ${outcomeText}`;

  // "4 servings", "10 uses", "20 arrows", "5 torches", "A cask of 6 servings"
  // Up to two describing words may sit between: "20 crossbow bolts", "10 iron sling bullets".
  const counted = outcomeText.match(new RegExp(`(\\d+)\\s+(?:[a-z'-]+\\s+){0,2}?(?:${COUNT_WORDS})\\b`, "i"));
  if (counted) return { consumable: true, usesPerItem: Math.max(1, Number(counted[1])) };
  const feeds = outcomeText.match(/feeds (\d+)/i);
  if (feeds) return { consumable: true, usesPerItem: Math.max(1, Number(feeds[1])) };

  if (/works twice/i.test(outcomeText)) return { consumable: true, usesPerItem: 2 };
  if (/resets twice/i.test(outcomeText)) return { consumable: true, usesPerItem: 3 };
  if (/single use|single-use/i.test(outcomeText)) return { consumable: true, usesPerItem: 1 };

  if (NOT_USED_UP.test(text)) return { consumable: false, usesPerItem: 0 };

  const category = recipe.category.toLowerCase();
  const tags = recipe.tags.map((tag) => tag.toLowerCase());
  if (["potion", "poison", "consumable"].includes(category)) return { consumable: true, usesPerItem: 1 };
  if (tags.includes("throwable")) return { consumable: true, usesPerItem: 1 };
  // Traps, charges, ward lines, incense, oils: one-shot unless marked otherwise.
  if (tags.includes("utility")) return { consumable: true, usesPerItem: 1 };

  return { consumable: false, usesPerItem: 0 };
}
