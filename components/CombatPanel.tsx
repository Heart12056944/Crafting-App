"use client";

import React, { useMemo, useState } from "react";
import { Plus, Swords, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CreaturePicker from "@/components/CreaturePicker";
import { creatureTierRules, type CreatureTier, type LootTable } from "@/data/lootTables";
import { visibleBountyCreatures } from "@/data/bounties";
import { creatureInfo, formatCr } from "@/data/creatures";
import { speciesById } from "@/data/husbandry";

// GM-only. Start a fight with the creatures in it, then end it and say what
// happened to each one: killed creatures go to the Looting tab, tamed ones to
// Husbandry for the taming roll, and ones that ran are gone.

export type CombatOutcome = "killed" | "ran" | "tamed";
export type CombatCreature = { uid: string; tableId: string; label: string; tier: CreatureTier; outcome?: CombatOutcome };
export type CombatState = { startedDay: number; round?: number; creatures: CombatCreature[] };

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

const OUTCOME_LABEL: Record<CombatOutcome, string> = { killed: "Killed", ran: "Ran away", tamed: "Tame" };

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

const newUid = () => Math.random().toString(36).slice(2, 10);

export function canBeTamed(tableId: string) {
  return Boolean(speciesById.get(tableId)?.tameDc);
}

export default function CombatPanel({
  disabledTags,
  combat,
  campaignDay,
  onSave,
  onFinish,
}: {
  disabledTags: string[];
  combat: CombatState | null;
  campaignDay: number;
  onSave: (state: CombatState | null) => void;
  // Applies the results; returns a summary line.
  onFinish: (results: { killed: Map<string, { table: string; tier: CreatureTier; qty: number }>; tamed: string[]; ran: string[] }) => Promise<string>;
}) {
  const creatures = useMemo(() => visibleBountyCreatures(disabledTags), [disabledTags]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<CombatCreature[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const list = combat ? combat.creatures : draft;
  const setList = (next: CombatCreature[]) => (combat ? onSave({ ...combat, creatures: next }) : setDraft(next));

  function add(table: LootTable, count = 1) {
    const tier = table.defaultTier || "common";
    setList([...list, ...Array.from({ length: count }, () => ({ uid: newUid(), tableId: table.id, label: table.label, tier }))]);
    setPickerOpen(false);
  }

  function setOne(uid: string, changes: Partial<CombatCreature>) {
    setList(list.map((creature) => (creature.uid === uid ? { ...creature, ...changes } : creature)));
  }

  function start() {
    onSave({ startedDay: campaignDay, round: 1, creatures: draft });
    setDraft([]);
    setMessage("Combat started.");
  }

  async function end() {
    if (!combat) return;
    setBusy(true);
    const killed = new Map<string, { table: string; tier: CreatureTier; qty: number }>();
    const tamed: string[] = [];
    const ran: string[] = [];
    for (const creature of combat.creatures) {
      const outcome = creature.outcome || "killed";
      if (outcome === "killed") {
        const key = `${creature.tableId}|${creature.tier}`;
        const current = killed.get(key);
        killed.set(key, { table: creature.tableId, tier: creature.tier, qty: (current?.qty || 0) + 1 });
      } else if (outcome === "tamed") tamed.push(creature.tableId);
      else ran.push(creature.label);
    }
    try {
      const summary = await onFinish({ killed, tamed, ran });
      onSave(null);
      setConfirmEnd(false);
      setMessage(summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't finish the combat.");
    } finally {
      setBusy(false);
    }
  }

  // Group identical creatures for counts in the header.
  const counts = list.reduce<Record<string, number>>((acc, creature) => ({ ...acc, [creature.label]: (acc[creature.label] || 0) + 1 }), {});

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Swords className="w-7 h-7" />
            <h2 className="text-3xl font-bold">Combat</h2>
            {combat && <span className="rounded bg-[#8b1a1a] px-2 py-0.5 text-sm font-bold text-[#fff0c7]">In combat</span>}
          </div>
          <p className="text-sm">
            GM only. Add the creatures in the fight and start it. When it&apos;s over, mark what happened to each one and end the
            combat: killed creatures go to the Looting tab to be harvested, tamed ones go to Husbandry for the taming roll, and
            ones that ran away are gone.
          </p>
          {message && <p className="rounded bg-[#fff0c7] p-2 text-sm font-bold">{message}</p>}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-2xl font-bold">{combat ? `The fight (started day ${combat.startedDay})` : "Set up a fight"}</h3>
            <Button onClick={() => setPickerOpen(true)} className={blueButton}>
              <Plus className="mr-1 h-4 w-4" /> Add creature
            </Button>
          </div>
          {Object.keys(counts).length > 0 && (
            <p className="text-sm">{Object.entries(counts).map(([label, count]) => `${count}× ${label}`).join(", ")}</p>
          )}
          {list.length === 0 && <p className="text-sm italic">No creatures yet.</p>}
          <div className="space-y-2">
            {list.map((creature) => {
              const table = creatures.find((item) => item.id === creature.tableId);
              const info = table ? creatureInfo(table) : null;
              const tameable = canBeTamed(creature.tableId);
              const outcome = creature.outcome || "killed";
              return (
                <div key={creature.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#9a7b45] bg-[#f7e7c5] p-2 text-sm">
                  <span>
                    <strong>{creature.label}</strong>
                    {info && <span className="text-xs"> · CR {formatCr(info.cr)}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <select
                      className={fieldClass}
                      value={creature.tier}
                      onChange={(event) => setOne(creature.uid, { tier: event.target.value as CreatureTier })}
                      aria-label={`${creature.label} loot tier`}
                    >
                      {(Object.keys(creatureTierRules) as CreatureTier[]).map((tier) => (
                        <option key={tier} value={tier}>{creatureTierRules[tier].label}</option>
                      ))}
                    </select>
                    {combat &&
                      (["killed", "ran", ...(tameable ? ["tamed"] : [])] as CombatOutcome[]).map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          onClick={() => setOne(creature.uid, { outcome: option })}
                          className={outcome === option ? darkButton : "bg-[#e7d0a3] text-[#251b10] hover:bg-[#f2dfb9] border border-[#9a7b45]"}
                          aria-pressed={outcome === option}
                        >
                          {OUTCOME_LABEL[option]}
                        </Button>
                      ))}
                    <button
                      type="button"
                      className="text-[#8b1a1a]"
                      onClick={() => setList(list.filter((item) => item.uid !== creature.uid))}
                      aria-label={`Remove ${creature.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {!combat && (
            <Button disabled={draft.length === 0} onClick={start} className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7]">
              <Swords className="mr-1 h-4 w-4" /> Start combat
            </Button>
          )}
          {combat && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#d9bf8c] pt-3">
              {confirmEnd ? (
                <>
                  <span className="text-sm">
                    End the combat? {list.filter((c) => (c.outcome || "killed") === "killed").length} killed,{" "}
                    {list.filter((c) => c.outcome === "tamed").length} to tame, {list.filter((c) => c.outcome === "ran").length} ran.
                  </span>
                  <Button disabled={busy} onClick={end} className="bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7]">End combat</Button>
                  <button type="button" className="text-sm underline" onClick={() => setConfirmEnd(false)}>Back</button>
                </>
              ) : (
                <>
                  <Button onClick={() => setConfirmEnd(true)} className="bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7]">Combat over</Button>
                  <button type="button" className="text-sm underline" onClick={() => { onSave(null); setMessage("Combat cancelled. Nothing was added."); }}>
                    Cancel without results
                  </button>
                </>
              )}
            </div>
          )}
          {combat && <p className="text-xs">Everything is Killed unless you change it. &quot;Tame&quot; only shows for creatures that can be tamed.</p>}
        </div>
      </Panel>

      <CreaturePicker creatures={creatures} open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(table) => add(table)} title="Add a creature to the fight" />
    </div>
  );
}
