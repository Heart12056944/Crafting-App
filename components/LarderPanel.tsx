"use client";

import React, { useState } from "react";
import { Soup } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { LARDER_SECTIONS, larderEntries, type LarderSection } from "@/data/larder";

// What every food looks like. Entries from sets the GM has switched off for
// this campaign are hidden.
export default function LarderPanel({ disabledSets }: { disabledSets: string[] }) {
  const [section, setSection] = useState<LarderSection | "all">("all");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const visible = larderEntries.filter(
    (entry) =>
      !disabledSets.includes(entry.set) &&
      (section === "all" || entry.section === section) &&
      (!query ||
        entry.name.toLowerCase().includes(query) ||
        entry.look.toLowerCase().includes(query) ||
        entry.badges.some((badge) => badge.toLowerCase().includes(query)))
  );

  const cardStyle = { background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" };

  return (
    <div className="space-y-6 font-serif">
      <Card className="rounded-2xl shadow-2xl border-2" style={cardStyle}>
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Soup className="w-8 h-8" />
            <h2 className="text-3xl font-bold">The Larder</h2>
          </div>
          <p>What every cut of meat, fish, vegetable, fruit, herb and dish looks like, where it comes from, and what it&apos;s cooked into.</p>
          <div className="flex flex-wrap items-center gap-2">
            {[{ id: "all" as const, label: "Everything" }, ...LARDER_SECTIONS].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`rounded-full border px-3 py-1 text-sm font-bold ${
                  section === item.id ? "border-[#4b3115] bg-[#4b3115] text-[#fff0c7]" : "border-[#9a7b45] bg-[#fff0c7]"
                }`}
              >
                {item.label}
              </button>
            ))}
            <input
              className="ml-auto rounded border border-[#9a7b45] bg-[#fff0c7] px-3 py-1 text-sm"
              placeholder="Search the larder..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search the larder"
            />
          </div>
        </CardContent>
      </Card>

      {LARDER_SECTIONS.filter((item) => section === "all" || item.id === section).map((item) => {
        const entries = visible.filter((entry) => entry.section === item.id);
        if (entries.length === 0) return null;
        return (
          <Card key={item.id} className="rounded-2xl shadow-2xl border-2" style={cardStyle}>
            <CardContent className="p-6 md:p-8 space-y-4">
              <div>
                <h3 className="text-2xl font-bold">{item.label}</h3>
                <p className="text-sm italic">{item.intro}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <div key={entry.name} className="space-y-2 rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-4">
                    <div>
                      <h4 className="text-lg font-bold">{entry.name}</h4>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.badges.map((badge) => (
                          <span key={badge} className="rounded-full border border-[#9a7b45] bg-[#fff0c7] px-2 py-0.5 text-[11px] font-bold">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">
                      <strong>Looks like:</strong> {entry.look}
                    </p>
                    {entry.notes && <p className="text-xs italic">{entry.notes}</p>}
                    {entry.foundIn.length > 0 && (
                      <p className="text-xs">
                        <strong>Found:</strong> {entry.foundIn.join(", ")}
                      </p>
                    )}
                    {entry.usedIn.length > 0 && (
                      <p className="text-xs">
                        <strong>Cooked into:</strong> {entry.usedIn.slice(0, 6).join(", ")}
                        {entry.usedIn.length > 6 ? ` and ${entry.usedIn.length - 6} more` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {visible.length === 0 && (
        <Card className="rounded-2xl shadow-2xl border-2" style={cardStyle}>
          <CardContent className="p-6">
            <p className="italic">Nothing matches.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
