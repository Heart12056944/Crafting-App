"use client";

import React, { useMemo, useState } from "react";
import {
  COMPANION_CATEGORIES,
  COMPANION_DEFINITIONS,
  type CompanionCategory,
  type CompanionDefinition,
  type CompanionRarity,
} from "@/data/companionDefinitions";

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

export default function CompanionPanel() {
  const [activeCategory, setActiveCategory] = useState<CompanionCategory>("Companion");
  const [rarity, setRarity] = useState<CompanionRarity | "Any">("Any");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("Any");

  const tags = useMemo(() => {
    const allTags = new Set<string>();

    COMPANION_DEFINITIONS
      .filter((entry) => entry.category === activeCategory)
      .forEach((entry) => {
        (entry.tags || []).forEach((tag) => allTags.add(tag));
      });

    return ["Any", ...Array.from(allTags).sort()];
  }, [activeCategory]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();

    return COMPANION_DEFINITIONS
      .filter((entry) => {
        const categoryMatch = entry.category === activeCategory;
        const rarityMatch = rarity === "Any" || entry.rarity === rarity;
        const tagMatch = tagFilter === "Any" || (entry.tags || []).includes(tagFilter);
        const textMatch =
          !text ||
          `${entry.name} ${entry.category} ${entry.rarity} ${entry.description} ${(entry.tags || []).join(" ")}`
            .toLowerCase()
            .includes(text);

        return categoryMatch && rarityMatch && tagMatch && textMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, rarity, search, tagFilter]);

  return (
    <div className="rounded-2xl border-2 border-[#9a7b45] bg-[#ead6ad] p-6 text-[#251b10] shadow-2xl">
      <div className="mb-5">
        <h2 className="font-serif text-3xl font-bold">Companions</h2>
        <p className="mt-1 text-sm">
          Browse actual companions and companion abilities separately from the normal Rewards tab.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {COMPANION_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => {
              setActiveCategory(category);
              setRarity("Any");
              setSearch("");
              setTagFilter("Any");
            }}
            className={`rounded-xl border border-[#9a7b45] px-4 py-2 font-bold ${
              activeCategory === category
                ? "bg-[#4b3115] text-[#fff0c7]"
                : "bg-[#fff0c7] text-[#251b10]"
            }`}
          >
            {category === "Companion" ? "Actual Companions" : "Companion Abilities"}
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2"
          placeholder="Search..."
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
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag === "Any" ? "All Tags" : tag}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-sm font-bold">
        Showing {filtered.length} {activeCategory === "Companion" ? "companions" : "companion abilities"}
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filtered.map((entry) => (
          <CompanionCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function CompanionCard({ entry }: { entry: CompanionDefinition }) {
  return (
    <div className="rounded-2xl border border-[#9a7b45] bg-[#fff0c7] p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-2xl font-bold">{entry.name}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#fff0c7]">
            <span className="rounded bg-[#4b3115] px-2 py-1">{entry.category}</span>
            <span className={`rounded px-2 py-1 ${rarityBadgeClass(entry.rarity)}`}>{entry.rarity}</span>
            <span className="rounded bg-[#5b4630] px-2 py-1">{entry.valueGp || 0} GP</span>
          </div>
        </div>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed">{entry.description}</p>

      {(entry.tags || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(entry.tags || []).slice(0, 12).map((tag) => (
            <span key={tag} className="rounded border border-[#9a7b45] bg-[#ead6ad] px-2 py-0.5 text-[10px] font-bold uppercase">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
