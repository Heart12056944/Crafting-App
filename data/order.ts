// The ranks of the Order of the Undying Vigil (from the Initiate's Handbook).
// The ranks are not a hierarchy: they record what Verath has witnessed in a member.

export type OrderRank = "unlit" | "kindled" | "steadfast" | "tempered" | "unwavering" | "vigil";

export type OrderDeed = { day: number; text: string };

export const ORDER_RANKS: { id: OrderRank; numeral: string; name: string; title: string; practice: string; advancement: string; mark?: string }[] = [
  {
    id: "unlit",
    numeral: "I",
    name: "The Unlit",
    title: "Novice",
    practice: "No copy of the Ember Codex yet. Observes before taking part; not expected to approach the Vigil Fire until ready.",
    advancement: "Arrival and acceptance by the High Warden.",
  },
  {
    id: "kindled",
    numeral: "II",
    name: "The Kindled",
    title: "Sworn Member",
    practice: "Receives a personal copy of the Ember Codex and a first formal patrol assignment. A full member of the Order.",
    advancement: "The Vigil Oath spoken before the fire, and a first genuine trial survived: the cost of continuing was real, and they continued anyway.",
  },
  {
    id: "steadfast",
    numeral: "III",
    name: "The Steadfast",
    title: "Core Member",
    practice: "Mentors the Unlit. Wider patrol authority; trusted with the Order's more sensitive work.",
    advancement: "Consistency over time, in prayer and in the field. No single event: it is the accumulation of years.",
  },
  {
    id: "tempered",
    numeral: "IV",
    name: "The Tempered",
    title: "Proven",
    practice: "Consulted on major Order decisions; their voice carries weight in council.",
    advancement: "Cannot be requested or trained toward. Verath's decision, witnessed by the High Warden, after enduring something unsurvivable by ordinary measure.",
    mark: "Verath's mark: one morning the prayers feel different, heavier, more direct, and the High Warden tells them what it means.",
  },
  {
    id: "unwavering",
    numeral: "V",
    name: "The Unwavering",
    title: "Elder (never more than nine)",
    practice: "Carries one of the ten original followers' books. One of the nine who will one day sit in the fire to wait for Verath to choose a High Warden.",
    advancement: "Verath's direct recognition, over a lifetime. Impossible while all nine seats are filled.",
    mark: "The flame has become structural: others feel them in a room before they see them.",
  },
  {
    id: "vigil",
    numeral: "VI",
    name: "The Vigil",
    title: "High Warden",
    practice: "One person. Holds the first High Warden's book. Verath's voice.",
    advancement: "Chosen by the fire, while the nine Unwavering sit in it together.",
  },
];

export const orderRankById = new Map(ORDER_RANKS.map((rank) => [rank.id, rank]));
