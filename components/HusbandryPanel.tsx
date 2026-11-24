"use client";

import React, { useEffect, useRef, useState } from "react";
import { PawPrint, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { addAnimal, fetchCampaignAnimals, releaseAnimal, updateAnimal, type AnimalRow } from "@/lib/supabaseAnimals";
import {
  HUSBANDRY_SPECIES,
  daysUntilReady,
  pickProductMaterial,
  productsFor,
  speciesById,
  type AnimalSex,
  type HusbandryProduct,
} from "@/data/husbandry";
import { lootTables, rollDiceExpression } from "@/data/lootTables";
import { CREATURE_INFO } from "@/data/creatures";
import { formatCp } from "@/data/coins";

type CharacterLike = { id: string; name: string; isActive?: boolean };
type HandlingLevel = "none" | "proficient" | "expertise";

// Animal Handling bonus and whether the character can speak with animals
// (a druid, a ranger, or anyone with Speak with Animals).
export type HandlingInfo = { bonus: number; level: HandlingLevel; speaks: boolean };

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";
const cardStyle = { background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" };

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl shadow-2xl border-2" style={cardStyle}>
      <CardContent className="p-6 md:p-8">{children}</CardContent>
    </Card>
  );
}

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function randomSex(): AnimalSex {
  return Math.random() < 0.5 ? "female" : "male";
}

function collectRoll(product: HusbandryProduct) {
  return { material: pickProductMaterial(product, Math.random()), qty: Math.max(1, rollDiceExpression(product.amount)) };
}

// Species that can be butchered: the ones with a loot table of the same id.
// Dogs and cats are companions, not livestock.
const BUTCHERABLE = new Set(lootTables.filter((table) => !CREATURE_INFO[table.id]?.kind).map((table) => table.id));

// Each listener gets its own channel name (Supabase throws on repeats).
let animalChannelCount = 0;

export default function HusbandryPanel({
  campaignId,
  characters,
  adminUnlocked,
  claimedCharacterIds,
  campaignDay,
  wildAnimals,
  onSetWildAnimal,
  handlingFor,
  onSetHandling,
  onAddMaterials,
  onButcher,
  onJournal,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
  claimedCharacterIds: string[];
  campaignDay: number;
  // Species ids the GM has placed nearby for taming.
  wildAnimals: string[];
  onSetWildAnimal: (speciesId: string, nearby: boolean) => void;
  handlingFor: (characterId: string) => HandlingInfo;
  onSetHandling: (characterId: string, change: { level?: HandlingLevel; speaks?: boolean }) => void;
  onAddMaterials: (items: { name: string; qty: number }[]) => void;
  // Puts this species on the Looting tab's table to be harvested like any creature.
  onButcher: (speciesId: string) => Promise<void>;
  onJournal?: (text: string) => void;
}) {
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tamer, setTamer] = useState("");
  const [tameNames, setTameNames] = useState<Record<string, string>>({});
  const [placeSpecies, setPlaceSpecies] = useState(HUSBANDRY_SPECIES.find((s) => s.origin === "wild")?.id || "");
  const [addSpecies, setAddSpecies] = useState(HUSBANDRY_SPECIES[0].id);
  const [addName, setAddName] = useState("");
  const [addSex, setAddSex] = useState<AnimalSex>("female");
  const [addKeeper, setAddKeeper] = useState("");
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [confirmButcher, setConfirmButcher] = useState("");
  const reloadRef = useRef(() => {});

  useEffect(() => {
    reloadRef.current = () => setVersion((value) => value + 1);
  });

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    fetchCampaignAnimals(campaignId)
      .then((rows) => {
        if (!cancelled) setAnimals(rows);
      })
      .catch((error) => console.warn("Could not load animals.", error));
    return () => {
      cancelled = true;
    };
  }, [campaignId, version]);

  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-animals-${campaignId}-${++animalChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_animals", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const visible = characters.filter((character) => adminUnlocked || character.isActive !== false);
  const nameOf = (id: string | null) => (id ? characters.find((character) => character.id === id)?.name || "Unknown" : "The party");
  const tamerOptions = adminUnlocked ? visible : visible.filter((character) => claimedCharacterIds.includes(character.id));
  const activeTamer = tamerOptions.some((character) => character.id === tamer) ? tamer : tamerOptions[0]?.id || "";

  const canTend = (animal: AnimalRow) =>
    adminUnlocked ||
    (animal.character_id ? claimedCharacterIds.includes(animal.character_id) : claimedCharacterIds.length > 0);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setVersion((value) => value + 1);
    }
  }

  function attemptTame(speciesId: string, convince: boolean) {
    const species = speciesById.get(speciesId);
    if (!species?.tameDc || !activeTamer) return;
    const handling = handlingFor(activeTamer);
    const dc = convince ? species.tameDc - 2 : species.tameDc;
    const first = d20();
    const second = convince ? d20() : 0;
    const natural = Math.max(first, second);
    const total = natural + handling.bonus;
    const success = natural !== 1 && (natural === 20 || total >= dc);
    const rolls = convince ? `${first} and ${second} (advantage) → ${natural}` : `${natural}`;
    const rollText = `${nameOf(activeTamer)} rolled ${rolls}${handling.bonus ? ` ${handling.bonus >= 0 ? "+" : "−"} ${Math.abs(handling.bonus)}` : ""} = ${total} vs DC ${dc}.`;
    const how = convince ? "convinced" : "tamed";

    run(async () => {
      onSetWildAnimal(speciesId, false);
      if (!success) {
        setMessage(`${rollText} The ${species.name.toLowerCase()} bolts. Ask the GM if there's another nearby.`);
        onJournal?.(`${rollText} The ${species.name.toLowerCase()} bolts. Ask the GM if there's another nearby.`);
        return;
      }
      const sex = randomSex();
      const name = (tameNames[speciesId] || "").trim() || `${nameOf(activeTamer)}'s ${species.name}`;
      await addAnimal({
        campaignId,
        species: species.id,
        name,
        sex,
        characterId: activeTamer,
        tamedBy: `${how} by ${nameOf(activeTamer)}`,
        today: campaignDay,
        productIds: productsFor(species, sex).map((product) => product.id),
      });
      setTameNames((current) => ({ ...current, [speciesId]: "" }));
      setMessage(`${rollText} Success! ${name} (${sex === "female" ? "a female" : "a male"} ${species.name.toLowerCase()}) has been ${how} and joins ${nameOf(activeTamer)}.`);
      onJournal?.(`${rollText} Success! ${name} (${sex === "female" ? "a female" : "a male"} ${species.name.toLowerCase()}) has been ${how} and joins ${nameOf(activeTamer)}.`);
    });
  }

  function collect(animal: AnimalRow, product: HusbandryProduct) {
    const species = speciesById.get(animal.species);
    if (!species) return;
    const { material, qty } = collectRoll(product);
    run(async () => {
      await updateAnimal(animal.id, { last_collected: { ...animal.last_collected, [product.id]: campaignDay } });
      onAddMaterials([{ name: material, qty }]);
      setMessage(`${product.label}: ${animal.name} gave ${qty}× ${material}. It's in the party's materials.`);
    });
  }

  function butcher(animal: AnimalRow) {
    const species = speciesById.get(animal.species);
    if (!species) return;
    setConfirmButcher("");
    run(async () => {
      await onButcher(species.id);
      await releaseAnimal(animal.id);
      setMessage(`${animal.name} has been slaughtered. Harvest it on the Looting tab like any creature: the cuts depend on the harvest rolls.`);
      onJournal?.(`${animal.name} has been slaughtered. Harvest it on the Looting tab like any creature: the cuts depend on the harvest rolls.`);
    });
  }

  function gmAdd() {
    const species = speciesById.get(addSpecies);
    if (!species) return;
    const name = addName.trim() || species.name;
    run(async () => {
      await addAnimal({
        campaignId,
        species: species.id,
        name,
        sex: addSex,
        characterId: addKeeper || null,
        tamedBy: species.origin === "farm" ? "bought" : "given by the GM",
        today: campaignDay,
        productIds: productsFor(species, addSex).map((product) => product.id),
      });
      setAddName("");
      setMessage(`${name} joins ${addKeeper ? nameOf(addKeeper) : "the party"}.`);
      onJournal?.(`${name} joins ${addKeeper ? nameOf(addKeeper) : "the party"}.`);
    });
  }

  const wildSpecies = HUSBANDRY_SPECIES.filter((species) => species.origin === "wild");

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PawPrint className="w-8 h-8" />
              <h2 className="text-3xl font-bold">Husbandry</h2>
            </div>
            <span className="rounded-full border border-[#9a7b45] bg-[#fff0c7] px-3 py-1 text-sm font-bold">Day {campaignDay}</span>
          </div>
          <p>
            Keep prey animals for what they give: milk, wool, eggs, shed antler, or whatever a boar roots up. Wild ones must be tamed when the GM says one is nearby. Anyone can try with <strong>Animal Handling</strong> (WIS); a <strong>druid, ranger, or anyone who can speak with animals</strong> can instead <em>convince</em> it, rolling with advantage against a lower DC. Farm animals are bought. Products come back on a schedule counted in days, and the day moves on when the GM presses Pass Day.
          </p>
          {tamerOptions.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <strong>Acting as:</strong>
              <select className={fieldClass} value={activeTamer} onChange={(event) => setTamer(event.target.value)} aria-label="Acting as">
                {tamerOptions.map((character) => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
              {activeTamer && (
                <span className="text-xs">
                  Animal Handling {handlingFor(activeTamer).bonus >= 0 ? "+" : ""}
                  {handlingFor(activeTamer).bonus}
                  {handlingFor(activeTamer).speaks ? " · can speak with animals" : ""}
                </span>
              )}
            </label>
          )}
          {!adminUnlocked && claimedCharacterIds.length === 0 && (
            <p className="rounded-lg border border-[#c97716] bg-[#ffe0a3] p-2 text-sm font-bold">Claim your character (top of the page) to tame and tend animals.</p>
          )}
          {message && <p className="font-bold">{message}</p>}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Wild animals nearby</h3>
          {wildAnimals.length === 0 && <p className="text-sm italic">Nothing nearby to tame right now.</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {wildAnimals.map((speciesId) => {
              const species = speciesById.get(speciesId);
              if (!species) return null;
              const speaks = activeTamer ? handlingFor(activeTamer).speaks : false;
              return (
                <div key={speciesId} className="space-y-2 rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-lg font-bold">A wild {species.name.toLowerCase()}</h4>
                    {adminUnlocked && (
                      <button type="button" className="text-xs underline" onClick={() => onSetWildAnimal(speciesId, false)}>
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-sm">{species.looks}</p>
                  <p className="text-xs italic">{species.temperament}</p>
                  <p className="text-xs">
                    Tame: Animal Handling DC {species.tameDc}. Convince (druid, ranger, Speak with Animals): DC {(species.tameDc || 0) - 2} with advantage.
                  </p>
                  <input
                    className={`${fieldClass} w-full`}
                    placeholder="Name it (optional)"
                    value={tameNames[speciesId] || ""}
                    onChange={(event) => setTameNames({ ...tameNames, [speciesId]: event.target.value })}
                    aria-label={`Name for the ${species.name}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className={darkButton} disabled={busy || !activeTamer} onClick={() => attemptTame(speciesId, false)}>
                      Try to tame
                    </Button>
                    <Button
                      size="sm"
                      className={blueButton}
                      disabled={busy || !activeTamer || !speaks}
                      title={speaks ? "" : "Only a druid, a ranger, or someone who can speak with animals"}
                      onClick={() => attemptTame(speciesId, true)}
                    >
                      Convince it
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {adminUnlocked && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#9a7b45] bg-[#f2dfb9] p-3 text-sm">
              <strong>GM: place a wild animal nearby</strong>
              <select className={fieldClass} value={placeSpecies} onChange={(event) => setPlaceSpecies(event.target.value)} aria-label="Wild species">
                {wildSpecies.map((species) => (
                  <option key={species.id} value={species.id}>{species.name} (DC {species.tameDc})</option>
                ))}
              </select>
              <Button size="sm" className={darkButton} disabled={wildAnimals.includes(placeSpecies)} onClick={() => onSetWildAnimal(placeSpecies, true)}>
                Place
              </Button>
              <span className="text-xs">One attempt per animal: it joins on a success and bolts on a failure.</span>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">The herd</h3>
          {animals.length === 0 && <p className="text-sm italic">No animals yet.</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {animals.map((animal) => {
              const species = speciesById.get(animal.species);
              if (!species) return null;
              const products = productsFor(species, animal.sex);
              const tend = canTend(animal);
              return (
                <div key={animal.id} className="space-y-2 rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-4">
                  <div>
                    <h4 className="text-lg font-bold">{animal.name}</h4>
                    <p className="text-xs">
                      {animal.sex === "female" ? "Female" : "Male"} {species.name.toLowerCase()} · kept by {animal.character_id ? nameOf(animal.character_id) : "the party"}
                      {animal.tamed_by ? ` · ${animal.tamed_by}` : ""}
                    </p>
                  </div>
                  {products.length === 0 && (
                    <p className="text-xs italic">{species.mount ? "A mount: ride it, and track it in combat, from the Travel & Camp tab." : "Gives nothing; good company, though."}</p>
                  )}
                  {products.map((product) => {
                    const wait = daysUntilReady(product, animal.last_collected[product.id], campaignDay);
                    const what = product.materials.map((item) => item.name).join(" / ");
                    return (
                      <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#fff0c7] px-2 py-1 text-sm">
                        <span>
                          <strong>{product.label}</strong>: {product.amount} {what}
                          <span className="block text-xs">
                            Every {product.everyDays === 1 ? "day" : `${product.everyDays} days`} · {wait === 0 ? "ready now" : `ready in ${wait} day${wait === 1 ? "" : "s"}`}
                          </span>
                        </span>
                        {tend && (
                          <Button size="sm" className={darkButton} disabled={busy || wait > 0} onClick={() => collect(animal, product)}>
                            {product.label}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" className="text-xs underline" onClick={() => setOpenDetails({ ...openDetails, [animal.id]: !openDetails[animal.id] })}>
                    {openDetails[animal.id] ? "Hide" : "Show"} details
                  </button>
                  {openDetails[animal.id] && (
                    <div className="space-y-2 text-xs">
                      <p>{species.looks}</p>
                      <p className="italic">{species.temperament}</p>
                      {tend && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className={fieldClass}
                            defaultValue={animal.name}
                            onBlur={(event) => {
                              const name = event.target.value.trim();
                              if (name && name !== animal.name) run(() => updateAnimal(animal.id, { name }));
                            }}
                            aria-label={`Rename ${animal.name}`}
                          />
                          {adminUnlocked && (
                            <>
                              <select
                                className={fieldClass}
                                value={animal.sex}
                                onChange={(event) => run(() => updateAnimal(animal.id, { sex: event.target.value as AnimalSex }))}
                                aria-label={`${animal.name} sex`}
                              >
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                              </select>
                              <select
                                className={fieldClass}
                                value={animal.character_id || ""}
                                onChange={(event) => run(() => updateAnimal(animal.id, { character_id: event.target.value || null }))}
                                aria-label={`${animal.name} keeper`}
                              >
                                <option value="">The party</option>
                                {visible.map((character) => (
                                  <option key={character.id} value={character.id}>{character.name}</option>
                                ))}
                              </select>
                            </>
                          )}
                          <button
                            type="button"
                            className="flex items-center gap-1 text-[#8b1a1a]"
                            onClick={() => run(() => releaseAnimal(animal.id))}
                            aria-label={`Release ${animal.name}`}
                          >
                            <Trash2 className="h-3 w-3" /> Release
                          </button>
                          {BUTCHERABLE.has(species.id) &&
                            (confirmButcher === animal.id ? (
                              <span className="flex items-center gap-2">
                                <span>Slaughter {animal.name} for meat?</span>
                                <Button size="sm" className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7]" disabled={busy} onClick={() => butcher(animal)}>
                                  Butcher
                                </Button>
                                <button type="button" className="underline" onClick={() => setConfirmButcher("")}>Cancel</button>
                              </span>
                            ) : (
                              <button type="button" className="font-bold underline" onClick={() => setConfirmButcher(animal.id)}>
                                Butcher for meat
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {adminUnlocked && (
        <Panel>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">GM tools</h3>
            <div className="space-y-2">
              <strong>Add an animal (bought, gifted, or raised)</strong>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select className={fieldClass} value={addSpecies} onChange={(event) => setAddSpecies(event.target.value)} aria-label="Species to add">
                  {HUSBANDRY_SPECIES.map((species) => (
                    <option key={species.id} value={species.id}>
                      {species.name}
                      {species.priceCp ? ` (about ${formatCp(species.priceCp)})` : ""}
                    </option>
                  ))}
                </select>
                <select className={fieldClass} value={addSex} onChange={(event) => setAddSex(event.target.value as AnimalSex)} aria-label="Sex">
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
                <select className={fieldClass} value={addKeeper} onChange={(event) => setAddKeeper(event.target.value)} aria-label="Keeper">
                  <option value="">The party</option>
                  {visible.map((character) => (
                    <option key={character.id} value={character.id}>{character.name}</option>
                  ))}
                </select>
                <input className={fieldClass} placeholder="Name" value={addName} onChange={(event) => setAddName(event.target.value)} aria-label="Animal name" />
                <Button size="sm" className={darkButton} disabled={busy} onClick={gmAdd}>
                  Add
                </Button>
              </div>
              <p className="text-xs">Prices are a guide; take the coins from the buyer&apos;s purse on the Inventory tab.</p>
            </div>

            <div className="space-y-2">
              <strong>Animal Handling and speaking with animals</strong>
              <p className="text-xs">Animal Handling uses WIS plus proficiency. Tick the box for druids, rangers and anyone who can cast or has Speak with Animals.</p>
              <div className="space-y-1">
                {visible.map((character) => {
                  const handling = handlingFor(character.id);
                  return (
                    <div key={character.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-[#fff0c7] px-2 py-1 text-sm">
                      <strong className="w-40">{character.name}</strong>
                      <select
                        className={fieldClass}
                        value={handling.level}
                        onChange={(event) => onSetHandling(character.id, { level: event.target.value as HandlingLevel })}
                        aria-label={`${character.name} Animal Handling`}
                      >
                        <option value="none">Not proficient</option>
                        <option value="proficient">Proficient</option>
                        <option value="expertise">Expertise</option>
                      </select>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={handling.speaks}
                          onChange={(event) => onSetHandling(character.id, { speaks: event.target.checked })}
                        />
                        Druid, ranger or Speak with Animals
                      </label>
                      <span className="text-xs">Total {handling.bonus >= 0 ? "+" : ""}{handling.bonus}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
