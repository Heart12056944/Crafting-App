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
  // Animals that can be ridden. See MOUNT_RULES for how they work in combat.
  mount?: MountStats;
};

export type MountStats = {
  size: "Medium" | "Large";
  ac: number;
  hp: number;
  speed: number; // feet
  carryLb: number;
  attack: { name: string; bonus: number; damage: string; type: string };
  // War-trained mounts can attack while you control them, and charge harder.
  warTrained: boolean;
  // Wild mounts act on their own initiative (independent) unless the rider masters them.
  independent?: boolean;
  trait?: string;
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
    mount: {
      size: "Large",
      ac: 10,
      hp: 13,
      speed: 50,
      carryLb: 390,
      attack: { name: "Ram", bonus: 5, damage: "1d6+3", type: "bludgeoning" },
      warTrained: false,
      independent: true,
      trait: "Sure-footed: ignores difficult terrain from snow, scree and broken ground.",
    },
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
    mount: {
      size: "Large",
      ac: 12,
      hp: 42,
      speed: 40,
      carryLb: 450,
      attack: { name: "Tusk", bonus: 5, damage: "2d6+3", type: "slashing" },
      warTrained: true,
      independent: true,
      trait: "Relentless (once per Pass Day): if it would drop to 0 HP from 10 damage or less, it drops to 1 HP instead.",
    },
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
    id: "thornspine-wolf",
    name: "Thornspine Wolf",
    origin: "wild",
    region: "Thornspine, past the Wall",
    tameDc: 17,
    looks: "A lean grey wolf with a dark saddle of fur and pale eyes.",
    temperament: "Wary and proud. Once it accepts you, it guards the camp and follows your lead.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 2 }],
  },
  {
    id: "thornspine-direwolf",
    name: "Thornspine Direwolf",
    origin: "wild",
    region: "Thornspine high passes",
    tameDc: 18,
    looks: "A wolf the size of a pony, charcoal-furred, with a scarred muzzle.",
    temperament: "Dominant and testing. It obeys the strongest; prove you are.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1d2", everyDays: 2 }],
    mount: { size: "Large", ac: 14, hp: 37, speed: 50, carryLb: 510, attack: { name: "Bite", bonus: 5, damage: "2d6+3", type: "piercing" }, warTrained: true, independent: true, trait: "Pack Tactics: advantage on attacks against a creature an ally is next to. Carries Medium riders only if they have mastered it." },
  },
  {
    id: "ridge-fox",
    name: "Ridge Fox",
    origin: "wild",
    region: "Thornspine slopes",
    tameDc: 17,
    looks: "A small russet fox with a white winter ruff and a huge brush of a tail.",
    temperament: "Curious, sly and easily bored. Steals anything shiny.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 3 }],
  },
  {
    id: "scree-jackal",
    name: "Scree Jackal",
    origin: "wild",
    region: "Thornspine scree fields",
    tameDc: 17,
    looks: "A rangy, sandy-grey wild dog with big ears and a yipping bark.",
    temperament: "Skittish alone, bold in a pack. Warns of anything approaching.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 2 }],
  },
  {
    id: "feral-hound",
    name: "Feral Hound",
    origin: "wild",
    region: "Abandoned Valdren farms",
    tameDc: 17,
    looks: "A big, mud-brown farm dog gone wild, ribs showing under a matted coat.",
    temperament: "Remembers people. Hard to win back, then fiercely loyal.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 2 }],
  },
  {
    id: "snow-cat",
    name: "Snow Cat",
    origin: "wild",
    region: "Thornspine snowline",
    tameDc: 17,
    looks: "A thick-furred white cat as big as a large dog, with a long tail it wraps round itself in the cold.",
    temperament: "Aloof and silent. Comes and goes as it pleases, but always comes back.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 3 }],
  },
  {
    id: "valdren-mouser",
    name: "Valdren Mouser",
    origin: "wild",
    region: "Valdren barns and villages",
    tameDc: 17,
    looks: "A scruffy tabby farm cat with a torn ear.",
    temperament: "Independent. Keeps the stores free of rats and accepts you as staff.",
    products: [],
  },
  {
    id: "crag-lynx",
    name: "Crag Lynx",
    origin: "wild",
    region: "Thornspine forests",
    tameDc: 17,
    looks: "A spotted grey lynx with black ear tufts and huge furred paws.",
    temperament: "Shy and patient. Hunts at dusk and dawn.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1", everyDays: 3 }],
  },
  {
    id: "ridge-panther",
    name: "Ridge Panther",
    origin: "wild",
    region: "Thornspine forests and ledges",
    tameDc: 18,
    looks: "A sleek, near-black great cat with faint rosettes and gold eyes.",
    temperament: "Proud and solitary. It allows company rather than seeking it.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1d2", everyDays: 3 }],
  },
  {
    id: "thornspine-sabretooth",
    name: "Thornspine Sabretooth",
    origin: "wild",
    region: "Thornspine high valleys",
    tameDc: 19,
    looks: "A massive tawny cat striped with smoke-grey, with fangs like curved daggers.",
    temperament: "Fearless and territorial. Taming one is the stuff of songs.",
    products: [{ id: "hunt", label: "Let it hunt", materials: one("Raw Game Meat"), amount: "1d3", everyDays: 3 }],
    mount: { size: "Large", ac: 12, hp: 52, speed: 40, carryLb: 540, attack: { name: "Bite", bonus: 6, damage: "1d10+5", type: "piercing" }, warTrained: true, independent: true, trait: "Pounce: if it moves 20 ft straight at a creature and hits with a claw, the target makes a DC 14 STR save or is knocked prone." },
  },
  {
    id: "riding-horse",
    name: "Riding Horse",
    origin: "farm",
    region: "Valdren stables",
    priceCp: 7500,
    looks: "A lean, long-legged bay horse with a white blaze.",
    temperament: "Quick and willing, but nervous in a fight.",
    products: [],
    mount: { size: "Large", ac: 11, hp: 13, speed: 60, carryLb: 480, attack: { name: "Hooves", bonus: 5, damage: "1d8+3", type: "bludgeoning" }, warTrained: false },
  },
  {
    id: "draft-horse",
    name: "Draft Horse",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 5000,
    looks: "A huge, feathered-footed black horse with a broad back.",
    temperament: "Slow, unflappable and strong enough to pull a cart out of a ditch.",
    products: [],
    mount: { size: "Large", ac: 10, hp: 15, speed: 40, carryLb: 540, attack: { name: "Hooves", bonus: 6, damage: "1d4+4", type: "bludgeoning" }, warTrained: false },
  },
  {
    id: "warhorse",
    name: "Warhorse",
    origin: "farm",
    region: "Bred for the Wall's riders",
    priceCp: 40000,
    looks: "A heavy grey charger with a scarred chest and a calm, steady eye.",
    temperament: "Trained not to flinch at steel, fire or the dead.",
    products: [],
    mount: {
      size: "Large",
      ac: 11,
      hp: 19,
      speed: 60,
      carryLb: 540,
      attack: { name: "Hooves", bonus: 6, damage: "2d6+4", type: "bludgeoning" },
      warTrained: true,
      trait: "Steady: advantage on checks and saves against being frightened or spooked.",
    },
  },
  {
    id: "pony",
    name: "Pony",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 3000,
    looks: "A stocky, shaggy little dun pony.",
    temperament: "Stubborn, hardy and fond of apples. Carries Small riders only.",
    products: [],
    mount: { size: "Medium", ac: 10, hp: 11, speed: 40, carryLb: 225, attack: { name: "Hooves", bonus: 4, damage: "1d4+2", type: "bludgeoning" }, warTrained: false },
  },
  {
    id: "mule",
    name: "Mule",
    origin: "farm",
    region: "Valdren farms",
    priceCp: 800,
    looks: "A long-eared, rough-coated brown mule.",
    temperament: "Sure-footed and patient; refuses anything it thinks is a bad idea. Carries Small riders, or packs.",
    products: [],
    mount: {
      size: "Medium",
      ac: 10,
      hp: 11,
      speed: 40,
      carryLb: 420,
      attack: { name: "Hooves", bonus: 4, damage: "1d4+2", type: "bludgeoning" },
      warTrained: false,
      trait: "Beast of Burden: counts as Large for what it can carry.",
    },
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

// How mounts work at the table (shown in the Travel tab and the Player Guide).
export const MOUNT_RULES: { title: string; body: string }[] = [
  {
    title: "Mounting",
    body: "Getting on or off a mount costs half your speed. The mount must be at least one size larger than you (Medium mounts carry Small riders). You need a saddle to fight from the saddle; a military saddle gives advantage on checks and saves to stay mounted.",
  },
  {
    title: "Controlled mounts",
    body: "Trained farm mounts are controlled: they act on your initiative and move as you direct, and on their turn they can only Dash, Disengage or Dodge. A war-trained mount you control can instead attack with its own attack.",
  },
  {
    title: "Independent mounts",
    body: "Tamed wild mounts (stags, boars) keep their own initiative and act as they like: they may attack, flee or ignore you. A rider can try a DC 15 Wisdom (Animal Handling) check as a bonus action to make it controlled until their next turn.",
  },
  {
    title: "Charge",
    body: "If your mount moves at least 20 feet straight toward a creature and you hit it with a melee weapon attack on the same turn, the hit deals an extra 1d6 damage (1d8 on a war-trained mount).",
  },
  {
    title: "Staying in the saddle",
    body: "If your mount is knocked prone, or you are knocked prone or moved against your will, make a DC 10 Dexterity save or fall off and land prone within 5 feet. If the mount drops to 0 HP, you can use your reaction to land on your feet; otherwise you fall prone.",
  },
  {
    title: "Spooked",
    body: "Storms, fire and the dead can panic animals. When the weather or the GM calls for it, the rider makes a Wisdom (Animal Handling) check; on a failure the mount bolts as an independent mount for a round. War-trained mounts are steadier.",
  },
  {
    title: "Wounds and rest",
    body: "Track your mount's HP in the Travel tab. A mount is back to full HP after a night's rest (Pass Day), and fully dead at 0 HP unless someone stabilises it.",
  },
];
