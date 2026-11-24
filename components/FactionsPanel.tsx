"use client";

import React, { useState } from "react";
import { Flag, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  REPUTATION_TIERS,
  createFaction,
  deleteFaction,
  reputationTier,
  updateFaction,
  useCampaignFactions,
} from "@/lib/supabaseFactions";

// The groups the party deals with and where it stands with each. Jobs posted
// for a faction raise standing when done; standing changes prices at the
// faction's shops.

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

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

export default function FactionsPanel({
  campaignId,
  adminUnlocked,
  onJournal,
}: {
  campaignId: string;
  adminUnlocked: boolean;
  onJournal: (text: string) => void;
}) {
  const { factions, missing, reload } = useCampaignFactions(campaignId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function act(action: () => Promise<unknown>, done?: string, journal?: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      if (done) setMessage(done);
      if (journal) onJournal(journal);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Flag className="w-7 h-7" />
            <h2 className="text-3xl font-bold">Factions</h2>
          </div>
          <p className="text-sm">
            Where the party stands with the groups it deals with, from −100 to 100. Finishing a job posted for a faction raises your
            standing; the GM can also change it for what you do in play. Standing changes prices at a faction&apos;s shops.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {REPUTATION_TIERS.map((tier) => (
              <span key={tier.label} className="rounded border border-[#9a7b45] bg-[#f7e7c5] px-2 py-0.5">
                <strong>{tier.label}</strong> ({tier.min}+): {tier.note}
              </span>
            ))}
          </div>
          {missing && <p className="text-sm font-bold text-[#8b1a1a]">The factions table isn&apos;t set up yet. Run the latest SQL in Supabase.</p>}
          {message && <p className="rounded bg-[#fff0c7] p-2 text-sm font-bold">{message}</p>}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          {factions.length === 0 && <p className="text-sm italic">No factions yet.</p>}
          {factions.map((faction) => {
            const tier = reputationTier(faction.reputation);
            const amount = amounts[faction.id] ?? 5;
            const change = (delta: number) =>
              act(
                () => updateFaction(faction.id, { reputation: faction.reputation + delta }),
                undefined,
                `Standing with ${faction.name} ${delta > 0 ? "rose" : "fell"} by ${Math.abs(delta)} (now ${Math.max(-100, Math.min(100, faction.reputation + delta))}).`
              );
            return (
              <div key={faction.id} className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold">{faction.name}</p>
                  <p className="font-bold">
                    {tier.label} ({faction.reputation > 0 ? "+" : ""}
                    {faction.reputation})
                  </p>
                </div>
                {faction.description && <p className="text-sm">{faction.description}</p>}
                <div className="relative h-3 rounded bg-[#d9bf8c]">
                  <div className="absolute top-0 h-3 w-0.5 bg-[#4b3115]" style={{ left: "50%" }} />
                  <div
                    className="absolute top-0 h-3 rounded"
                    style={{
                      left: faction.reputation >= 0 ? "50%" : `${50 + faction.reputation / 2}%`,
                      width: `${Math.abs(faction.reputation) / 2}%`,
                      background: faction.reputation >= 0 ? "#1d5c2e" : "#8b1a1a",
                    }}
                  />
                </div>
                <p className="text-xs">{tier.note}</p>
                {adminUnlocked && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="number"
                      min={1}
                      className={`${fieldClass} w-16`}
                      value={amount}
                      onChange={(event) => setAmounts({ ...amounts, [faction.id]: Math.max(1, Number(event.target.value) || 1) })}
                      aria-label={`Change standing with ${faction.name} by`}
                    />
                    <Button size="sm" disabled={busy} onClick={() => change(amount)} className="bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7]">
                      Raise
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => change(-amount)} className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7]">
                      Lower
                    </Button>
                    <button className="ml-auto flex items-center gap-1 text-xs text-[#8b1a1a]" disabled={busy} onClick={() => act(() => deleteFaction(faction.id), `${faction.name} removed.`)}>
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {adminUnlocked && (
            <div className="space-y-2 border-t border-[#d9bf8c] pt-3">
              <p className="font-bold">GM: add a faction</p>
              <div className="flex flex-wrap gap-2">
                <input className={fieldClass} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} aria-label="Faction name" />
                <input
                  className={`${fieldClass} min-w-[18rem] flex-1`}
                  placeholder="Who they are (players see this)"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-label="Faction description"
                />
                <Button
                  disabled={busy || !name.trim()}
                  className={darkButton}
                  onClick={() =>
                    act(async () => {
                      await createFaction(campaignId, name.trim(), description.trim());
                      setName("");
                      setDescription("");
                    }, `Added ${name.trim()}.`)
                  }
                >
                  Add faction
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
