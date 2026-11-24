import type { Season } from "./calendar";

// Gear that protects against the weather, and what each kind of weather
// demands. The Travel tab checks each character's pack against today's weather.

export type Exposure = "cold" | "wet" | "heat";

// Worn clothing/gear in a character's own pack.
export const PERSONAL_GEAR: Record<Exposure, string[]> = {
  cold: ["Winter Coat", "Cured Wolf-Leather Jerkin", "Winter-Fur Cloak", "Direwolf Cloak", "Sabretooth Mantle"],
  wet: ["Oilskin Cloak"],
  heat: ["Summer Linens"],
};

// Camp gear protects everyone, wherever it's carried (or in the party stash).
export const CAMP_GEAR: Partial<Record<Exposure, string[]>> = {
  wet: ["Waxed Tarp", "Hide Tent"],
};

// Extras: mittens stop frostbite, a waterskin covers heat-wave water.
export const EXTRAS = { frostbite: "Fur Mittens & Hat", water: "Large Waterskin", glare: "Snow Goggles", snow: "Snowshoes" };

export type WeatherDemand = { kind: Exposure; dc: number; note: string };

// What the weather asks of someone out in it. Rain only chills outside summer.
export function weatherDemands(weather: string, season: Season): WeatherDemand[] {
  switch (weather) {
    case "bitter-cold":
      return [{ kind: "cold", dc: 12, note: "bitter cold" }];
    case "blizzard":
      return [{ kind: "cold", dc: 12, note: "blizzard" }];
    case "frost":
      return [{ kind: "cold", dc: 10, note: "a freezing night" }];
    case "snow":
      return season === "Winter" ? [{ kind: "cold", dc: 8, note: "snow and cold" }] : [];
    case "heavy-rain":
    case "thunderstorm":
      return season === "Summer" ? [] : [{ kind: "wet", dc: 8, note: "cold rain" }];
    case "hurricane":
      return [{ kind: "wet", dc: 12, note: "the storm" }];
    case "heat":
      return [{ kind: "heat", dc: 10, note: "the heat" }];
    default:
      return [];
  }
}

export function hasItem(names: string[], wanted: string) {
  return names.some((name) => name.toLowerCase() === wanted.toLowerCase());
}

// Which gear (if any) covers a character for this kind of weather.
export function protection(kind: Exposure, ownItems: string[], partyItems: string[]) {
  const personal = PERSONAL_GEAR[kind].find((item) => hasItem(ownItems, item));
  if (personal) return personal;
  return (CAMP_GEAR[kind] || []).find((item) => hasItem(partyItems, item)) || null;
}
