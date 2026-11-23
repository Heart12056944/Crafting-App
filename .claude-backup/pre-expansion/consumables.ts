// Works out whether a crafted item is used up, and how many uses it has, from
// its recipe and outcome text. Anything this gets wrong, the GM can adjust on
// the item in the Inventory tab.

const COUNT_WORDS =
  "servings?|uses?|shots?|drams?|small glasses|glasses|arrows?|bolts?|darts?|torches?|bombs?|charges?|doses?|flasks?|vials?";

const NOT_USED_UP = /reusable|lantern|grapnel|grappling hook|alarm|focus|holy symbol|tattoo|lens|compass|vial frosts/i;

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
  const counted = outcomeText.match(new RegExp(`(\\d+)\\s+(?:${COUNT_WORDS})\\b`, "i"));
  if (counted) return { consumable: true, usesPerItem: Math.max(1, Number(counted[1])) };

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
