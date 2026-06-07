"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import attributeCardsJson from "@/data/attributes/attributeCards.json";

export type AttributeCardData = {
  id: number;
  name: string;
  tags: string[];
  score: number;
  desc: string;
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

type AttributeRollLimit = {
  campaign_id: string;
  character_id: string;
  max_rolls: number;
};

type VisibilityRow = {
  campaign_id: string;
  card_id: number;
  is_visible: boolean;
};

const TAG_COLORS: Record<string, string> = {
  Cursed: "#8B0000",
  Passive: "#2d4a2d",
  Legendary: "#7B5800",
  Armor: "#1a3a5c",
};

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
  const [rollLimits, setRollLimits] = useState<Record<string, number>>({});
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [drawPool, setDrawPool] = useState<AttributeCardData[]>([]);
  const [message, setMessage] = useState("");

  const activeCharacters = useMemo(
    () => characters.filter((character) => adminUnlocked || character.isActive !== false),
    [characters, adminUnlocked]
  );

  useEffect(() => {
    if (!selectedCharacterId && activeCharacters[0]?.id) {
      setSelectedCharacterId(activeCharacters[0].id);
    }
  }, [activeCharacters, selectedCharacterId]);

  async function loadAttributeData() {
    if (!campaignId) return;

    const [
      { data: visibilityRows, error: visibilityError },
      { data: assignmentRows, error: assignmentError },
      { data: limitRows, error: limitError },
    ] = await Promise.all([
      supabase.from("campaign_attribute_visibility").select("campaign_id, card_id, is_visible").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attributes").select("id, campaign_id, character_id, card_id").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attribute_roll_limits").select("campaign_id, character_id, max_rolls").eq("campaign_id", campaignId),
    ]);

    if (visibilityError || assignmentError || limitError) {
      setMessage(visibilityError?.message || assignmentError?.message || limitError?.message || "Failed to load attributes.");
      return;
    }

    const nextVisibility: Record<number, boolean> = {};
    (visibilityRows as VisibilityRow[] | null)?.forEach((row) => {
      nextVisibility[row.card_id] = row.is_visible;
    });

    const nextRollLimits: Record<string, number> = {};
    (limitRows as AttributeRollLimit[] | null)?.forEach((row) => {
      nextRollLimits[row.character_id] = row.max_rolls;
    });

    setVisibility(nextVisibility);
    setAssignments((assignmentRows as AttributeAssignment[] | null) || []);
    setRollLimits(nextRollLimits);
  }

  useEffect(() => {
    loadAttributeData();

    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-attributes-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_attribute_visibility", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attributes", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attribute_roll_limits", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
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

  function characterRollLimit(characterId: string) {
    return rollLimits[characterId] ?? 2;
  }

  async function updateCharacterRollLimit(characterId: string, nextLimit: number) {
    if (!adminUnlocked || !campaignId) return;

    const safeLimit = Math.max(0, nextLimit);
    setRollLimits((current) => ({ ...current, [characterId]: safeLimit }));

    const { error } = await supabase.from("campaign_character_attribute_roll_limits").upsert(
      {
        campaign_id: campaignId,
        character_id: characterId,
        max_rolls: safeLimit,
      },
      { onConflict: "campaign_id,character_id" }
    );

    if (error) {
      setMessage(error.message);
      loadAttributeData();
    }
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

  function drawOne() {
    setMessage("");
    if (!selectedCharacterId) {
      setMessage("Choose a character first.");
      return;
    }

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId).map((assignment) => assignment.card_id);
    const maxRolls = characterRollLimit(selectedCharacterId);
    if (owned.length >= maxRolls) {
      setMessage(`This character has already rolled their current maximum of ${maxRolls} attribute card${maxRolls === 1 ? "" : "s"}.`);
      setDrawPool([]);
      return;
    }

    const pool = ATTRIBUTE_CARDS.filter((card) => isCardVisible(card.id, visibility) && !owned.includes(card.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setDrawPool(shuffled.slice(0, 1));
  }

  async function assignCard(card: AttributeCardData) {
    if (!campaignId || !selectedCharacterId) return;

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId);
    const maxRolls = characterRollLimit(selectedCharacterId);
    if (owned.length >= maxRolls) {
      setMessage(`This character has already rolled their current maximum of ${maxRolls} attribute card${maxRolls === 1 ? "" : "s"}.`);
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
            <p className="text-sm">Browse attributes, choose which character is drawing, and permanently track each character’s rolled attributes.</p>
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
              <strong>Drawing Character</strong>
              <select className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2" value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
                {activeCharacters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name} ({characterCards(character.id).length}/{characterRollLimit(character.id)})</option>
                ))}
              </select>
            </label>

            {adminUnlocked && selectedCharacterId && (
              <div className="mt-3 rounded border border-[#9a7b45] bg-[#fff0c7] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <strong>Roll Limit</strong>
                  <button
                    onClick={() => updateCharacterRollLimit(selectedCharacterId, characterRollLimit(selectedCharacterId) - 1)}
                    className="rounded bg-[#5b1f1f] px-3 py-1 text-[#fff0c7]"
                  >
                    -
                  </button>
                  <span className="min-w-8 text-center font-bold">{characterRollLimit(selectedCharacterId)}</span>
                  <button
                    onClick={() => updateCharacterRollLimit(selectedCharacterId, characterRollLimit(selectedCharacterId) + 1)}
                    className="rounded bg-[#1f4d2e] px-3 py-1 text-[#fff0c7]"
                  >
                    +
                  </button>
                  <span className="text-sm italic">GM can increase/decrease how many attributes this character may roll.</span>
                </div>
              </div>
            )}

            <p className="mt-2 text-sm italic">
              Players choose which character they are drawing for. The card is drawn only from currently visible attributes.
            </p>
            <button onClick={drawOne} className="mt-3 rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
              Draw 1 Visible Card
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {drawPool.map((card) => <Card key={card.id} card={card} onClick={() => assignCard(card)} />)}
          </div>
        </div>
      )}

      {subTab === "characters" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activeCharacters.map((character) => {
            const cards = characterCards(character.id, adminUnlocked);
            return (
              <div key={character.id} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-bold">{character.name} <span className="text-sm font-normal">({cards.length}/{characterRollLimit(character.id)})</span></h3>
                  {adminUnlocked && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold">Roll limit</span>
                      <button
                        onClick={() => updateCharacterRollLimit(character.id, characterRollLimit(character.id) - 1)}
                        className="rounded bg-[#5b1f1f] px-2 py-1 text-[#fff0c7]"
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center font-bold">{characterRollLimit(character.id)}</span>
                      <button
                        onClick={() => updateCharacterRollLimit(character.id, characterRollLimit(character.id) + 1)}
                        className="rounded bg-[#1f4d2e] px-2 py-1 text-[#fff0c7]"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
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
      )}
    </div>
  );
}
