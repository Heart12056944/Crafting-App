import type { GatheringActivity } from "./gatheringSpots";

// The campaign calendar and weather. Day 1 of the campaign falls on the
// GM-chosen start date (default: the first day of Mid Spring). A year is four
// seasons of three 30-day months: Early, Mid and Late.

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type Season = (typeof SEASONS)[number];
export const MONTH_PARTS = ["Early", "Mid", "Late"] as const;
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = SEASONS.length * MONTH_PARTS.length * DAYS_PER_MONTH;

// Index into the year (0 = Early Spring, day 1). Mid Spring, day 1:
export const DEFAULT_START = DAYS_PER_MONTH;

export function dayOfYearIndex(season: Season, part: (typeof MONTH_PARTS)[number], day: number) {
  return SEASONS.indexOf(season) * 90 + MONTH_PARTS.indexOf(part) * DAYS_PER_MONTH + Math.max(1, Math.min(DAYS_PER_MONTH, day)) - 1;
}

// Years are counted in the Post-Crusade Reckoning: Year 0 is the year the
// Ironwall was finished. Earlier years are BCR ("before"), so 273 BCR = −273 PCR.
// The present day of Tales on the Sea is 250 PCR.
export const DEFAULT_YEAR = 250;
export type Era = "PCR" | "BCR";

export function formatYear(year: number) {
  return year < 0 ? `${-year} BCR` : `${year} PCR`;
}

// Signed PCR year from a number and an era (273 BCR -> -273).
export function toSignedYear(value: number, era: Era) {
  const year = Math.abs(Math.round(value));
  return era === "BCR" ? -year : year;
}

export function splitYear(year: number): { value: number; era: Era } {
  return year < 0 ? { value: -year, era: "BCR" } : { value: year, era: "PCR" };
}

export type CalendarDate = {
  season: Season;
  part: (typeof MONTH_PARTS)[number];
  day: number;
  // Signed PCR year (negative = BCR).
  year: number;
  yearLabel: string;
  // e.g. "Mid Spring, day 3"
  short: string;
  // e.g. "Mid Spring, day 3, 240 PCR"
  label: string;
};

// campaignDay starts at 1. start: day of the year that campaign day 1 falls on;
// startYear: the (signed PCR) year campaign day 1 falls in.
export function dateForCampaignDay(campaignDay: number, start = DEFAULT_START, startYear = DEFAULT_YEAR): CalendarDate {
  const absolute = start + Math.max(0, campaignDay - 1);
  const index = ((absolute % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const season = SEASONS[Math.floor(index / 90)];
  const part = MONTH_PARTS[Math.floor((index % 90) / DAYS_PER_MONTH)];
  const day = (index % DAYS_PER_MONTH) + 1;
  const year = startYear + Math.floor(absolute / DAYS_PER_YEAR);
  const short = `${part} ${season}, day ${day}`;
  return { season, part, day, year, yearLabel: formatYear(year), short, label: `${short}, ${formatYear(year)}` };
}

export type ClimateId = "mountain" | "valley" | "tropical-sea";

export const CLIMATES: Record<ClimateId, { label: string; note: string }> = {
  mountain: { label: "Mountains (Thornspine)", note: "Rainy springs and autumns, hot summers, long brutal winters." },
  valley: { label: "Farmland valley (Valdren)", note: "Rainy springs and autumns, hot humid summers, cold snowy winters." },
  "tropical-sea": { label: "Tropical sea (Romley)", note: "Warm all year; storms and hurricanes in summer and early autumn." },
};

// A gathering modifier, or "closed" when that activity can't be done at all.
export type WeatherGathering = Partial<Record<GatheringActivity, number | "closed">>;

export type Weather = {
  id: string;
  label: string;
  description: string;
  // Rules the table applies while it lasts.
  effects: string[];
  gathering: WeatherGathering;
  // Mounts: a DC for staying in control when the weather spooks animals.
  spooksMounts?: number;
};

export const WEATHER: Record<string, Weather> = {
  clear: { id: "clear", label: "Clear", description: "Clear skies and good visibility.", effects: [], gathering: {} },
  overcast: { id: "overcast", label: "Overcast", description: "Low grey cloud, dry and still.", effects: [], gathering: {} },
  "light-rain": {
    id: "light-rain",
    label: "Light rain",
    description: "A steady drizzle.",
    effects: ["Fish bite more: +1 to Fishing.", "Open flames need shelter."],
    gathering: { fishing: 1 },
  },
  "heavy-rain": {
    id: "heavy-rain",
    label: "Heavy rain",
    description: "Driving rain; everything is soaked.",
    effects: [
      "Lightly obscured; disadvantage on Wisdom (Perception) checks that rely on sight or hearing.",
      "Open fires go out. −2 to Mining, Woodcutting and Foraging.",
    ],
    gathering: { mining: -2, woodcutting: -2, foraging: -2 },
  },
  thunderstorm: {
    id: "thunderstorm",
    label: "Thunderstorm",
    description: "Lightning, thunder and torrential rain.",
    effects: [
      "As heavy rain, and no fishing.",
      "Mounts may panic: a rider makes a DC 12 Wisdom (Animal Handling) check when thunder breaks or the mount bolts.",
    ],
    gathering: { mining: -2, woodcutting: -5, foraging: -2, fishing: "closed" },
    spooksMounts: 12,
  },
  fog: {
    id: "fog",
    label: "Fog",
    description: "Thick fog; you can't see far.",
    effects: ["Heavily obscured beyond 30 feet.", "−2 to Foraging (hard to tell plants apart)."],
    gathering: { foraging: -2 },
  },
  frost: {
    id: "frost",
    label: "Hard frost",
    description: "A clear, bitter night leaves everything white.",
    effects: ["Extreme cold overnight without shelter or cold-weather gear (DC 10 Constitution save or 1 exhaustion).", "Frost-ripening fruit (rimepods) can be picked."],
    gathering: {},
  },
  snow: {
    id: "snow",
    label: "Snow",
    description: "Falling snow and drifts underfoot.",
    effects: ["Difficult terrain off the road; travel pace is halved.", "Tracks are easy to follow: +2 to Survival checks to track.", "−2 to Foraging and Woodcutting."],
    gathering: { foraging: -2, woodcutting: -2 },
  },
  blizzard: {
    id: "blizzard",
    label: "Blizzard",
    description: "Howling wind and snow; you can barely see your hands.",
    effects: [
      "Heavily obscured. Extreme cold: DC 10 Constitution save each hour outside without cold-weather gear or 1 exhaustion.",
      "No foraging, woodcutting or fishing. Mines are sheltered (−2 to Mining).",
      "Mounts balk: DC 14 Wisdom (Animal Handling) to make one travel.",
    ],
    gathering: { foraging: "closed", woodcutting: "closed", fishing: "closed", mining: -2 },
    spooksMounts: 14,
  },
  "bitter-cold": {
    id: "bitter-cold",
    label: "Bitter cold",
    description: "A still, brutal cold that freezes breath on your scarf.",
    effects: [
      "Extreme cold all day: without cold-weather gear, a DC 10 Constitution save each hour outside or 1 exhaustion.",
      "Exposed skin risks frostbite. Water freezes in the skins. −2 to Fishing (through the ice) and Woodcutting.",
    ],
    gathering: { fishing: -2, woodcutting: -2 },
  },
  heat: {
    id: "heat",
    label: "Heat wave",
    description: "Oppressive, airless heat.",
    effects: ["Extreme heat: without water, a DC 5 Constitution save each hour (+1 per hour) or 1 exhaustion.", "Double water needs. −2 to Mining."],
    gathering: { mining: -2 },
  },
  "strong-wind": {
    id: "strong-wind",
    label: "Strong wind",
    description: "Gusting wind that snatches at cloaks and sails.",
    effects: ["Disadvantage on ranged weapon attacks and on Perception checks that rely on hearing.", "Open flames go out. −2 to Fishing."],
    gathering: { fishing: -2 },
  },
  hurricane: {
    id: "hurricane",
    label: "Hurricane",
    description: "A great storm: screaming wind, rain like thrown gravel, the sea gone mad.",
    effects: [
      "No sailing and no outdoor gathering. Ships in harbour must be secured.",
      "Unsheltered creatures take 1d6 bludgeoning damage an hour from debris.",
      "Mounts panic: DC 16 Wisdom (Animal Handling) or the mount bolts.",
    ],
    gathering: { fishing: "closed", woodcutting: "closed", foraging: "closed", mining: "closed" },
    spooksMounts: 16,
  },
};

type Weights = Record<string, number>;

const TABLES: Record<ClimateId, Record<Season, Weights>> = {
  // The Vigil's climate is Canadian: rainy springs and autumns, hot summers, cold winters.
  mountain: {
    Spring: { "light-rain": 30, "heavy-rain": 20, overcast: 15, fog: 10, clear: 15, thunderstorm: 5, frost: 3, snow: 2 },
    Summer: { clear: 35, heat: 25, thunderstorm: 12, "light-rain": 8, overcast: 8, "strong-wind": 7, fog: 5 },
    Autumn: { "light-rain": 30, "heavy-rain": 20, overcast: 15, fog: 12, "strong-wind": 8, clear: 10, frost: 5 },
    Winter: { snow: 30, "bitter-cold": 20, frost: 15, blizzard: 15, clear: 12, overcast: 5, "strong-wind": 3 },
  },
  valley: {
    Spring: { "light-rain": 30, "heavy-rain": 18, overcast: 15, fog: 10, clear: 20, thunderstorm: 7 },
    Summer: { clear: 40, heat: 25, thunderstorm: 12, "light-rain": 8, overcast: 8, "strong-wind": 7 },
    Autumn: { "light-rain": 30, "heavy-rain": 18, overcast: 17, fog: 13, "strong-wind": 7, clear: 12, frost: 3 },
    Winter: { snow: 30, "bitter-cold": 15, frost: 20, blizzard: 10, clear: 15, overcast: 10 },
  },
  "tropical-sea": {
    Spring: { clear: 40, overcast: 15, "light-rain": 25, "heavy-rain": 10, "strong-wind": 10 },
    Summer: { clear: 30, "light-rain": 15, "heavy-rain": 15, thunderstorm: 15, "strong-wind": 10, hurricane: 5, heat: 10 },
    Autumn: { clear: 35, overcast: 15, "light-rain": 20, "heavy-rain": 10, thunderstorm: 10, "strong-wind": 7, hurricane: 3 },
    Winter: { clear: 45, overcast: 20, "light-rain": 20, "strong-wind": 15 },
  },
};

export function weatherTable(climate: ClimateId, date: CalendarDate): Weights {
  const table = { ...TABLES[climate][date.season] };
  // Hurricane season in the tropics runs through Early Autumn only.
  if (climate === "tropical-sea" && date.season === "Autumn" && date.part !== "Early") delete table.hurricane;
  // In the north, winter hangs on into Early Spring and arrives in Late Autumn.
  if (climate !== "tropical-sea") {
    if (date.season === "Spring" && date.part === "Early") Object.assign(table, { snow: 12, frost: 10, "light-rain": 20 });
    if (date.season === "Autumn" && date.part === "Late") Object.assign(table, { snow: 10, frost: 12, "bitter-cold": 3 });
    if (date.season === "Summer" && date.part === "Mid") table.heat = (table.heat || 0) + 10;
  }
  return table;
}

// Typical temperatures (°C) by season, for describing the day.
const TEMPERATURES: Record<ClimateId, Record<Season, string>> = {
  mountain: { Spring: "0 to 12°C, cold nights", Summer: "20 to 33°C, hot days", Autumn: "−2 to 12°C, raw and wet", Winter: "−35 to −10°C" },
  valley: { Spring: "3 to 15°C", Summer: "22 to 35°C, hot and humid", Autumn: "0 to 14°C", Winter: "−30 to −8°C" },
  "tropical-sea": { Spring: "24 to 30°C", Summer: "27 to 34°C", Autumn: "25 to 31°C", Winter: "21 to 27°C" },
};

export function typicalTemperature(climate: ClimateId, date: CalendarDate, weather?: string) {
  const base = TEMPERATURES[climate][date.season];
  if (weather === "heat") return `${base}; a heat wave today, well above that`;
  if (weather === "bitter-cold") return `${base}; bitter cold today, at the bottom of that range or below`;
  return base;
}

// Weather tends to hold: a 35% chance it stays as it was, if it still fits the season.
export function rollWeather(climate: ClimateId, date: CalendarDate, yesterday?: string): string {
  const table = weatherTable(climate, date);
  if (yesterday && table[yesterday] && Math.random() < 0.35) return yesterday;
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[0][0];
}

export function weatherById(id: string | undefined) {
  return (id && WEATHER[id]) || WEATHER.clear;
}

// Settings saved in campaign_discoveries (kind "calendar").
export type CalendarSettings = {
  start: number;
  // Signed PCR year campaign day 1 falls in.
  startYear: number;
  climate: ClimateId;
  weather: string;
  // Rations are eaten automatically on Pass Day unless this is "off".
  rations: boolean;
  // Campaign day the party's food was provided (inn, host, spell): nothing is eaten that day.
  fedDay: number;
};

export function readCalendarSettings(values: Record<string, string>): CalendarSettings {
  const climate = values.climate as ClimateId;
  return {
    start: Number.isFinite(Number(values.start)) && values.start !== undefined ? Number(values.start) : DEFAULT_START,
    startYear: values.year !== undefined && Number.isFinite(Number(values.year)) ? Number(values.year) : DEFAULT_YEAR,
    climate: climate && CLIMATES[climate] ? climate : "mountain",
    weather: values.weather && WEATHER[values.weather] ? values.weather : "clear",
    rations: values.rations !== "off",
    fedDay: Number(values.fed) || 0,
  };
}

// Days a character can go without food before exhaustion starts (PHB): 3 + CON modifier, at least 1.
export function daysWithoutFoodAllowed(conModifier: number) {
  return Math.max(1, 3 + conModifier);
}
