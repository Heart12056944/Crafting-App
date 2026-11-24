"use client";

import React, { useEffect, useState } from "react";
import { Castle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { changePurse, fetchPurses, PARTY_FUND } from "@/lib/supabaseCoins";
import { emptyCoins, paymentPlan } from "@/data/coins";
import { FACILITIES, MAX_FACILITY_LEVEL, UPGRADE_COST_GP, animalCapacity, facilityLevel, type FacilityId, type HomesteadLevels } from "@/data/homestead";
import { fetchCampaignAnimals } from "@/lib/supabaseAnimals";

// The party's base: facilities, their levels and what they give.

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";

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

export default function HomesteadPanel({
  campaignId,
  adminUnlocked,
  levels,
  name,
  setLevel,
  setName,
  onJournal,
}: {
  campaignId: string;
  adminUnlocked: boolean;
  levels: HomesteadLevels;
  name: string;
  setLevel: (id: FacilityId, level: number) => void;
  setName: (name: string) => void;
  onJournal: (text: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [animalCount, setAnimalCount] = useState(0);
  const capacity = animalCapacity(levels);

  useEffect(() => {
    if (!campaignId) return;
    fetchCampaignAnimals(campaignId)
      .then((rows) => setAnimalCount(rows.length))
      .catch(() => setAnimalCount(0));
  }, [campaignId]);

  async function upgrade(id: FacilityId, pay: boolean) {
    const facility = FACILITIES.find((item) => item.id === id)!;
    const current = facilityLevel(levels, id);
    if (current >= MAX_FACILITY_LEVEL) return;
    const costGp = UPGRADE_COST_GP[current];
    setBusy(true);
    setMessage("");
    try {
      if (pay) {
        const party = (await fetchPurses(campaignId)).find((row) => row.holder === PARTY_FUND);
        const plan = paymentPlan(party || emptyCoins(), costGp * 100);
        if (!plan) throw new Error(`The party fund can't cover ${costGp} gp.`);
        await changePurse(campaignId, PARTY_FUND, plan, `Built ${facility.name} level ${current + 1}`);
      }
      setLevel(id, current + 1);
      const text = `${facility.name} ${current === 0 ? "built" : "upgraded"} to level ${current + 1}${pay ? ` for ${costGp} gp from the party fund` : ""}.`;
      setMessage(text);
      onJournal(text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The party fund can't cover that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Castle className="w-7 h-7" />
            <h2 className="text-3xl font-bold">{name || "Homestead"}</h2>
          </div>
          <p className="text-sm">
            The party&apos;s base. Each facility has three levels; their bonuses apply on their own (crafting checks, disease saves,
            healing, training). Stables: {animalCount} of {capacity} places used
            {animalCount > capacity ? " (over capacity: animals are cramped and unhappy)" : ""}.
          </p>
          {message && <p className="rounded bg-[#fff0c7] p-2 text-sm font-bold">{message}</p>}
          {adminUnlocked && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#d9bf8c] pt-2 text-sm">
              <input
                className="rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                aria-label="Homestead name"
                placeholder="Name the base"
              />
              <Button size="sm" className={darkButton} onClick={() => setName(draftName.trim())}>
                Rename
              </Button>
              <Button
                size="sm"
                className="bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7]"
                onClick={() => {
                  FACILITIES.forEach((facility) => setLevel(facility.id, MAX_FACILITY_LEVEL));
                  setMessage("Every facility is fully built.");
                }}
              >
                Set everything to fully built
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FACILITIES.map((facility) => {
          const level = facilityLevel(levels, facility.id);
          return (
            <Panel key={facility.id}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{facility.name}</h3>
                  <span className="font-bold">{level === 0 ? "Not built" : `Level ${level}`}</span>
                </div>
                <p className="text-sm italic">{facility.description}</p>
                <ul className="space-y-1 text-sm">
                  {facility.levels.map((text, index) => (
                    <li key={text} className={index < level ? "font-bold" : "opacity-60"}>
                      {index < level ? "✓" : "○"} Level {index + 1}: {text}
                    </li>
                  ))}
                </ul>
                {adminUnlocked && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {level < MAX_FACILITY_LEVEL && (
                      <>
                        <Button size="sm" disabled={busy} className={darkButton} onClick={() => upgrade(facility.id, true)}>
                          {level === 0 ? "Build" : "Upgrade"} ({UPGRADE_COST_GP[level]} gp from party fund)
                        </Button>
                        <button className="underline" disabled={busy} onClick={() => upgrade(facility.id, false)}>
                          {level === 0 ? "Build" : "Upgrade"} free
                        </button>
                      </>
                    )}
                    {level > 0 && (
                      <button className="text-xs underline" onClick={() => setLevel(facility.id, level - 1)}>
                        Lower a level
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
