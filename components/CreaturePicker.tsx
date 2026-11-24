"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LootTable } from "@/data/lootTables";
import { creatureInfo, formatCr } from "@/data/creatures";

// A pop-up search for picking a creature. Only the creatures passed in are
// listed, so the caller decides what's visible in the campaign.
export default function CreaturePicker({
  creatures,
  open,
  onClose,
  onPick,
  title = "Choose a creature",
  note,
}: {
  // Extra text after each creature (e.g. how plentiful it is).
  note?: (table: LootTable) => string;
  creatures: LootTable[];
  open: boolean;
  onClose: () => void;
  onPick: (table: LootTable) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const close = () => {
    setQuery("");
    onClose();
  };
  const pick = (table: LootTable) => {
    setQuery("");
    onPick(table);
  };

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return creatures
      .filter((table) => {
        const text = `${table.label} ${table.family} ${table.set || ""} ${table.defaultTier || ""} ${creatureInfo(table).kind || ""}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => creatureInfo(a).cr - creatureInfo(b).cr || a.label.localeCompare(b.label));
  }, [creatures, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-[#9a7b45] p-4 font-serif text-[#251b10] shadow-2xl"
        style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button type="button" onClick={close} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded border border-[#9a7b45] bg-[#fff0c7] px-2">
          <Search className="h-4 w-4" />
          <input
            autoFocus
            className="w-full bg-transparent py-2 text-sm outline-none"
            placeholder="Search by name, family, tier, canine, feline..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) pick(results[0]);
              if (event.key === "Escape") close();
            }}
            aria-label="Search creatures"
          />
        </div>
        <div className="max-h-[50vh] space-y-1 overflow-auto">
          {results.length === 0 && <p className="text-sm italic">No creatures match.</p>}
          {results.map((table) => {
            const info = creatureInfo(table);
            return (
              <Button
                key={table.id}
                onClick={() => pick(table)}
                className="flex h-auto w-full justify-between bg-[#f7e7c5] px-3 py-2 text-left text-[#251b10] hover:bg-[#fff0c7]"
              >
                <span className="font-bold">{table.label}</span>
                <span className="text-xs">
                  CR {formatCr(info.cr)} · {info.kind || info.role} · {table.defaultTier || "common"}
                  {note?.(table) ? ` · ${note(table)}` : ""}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
