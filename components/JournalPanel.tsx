"use client";

import React, { useState } from "react";
import { BookOpenText, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
  useCampaignJournal,
  type JournalRow,
} from "@/lib/supabaseJournal";
import { dateForCampaignDay } from "@/data/calendar";

// What happened, day by day (written automatically as things happen), and the
// rumour board the GM uses to plant hooks.

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

export default function JournalPanel({
  campaignId,
  adminUnlocked,
  campaignDay,
  calendarStart,
}: {
  campaignId: string;
  adminUnlocked: boolean;
  campaignDay: number;
  calendarStart: number;
}) {
  const { entries, missing, reload } = useCampaignJournal(campaignId);
  const [rumour, setRumour] = useState("");
  const [note, setNote] = useState("");
  const [noteGmOnly, setNoteGmOnly] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = entries.filter((entry) => adminUnlocked || !entry.gm_only);
  const rumours = visible.filter((entry) => entry.kind === "rumour");
  const events = visible.filter((entry) => entry.kind === "event");
  const byDay = new Map<number, JournalRow[]>();
  for (const entry of events) byDay.set(entry.day, [...(byDay.get(entry.day) || []), entry]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (error) {
      console.warn("Journal change failed.", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpenText className="w-7 h-7" />
            <h2 className="text-3xl font-bold">Journal</h2>
          </div>
          <p className="text-sm">
            The party&apos;s story so far: every new day, fight, bounty, purchase, tamed animal, injury and illness is written down
            here as it happens. Rumours are things the party has heard; chase them or don&apos;t.
          </p>
          {missing && <p className="text-sm font-bold text-[#8b1a1a]">The journal table isn&apos;t set up yet. Run the latest SQL in Supabase.</p>}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Rumours</h3>
          {rumours.filter((entry) => entry.status === "open").length === 0 && <p className="text-sm italic">No rumours right now.</p>}
          {rumours
            .filter((entry) => entry.status === "open" || showResolved)
            .map((entry) => (
              <div key={entry.id} className={`rounded-lg border border-[#9a7b45] p-2 text-sm ${entry.status === "resolved" ? "bg-[#e7d0a3] opacity-70" : "bg-[#f7e7c5]"}`}>
                <p>
                  {entry.text}
                  {entry.gm_only ? <span className="text-xs italic"> (GM only)</span> : null}
                </p>
                <p className="text-xs">
                  Heard on {dateForCampaignDay(entry.day, calendarStart).label}
                  {entry.status === "resolved" ? " · resolved" : ""}
                </p>
                {adminUnlocked && (
                  <div className="mt-1 flex gap-3 text-xs">
                    <button
                      className="underline"
                      disabled={busy}
                      onClick={() => act(() => updateJournalEntry(entry.id, { status: entry.status === "open" ? "resolved" : "open" }))}
                    >
                      {entry.status === "open" ? "Mark resolved" : "Reopen"}
                    </button>
                    {entry.gm_only && (
                      <button className="underline" disabled={busy} onClick={() => act(() => updateJournalEntry(entry.id, { gm_only: false }))}>
                        Show to players
                      </button>
                    )}
                    <button className="text-[#8b1a1a]" disabled={busy} onClick={() => act(() => deleteJournalEntry(entry.id))} aria-label="Delete rumour">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          {rumours.some((entry) => entry.status === "resolved") && (
            <button className="text-xs underline" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? "Hide" : "Show"} resolved rumours
            </button>
          )}
          {adminUnlocked && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#d9bf8c] pt-2">
              <input
                className={`${fieldClass} min-w-[18rem] flex-1`}
                placeholder="A traveller swears she saw lights in the old mine..."
                value={rumour}
                onChange={(event) => setRumour(event.target.value)}
                aria-label="New rumour"
              />
              <Button
                size="sm"
                disabled={busy || !rumour.trim()}
                className={darkButton}
                onClick={() =>
                  act(async () => {
                    await addJournalEntry({ campaignId, day: campaignDay, text: rumour, kind: "rumour" });
                    setRumour("");
                  })
                }
              >
                Post rumour
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Log</h3>
          {adminUnlocked && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${fieldClass} min-w-[18rem] flex-1`}
                placeholder="Add a note for today..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-label="New journal note"
              />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={noteGmOnly} onChange={(event) => setNoteGmOnly(event.target.checked)} /> GM only
              </label>
              <Button
                size="sm"
                disabled={busy || !note.trim()}
                className={darkButton}
                onClick={() =>
                  act(async () => {
                    await addJournalEntry({ campaignId, day: campaignDay, text: note, gmOnly: noteGmOnly });
                    setNote("");
                  })
                }
              >
                Add note
              </Button>
            </div>
          )}
          {byDay.size === 0 && <p className="text-sm italic">Nothing logged yet.</p>}
          {[...byDay.entries()].map(([day, dayEntries]) => (
            <div key={day} className="space-y-1">
              <p className="font-bold">
                Day {day} · {dateForCampaignDay(day, calendarStart).label}
              </p>
              {[...dayEntries].reverse().map((entry) => (
                <p key={entry.id} className="flex items-start justify-between gap-2 border-b border-[#e0c896] text-sm">
                  <span>
                    {entry.text}
                    {entry.gm_only ? <span className="text-xs italic"> (GM only)</span> : null}
                  </span>
                  {adminUnlocked && (
                    <button className="text-[#8b1a1a]" disabled={busy} onClick={() => act(() => deleteJournalEntry(entry.id))} aria-label="Delete entry">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </p>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
