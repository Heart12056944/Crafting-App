"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { fetchCampaignInventory, spendInventoryUse, type InventoryRow } from "@/lib/supabaseInventory";
import { Button } from "@/components/ui/button";
import {
  DISEASES,
  INJURIES,
  SAVES_TO_RECOVER,
  afflictionEffect,
  afflictionName,
  diseaseByKey,
  injuryByKey,
  newAfflictionId,
  rollInjury,
  type Affliction,
} from "@/data/afflictions";
import { bonusCapacity, coinWeight, encumbrance, rowWeight, unitWeight } from "@/data/weights";
import { DOWNTIME_ACTIVITIES, trainingDaysNeeded, type Downtime, type DowntimeActivity } from "@/data/downtime";
import { fetchCampaignAnimals, type AnimalRow } from "@/lib/supabaseAnimals";
import { fetchPurses, type PurseRow } from "@/lib/supabaseCoins";
import { formatCoins } from "@/data/coins";
import { profBonus, proficiencyBonusForLevel, clampLevel } from "@/data/abilityScores";
import { gatheringActivities, type GatheringActivity } from "@/data/gatheringSpots";
import { speciesById } from "@/data/husbandry";
import { ATTRIBUTE_CARDS } from "@/data/attributeCards";

// One page per character: abilities, skills, tools, cards, coins, what they
// carry and the animals they keep. The GM can flip between every character;
// players only see their own.

type Proficiency = "none" | "proficient" | "expertise";
type SheetCharacter = {
  id: string;
  name: string;
  isActive?: boolean;
  level?: number;
  stats: Record<string, number>;
  tools: Record<string, Proficiency>;
  ownedTools?: Record<string, boolean>;
  brokenTools?: Record<string, boolean>;
  harvesting: number;
  harvestingProficiency?: Proficiency;
  animalHandling?: Proficiency;
  gatheringSkills?: Partial<Record<GatheringActivity, Proficiency>>;
  daysWithoutFood?: number;
  exhaustion?: number;
  afflictions?: Affliction[];
  downtime?: Downtime;
};

const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";
const smallButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const TOOL_NAMES = [
  "Smith", "Tinker", "Weaver", "Leatherworker", "Alchemist", "Poisoner", "Carpenter", "Carver", "Woodcarver", "Jeweler", "Fletcher",
  "Tattoo Artist Needles", "Herbalism Kit", "Brewer's Supplies", "Cook's Utensils",
];

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
const STAT_NAMES: Record<string, string> = { STR: "Strength", DEX: "Dexterity", CON: "Constitution", INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma" };
const fmt = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const profLabel = (level?: Proficiency) => (level === "expertise" ? "Expertise" : level === "proficient" ? "Proficient" : "");

let sheetChannelCount = 0;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3 space-y-2">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}

export default function MyCharacterPanel({
  campaignId,
  adminUnlocked,
  characters,
  characterIds,
  finalScoresById,
  cardIdsById,
  campaignDay,
  canEdit,
  trainingDiscount,
  onUpdate,
}: {
  // Whether this viewer may change this character (GM, or the player who claimed it).
  canEdit: (characterId: string) => boolean;
  trainingDiscount: number;
  onUpdate: (characterId: string, changes: { afflictions?: Affliction[]; downtime?: Downtime }, journal?: string) => void;
  campaignId: string;
  adminUnlocked: boolean;
  characters: SheetCharacter[];
  characterIds: string[];
  finalScoresById: Map<string, Record<string, number> | null>;
  cardIdsById: Map<string, number[]>;
  campaignDay: number;
}) {
  const shown = characters.filter((character) => characterIds.includes(character.id));
  const [selectedId, setSelectedId] = useState("");
  const selected = shown.find((character) => character.id === selectedId) || shown[0];
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [purses, setPurses] = useState<PurseRow[]>([]);
  const [newInjury, setNewInjury] = useState("");
  const [newDisease, setNewDisease] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      const [items, herd, coins] = await Promise.all([
        fetchCampaignInventory(campaignId).catch(() => []),
        fetchCampaignAnimals(campaignId).catch(() => []),
        fetchPurses(campaignId).catch(() => []),
      ]);
      setInventory(items);
      setAnimals(herd);
      setPurses(coins);
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const reload = () => reloadRef.current();
    const channel = supabase
      .channel(`campaign-sheet-${campaignId}-${++sheetChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_inventory_items", filter: `campaign_id=eq.${campaignId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_animals", filter: `campaign_id=eq.${campaignId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_purses", filter: `campaign_id=eq.${campaignId}` }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  if (shown.length === 0) {
    return (
      <Card className="rounded-2xl border-2" style={{ background: "#f2dfb9", borderColor: "#9a7b45", color: "#251b10" }}>
        <CardContent className="p-6 font-serif">
          <p className="text-lg font-bold">No character yet.</p>
          <p className="text-sm">Claim your character in the bar above and their sheet will show here.</p>
        </CardContent>
      </Card>
    );
  }

  const character = selected!;
  const level = clampLevel(character.level);
  const pb = proficiencyBonusForLevel(level);
  const scores = finalScoresById.get(character.id) || null;
  const stats = character.stats || {};
  const held = inventory.filter((item) => item.character_id === character.id);
  const herd = animals.filter((animal) => animal.character_id === character.id || animal.mount_state?.rider === character.id);
  const purse = purses.find((row) => row.holder === character.id);
  const cards = (cardIdsById.get(character.id) || []).map((id) => ATTRIBUTE_CARDS.find((card) => card.id === id)).filter(Boolean);
  const proficientTools = Object.entries(character.tools || {}).filter(([, level]) => level && level !== "none");
  const ownedTools = Object.entries(character.ownedTools || {}).filter(([, owned]) => owned).map(([tool]) => tool);
  const exhaustion = character.exhaustion ?? 0;
  const strength = scores?.STR ?? 10 + 2 * (stats.STR ?? 0);
  const itemsWeight = held.reduce((sum, item) => sum + rowWeight(item), 0);
  const coinsWeight = coinWeight(purse);
  const carried = Math.round((itemsWeight + coinsWeight) * 100) / 100;
  const load = encumbrance(carried, strength, bonusCapacity(held));

  const skills = [
    { name: "Harvesting", stat: "WIS", total: character.harvesting, level: character.harvestingProficiency },
    { name: "Animal Handling", stat: "WIS", total: (stats.WIS ?? 0) + profBonus(character.animalHandling, level), level: character.animalHandling },
    ...(Object.keys(gatheringActivities) as GatheringActivity[]).map((activity) => {
      const info = gatheringActivities[activity];
      const skill = character.gatheringSkills?.[activity];
      return { name: info.label, stat: info.stat, total: (stats[info.stat] ?? 0) + profBonus(skill, level), level: skill };
    }),
  ];

  return (
    <div className="space-y-4 font-serif text-[#251b10]">
      {shown.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Characters">
          {shown.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedId(option.id)}
              className="rounded-t-lg border-2 border-b-0 px-4 py-2 text-sm font-bold"
              style={{
                borderColor: "#9a7b45",
                background: option.id === character.id ? "#4b3115" : "#e7d0a3",
                color: option.id === character.id ? "#fff0c7" : "#251b10",
              }}
              aria-pressed={option.id === character.id}
            >
              {option.name}
              {option.isActive === false ? " (not in play)" : ""}
            </button>
          ))}
        </nav>
      )}

      <Card className="rounded-2xl shadow-2xl border-2" style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45" }}>
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserRound className="h-8 w-8" />
              <div>
                <h2 className="text-3xl font-bold">{character.name}</h2>
                <p className="text-sm">
                  Level {level} · Proficiency bonus +{pb}
                  {adminUnlocked && character.isActive === false ? " · not in play yet" : ""}
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className={exhaustion ? "font-bold text-[#8b1a1a]" : ""}>
                {exhaustion ? `Exhaustion ${exhaustion} (−${exhaustion * 2} to d20 tests, −${exhaustion * 5} ft speed)` : "No exhaustion"}
              </p>
              {(character.daysWithoutFood ?? 0) > 0 && <p>{character.daysWithoutFood} day(s) without food</p>}
              <p>Day {campaignDay}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {STATS.map((stat) => (
              <div key={stat} className="rounded-xl border-2 border-[#9a7b45] bg-[#fff0c7] p-2 text-center">
                <p className="text-xs font-bold uppercase">{STAT_NAMES[stat]}</p>
                <p className="text-2xl font-bold">{fmt(stats[stat] ?? 0)}</p>
                {scores && <p className="text-xs">score {scores[stat]}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Section title="Skills">
              <div className="grid grid-cols-1 gap-1 text-sm">
                {skills.map((skill) => (
                  <p key={skill.name} className="flex justify-between border-b border-[#e0c896]">
                    <span>
                      {skill.name} <span className="text-xs">({skill.stat}{profLabel(skill.level) ? `, ${profLabel(skill.level)}` : ""})</span>
                    </span>
                    <strong>{fmt(skill.total)}</strong>
                  </p>
                ))}
              </div>
            </Section>

            <Section title="Tools">
              {proficientTools.length === 0 && <p className="text-sm italic">No tool proficiencies.</p>}
              {proficientTools.map(([tool, toolLevel]) => (
                <p key={tool} className="text-sm">
                  <strong>{tool}</strong> · {profLabel(toolLevel as Proficiency)} (+{profBonus(toolLevel as Proficiency, level)})
                  {character.ownedTools?.[tool] ? (character.brokenTools?.[tool] ? " · owned (broken)" : " · owned") : ""}
                </p>
              ))}
              {ownedTools.filter((tool) => !character.tools?.[tool] || character.tools[tool] === "none").length > 0 && (
                <p className="text-xs">
                  Also owns: {ownedTools.filter((tool) => !character.tools?.[tool] || character.tools[tool] === "none").join(", ")}
                </p>
              )}
            </Section>

            <Section title="Attribute cards">
              {cards.length === 0 && <p className="text-sm italic">None.</p>}
              {cards.map((card) => (
                <details key={card!.id} className="text-sm">
                  <summary className="cursor-pointer font-bold">{card!.name}</summary>
                  <p className="text-xs">{card!.desc}</p>
                </details>
              ))}
            </Section>

            <Section title="Coin purse">
              <p className="text-lg font-bold">{purse ? formatCoins(purse) : "Empty"}</p>
            </Section>
          </div>

          <AfflictionsSection
            character={character}
            adminUnlocked={adminUnlocked}
            editable={canEdit(character.id)}
            campaignDay={campaignDay}
            inventory={inventory.filter((item) => item.character_id === character.id || item.character_id === null)}
            busy={busy}
            note={note}
            newInjury={newInjury}
            newDisease={newDisease}
            setNewInjury={setNewInjury}
            setNewDisease={setNewDisease}
            update={(afflictions, journal) => onUpdate(character.id, { afflictions }, journal)}
            treat={async (row, affliction, cures) => {
              setBusy(true);
              try {
                await spendInventoryUse(row);
                const rest = (character.afflictions || []).filter((item) => item.id !== affliction.id);
                const next = cures ? rest : [...rest, { ...affliction, helped: true }];
                const text = cures
                  ? `${character.name} was treated with ${row.name}: ${afflictionName(affliction)} is cured.`
                  : `${character.name} took ${row.name}: advantage on the next save against ${afflictionName(affliction).toLowerCase()}.`;
                onUpdate(character.id, { afflictions: next }, text);
                setNote(text);
                await reloadRef.current();
              } catch (error) {
                setNote(error instanceof Error ? error.message : "Couldn't use that.");
              } finally {
                setBusy(false);
              }
            }}
          />

          <DowntimeSection
            character={character}
            editable={canEdit(character.id)}
            trainingDiscount={trainingDiscount}
            update={(downtime) => onUpdate(character.id, { downtime })}
          />

          <Section title={`Inventory (${held.reduce((sum, item) => sum + item.qty, 0)} items)`}>
            <div className="space-y-1">
              <p className={`text-sm ${load.over ? "font-bold text-[#8b1a1a]" : ""}`}>
                Carrying <strong>{carried} lb</strong> of {load.capacity} lb ({load.status})
                {coinsWeight ? <span className="text-xs"> · coins {Math.round(coinsWeight * 100) / 100} lb</span> : null}
              </p>
              <div className="h-2 w-full rounded bg-[#d9bf8c]">
                <div
                  className="h-2 rounded"
                  style={{ width: `${Math.min(100, (carried / Math.max(1, load.capacity)) * 100)}%`, background: load.over ? "#8b1a1a" : load.near ? "#b8860b" : "#1d5c2e" }}
                />
              </div>
              <p className="text-xs">
                STR {strength}: carrying capacity {load.capacity} lb (STR × 15{load.capacity > strength * 15 ? ", plus a bigger pack" : ""}); push, drag or lift up to {load.lift} lb.
              </p>
            </div>
            {held.length === 0 && <p className="text-sm italic">Carrying nothing.</p>}
            <div className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
              {held.map((item) => (
                <p key={item.id} className="flex justify-between border-b border-[#e0c896]">
                  <span>
                    {item.name}
                    {item.quality && item.quality !== "Normal" ? <span className="text-xs"> ({item.quality})</span> : ""}
                    {item.metadata?.consumable && (item.metadata.usesPerItem ?? 1) > 1 ? (
                      <span className="text-xs"> · {item.metadata.usesLeft ?? item.metadata.usesPerItem}/{item.metadata.usesPerItem} uses</span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="text-xs">{Math.round(unitWeight(item) * item.qty * 100) / 100} lb</span> <strong>×{item.qty}</strong>
                  </span>
                </p>
              ))}
            </div>
          </Section>

          <Section title="Tamed creatures and mounts">
            {herd.length === 0 && <p className="text-sm italic">No animals.</p>}
            {herd.map((animal) => {
              const species = speciesById.get(animal.species);
              const mount = species?.mount;
              const hp = mount
                ? animal.mount_state?.hp !== undefined && animal.mount_state?.hpDay === campaignDay
                  ? animal.mount_state.hp
                  : mount.hp
                : null;
              return (
                <p key={animal.id} className="text-sm">
                  <strong>{animal.name}</strong> · {species?.name || animal.species}
                  {animal.sex ? ` (${animal.sex})` : ""}
                  {mount ? ` · mount, HP ${hp}/${mount.hp}, AC ${mount.ac}, speed ${mount.speed} ft` : ""}
                  {animal.mount_state?.rider === character.id ? " · riding it" : ""}
                  {animal.character_id !== character.id ? " · belongs to someone else" : ""}
                </p>
              );
            })}
          </Section>
        </CardContent>
      </Card>
    </div>
  );
}

function AfflictionsSection({
  character,
  adminUnlocked,
  editable,
  campaignDay,
  inventory,
  busy,
  note,
  newInjury,
  newDisease,
  setNewInjury,
  setNewDisease,
  update,
  treat,
}: {
  character: SheetCharacter;
  adminUnlocked: boolean;
  editable: boolean;
  campaignDay: number;
  inventory: InventoryRow[];
  busy: boolean;
  note: string;
  newInjury: string;
  newDisease: string;
  setNewInjury: (value: string) => void;
  setNewDisease: (value: string) => void;
  update: (afflictions: Affliction[], journal?: string) => void;
  treat: (row: InventoryRow, affliction: Affliction, cures: boolean) => void;
}) {
  const afflictions = character.afflictions || [];
  const add = (affliction: Omit<Affliction, "id" | "since">, journal: string) =>
    update([...afflictions, { ...affliction, id: newAfflictionId(), since: campaignDay }], journal);

  return (
    <Section title="Injuries and illness">
      {afflictions.length === 0 && <p className="text-sm italic">Healthy.</p>}
      {afflictions.map((affliction) => {
        const disease = affliction.type === "disease" ? diseaseByKey.get(affliction.key) : undefined;
        const injury = affliction.type === "injury" ? injuryByKey.get(affliction.key) : undefined;
        const usable = disease
          ? inventory.filter((row) => row.qty > 0 && [...disease.cures, ...disease.helps].some((name) => name.toLowerCase() === row.name.toLowerCase()))
          : [];
        return (
          <div key={affliction.id} className="rounded border border-[#e0c896] bg-[#fff6dc] p-2 text-sm space-y-1">
            <p>
              <strong>{afflictionName(affliction)}</strong>
              {disease && ` · stage ${affliction.stage || 1}, ${affliction.successes || 0}/${SAVES_TO_RECOVER} saves${affliction.helped ? " · treated (advantage next save)" : ""}`}
              {injury &&
                (injury.healDays === null || affliction.daysLeft === null
                  ? " · permanent (needs powerful magic)"
                  : ` · heals in ${affliction.daysLeft ?? injury.healDays} day(s)`)}
            </p>
            <p className="text-xs">{afflictionEffect(affliction)}</p>
            {disease && (
              <p className="text-xs">
                DC {disease.dc} CON save each Pass Day. Cured by {disease.cures.join(" or ")}; {disease.helps.join(" or ")} helps.
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {editable &&
                usable.map((row) => {
                  const cures = disease!.cures.some((name) => name.toLowerCase() === row.name.toLowerCase());
                  return (
                    <Button key={row.id} size="sm" disabled={busy} className={smallButton} onClick={() => treat(row, affliction, cures)}>
                      {cures ? "Cure" : "Treat"} with {row.name}
                      {row.character_id === null ? " (stash)" : ""}
                    </Button>
                  );
                })}
              {adminUnlocked && (
                <button
                  className="underline text-[#8b1a1a]"
                  onClick={() =>
                    update(
                      afflictions.filter((item) => item.id !== affliction.id),
                      `${character.name}'s ${afflictionName(affliction).toLowerCase()} is gone.`
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
      {note && <p className="text-xs font-bold">{note}</p>}
      {adminUnlocked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#e0c896] pt-2 text-xs">
          <Button
            size="sm"
            className={smallButton}
            onClick={() => {
              const { roll, injury } = rollInjury();
              add(
                { type: "injury", key: injury.key, daysLeft: injury.healDays },
                `${character.name} rolled ${roll} for a lingering injury: ${injury.name}. ${injury.effect}`
              );
            }}
          >
            Roll lingering injury
          </Button>
          <select className={fieldClass} value={newInjury} onChange={(event) => setNewInjury(event.target.value)} aria-label="Injury to add">
            <option value="">Add an injury...</option>
            {INJURIES.map((injury) => (
              <option key={injury.key} value={injury.key}>{injury.name}</option>
            ))}
          </select>
          {newInjury && (
            <button
              className="underline"
              onClick={() => {
                const injury = injuryByKey.get(newInjury)!;
                add({ type: "injury", key: injury.key, daysLeft: injury.healDays }, `${character.name} suffered an injury: ${injury.name}.`);
                setNewInjury("");
              }}
            >
              Add
            </button>
          )}
          <select className={fieldClass} value={newDisease} onChange={(event) => setNewDisease(event.target.value)} aria-label="Disease to add">
            <option value="">Add a disease...</option>
            {DISEASES.map((disease) => (
              <option key={disease.key} value={disease.key}>{disease.name}</option>
            ))}
          </select>
          {newDisease && (
            <button
              className="underline"
              onClick={() => {
                const disease = diseaseByKey.get(newDisease)!;
                add({ type: "disease", key: disease.key, stage: 1, successes: 0 }, `${character.name} has caught ${disease.name.toLowerCase()}.`);
                setNewDisease("");
              }}
            >
              Add
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function DowntimeSection({
  character,
  editable,
  trainingDiscount,
  update,
}: {
  character: SheetCharacter;
  editable: boolean;
  trainingDiscount: number;
  update: (downtime: Downtime) => void;
}) {
  const downtime = character.downtime || { activity: "none" as DowntimeActivity };
  const info = DOWNTIME_ACTIVITIES.find((item) => item.id === downtime.activity) || DOWNTIME_ACTIVITIES[0];
  const learnable = TOOL_NAMES.filter((tool) => !character.tools?.[tool] || character.tools[tool] === "none");
  const needed = trainingDaysNeeded(character.stats?.INT ?? 0, trainingDiscount);

  return (
    <Section title="Downtime">
      <p className="text-sm">
        <strong>{info.label}</strong>
        {downtime.activity === "training" && downtime.target ? `: ${downtime.target} (${downtime.daysDone || 0}/${needed} days)` : ""}
        {downtime.activity === "research" && downtime.target ? `: "${downtime.target}" (${downtime.daysDone || 0} days so far)` : ""}
      </p>
      <p className="text-xs">{info.description} Downtime happens each Pass Day.</p>
      {editable && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            className={fieldClass}
            value={downtime.activity}
            onChange={(event) => update({ activity: event.target.value as DowntimeActivity, daysDone: 0 })}
            aria-label={`${character.name}'s downtime`}
          >
            {DOWNTIME_ACTIVITIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {downtime.activity === "training" && (
            <select
              className={fieldClass}
              value={downtime.target || ""}
              onChange={(event) => update({ ...downtime, target: event.target.value, daysDone: 0 })}
              aria-label="Tool to learn"
            >
              <option value="">Choose a tool to learn...</option>
              {learnable.map((tool) => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>
          )}
          {downtime.activity === "research" && (
            <input
              className={fieldClass}
              placeholder="What are you researching?"
              defaultValue={downtime.target || ""}
              onBlur={(event) => update({ ...downtime, target: event.target.value })}
              aria-label="Research topic"
            />
          )}
        </div>
      )}
    </Section>
  );
}
