"use client";

import React, { useEffect, useRef, useState } from "react";
import { CloudSun, Drumstick, PawPrint } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { fetchCampaignAnimals, updateAnimal, type AnimalRow, type MountState } from "@/lib/supabaseAnimals";
import { fetchCampaignInventory, type InventoryRow } from "@/lib/supabaseInventory";
import {
  CLIMATES,
  DAYS_PER_MONTH,
  MONTH_PARTS,
  SEASONS,
  WEATHER,
  dayOfYearIndex,
  daysWithoutFoodAllowed,
  rollWeather,
  weatherById,
  weatherTable,
  typicalTemperature,
  splitYear,
  toSignedYear,
  type Era,
  type CalendarDate,
  type CalendarSettings,
  type ClimateId,
  type Season,
} from "@/data/calendar";
import { daysOfFood } from "@/data/rations";
import { EXTRAS, hasItem, protection, weatherDemands } from "@/data/weatherGear";
import { MOUNT_RULES, speciesById } from "@/data/husbandry";

type TravelCharacter = {
  id: string;
  name: string;
  isActive?: boolean;
  stats: Record<string, number>;
  daysWithoutFood?: number;
  exhaustion?: number;
};

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

let travelChannelCount = 0;

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card
      className="rounded-2xl shadow-2xl border-2"
      style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" }}
    >
      <CardContent className="p-6 md:p-8">{children}</CardContent>
    </Card>
  );
}

// "2d6+4" -> total and text.
export function rollDamage(expression: string) {
  const match = expression.replace(/\s/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const flat = Number(expression) || 0;
    return { total: flat, text: String(flat) };
  }
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const bonus = Number(match[3] || 0);
  const dice = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const total = Math.max(0, dice.reduce((sum, die) => sum + die, 0) + bonus);
  return { total, text: `[${dice.join(", ")}]${bonus ? (bonus > 0 ? ` + ${bonus}` : ` − ${-bonus}`) : ""} = ${total}` };
}

const d20 = () => Math.floor(Math.random() * 20) + 1;

const EXHAUSTION_TEXT = (level: number) =>
  level <= 0
    ? "No exhaustion."
    : level >= 6
      ? "Exhaustion 6: dead."
      : `Exhaustion ${level}: −${level * 2} to every d20 test, speed −${level * 5} ft.`;

export default function TravelPanel({
  campaignId,
  adminUnlocked,
  characters,
  claimedCharacterIds,
  campaignDay,
  date,
  calendar,
  lastDayReport,
  setCalendarValue,
  onAdjustCharacter,
  wildlife,
  predatorPressure,
  onResetWildlife,
  onExposure,
}: {
  // Applies exposure results: exhaustion gained, and whether frostbite set in.
  onExposure: (results: { characterId: string; exhaustion: number; frostbite: boolean }[], lines: string[]) => void;
  wildlife: { id: string; label: string; abundance: string; pressure: number }[];
  predatorPressure: number;
  onResetWildlife: (tableId: string) => void;
  campaignId: string;
  adminUnlocked: boolean;
  characters: TravelCharacter[];
  claimedCharacterIds: string[];
  campaignDay: number;
  date: CalendarDate;
  calendar: CalendarSettings;
  lastDayReport: string[];
  setCalendarValue: (key: string, value: string | null) => void;
  onAdjustCharacter: (characterId: string, changes: { exhaustion?: number; daysWithoutFood?: number }) => void;
}) {
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      try {
        const [animalRows, items] = await Promise.all([fetchCampaignAnimals(campaignId), fetchCampaignInventory(campaignId)]);
        setAnimals(animalRows);
        setInventory(items);
      } catch (error) {
        console.warn("Could not load travel data.", error);
      }
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const channel = supabase
      .channel(`campaign-travel-${campaignId}-${++travelChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_animals", filter: `campaign_id=eq.${campaignId}` }, () => reloadRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_inventory_items", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, campaignDay]);

  const party = characters.filter((character) => character.isActive !== false);
  const weather = weatherById(calendar.weather);
  const mounts = animals.filter((animal) => speciesById.get(animal.species)?.mount);
  const demands = weatherDemands(weather.id, date.season);
  const partyItems = inventory.map((row) => row.name);
  const itemsOf = (characterId: string) => inventory.filter((row) => row.character_id === characterId).map((row) => row.name);
  const [exposureLog, setExposureLog] = useState<string[]>([]);

  // Everyone out in the weather makes a CON save per demand: advantage with the right gear.
  function rollExposure() {
    const results: { characterId: string; exhaustion: number; frostbite: boolean }[] = [];
    const lines: string[] = [];
    for (const character of party) {
      const own = itemsOf(character.id);
      let exhaustion = 0;
      let frostbite = false;
      for (const demand of demands) {
        const gear = protection(demand.kind, own, partyItems);
        const waterless = demand.kind === "heat" && !hasItem(own, EXTRAS.water);
        const a = d20();
        const b = d20();
        const natural = gear && !waterless ? Math.max(a, b) : waterless && !gear ? Math.min(a, b) : a;
        const total = natural + (character.stats?.CON ?? 0);
        if (total >= demand.dc) {
          lines.push(`${character.name} weathered ${demand.note} (${total} vs DC ${demand.dc}${gear ? `, ${gear}` : ""}).`);
        } else {
          exhaustion += 1;
          const bite = demand.kind === "cold" && total <= demand.dc - 5 && !hasItem(own, EXTRAS.frostbite);
          frostbite = frostbite || bite;
          lines.push(
            `${character.name} suffered in ${demand.note} (${total} vs DC ${demand.dc}${gear ? "" : ", no gear"}${waterless ? ", no water" : ""}): +1 exhaustion${bite ? " and frostbite" : ""}.`
          );
        }
      }
      if (exhaustion || frostbite) results.push({ characterId: character.id, exhaustion, frostbite });
    }
    setExposureLog(lines);
    onExposure(results, lines);
  }

  return (
    <div className="space-y-6 font-serif">
      <CalendarCard
        adminUnlocked={adminUnlocked}
        campaignDay={campaignDay}
        date={date}
        calendar={calendar}
        setCalendarValue={setCalendarValue}
      />

      <Panel>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Drumstick className="w-6 h-6" />
            <h3 className="text-2xl font-bold">Rations</h3>
          </div>
          <p className="text-sm">
            {calendar.rations
              ? "Each Pass Day, every active character eats one day's food: one ration or one serving of a dish. They eat from their own pack first, then the party stash, and fresh meals before rations that keep."
              : "Rations are switched off: Pass Day doesn't use any food."}{" "}
            A character can go 3 + CON modifier days (at least 1) without food; after that each day without food adds a level of
            exhaustion. A day with food and rest removes one level.
          </p>
          {calendar.fedDay === campaignDay && <p className="text-sm font-bold">Meals are provided today: no rations will be used at Pass Day.</p>}
          {adminUnlocked && (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={calendar.rations} onChange={(event) => setCalendarValue("rations", event.target.checked ? null : "off")} />
                Eat rations on Pass Day
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={calendar.fedDay === campaignDay}
                  onChange={(event) => setCalendarValue("fed", event.target.checked ? String(campaignDay) : null)}
                />
                Meals provided today (inn, host, Goodberry)
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {party.map((character) => {
              const carried = daysOfFood(inventory, character.id);
              const allowed = daysWithoutFoodAllowed(character.stats?.CON ?? 0);
              const hungry = character.daysWithoutFood ?? 0;
              const exhaustion = character.exhaustion ?? 0;
              return (
                <div key={character.id} className="rounded-lg border border-[#9a7b45] bg-[#f7e7c5] p-2 text-sm space-y-1">
                  <p className="font-bold">{character.name}</p>
                  <p>
                    Carrying {carried} day{carried === 1 ? "" : "s"} of food.
                    {hungry > 0 ? ` ${hungry} day${hungry === 1 ? "" : "s"} without food (limit ${allowed}).` : ""}
                  </p>
                  <p className={exhaustion > 0 ? "font-bold text-[#8b1a1a]" : ""}>{EXHAUSTION_TEXT(exhaustion)}</p>
                  {adminUnlocked && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span>Exhaustion</span>
                      <button className="rounded border border-[#9a7b45] px-2" onClick={() => onAdjustCharacter(character.id, { exhaustion: Math.max(0, exhaustion - 1) })}>−</button>
                      <strong>{exhaustion}</strong>
                      <button className="rounded border border-[#9a7b45] px-2" onClick={() => onAdjustCharacter(character.id, { exhaustion: Math.min(6, exhaustion + 1) })}>+</button>
                      {hungry > 0 && (
                        <button className="underline" onClick={() => onAdjustCharacter(character.id, { daysWithoutFood: 0 })}>Mark as fed</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs">Party stash: {daysOfFood(inventory, null)} days of food.</p>
          {lastDayReport.length > 0 && (
            <div className="rounded bg-[#fff0c7] p-2 text-xs space-y-1">
              <p className="font-bold">Last Pass Day</p>
              {lastDayReport.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Weather gear</h3>
          <p className="text-sm">
            {demands.length
              ? `Today's ${weather.label.toLowerCase()} is hard on anyone out in it: ${demands.map((demand) => `${demand.note} (DC ${demand.dc} CON)`).join(", ")}. The right gear gives advantage on the save; failing adds a level of exhaustion, and failing badly in the cold without mittens brings frostbite. In a heat wave, no waterskin means disadvantage.`
              : `Nothing in today's weather calls for special gear.`}{" "}
            Cold: a winter coat (or wolf-leather jerkin, fur cloak); rain: an oilskin cloak, or a tarp or tent for the whole camp; heat: summer linens and a waterskin.
          </p>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {party.map((character) => {
              const own = itemsOf(character.id);
              const kinds = ["cold", "wet", "heat"] as const;
              return (
                <div key={character.id} className="rounded border border-[#e0c896] bg-[#f7e7c5] p-2">
                  <p className="font-bold">{character.name}</p>
                  {kinds.map((kind) => {
                    const gear = protection(kind, own, partyItems);
                    const needed = demands.some((demand) => demand.kind === kind);
                    return (
                      <p key={kind} className={needed && !gear ? "font-bold text-[#8b1a1a]" : ""}>
                        {kind === "cold" ? "Cold" : kind === "wet" ? "Rain" : "Heat"}: {gear || "nothing"}
                        {needed && !gear ? " (needed today!)" : ""}
                      </p>
                    );
                  })}
                  <p className="text-xs">
                    {[EXTRAS.frostbite, EXTRAS.water, EXTRAS.glare, EXTRAS.snow].filter((item) => hasItem(own, item)).join(", ") || "No extras"}
                  </p>
                </div>
              );
            })}
          </div>
          {adminUnlocked && demands.length > 0 && (
            <Button size="sm" className={darkButton} onClick={rollExposure}>
              Roll exposure saves (party is out in it)
            </Button>
          )}
          {exposureLog.map((line) => (
            <p key={line} className="text-xs">{line}</p>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Wildlife</h3>
          <p className="text-sm">
            Every creature the party kills adds hunting pressure, which fades by 1 every 2 days. Hunt one kind hard and it thins out,
            gets scarce, then is hunted out: it stops turning up in random bounties until it recovers. Hunt the predators hard and the
            prey animals thrive. Gathering spots get picked over the same way, and plants, eggs and some fish only show up in season.
          </p>
          {wildlife.filter((item) => item.pressure > 0).length === 0 && <p className="text-sm italic">The wilds are undisturbed.</p>}
          {predatorPressure >= 8 && <p className="text-sm font-bold">So many predators have been killed that prey animals are thriving.</p>}
          <div className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {wildlife
              .filter((item) => item.pressure > 0)
              .sort((a, b) => b.pressure - a.pressure)
              .map((item) => (
                <p key={item.id} className="flex items-center justify-between border-b border-[#e0c896]">
                  <span>
                    <strong>{item.label}</strong> · {item.abundance} (pressure {Math.round(item.pressure * 10) / 10})
                  </span>
                  {adminUnlocked && (
                    <button className="text-xs underline" onClick={() => onResetWildlife(item.id)}>
                      Reset
                    </button>
                  )}
                </p>
              ))}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PawPrint className="w-6 h-6" />
            <h3 className="text-2xl font-bold">Mounts</h3>
          </div>
          <p className="text-sm">
            Horses, mules and ponies are bought (the GM adds them in Husbandry); tamed ridge stags and tuskback boars can be ridden too.
            Pick a rider, track HP in a fight, and roll the mount&apos;s attacks here.
          </p>
          {weather.spooksMounts && (
            <p className="text-sm font-bold text-[#8b1a1a]">
              {weather.label}: mounts may panic. Riders make a DC {weather.spooksMounts} Wisdom (Animal Handling) check when the GM calls for it.
            </p>
          )}
          {mounts.length === 0 && <p className="text-sm italic">No mounts yet.</p>}
          {mounts.map((animal) => (
            <MountCard
              key={animal.id}
              animal={animal}
              characters={party}
              campaignDay={campaignDay}
              canAct={
                adminUnlocked ||
                (animal.character_id !== null && claimedCharacterIds.includes(animal.character_id)) ||
                (animal.mount_state?.rider ? claimedCharacterIds.includes(animal.mount_state.rider) : false)
              }
              onSave={(state) =>
                updateAnimal(animal.id, { mount_state: { ...(animal.mount_state || {}), ...state } })
                  .then(() => reloadRef.current())
                  .catch((error) => console.warn("Could not save the mount.", error))
              }
            />
          ))}
          <details className="rounded-lg border border-[#9a7b45] bg-[#f7e7c5] p-3 text-sm">
            <summary className="cursor-pointer font-bold">Mounted combat rules</summary>
            <div className="mt-2 space-y-2">
              {MOUNT_RULES.map((rule) => (
                <p key={rule.title}>
                  <strong>{rule.title}.</strong> {rule.body}
                </p>
              ))}
            </div>
          </details>
        </div>
      </Panel>
    </div>
  );
}

function CalendarCard({
  adminUnlocked,
  campaignDay,
  date,
  calendar,
  setCalendarValue,
}: {
  adminUnlocked: boolean;
  campaignDay: number;
  date: CalendarDate;
  calendar: CalendarSettings;
  setCalendarValue: (key: string, value: string | null) => void;
}) {
  const weather = weatherById(calendar.weather);
  const [season, setSeason] = useState<Season>(date.season);
  const [part, setPart] = useState<(typeof MONTH_PARTS)[number]>(date.part);
  const [day, setDay] = useState(date.day);
  const [yearValue, setYearValue] = useState(splitYear(date.year).value);
  const [era, setEra] = useState<Era>(splitYear(date.year).era);
  const possible = Object.keys(weatherTable(calendar.climate, date));
  const gatheringNotes = Object.entries(weather.gathering).map(([activity, effect]) =>
    effect === "closed" ? `no ${activity}` : `${activity} ${Number(effect) > 0 ? "+" : ""}${effect}`
  );

  function setToday() {
    // Day 1 of the campaign is today minus the days already played.
    const start = dayOfYearIndex(season, part, day) - (campaignDay - 1);
    setCalendarValue("start", String(start));
    setCalendarValue("year", String(toSignedYear(yearValue, era)));
  }

  return (
    <Panel>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CloudSun className="w-7 h-7" />
          <h2 className="text-3xl font-bold">Travel &amp; Camp</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3">
            <p className="text-xs uppercase tracking-wide">Today</p>
            <p className="text-2xl font-bold">{date.short}</p>
            <p className="text-sm">
              {date.yearLabel} · campaign day {campaignDay} · {CLIMATES[calendar.climate].label}
            </p>
          </div>
          <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3">
            <p className="text-xs uppercase tracking-wide">Weather</p>
            <p className="text-2xl font-bold">{weather.label}</p>
            <p className="text-sm">{weather.description}</p>
            <p className="text-xs italic">Typical for {date.part.toLowerCase()} {date.season.toLowerCase()}: {typicalTemperature(calendar.climate, date, weather.id)}.</p>
            {weather.effects.map((line) => (
              <p key={line} className="text-xs">• {line}</p>
            ))}
            {gatheringNotes.length > 0 && <p className="text-xs font-bold">Gathering today: {gatheringNotes.join(", ")}.</p>}
          </div>
        </div>
        <p className="text-xs">The GM&apos;s Pass Day moves the calendar on and rolls the next day&apos;s weather for the season.</p>

        {adminUnlocked && (
          <div className="rounded-lg border border-dashed border-[#9a7b45] p-3 space-y-2 text-sm">
            <p className="font-bold">GM: calendar and weather</p>
            <div className="flex flex-wrap items-center gap-2">
              <span>Today is</span>
              <select className={fieldClass} value={part} onChange={(event) => setPart(event.target.value as (typeof MONTH_PARTS)[number])} aria-label="Part of the season">
                {MONTH_PARTS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select className={fieldClass} value={season} onChange={(event) => setSeason(event.target.value as Season)} aria-label="Season">
                {SEASONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <span>day</span>
              <input
                type="number"
                min={1}
                max={DAYS_PER_MONTH}
                className={`${fieldClass} w-16`}
                value={day}
                onChange={(event) => setDay(Math.max(1, Math.min(DAYS_PER_MONTH, Number(event.target.value) || 1)))}
                aria-label="Day of the month"
              />
              <span>,</span>
              <input
                type="number"
                min={0}
                className={`${fieldClass} w-20`}
                value={yearValue}
                onChange={(event) => setYearValue(Math.max(0, Number(event.target.value) || 0))}
                aria-label="Year"
              />
              <select className={fieldClass} value={era} onChange={(event) => setEra(event.target.value as Era)} aria-label="Era">
                <option value="PCR">PCR</option>
                <option value="BCR">BCR</option>
              </select>
              <Button size="sm" onClick={setToday} className={darkButton}>Set date</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Climate</span>
              <select className={fieldClass} value={calendar.climate} onChange={(event) => setCalendarValue("climate", event.target.value as ClimateId)} aria-label="Climate">
                {(Object.keys(CLIMATES) as ClimateId[]).map((id) => (
                  <option key={id} value={id}>{CLIMATES[id].label}</option>
                ))}
              </select>
              <span>Weather</span>
              <select className={fieldClass} value={calendar.weather} onChange={(event) => setCalendarValue("weather", event.target.value)} aria-label="Today's weather">
                {Object.values(WEATHER).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}{possible.includes(option.id) ? "" : " (unusual now)"}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => setCalendarValue("weather", rollWeather(calendar.climate, date))} className={blueButton}>
                Reroll weather
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function MountCard({
  animal,
  characters,
  campaignDay,
  canAct,
  onSave,
}: {
  animal: AnimalRow;
  characters: TravelCharacter[];
  campaignDay: number;
  canAct: boolean;
  onSave: (state: MountState) => void;
}) {
  const species = speciesById.get(animal.species)!;
  const mount = species.mount!;
  const state = animal.mount_state || {};
  // A night's rest heals the mount fully.
  const hp = state.hp !== undefined && state.hpDay === campaignDay ? state.hp : mount.hp;
  const mode = state.mode || (mount.independent ? "independent" : "controlled");
  const rider = characters.find((character) => character.id === state.rider);
  const [amount, setAmount] = useState(1);
  const [log, setLog] = useState<string[]>([]);

  function changeHp(delta: number) {
    const next = Math.max(0, Math.min(mount.hp, hp + delta));
    onSave({ hp: next, hpDay: campaignDay });
  }

  function attack() {
    const natural = d20();
    const damage = rollDamage(mount.attack.damage);
    const crit = natural === 20 ? rollDamage(mount.attack.damage.replace(/[+-]\d+$/, "")) : null;
    setLog((current) =>
      [
        `${mount.attack.name}: ${natural} + ${mount.attack.bonus} = ${natural + mount.attack.bonus} to hit${natural === 20 ? " (critical!)" : natural === 1 ? " (miss)" : ""}. Damage ${damage.text}${crit ? ` + crit ${crit.text}` : ""} ${mount.attack.type}.`,
        ...current,
      ].slice(0, 4)
    );
  }

  function charge() {
    const die = mount.warTrained ? "1d8" : "1d6";
    const extra = rollDamage(die);
    setLog((current) => [`Charge: +${extra.text} damage on the rider's melee hit (${die}).`, ...current].slice(0, 4));
  }

  return (
    <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">
            {animal.name} <span className="text-sm font-normal">({species.name}, {mount.size}{mount.warTrained ? ", war-trained" : ""})</span>
          </p>
          <p className="text-xs">
            AC {mount.ac} · Speed {mount.speed} ft · carries {mount.carryLb} lb · {mount.attack.name} +{mount.attack.bonus} ({mount.attack.damage} {mount.attack.type})
          </p>
          {mount.trait && <p className="text-xs italic">{mount.trait}</p>}
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${hp === 0 ? "text-[#8b1a1a]" : ""}`}>
            HP {hp} / {mount.hp}
          </p>
          <div className="h-2 w-32 rounded bg-[#d9bf8c]">
            <div className="h-2 rounded bg-[#1d5c2e]" style={{ width: `${(hp / mount.hp) * 100}%` }} />
          </div>
        </div>
      </div>

      <p>
        {rider ? <>Ridden by <strong>{rider.name}</strong></> : "No rider"} · {mode === "controlled" ? "Controlled: acts on the rider's turn (Dash, Disengage or Dodge" + (mount.warTrained ? ", or attack)" : ")") : "Independent: rolls its own initiative and acts on its own"}
        {state.saddle === "military" ? " · military saddle (advantage to stay mounted)" : state.saddle === "riding" ? " · riding saddle" : " · no saddle"}
      </p>

      {canAct && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select className={fieldClass} value={state.rider || ""} onChange={(event) => onSave({ rider: event.target.value || null })} aria-label={`${animal.name}'s rider`}>
              <option value="">No rider</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>{character.name}</option>
              ))}
            </select>
            <select className={fieldClass} value={mode} onChange={(event) => onSave({ mode: event.target.value as MountState["mode"] })} aria-label={`${animal.name}'s mode`}>
              <option value="controlled">Controlled</option>
              <option value="independent">Independent</option>
            </select>
            <select className={fieldClass} value={state.saddle || "none"} onChange={(event) => onSave({ saddle: event.target.value as MountState["saddle"] })} aria-label={`${animal.name}'s saddle`}>
              <option value="none">No saddle</option>
              <option value="riding">Riding saddle</option>
              <option value="military">Military saddle</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} className={`${fieldClass} w-16`} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} aria-label={`HP change for ${animal.name}`} />
            <Button size="sm" onClick={() => changeHp(-amount)} className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7]">Damage</Button>
            <Button size="sm" onClick={() => changeHp(amount)} className="bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7]">Heal</Button>
            <Button size="sm" onClick={attack} className={darkButton} disabled={mode === "controlled" && !mount.warTrained && Boolean(rider)}>
              {mount.attack.name} attack
            </Button>
            <Button size="sm" onClick={charge} className={blueButton}>Charge bonus</Button>
          </div>
          {mode === "controlled" && !mount.warTrained && rider && (
            <p className="text-xs italic">A controlled mount that isn&apos;t war-trained can&apos;t attack; make it independent to let it fight.</p>
          )}
          {log.map((line, index) => (
            <p key={`${line}-${index}`} className="rounded bg-[#fff0c7] px-2 py-1 text-xs">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
