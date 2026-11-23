// Husbandry: prey animals the party keeps. Wild ones are tamed (Animal
// Handling) or convinced (a druid, a ranger, or anyone who can speak with
// animals); farm animals are bought. Each animal yields materials on a
// schedule counted in campaign days (advanced by the GM's Pass Day).

export type AnimalSex = "female" | "male";

export type HusbandryProduct = {
  id: string;
  label: string; // the action, e.g. "Milk", "Shear"
  // One material, or a weighted choice of several (a boar rooting for food).
  materials: { name: string; weight: number }[];
  amount: string; // dice or a number
  everyDays: number;
  sex?: AnimalSex; // only animals of this sex produce it
};

export type HusbandrySpecies = {
  id: string;
  name: string;
  origin: "wild" | "farm";
  region: string;
  // Wild animals: Animal Handling DC to tame. Convincing (druid, ranger,
  // Speak with Animals) is 2 lower and rolled with advantage.
  tameDc?: number;
  // Farm animals: a suggested price in copper.
  priceCp?: number;
  looks: string;
  temperament: string;
  products: HusbandryProduct[];
};

const one = (name: string) => [{ name, weight: 1 }];

export const HUSBANDRY_SPECIES: HusbandrySpecies[] = [
  {
    id: "mountain-ram",
    name: "Mountain Ram",
    origin: "wild",
    region: "Thornspine, past the Wall",
    tameDc: 14,
    looks: "A heavy-shouldered mountain sheep with a coarse, oily grey fleece. Rams carry great curled horns; ewes, short spikes.",
    temperament: "Stubborn but calm once it trusts you. Follows whoever feeds it.",
    products: [
      { id: "shear", label: "Shear", materials: one("Ram's Wool"), amount: "1d4", everyDays: 7 },
      { id: "milk", label: "Milk", materials: one("Ewe's Milk"), amount: "1d2", everyDays: 1, sex: "female" },
    ],
  },
  {
    id: "ridge-stag",
    name: "Ridge Stag",
    origin: "wild",
    region: "Thornspine, past the Wall",
    tameDc: 16,
    looks: "A tall, grey-brown deer with a pale rump. Stags grow branching antlers and shed them each season; hinds are smaller and hornless.",
    temperament: "Skittish. Bolts at sudden noise, and never fully stops watching you.",
    products: [
      { id: "milk", label: "Milk", materials: one("Hind's Milk"), amount: "1", everyDays: 1, sex: "female" },
      { id: "shed", label: "Collect shed antler", materials: one("Antler Tine"), amount: "1d2", everyDays: 30, sex: "male" },
    ],
  },
  {
    id: "tuskback-boar",
    name: "Tuskback Boar",
    origin: "wild",
    region: "Thornspine, past the Wall",
    tameDc: 17,
    looks: "A low, barrel-bodied boar with a ridge of black bristles down its spine and short, sharp tusks.",
    temperament: "Ornery and greedy. Will root out food for you, and will bite if you're slow sharing it.",
    products: [
      {
        id: "root",
        label: "Let it root for food",
        materials: [
          { name: "Scree Tuber", weight: 50 },
          { name: "Hollowcap", weight: 30 },
          { name: "Graveroot", weight: 20 },
        ],
        amount: "1d2",
        everyDays: 1,
      },
    ],
  },
  {
    id: "reedfowl",
    name: "Reedfowl",
    origin: "wild",
    region: "Thornspine tarns",
    tameDc: 12,
    looks: "A plump, grey-green waterbird with a short orange bill and a loud, honking call.",
    temperament: "Noisy, nosy and easily bribed with seed.",
    products: [{ id: "eggs", label: "Collect eggs", materials: one("Reedfowl Egg"), amount: "1", everyDays: 1, sex: "female" }],
  },
  {
    id: "valdren-kine",
    name: "Valdren Kine",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 1000,
    looks: "A broad, shaggy red-brown farm cow with short, wide horns and a placid face.",
    temperament: "Patient and slow. Needs good grazing and a lot of water.",
    products: [{ id: "milk", label: "Milk", materials: one("Kine Milk"), amount: "1d3", everyDays: 1, sex: "female" }],
  },
  {
    id: "valdren-hog",
    name: "Valdren Hog",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 300,
    looks: "A heavy, pale pink farm pig with a few black blotches, floppy ears and a curly tail.",
    temperament: "Clever, greedy and always hungry. Roots up anything edible in its pen.",
    products: [
      {
        id: "root",
        label: "Let it root for food",
        materials: [
          { name: "Scree Tuber", weight: 60 },
          { name: "Hollowcap", weight: 40 },
        ],
        amount: "1",
        everyDays: 2,
      },
    ],
  },
  {
    id: "coop-fowl",
    name: "Coop Fowl",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 20,
    looks: "A small, speckled brown farmyard bird with a red comb.",
    temperament: "Scatterbrained. Lays wherever it likes.",
    products: [{ id: "eggs", label: "Collect eggs", materials: one("Coop Egg"), amount: "1", everyDays: 1, sex: "female" }],
  },
  {
    id: "skerry-goat",
    name: "Skerry Goat",
    origin: "farm",
    region: "Romley islands",
    priceCp: 100,
    looks: "A small, sure-footed black-and-white goat with a wispy beard, bred to live on rocky islets and ship decks.",
    temperament: "Eats anything, including rope. Never seasick.",
    products: [{ id: "milk", label: "Milk", materials: one("Goat's Milk"), amount: "1d2", everyDays: 1, sex: "female" }],
  },
];

export const speciesById = new Map(HUSBANDRY_SPECIES.map((species) => [species.id, species]));

// Products this animal gives, given its sex.
export function productsFor(species: HusbandrySpecies, sex: AnimalSex) {
  return species.products.filter((product) => !product.sex || product.sex === sex);
}

// Days until a product is ready again (0 = ready now).
export function daysUntilReady(product: HusbandryProduct, lastCollectedDay: number | undefined, today: number) {
  if (lastCollectedDay === undefined) return 0;
  return Math.max(0, lastCollectedDay + product.everyDays - today);
}

export function pickProductMaterial(product: HusbandryProduct, roll: number) {
  const total = product.materials.reduce((sum, item) => sum + item.weight, 0);
  let point = roll * total;
  for (const item of product.materials) {
    point -= item.weight;
    if (point < 0) return item.name;
  }
  return product.materials[product.materials.length - 1].name;
}
