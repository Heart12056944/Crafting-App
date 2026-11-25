// Regions of the world the party can be in. When the GM moves the party into a
// region, its gathering spots (mining, woodcutting, foraging, fishing) open to
// players, the materials found at them and the common parts that can be
// harvested from its creatures are discovered, and the GM sees the wildlife that
// lives there. Random bounties and the Gathering tab follow the current region.
// The "Map:" comments are the GM's battle maps, for reference only.
//
// To add a region: add an entry below. Creatures are loot table ids, spots are
// gathering spot ids, wildAnimals are husbandry species ids that can be tamed
// there (the GM puts them nearby in Husbandry when the party meets one). A spot or creature
// can be in as many regions as fits.

export type RegionZone = "The Unwavering" | "The Ironwall" | "Past the Wall";

export type Region = {
  id: string;
  name: string;
  zone: RegionZone;
  set: string; // recipe set (campaign) the region belongs to
  // For players: what the place is like.
  description: string;
  creatures: string[];
  spots: string[];
  wildAnimals: string[];
  // GM only: a note for running the region.
  gmNote?: string;
};

export const REGIONS: Region[] = [
  // --- The Unwavering, from the foothills up to the Vigil ---
  {
    id: "unwavering-base",
    name: "Base of the Mountain",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "The last village before the climb: red roofs, a fountain square, and stone walls around the gardens. Pilgrims and Order patrols pass through on the cobbled road, and the mountain fills half the sky.",
    // Map: 53_Village_Fountain_20x20_no_grid_day_no_watermark.jpg
    creatures: ["valdren-mouser", "feral-hound", "carrion-crow", "ridge-fox", "compact-deserter", "pinewood-bear", "ridge-boar", "highland-deer"],
    spots: ["village-gardens", "snowmelt-stream", "pine-stand"],
    wildAnimals: ["valdren-mouser", "feral-hound", "ridge-fox"],
    gmNote: "Civilised side of the Wall. Undead are almost never seen here; a lone Brainless would be news for a month.",
  },
  {
    id: "unwavering-start",
    name: "Start of the Mountain",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "A dirt trail winding between grey stone ridges and patches of green. The first real climb: easy going for the fit, a warning for everyone else.",
    // Map: 94_Eagle_s_Edge_Trail_40x30_no_grid_day_sunlight.jpg
    creatures: ["crag-hawk", "mountain-ram", "ridge-fox", "scree-jackal", "thornspine-wolf", "tuskback-boar", "pinewood-bear", "ridge-boar", "highland-deer", "scree-adder"],
    spots: ["shaded-rock-slopes", "thornspine-surface-seam", "pine-stand"],
    wildAnimals: ["mountain-ram", "ridge-fox", "scree-jackal", "tuskback-boar"],
  },
  {
    id: "unwavering-quarter",
    name: "A Quarter of the Way Up",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "A falls thunders down into a narrow gorge, and the road crosses it on an old stone bridge. Travellers camp on the far side to dry out; not all of them leave.",
    // Map: 218_The_Thunder_Falls_Crossing_30x40_no_grid_day.jpg
    creatures: ["ridge-stag", "thornspine-wolf", "crag-lynx", "thornspine-bear", "carrion-crow", "tarn-serpent", "pinewood-bear", "crownhorn-elk", "highland-deer", "rootcoil-constrictor"],
    spots: ["spray-soaked-rocks", "plunge-pool", "tarnside-reedbeds"],
    wildAnimals: ["ridge-stag", "reedfowl", "crag-lynx", "thornspine-wolf"],
    gmNote: "The wrecked cart and scattered bones by the east camp are a good hook: a bear, or something worse.",
  },
  {
    id: "unwavering-35",
    name: "Spine Crossing (35% Up)",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "A cracked stone ridge, barely wide enough for a cart, runs across a sea of cloud. The drop on either side is not something anyone has measured.",
    // Map: 208_Mountain_s_Spine_Crossing_30x45_no_grid_day.jpg
    creatures: ["crag-hawk", "mountain-ram", "snow-cat", "ridge-panther", "cave-bat", "brainless-wolf", "rime-bear", "frostmaw"],
    spots: ["cloud-ledges", "old-ironbark-grove", "deep-ridge-vein"],
    wildAnimals: ["mountain-ram", "ridge-panther", "snow-cat"],
    gmNote: "Fighting on the spine: a creature shoved off the edge falls into the cloud. Strong winds are common.",
  },
  {
    id: "unwavering-half",
    name: "Halfway Up",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "The path clings to a cliff above a fast mountain river, crossing it on a single plank bridge. Great slabs of rock overhang the trail.",
    // Map: b0eda10ecc7b14461d7c71a4fa946369.jpg (Tehox canyon river)
    creatures: ["thornspine-bear", "ridge-panther", "tuskback-boar", "thornspine-direwolf", "tarn-serpent", "rootcoil-constrictor", "crownhorn-elk"],
    spots: ["canyon-rapids", "deep-tarn", "old-ironbark-grove"],
    wildAnimals: ["thornspine-direwolf", "ridge-panther", "tuskback-boar"],
  },
  {
    id: "unwavering-60",
    name: "The Mountain Gate (60% Up)",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "Two towers and a gatehouse close the pass, with a camp of tents and wagons on the upper side. Everyone going higher stops here.",
    // Map: 204_Mountain_Gate_30x40_no_grid_day.jpg
    creatures: ["snow-cat", "thornspine-direwolf", "thornspine-sabretooth", "compact-deserter", "crag-hawk", "rime-bear", "frostmaw"],
    spots: ["lightning-scarred-ridge", "deep-ridge-vein"],
    wildAnimals: ["snow-cat", "thornspine-direwolf", "thornspine-sabretooth"],
  },
  {
    id: "the-vigil",
    name: "The Vigil",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "The Undying Ember: halls, gardens and training yards carved into black granite near the peak, and below them the Vigil Fire.",
    // Map: LockwoodEstateWM_35x24.jpg (ground floor), LockwoodEstate2FloorWM_35x24.jpg (upper floor)
    creatures: ["valdren-mouser", "cave-bat"],
    spots: ["warm-spring-hollow", "old-ironbark-grove"],
    wildAnimals: ["valdren-mouser"],
    gmNote: "Home. Nothing hostile gets this far without a story behind it.",
  },
  {
    id: "vigil-mines",
    name: "The Vigil Mining Ground",
    zone: "The Unwavering",
    set: "undying-vigil",
    description:
      "A small fort dug into the cliff, with barracks, a mess and storerooms above and the working tunnels below. The rock gets warmer the deeper you go.",
    // Map: 166_Mountain_Mine_Fort_40x50_no_grid_day.jpg
    creatures: ["cave-bat", "thornspine-bear", "brainless", "dusk-bat-swarm"],
    spots: ["vigil-mine-galleries", "the-warm-seam", "ashline-lode"],
    wildAnimals: [],
    gmNote: "The deep rock here is the Unwavering's black stone. Something in the lowest tunnels occasionally answers a pickaxe.",
  },

  // --- The three Wall entries ---
  {
    id: "wall-valdren",
    name: "The Wall: Valdren Entry",
    zone: "The Ironwall",
    set: "undying-vigil",
    description:
      "A fortress gate over a river gorge, with a busy Valdren market town packed against its back. Traders, soldiers and smugglers all come through here, and the garrison is well fed and well drilled.",
    // Map: 136_Main_Gate_Fortress_44x40_no_grid_day.jpg
    creatures: ["brainless", "directed-brainless", "skeleton-warrior", "skeleton-archer", "compact-deserter", "carrion-crow", "feral-hound"],
    spots: ["market-midden", "snowmelt-stream", "thornspine-tarn"],
    wildAnimals: ["feral-hound", "valdren-mouser"],
  },
  {
    id: "wall-dominion",
    name: "The Wall: Dominion Entry",
    zone: "The Ironwall",
    set: "undying-vigil",
    description:
      "A long, straight stretch of wall between two cannon towers, ballistae every few yards. The Dominion's camp behind it is laid out in rows, and its soldiers pray at dawn before they drill.",
    // Map: 144_The_Great_Wall_40x50_no_grid_day_no_ogres.jpg
    creatures: ["brainless", "directed-brainless", "skeleton-warrior", "skeleton-archer", "skeleton-knight", "brainless-wolf", "carrion-crow"],
    spots: ["spent-bolt-field", "old-battlefield-meadow", "pine-stand"],
    wildAnimals: ["feral-hound"],
  },
  {
    id: "wall-coalition",
    name: "The Wall: Coalition Entry",
    zone: "The Ironwall",
    set: "undying-vigil",
    description:
      "Round towers on a rock spur over a dusty pass, held by the coalition of smaller nations. The camp is thin, the barrels half empty, and the garrison is stretched over more wall than it can watch.",
    // Map: 157_Before_The_Breach_35x27_no_grid_day.jpg
    creatures: ["brainless", "directed-brainless", "skeleton-warrior", "skeleton-archer", "brainless-wolf", "scree-jackal", "compact-deserter"],
    spots: ["collapsed-rampart", "old-battlefield-meadow", "thornspine-surface-seam"],
    wildAnimals: ["scree-jackal"],
    gmNote: "Underprepared and underfunded: the weakest point on this stretch of the Wall. Undead pressure shows here first, and deserters slip out through here most often.",
  },

  // --- Past the Wall ---
  {
    id: "beyond-cavern",
    name: "Past the Wall: The Burrow Canyon",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A pale, sun-baked canyon whose walls are riddled with dark, honeycombed burrows. Something made them. Something may still use them.",
    // Map: 0e50aeb04b2c5322eab3c4cd49206c9c.jpg (Box Avenue canyon)
    creatures: ["cave-bat", "brainless", "brainless-bear", "skeleton-warrior", "bloom-amalgam", "scree-jackal", "scree-adder", "ashback-viper", "dusk-bat-swarm"],
    spots: ["resin-burrows", "ashline-lode"],
    wildAnimals: ["scree-jackal"],
  },
  {
    id: "beyond-orc-stronghold",
    name: "Past the Wall: The Old Orc Stronghold",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A palisade fort on a rock island, ringed by a moat-river and reached by a single bridge. Fires still burn in the yard. Someone is living here.",
    // Map: 162_Orc_Stronghold_40x40_no_grid_day.jpg
    creatures: ["skeleton-warrior", "skeleton-archer", "skeleton-knight", "skeleton-mage", "death-knight", "brainless-bear", "waking-cultist", "ridge-boar"],
    spots: ["rusted-armoury", "thornspine-tarn", "old-battlefield-meadow"],
    wildAnimals: [],
  },
  {
    id: "beyond-broken-temple",
    name: "Past the Wall: The Broken Temple",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A temple split in two by a chasm, its tombs open and its floor flooded with dark water. The god it belonged to is long dead.",
    // Map: 202_The_Broken_Temple_27x35_no_grid_day.jpg
    creatures: ["skeleton-mage", "skeleton-knight", "skeleton-warrior", "waking-cultist", "directed-brainless", "carrion-crow"],
    spots: ["shattered-altar", "deep-tarn", "warm-spring-hollow"],
    wildAnimals: [],
  },
  {
    id: "beyond-meteorite",
    name: "Past the Wall: The Fallen Star",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "Three craters in a scorched clearing, each holding a glowing blue stone. Trees lie flattened away from them, and nothing grows in the burn.",
    // Map: 212_The_Mysterious_Meteorite_Impact_30x40_no_grid_day_sunny.jpg
    creatures: ["bloom-amalgam", "brainless", "ridge-stag", "carrion-crow", "waking-cultist"],
    spots: ["meteorite-crater", "lightning-scarred-ridge"],
    wildAnimals: ["ridge-stag"],
  },
  // --- Further past the Wall (ready for when the party gets close) ---
  {
    id: "last-light-waystation",
    name: "Past the Wall: Last Light Waystation",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A trail camp among the rocks, with a broken bridge and a few tents nobody came back for. The last place anyone tried to keep past the Wall.",
    // Map: 8239338-7896abb8-6a25-11f1-a1ac-e61f2674a2e9.jpg (broken-bridge trail camp)
    creatures: ["brainless", "brainless-wolf", "compact-deserter", "carrion-crow", "ridge-fox", "ridge-boar", "crownhorn-elk"],
    spots: ["pine-stand", "shaded-rock-slopes", "snowmelt-stream"],
    wildAnimals: ["ridge-fox", "feral-hound"],
    gmNote: "A natural rest stop. Whoever left the camp left in a hurry: the supplies are still in the crates.",
  },
  {
    id: "fogwater-ford",
    name: "Past the Wall: Fogwater Ford",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A rocky river crossing in old forest, where fog sits in the hollows and a narrow plank bridge spans the rapids. In winter the river freezes solid.",
    // Map: 25_Rocky_Forest_River_DFNG30x40.jpg (summer), 25_Rocky_Forest_River_Winter_WDFNG30x40.jpg (winter)
    creatures: ["ridge-stag", "thornspine-wolf", "crag-lynx", "brainless-wolf", "tarn-serpent", "rime-bear", "frostmaw", "crownhorn-elk", "highland-deer", "rootcoil-constrictor"],
    spots: ["canyon-rapids", "old-ironbark-grove", "shaded-rock-slopes"],
    wildAnimals: ["ridge-stag", "crag-lynx", "thornspine-wolf"],
    gmNote: "Use the winter map in winter: the river is walkable ice, and the fog turns to freezing mist.",
  },
  {
    id: "rubble-narrows",
    name: "Past the Wall: The Rubble Narrows",
    zone: "Past the Wall",
    set: "undying-vigil",
    description: "A grey pass choked with fallen boulders between two cliff walls. Every sound echoes.",
    // Map: 7926863078f0b1c020b1f9b6a6b920c6.jpg (grey boulder pass)
    creatures: ["mountain-ram", "scree-jackal", "brainless", "skeleton-warrior", "thornspine-bear", "frostmaw", "scree-adder"],
    spots: ["thornspine-surface-seam", "shaded-rock-slopes"],
    wildAnimals: ["mountain-ram", "scree-jackal"],
    gmNote: "Perfect ambush ground: the cliffs give the high ground to whoever gets there first.",
  },
  {
    id: "deserters-hollow",
    name: "Past the Wall: Deserter's Hollow",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A hidden canyon hold with stone halls, a log gate and a camp of tents and stalls. Deserters from every side of the Wall ended up here, and they don't welcome visitors.",
    // Map: 214_The_Mountain_Rebel_s_Hold_40x58_no_grid_day_lit.jpg
    creatures: ["compact-deserter", "feral-hound", "thornspine-wolf", "waking-cultist"],
    spots: ["thornspine-tarn", "pine-stand", "old-battlefield-meadow"],
    wildAnimals: ["feral-hound"],
    gmNote: "Mostly Compact deserters, some from the coalition's undermanned section. They trade with anyone who doesn't report them, and a Waking cultist or two may be hiding among them.",
  },
  {
    id: "rust-mesas",
    name: "Past the Wall: The Rust Mesas",
    zone: "Past the Wall",
    set: "undying-vigil",
    description: "Red stone mesas rising out of a dry, cracked basin. Nothing grows here but thorny scrub.",
    // Map: f0bdb7d6e6e33c3a7e8a623f5ed9733e.jpg (red canyon)
    creatures: ["scree-jackal", "carrion-crow", "brainless", "skeleton-archer", "brainless-bear", "scree-adder", "ashback-viper"],
    spots: ["ashline-lode", "thornspine-surface-seam"],
    wildAnimals: ["scree-jackal"],
  },
  {
    id: "ossuary-gate",
    name: "Past the Wall: The Ossuary Gate",
    zone: "Past the Wall",
    set: "undying-vigil",
    description: "Giant skulls carved into the cliff face look down on a cracked plain split by chasms. Whoever carved them wanted visitors to turn back.",
    // Map: 9918e042e2cf4e64fcc150025ef49653.jpg (skull cliffs)
    creatures: ["skeleton-warrior", "skeleton-archer", "skeleton-knight", "directed-brainless", "waking-cultist", "carrion-crow", "ashback-viper"],
    spots: ["shattered-altar", "old-battlefield-meadow"],
    wildAnimals: [],
  },
  {
    id: "silkchoke-mine",
    name: "Past the Wall: The Silkchoke Mine",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "An abandoned mine with an empty camp outside: cabins, a cookfire gone cold, and tracks leading in but not out. The deep galleries are thick with web.",
    // Map: 178_Spider-Infested_Mine_30x70_no_grid_day_lit.jpg
    creatures: ["silkchoke-spider", "silkchoke-matriarch", "cave-bat", "brainless"],
    spots: ["web-choked-galleries", "lantern-crystal-veins", "deep-ridge-vein"],
    wildAnimals: [],
    gmNote: "The deepest gallery breaks into the Lantern Tunnels: a second way down to the Still-Burning Forge.",
  },
  {
    id: "silkrun-caverns",
    name: "Past the Wall: The Silkrun Caverns",
    zone: "Past the Wall",
    set: "undying-vigil",
    description: "Caverns around an underground river, strung with web and lit by blue crystal. Old bones and a smashed boat lie on the bank.",
    // Map: 179_Spider_Infested_Cave_40x40_no_grid_lit.jpg
    creatures: ["silkchoke-spider", "silkchoke-matriarch", "tarn-serpent", "cave-bat", "dusk-bat-swarm", "rootcoil-constrictor"],
    spots: ["web-choked-galleries", "deep-tarn", "lantern-crystal-veins"],
    wildAnimals: [],
  },
  {
    id: "lantern-tunnels",
    name: "Past the Wall: The Lantern Tunnels",
    zone: "Past the Wall",
    set: "undying-vigil",
    description: "Winding tunnels lit by blue crystal growing from the walls. The air gets warmer the further down you go, and it smells of hot metal.",
    // Map: CaveTunnelsVol4Public.jpg
    creatures: ["cave-bat", "skeleton-warrior", "brainless", "silkchoke-spider", "dusk-bat-swarm"],
    spots: ["lantern-crystal-veins", "deep-ridge-vein"],
    wildAnimals: [],
    gmNote: "These lead down to the Still-Burning Forge.",
  },
  {
    id: "still-burning-forge",
    name: "Past the Wall: The Still-Burning Forge",
    zone: "Past the Wall",
    set: "undying-vigil",
    description:
      "A vast round dwarven forge, older than the Crusade, with its fires still roaring. Its anvils and moulds wait as if the smiths only stepped out. Some things can only be made here.",
    // Map: 137_The_Great_Dwarven_Forge_20x20_no_grid_lit.jpg
    creatures: ["skeleton-knight", "skeleton-mage", "death-knight", "directed-brainless"],
    spots: ["forge-slag-heaps", "central-crucible"],
    wildAnimals: [],
    gmNote: "The fires burn without fuel, just like the Vigil Fire. Nobody alive knows why; let the players notice. Forge-only recipes can be made here, broken tools can be repaired for free, and (a table rule) once per visit each character can rework one item they made: roll the recipe's check again and keep the better quality.",
  },
];

export const regionById = new Map(REGIONS.map((region) => [region.id, region]));

export const REGION_ZONES: RegionZone[] = ["The Unwavering", "The Ironwall", "Past the Wall"];

// Regions whose set isn't switched off for this campaign.
export function visibleRegions(disabledSets: string[]) {
  return REGIONS.filter((region) => !disabledSets.includes(region.set));
}

// Every region a gathering spot belongs to.
export function regionsForSpot(spotId: string) {
  return REGIONS.filter((region) => region.spots.includes(spotId));
}
