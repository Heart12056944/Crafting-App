"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { weatherById, daysWithoutFoodAllowed, type CalendarDate, type CalendarSettings } from "@/data/calendar";
import { afflictionName, type Affliction } from "@/data/afflictions";
import { EXTRAS, hasItem, protection, weatherDemands } from "@/data/weatherGear";
import { productsFor, speciesById, daysUntilReady } from "@/data/husbandry";
import { THREAT_STAGES, threatStage, type ThreatSettings } from "@/data/threat";
import { supabase } from "@/lib/supabaseClient";
import { fetchCampaignInventory, type InventoryRow } from "@/lib/supabaseInventory";
import { fetchCampaignAnimals, type AnimalRow } from "@/lib/supabaseAnimals";
import { fetchBounties, type BountyRow } from "@/lib/supabaseBounties";
import { useCampaignJournal } from "@/lib/supabaseJournal";
import { createBackup, deleteBackup, fetchBackups, restoreBackup, type BackupRow } from "@/lib/supabaseBackups";

// The GM's "today" page: everything worth knowing before the session starts, in one place.

type DashCharacter = {
  id: string;
  name: string;
  isActive?: boolean;
  exhaustion?: number;
  daysWithoutFood?: number;
  afflictions?: Affliction[];
  stats?: Partial<Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>>;
};

type Props = {
  campaignId: string;
  campaignDay: number;
  date: CalendarDate;
  calendar: CalendarSettings;
  characters: DashCharacter[];
  lootQueue: { id: string; label: string }[];
  threat: ThreatSettings;
  setThreat: (value: number) => void;
  setThreatRate: (perMonth: number) => void;
  goTo: (tab: "looting" | "husbandry" | "bounties" | "journal" | "travel" | "mycharacter" | "combat") => void;
};

const panel = "border border-[#9a7b45] bg-[#fbf2dc] text-[#251b10]";
const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]";
let dashboardChannelCount = 0;

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className={panel}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-xl font-bold">{title}</h3>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-[#6b5432]">{children}</p>;
}

export default function DashboardPanel(props: Props) {
  const { campaignId, campaignDay, date, calendar, characters, lootQueue, threat } = props;
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const { entries } = useCampaignJournal(campaignId);
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      const [items, herd, board] = await Promise.all([
        fetchCampaignInventory(campaignId).catch(() => [] as InventoryRow[]),
        fetchCampaignAnimals(campaignId).catch(() => [] as AnimalRow[]),
        fetchBounties(campaignId).catch(() => [] as BountyRow[]),
      ]);
      setInventory(items);
      setAnimals(herd);
      setBounties(board);
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const channel = supabase
      .channel(`campaign-dashboard-${campaignId}-${++dashboardChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_inventory_items", filter: `campaign_id=eq.${campaignId}` }, () => reloadRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_animals", filter: `campaign_id=eq.${campaignId}` }, () => reloadRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_bounties", filter: `campaign_id=eq.${campaignId}` }, () => reloadRef.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, campaignDay]);

  const party = characters.filter((character) => character.isActive !== false);
  const weather = weatherById(calendar.weather);
  const demands = weatherDemands(weather.id, date.season);
  const partyItems = inventory.map((row) => row.name);
  const itemsOf = (id: string) => inventory.filter((row) => row.character_id === id).map((row) => row.name);

  // Who needs looking after.
  const concerns = party
    .map((character) => {
      const notes: string[] = [];
      const allowed = daysWithoutFoodAllowed(character.stats?.CON ?? 0);
      const hungry = character.daysWithoutFood ?? 0;
      if (hungry > 0) notes.push(`${hungry} day${hungry === 1 ? "" : "s"} without food (${allowed} before exhaustion)`);
      if ((character.exhaustion ?? 0) > 0) notes.push(`exhaustion ${character.exhaustion}`);
      for (const affliction of character.afflictions || []) notes.push(afflictionName(affliction));
      const own = itemsOf(character.id);
      for (const demand of demands) {
        if (!protection(demand.kind, own, partyItems)) notes.push(`no ${demand.kind} gear for ${demand.note}`);
        if (demand.kind === "heat" && !hasItem(own, EXTRAS.water)) notes.push("no waterskin in the heat");
      }
      return { character, notes };
    })
    .filter((entry) => entry.notes.length > 0);

  const openBounties = bounties.filter((row) => row.status === "open" || row.status === "claimed");
  const openRumours = entries.filter((entry) => entry.kind === "rumour" && entry.status === "open");
  const readyAnimals = animals
    .map((animal) => {
      const species = speciesById.get(animal.species);
      if (!species) return null;
      const ready = productsFor(species, animal.sex).filter((product) => daysUntilReady(product, animal.last_collected?.[product.id], campaignDay) === 0);
      return ready.length ? { animal, ready: ready.map((product) => product.label) } : null;
    })
    .filter((entry): entry is { animal: AnimalRow; ready: string[] } => Boolean(entry));

  const stage = threatStage(threat.value);
  const nextStage = THREAT_STAGES.find((entry) => entry.min > threat.value);

  return (
    <div className="space-y-4">
      <Card className="border border-[#d2ad5f] bg-[#171717] text-[#fff0c7]">
        <CardContent className="p-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#e7c75e]">Today, campaign day {campaignDay}</p>
            <p className="font-serif text-3xl">{date.label}</p>
          </div>
          <p className="font-serif text-xl">
            {weather.label}
            {demands.length ? <span className="text-[#e7c75e]"> · exposure: {demands.map((demand) => `${demand.note} (DC ${demand.dc})`).join(", ")}</span> : null}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="The party" action={<Button size="sm" className={darkButton} onClick={() => props.goTo("mycharacter")}>Characters</Button>}>
          {concerns.length === 0 ? (
            <Empty>Everyone is fed, rested, healthy and dressed for the weather.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {concerns.map(({ character, notes }) => (
                <li key={character.id}>
                  <strong>{character.name}:</strong> {notes.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Threat clock (GM only)">
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-[#e3cf9f] overflow-hidden" aria-label={`Threat ${threat.value} of 100`}>
              <div className="h-full bg-[#8b1e1e]" style={{ width: `${threat.value}%` }} />
            </div>
            <p className="text-sm">
              <strong>
                {threat.value}/100 · {stage.name}.
              </strong>{" "}
              {stage.note}
            </p>
            <p className="text-sm text-[#6b5432]">
              {stage.encounters} Undead are {stage.undeadWeight}× as likely on random bounties.
              {nextStage ? ` ${nextStage.name} at ${nextStage.min}.` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[-5, -1, 1, 5].map((step) => (
                <Button key={step} size="sm" className={darkButton} onClick={() => props.setThreat(threat.value + step)} aria-label={`Threat ${step > 0 ? "+" : ""}${step}`}>
                  {step > 0 ? `+${step}` : step}
                </Button>
              ))}
              <label className="flex items-center gap-1">
                Rises
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-16 rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1"
                  value={threat.perMonth}
                  onChange={(event) => props.setThreatRate(Math.max(0, Number(event.target.value) || 0))}
                  aria-label="Threat per month"
                />
                a month
              </label>
            </div>
          </div>
        </Section>

        <Section title="Open bounties" action={<Button size="sm" className={darkButton} onClick={() => props.goTo("bounties")}>Board</Button>}>
          {openBounties.length === 0 ? (
            <Empty>Nothing on the board.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {openBounties.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <strong>{row.title}</strong> ({row.kind}, {row.status})
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Open rumours" action={<Button size="sm" className={darkButton} onClick={() => props.goTo("journal")}>Journal</Button>}>
          {openRumours.length === 0 ? (
            <Empty>No open rumours.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {openRumours.slice(0, 8).map((entry) => (
                <li key={entry.id}>
                  {entry.gm_only ? <span className="text-[#8b1e1e] font-semibold">[GM] </span> : null}
                  {entry.text}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Waiting to be looted" action={<Button size="sm" className={darkButton} onClick={() => props.goTo("looting")}>Looting</Button>}>
          {lootQueue.length === 0 ? <Empty>The looting queue is empty.</Empty> : <p className="text-sm">{lootQueue.map((entry) => entry.label).join(", ")}</p>}
        </Section>

        <Section title="The herd" action={<Button size="sm" className={darkButton} onClick={() => props.goTo("husbandry")}>Husbandry</Button>}>
          {readyAnimals.length === 0 ? (
            <Empty>Nothing to collect today.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {readyAnimals.slice(0, 10).map(({ animal, ready }) => (
                <li key={animal.id}>
                  <strong>{animal.name}</strong>: {ready.join(", ")} ready
                </li>
              ))}
              {readyAnimals.length > 10 ? <li>…and {readyAnimals.length - 10} more.</li> : null}
            </ul>
          )}
        </Section>
      </div>

      <BackupsSection campaignId={campaignId} />
    </div>
  );
}

function BackupsSection({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [confirmId, setConfirmId] = useState("");

  async function reload() {
    try {
      setRows(await fetchBackups(campaignId));
      setMissing(false);
    } catch {
      setMissing(true);
    }
  }

  useEffect(() => {
    if (campaignId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(row: BackupRow) {
    await run(async () => {
      await createBackup(campaignId, `Before restoring "${row.label}"`, "auto");
      await restoreBackup(row.id);
    }, `Restored "${row.label}". Reloading…`);
    setConfirmId("");
    window.setTimeout(() => window.location.reload(), 800);
  }

  return (
    <Section title="Backups">
      {missing ? (
        <p className="text-sm">Backups need the latest SQL (the campaign_backups table). Run the full SQL in Supabase to turn them on.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#6b5432]">
            A backup is taken automatically before Pass Day, a time skip, the end of combat and any restore (the newest 40 are kept). Restoring puts the whole campaign back as
            it was: characters, inventories, coins, animals, bounties, factions, the journal and the calendar.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 min-w-[12rem] rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm"
              placeholder="Label (optional), e.g. Before the siege"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              aria-label="Backup label"
            />
            <Button
              disabled={busy}
              className={darkButton}
              onClick={() => run(() => createBackup(campaignId, label.trim() || `Manual backup, ${new Date().toLocaleString()}`), "Backup taken.").then(() => setLabel(""))}
            >
              Take a backup
            </Button>
          </div>
          {message ? <p className="text-sm font-semibold">{message}</p> : null}
          {rows.length === 0 ? (
            <Empty>No backups yet.</Empty>
          ) : (
            <ul className="divide-y divide-[#d9c08a] text-sm">
              {rows.map((row) => (
                <li key={row.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{row.label}</strong> <span className="text-[#6b5432]">· {new Date(row.created_at).toLocaleString()} · {row.kind === "auto" ? "automatic" : "manual"}</span>
                  </span>
                  <span className="flex gap-2">
                    {confirmId === row.id ? (
                      <>
                        <Button size="sm" disabled={busy} className="bg-[#8b1e1e] hover:bg-[#a52626] text-white" onClick={() => restore(row)}>
                          Yes, restore
                        </Button>
                        <Button size="sm" disabled={busy} className={darkButton} onClick={() => setConfirmId("")}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" disabled={busy} className={darkButton} onClick={() => setConfirmId(row.id)}>
                          Restore
                        </Button>
                        <Button size="sm" disabled={busy} className={darkButton} onClick={() => run(() => deleteBackup(row.id), "Backup deleted.")} aria-label={`Delete ${row.label}`}>
                          Delete
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
