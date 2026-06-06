"use client";

import React, { useMemo, useState } from "react";
import {
  COMPANION_DEFINITIONS,
  type CompanionDefinition,
  type CompanionRarity,
} from "@/data/companionDefinitions";

type CompanionSubTab = "companions" | "abilities";

const RARITIES: CompanionRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

function rarityBadgeClass(rarity: string) {
  switch (rarity) {
    case "Common":
      return "bg-[#315c38]";
    case "Uncommon":
      return "bg-[#1f6f46]";
    case "Rare":
      return "bg-[#1f4f8f]";
    case "Epic":
      return "bg-[#5b2f8f]";
    case "Legendary":
      return "bg-[#9b6b16]";
    default:
      return "bg-[#333]";
  }
}

function companionAbilitiesFor(companion: CompanionDefinition) {
  const companionName = companion.name.toLowerCase();

  return COMPANION_DEFINITIONS.filter((entry) => {
    if (entry.category !== "Companion Ability") return false;

    const usedByMatch = (entry.usedBy || []).some((usedBy) => {
      const normalized = usedBy.toLowerCase();
      return normalized === companionName || normalized.includes(companionName) || companionName.includes(normalized);
    });

    const tagMatch = (entry.tags || []).some((tag) => {
      const normalized = tag.toLowerCase();
      return normalized === companionName || normalized.includes(companionName) || companionName.includes(normalized);
    });

    return usedByMatch || tagMatch;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export default function CompanionPanel() {
  const [subTab, setSubTab] = useState<CompanionSubTab>("companions");
  const [selectedCompanionId, setSelectedCompanionId] = useState("");
  const [rarity, setRarity] = useState<CompanionRarity | "Any">("Any");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("Any");

  const companions = useMemo(
    () => COMPANION_DEFINITIONS.filter((entry) => entry.category === "Companion").sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const selectedCompanion = useMemo(() => {
    return companions.find((entry) => entry.id === selectedCompanionId) || companions[0];
  }, [companions, selectedCompanionId]);

  const selectedCompanionAbilities = useMemo(() => {
    return selectedCompanion ? companionAbilitiesFor(selectedCompanion) : [];
  }, [selectedCompanion]);

  const allAbilityTags = useMemo(() => {
    const allTags = new Set<string>();

    COMPANION_DEFINITIONS
      .filter((entry) => entry.category === "Companion Ability")
      .forEach((entry) => {
        (entry.tags || []).forEach((tag) => allTags.add(tag));
      });

    return ["Any", ...Array.from(allTags).sort()];
  }, []);

  const filteredAbilities = useMemo(() => {
    const text = search.trim().toLowerCase();

    return COMPANION_DEFINITIONS
      .filter((entry) => {
        if (entry.category !== "Companion Ability") return false;

        const rarityMatch = rarity === "Any" || entry.rarity === rarity;
        const tagMatch = tagFilter === "Any" || (entry.tags || []).includes(tagFilter) || (entry.usedBy || []).includes(tagFilter);
        const textMatch =
          !text ||
          `${entry.name} ${entry.category} ${entry.rarity} ${entry.action || ""} ${entry.description} ${(entry.tags || []).join(" ")} ${(entry.usedBy || []).join(" ")}`
            .toLowerCase()
            .includes(text);

        return rarityMatch && tagMatch && textMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rarity, search, tagFilter]);

  return (
    <div className="rounded-2xl border-2 border-[#9a7b45] bg-[#ead6ad] p-6 text-[#251b10] shadow-2xl">
      <div className="mb-5">
        <h2 className="font-serif text-3xl font-bold">Companions</h2>
        <p className="mt-1 text-sm">
          Browse companions, click one to see its tagged abilities, or view the full ability codex.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSubTab("companions")}
          className={`rounded-xl border border-[#9a7b45] px-4 py-2 font-bold ${
            subTab === "companions"
              ? "bg-[#4b3115] text-[#fff0c7]"
              : "bg-[#fff0c7] text-[#251b10]"
          }`}
        >
          Companions
        </button>

        <button
          onClick={() => setSubTab("abilities")}
          className={`rounded-xl border border-[#9a7b45] px-4 py-2 font-bold ${
            subTab === "abilities"
              ? "bg-[#4b3115] text-[#fff0c7]"
              : "bg-[#fff0c7] text-[#251b10]"
          }`}
        >
          All Abilities
        </button>
      </div>

      {subTab === "companions" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-4">
            <h3 className="mb-3 font-serif text-2xl font-bold">Companion List</h3>
            <div className="max-h-[720px] space-y-2 overflow-y-auto pr-2">
              {companions.map((companion) => {
                const abilities = companionAbilitiesFor(companion);
                const selected = selectedCompanion?.id === companion.id;

                return (
                  <button
                    key={companion.id}
                    onClick={() => setSelectedCompanionId(companion.id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selected
                        ? "border-[#4b3115] bg-[#4b3115] text-[#fff0c7]"
                        : "border-[#9a7b45] bg-[#f2dfb9] text-[#251b10]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold">{companion.name}</span>
                      <span className="text-xs">{abilities.length} abilities</span>
                    </div>
                    <span className="text-xs">{companion.rarity}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCompanion && (
            <div className="space-y-4">
              <CompanionCard entry={selectedCompanion} />

              <div className="rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-4">
                <h3 className="mb-3 font-serif text-2xl font-bold">
                  {selectedCompanion.name} Abilities
                </h3>

                {selectedCompanionAbilities.length === 0 ? (
                  <p className="text-sm italic">
                    No abilities are tagged to this companion yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {selectedCompanionAbilities.map((ability) => (
                      <CompanionCard key={ability.id} entry={ability} compact />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "abilities" && (
        <div>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2"
              placeholder="Search abilities..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2"
              value={rarity}
              onChange={(event) => setRarity(event.target.value as CompanionRarity | "Any")}
            >
              <option value="Any">All Rarities</option>
              {RARITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>

            <select
              className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2 md:col-span-2"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              {allAbilityTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag === "Any" ? "All Tags / Used By" : tag}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-3 text-sm font-bold">
            Showing {filteredAbilities.length} companion abilities
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredAbilities.map((entry) => (
              <CompanionCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompanionCard({ entry, compact = false }: { entry: CompanionDefinition; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#9a7b45] bg-[#fff0c7] p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-2xl font-bold">{entry.name}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#fff0c7]">
            <span className="rounded bg-[#4b3115] px-2 py-1">{entry.category}</span>
            <span className={`rounded px-2 py-1 ${rarityBadgeClass(entry.rarity)}`}>{entry.rarity}</span>
            {entry.action && <span className="rounded bg-[#5b4630] px-2 py-1">{entry.action}</span>}
          </div>
        </div>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed">{entry.description}</p>

      {!compact && (entry.usedBy || []).length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-bold uppercase">Used By</p>
          <div className="flex flex-wrap gap-1">
            {(entry.usedBy || []).map((name) => (
              <span key={name} className="rounded border border-[#9a7b45] bg-[#ead6ad] px-2 py-0.5 text-[10px] font-bold uppercase">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {(entry.tags || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(entry.tags || []).filter((tag) => !(entry.usedBy || []).includes(tag)).slice(0, compact ? 6 : 12).map((tag) => (
            <span key={tag} className="rounded border border-[#9a7b45] bg-[#ead6ad] px-2 py-0.5 text-[10px] font-bold uppercase">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
