"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import attributeCardsJson from "@/data/attributes/attributeCards.json";

export type AttributeCardData = {
  id: number;
  name: string;
  tags: string[];
  rarity: AttributeRarity;
  score: number;
  desc: string;
};

type AttributeRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

const ATTRIBUTE_RARITY_WEIGHTS: Record<AttributeRarity, number> = {
  Common: 14,
  Uncommon: 12,
  Rare: 10,
  Epic: 7,
  Legendary: 3,
};

const ATTRIBUTE_CARDS = attributeCardsJson as AttributeCardData[];

type CharacterLike = {
  id: string;
  name: string;
  isActive?: boolean;
};

type AttributeAssignment = {
  id: string;
  campaign_id: string;
  character_id: string;
  card_id: number;
};

type VisibilityRow = {
  campaign_id: string;
  card_id: number;
  is_visible: boolean;
};

type VetoRow = {
  campaign_id: string;
  character_id: string;
  used: boolean;
};

const TAG_COLORS: Record<string, string> = {
  Adopted: "#4b153f",
  Aethros: "#105b63",
  "Arcane School": "#4f3b8f",
  Armada: "#2f2a4f",
  Armor: "#1a3a5c",
  Background: "#5b4a2c",
  Barbarian: "#333",
  Bard: "#333",
  Basic: "#3d5a3d",
  CCO: "#7b4a12",
  Class: "#4f3b8f",
  "Class Feature": "#333",
  Cleric: "#333",
  Common: "#2f4f2f",
  Crafting: "#29411e",
  "Crafting — Alchemist": "#183f4a",
  "Crafting — Leatherworker": "#384313",
  "Crafting — Smith": "#5b3a16",
  "Crafting — Tinker": "#163d3b",
  "Crafting — Weaver": "#4b153f",
  Cursed: "#8B0000",
  "DM Granted": "#5b3b8c",
  Destiny: "#a67c00",
  Dragon: "#7b2f24",
  Druid: "#333",
  Epic: "#5b2f8f",
  Feature: "#23524d",
  Fighter: "#333",
  Legendary: "#9b6b16",
  Leviathan: "#105b63",
  Monk: "#333",
  Navy: "#25466b",
  Normal: "#3d5a3d",
  "Order of the Undying Vigil": "#333",
  "Order of the Undying Vigil — Barbarian": "#333",
  "Order of the Undying Vigil — Cleric": "#333",
  "Order of the Undying Vigil — Monk": "#333",
  "Order of the Undying Vigil — Paladin": "#333",
  "Order of the Undying Vigil — Ranger": "#333",
  Paladin: "#333",
  Passive: "#2d4a2d",
  Race: "#35405c",
  "Race Base Score": "#35405c",
  Ranger: "#333",
  Rare: "#1f4f8f",
  "Religion — Eternal Flame": "#333",
  "Religion — Khevarai Nature Spirits": "#315c38",
  "Religion — Minor Sea Gods": "#333",
  "Religion — Order of the Undying Vigil": "#7a4f19",
  "Religion — Remnant Orders": "#333",
  "Religion — The Deep Current": "#105b63",
  "Religion — The Eternal Flame": "#9b3a16",
  "Religion — The Ironbound": "#59616b",
  "Religion — The Vaelthari Triad": "#333",
  "Religion — The Weaver": "#534489",
  Rogue: "#333",
  Romley: "#6b5b2a",
  Sea: "#1f6f8b",
  Sorcerer: "#333",
  Tanky: "#5a3b2c",
  "The Waking": "#3d234d",
  Uncommon: "#1f5f3a",
  Undead: "#4a5a4a",
  Verath: "#9b5c2e",
  Warlock: "#333",
  Weak: "#5c4b3a",
  Wizard: "#333",
};


function rollAttributeRarity(): AttributeRarity {
  const entries = Object.entries(ATTRIBUTE_RARITY_WEIGHTS) as [AttributeRarity, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return "Common";
}

function pickWeightedAttributeCard(pool: AttributeCardData[]): AttributeCardData | null {
  if (pool.length === 0) return null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rarity = rollAttributeRarity();
    const rarityPool = pool.filter((card) => card.rarity === rarity);
    if (rarityPool.length > 0) {
      return rarityPool[Math.floor(Math.random() * rarityPool.length)];
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}


function scoreColor(score: number) {
  if (score > 5) return "#4caf7a";
  if (score > 0) return "#9acd7a";
  if (score === 0) return "#aaa";
  if (score > -5) return "#e09050";
  return "#e05050";
}

function isCardVisible(cardId: number, visibility: Record<number, boolean>) {
  return visibility[cardId] !== false;
}

function Card({
  card,
  hidden,
  selected,
  onClick,
  compact,
}: {
  card: AttributeCardData;
  hidden?: boolean;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 transition ${onClick ? "cursor-pointer hover:-translate-y-1" : ""}`}
      style={{
        background: "linear-gradient(160deg, #1c1408 0%, #221a08 60%, #1a1205 100%)",
        border: selected ? "2px solid #d4a843" : "1px solid rgba(200,160,60,0.45)",
        opacity: hidden ? 0.35 : 1,
        boxShadow: selected
          ? "0 0 18px rgba(212,168,67,0.5), inset 0 0 30px rgba(0,0,0,0.4)"
          : "0 2px 12px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)",
        minHeight: compact ? 130 : 175,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
          style={{ borderColor: scoreColor(card.score), color: scoreColor(card.score), background: "rgba(0,0,0,0.65)" }}
        >
          {card.score > 0 ? `+${card.score}` : card.score}
        </div>
        <div className="min-w-0 flex-1 text-center font-serif text-lg font-bold text-[#e8d09a]">
          {card.name}
        </div>
      </div>

      <div className="my-2 h-px bg-gradient-to-r from-transparent via-[#9a7b45] to-transparent" />

      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: TAG_COLORS[tag] || "#333", color: "#e8d5a3", borderColor: "rgba(200,170,100,0.3)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {!compact && <p className="text-sm leading-relaxed text-[#c8b888]">{card.desc}</p>}
      {hidden && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#e09050]">Hidden from players</p>}
    </div>
  );
}

export default function AttributeCardsPanel({
  campaignId,
  characters,
  adminUnlocked,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
}) {
  const [subTab, setSubTab] = useState<"browse" | "draw" | "characters">("browse");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("All");
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});
  const [assignments, setAssignments] = useState<AttributeAssignment[]>([]);
  const [vetoRows, setVetoRows] = useState<VetoRow[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [drawPool, setDrawPool] = useState<AttributeCardData[]>([]);
  const [manualAssignCharacterId, setManualAssignCharacterId] = useState("");
  const [manualAssignCardId, setManualAssignCardId] = useState("");
  const [message, setMessage] = useState("");

  const activeCharacters = useMemo(
    () => characters.filter((character) => adminUnlocked || character.isActive !== false),
    [characters, adminUnlocked]
  );

  useEffect(() => {
    if (!selectedCharacterId && activeCharacters[0]?.id) {
      setSelectedCharacterId(activeCharacters[0].id);
    }
    if (!manualAssignCharacterId && activeCharacters[0]?.id) {
      setManualAssignCharacterId(activeCharacters[0].id);
    }
  }, [activeCharacters, selectedCharacterId, manualAssignCharacterId]);

  async function loadAttributeData() {
    if (!campaignId) return;

    const [
      { data: visibilityRows, error: visibilityError },
      { data: assignmentRows, error: assignmentError },
      { data: vetoData, error: vetoError },
    ] = await Promise.all([
      supabase.from("campaign_attribute_visibility").select("campaign_id, card_id, is_visible").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attributes").select("id, campaign_id, character_id, card_id").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attribute_vetoes").select("campaign_id, character_id, used").eq("campaign_id", campaignId),
    ]);

    if (visibilityError || assignmentError || vetoError) {
      setMessage(visibilityError?.message || assignmentError?.message || vetoError?.message || "Failed to load attributes.");
      return;
    }

    const nextVisibility: Record<number, boolean> = {};
    (visibilityRows as VisibilityRow[] | null)?.forEach((row) => {
      nextVisibility[row.card_id] = row.is_visible;
    });

    setVisibility(nextVisibility);
    setAssignments((assignmentRows as AttributeAssignment[] | null) || []);
    setVetoRows((vetoData as VetoRow[] | null) || []);
  }

  useEffect(() => {
    loadAttributeData();

    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-attributes-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_attribute_visibility", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attributes", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attribute_vetoes", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const allTags = useMemo(() => ["All", ...Array.from(new Set(ATTRIBUTE_CARDS.flatMap((card) => card.tags))).sort()], []);

  const visibleCards = useMemo(
    () => ATTRIBUTE_CARDS.filter((card) => adminUnlocked || isCardVisible(card.id, visibility)),
    [visibility, adminUnlocked]
  );

  const filteredCards = visibleCards.filter((card) => {
    const matchesSearch = `${card.name} ${card.desc}`.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tag === "All" || card.tags.includes(tag);
    return matchesSearch && matchesTag;
  });

  function characterCards(characterId: string, includeHidden = adminUnlocked) {
    const ids = assignments.filter((assignment) => assignment.character_id === characterId).map((assignment) => assignment.card_id);
    return ids
      .map((id) => ATTRIBUTE_CARDS.find((card) => card.id === id))
      .filter((card): card is AttributeCardData => Boolean(card))
      .filter((card) => includeHidden || isCardVisible(card.id, visibility));
  }

  async function toggleVisibility(card: AttributeCardData) {
    if (!adminUnlocked || !campaignId) return;

    const next = !isCardVisible(card.id, visibility);
    setVisibility((current) => ({ ...current, [card.id]: next }));

    const { error } = await supabase.from("campaign_attribute_visibility").upsert(
      {
        campaign_id: campaignId,
        card_id: card.id,
        is_visible: next,
      },
      { onConflict: "campaign_id,card_id" }
    );

    if (error) {
      setMessage(error.message);
      loadAttributeData();
    }
  }

  function tagVisibilityStats(tagName: string) {
    const taggedCards = ATTRIBUTE_CARDS.filter((card) => card.tags.includes(tagName));
    const visibleCount = taggedCards.filter((card) => isCardVisible(card.id, visibility)).length;

    return {
      total: taggedCards.length,
      visible: visibleCount,
      hidden: taggedCards.length - visibleCount,
      allVisible: taggedCards.length > 0 && visibleCount === taggedCards.length,
    };
  }

  async function setTagVisibility(tagName: string, isVisible: boolean) {
    if (!adminUnlocked || !campaignId) return;

    const taggedCards = ATTRIBUTE_CARDS.filter((card) => card.tags.includes(tagName));
    if (taggedCards.length === 0) return;

    const rows = taggedCards.map((card) => ({
      campaign_id: campaignId,
      card_id: card.id,
      is_visible: isVisible,
    }));

    setVisibility((current) => {
      const next = { ...current };
      taggedCards.forEach((card) => {
        next[card.id] = isVisible;
      });
      return next;
    });

    const { error } = await supabase
      .from("campaign_attribute_visibility")
      .upsert(rows, { onConflict: "campaign_id,card_id" });

    if (error) {
      setMessage(error.message);
      loadAttributeData();
      return;
    }

    setMessage(`${tagName} attributes are now ${isVisible ? "visible" : "hidden"}.`);
  }

  function hasVetoUsed(characterId: string) {
    return vetoRows.some((row) => row.character_id === characterId && row.used);
  }

  function drawOne(excludeCardIds: number[] = []) {
    setMessage("");
    if (!selectedCharacterId) {
      setMessage("Choose a character first.");
      return;
    }

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId).map((assignment) => assignment.card_id);
    if (owned.length >= 2) {
      setMessage("This character already has the maximum of 2 attribute cards.");
      setDrawPool([]);
      return;
    }

    const pool = ATTRIBUTE_CARDS.filter(
      (card) =>
        isCardVisible(card.id, visibility) &&
        !owned.includes(card.id) &&
        !excludeCardIds.includes(card.id)
    );

    if (pool.length === 0) {
      setMessage("No visible attribute cards are available to draw.");
      setDrawPool([]);
      return;
    }

    const drawn = pickWeightedAttributeCard(pool);
    if (!drawn) {
      setMessage("No visible attribute cards are available to draw.");
      setDrawPool([]);
      return;
    }

    setDrawPool([drawn]);
  }

  async function vetoDrawnCard() {
    if (!campaignId || !selectedCharacterId || drawPool.length === 0) return;

    const selectedCharacter = activeCharacters.find((character) => character.id === selectedCharacterId);
    if (!selectedCharacter) {
      setMessage("Choose a valid campaign character before vetoing.");
      setSelectedCharacterId(activeCharacters[0]?.id || "");
      return;
    }

    if (hasVetoUsed(selectedCharacter.id)) {
      setMessage("This character has already used their one attribute veto.");
      return;
    }

    const vetoedCardId = drawPool[0].id;

    const { error } = await supabase.from("campaign_character_attribute_vetoes").upsert(
      {
        campaign_id: campaignId,
        character_id: selectedCharacter.id,
        used: true,
      },
      { onConflict: "campaign_id,character_id" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setVetoRows((current) => [
      ...current.filter((row) => row.character_id !== selectedCharacter.id),
      { campaign_id: campaignId, character_id: selectedCharacter.id, used: true },
    ]);

    drawOne([vetoedCardId]);
  }

  async function assignCard(card: AttributeCardData) {
    if (!campaignId || !selectedCharacterId) return;

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId);
    if (owned.length >= 2) {
      setMessage("This character already has the maximum of 2 attribute cards.");
      return;
    }

    if (owned.some((assignment) => assignment.card_id === card.id)) {
      setMessage("That character already has this attribute.");
      return;
    }

    const { error } = await supabase.from("campaign_character_attributes").insert({
      campaign_id: campaignId,
      character_id: selectedCharacterId,
      card_id: card.id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${card.name} assigned.`);
    setDrawPool([]);
    loadAttributeData();
  }

  async function assignSpecificCard() {
    if (!adminUnlocked || !campaignId || !manualAssignCharacterId || !manualAssignCardId) return;

    const cardId = Number(manualAssignCardId);
    const card = ATTRIBUTE_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
      setMessage("Choose an attribute card first.");
      return;
    }

    const owned = assignments.filter((assignment) => assignment.character_id === manualAssignCharacterId);
    if (owned.length >= 2) {
      setMessage("That character already has the maximum of 2 attribute cards.");
      return;
    }

    if (owned.some((assignment) => assignment.card_id === cardId)) {
      setMessage("That character already has this attribute.");
      return;
    }

    const { error } = await supabase.from("campaign_character_attributes").insert({
      campaign_id: campaignId,
      character_id: manualAssignCharacterId,
      card_id: cardId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setManualAssignCardId("");
    setMessage(`${card.name} assigned by GM.`);
    loadAttributeData();
  }

  async function removeAssignment(characterId: string, cardId: number) {
    if (!adminUnlocked) return;

    const { error } = await supabase
      .from("campaign_character_attributes")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .eq("card_id", cardId);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAttributeData();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#9a7b45] bg-[#ead6ad] p-4 text-[#251b10] shadow-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold">Attributes</h2>
            <p className="text-sm">Browse attributes, draw one visible card at a time, and track up to 2 cards per character. Each character has one veto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["browse", "draw", "characters"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSubTab(tab)}
                className={`rounded-lg border px-3 py-2 font-serif text-sm capitalize ${subTab === tab ? "bg-[#251b10] text-[#fff0c7] border-[#251b10]" : "bg-[#fff0c7] text-[#251b10] border-[#9a7b45]"}`}
              >
                {tab === "characters" ? "Character Cards" : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 text-[#251b10]">{message}</div>}

      {subTab === "browse" && (
        <div className="space-y-4">
          {adminUnlocked && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
              <div className="mb-3">
                <h3 className="font-serif text-xl font-bold">GM Tag Visibility</h3>
                <p className="text-sm">Toggle entire attribute groups on or off without opening each card.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {allTags.filter((tagName) => tagName !== "All").map((tagName) => {
                  const stats = tagVisibilityStats(tagName);

                  return (
                    <div key={tagName} className="flex items-center gap-2 rounded-lg border border-[#9a7b45] bg-[#fff0c7] px-3 py-2">
                      <span
                        className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e8d5a3]"
                        style={{ background: TAG_COLORS[tagName] || "#333", borderColor: "rgba(200,170,100,0.3)" }}
                      >
                        {tagName}
                      </span>
                      <span className="text-xs">
                        {stats.visible}/{stats.total} visible
                      </span>
                      <button
                        onClick={() => setTagVisibility(tagName, !stats.allVisible)}
                        className={`rounded px-2 py-1 text-xs font-bold ${stats.allVisible ? "bg-[#5b1f1f] text-[#fff0c7]" : "bg-[#1f4d2e] text-[#fff0c7]"}`}
                      >
                        {stats.allVisible ? "Hide Tag" : "Show Tag"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10] md:flex-row">
            <input
              className="min-w-0 flex-1 rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
              placeholder="Search attribute cards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2" value={tag} onChange={(event) => setTag(event.target.value)}>
              {allTags.map((tagName) => <option key={tagName} value={tagName}>{tagName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => {
              const hidden = !isCardVisible(card.id, visibility);
              return (
                <div key={card.id} className="relative">
                  <Card card={card} hidden={hidden} />
                  {adminUnlocked && (
                    <button
                      onClick={() => toggleVisibility(card)}
                      className={`absolute bottom-2 right-2 rounded border px-2 py-1 text-xs font-bold ${hidden ? "bg-[#5b1f1f] text-[#fff0c7]" : "bg-[#1f4d2e] text-[#fff0c7]"}`}
                    >
                      {hidden ? "Hidden" : "Visible"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === "draw" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
            <label className="block space-y-1">
              <strong>Character</strong>
              <select className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2" value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
                {activeCharacters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name} ({characterCards(character.id).length}/2)</option>
                ))}
              </select>
            </label>
            <button onClick={() => drawOne()} className="mt-3 rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
              Draw 1 Visible Card
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {drawPool.map((card) => (
              <div key={card.id} className="space-y-3">
                <Card card={card} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => assignCard(card)} className="rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
                    Keep Attribute
                  </button>
                  <button
                    onClick={vetoDrawnCard}
                    disabled={hasVetoUsed(selectedCharacterId)}
                    className="rounded bg-[#7a3f00] px-4 py-2 font-serif text-[#fff0c7] disabled:opacity-50"
                  >
                    Veto & Draw Again
                  </button>
                </div>
                <p className="text-sm text-[#251b10]">
                  Veto: {hasVetoUsed(selectedCharacterId) ? "Used" : "Available"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "characters" && (
        <div className="space-y-4">
          {adminUnlocked && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
              <h3 className="mb-3 text-xl font-bold">GM: Assign Attribute</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select
                  className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
                  value={manualAssignCharacterId}
                  onChange={(event) => setManualAssignCharacterId(event.target.value)}
                >
                  {activeCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} ({characterCards(character.id, true).length}/2)
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
                  value={manualAssignCardId}
                  onChange={(event) => setManualAssignCardId(event.target.value)}
                >
                  <option value="">Choose attribute...</option>
                  {ATTRIBUTE_CARDS.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} {isCardVisible(card.id, visibility) ? "" : "(hidden)"}
                    </option>
                  ))}
                </select>
                <button onClick={assignSpecificCard} className="rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
                  Assign
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activeCharacters.map((character) => {
            const cards = characterCards(character.id, adminUnlocked);
            return (
              <div key={character.id} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
                <h3 className="mb-3 text-xl font-bold">{character.name} <span className="text-sm font-normal">({cards.length}/2)</span></h3>
                {cards.length === 0 ? (
                  <p className="text-sm italic">No attributes assigned.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {cards.map((card) => {
                      const hidden = !isCardVisible(card.id, visibility);
                      return (
                        <div key={card.id} className="relative">
                          <Card card={card} hidden={hidden} compact />
                          {adminUnlocked && (
                            <button
                              onClick={() => removeAssignment(character.id, card.id)}
                              className="absolute bottom-2 right-2 rounded bg-[#5b1f1f] px-2 py-1 text-xs text-[#fff0c7]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
