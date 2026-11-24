"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, Hammer, Trash2 } from "lucide-react";
import { useCampaignFactions, type FactionRow } from "@/lib/supabaseFactions";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import {
  completeBounty,
  deleteBounty,
  fetchBounties,
  postBounty,
  updateBounty,
  huntTargets,
  type BountyKind,
  type BountyRow,
} from "@/lib/supabaseBounties";
import { fetchCampaignInventory, removeOneInventoryItem, type InventoryRow } from "@/lib/supabaseInventory";
import { PARTY_FUND } from "@/lib/supabaseCoins";
import { formatCp } from "@/data/coins";
import { recipesRaw } from "@/data/recipesRaw";
import { isLootTableVisible, type LootTable } from "@/data/lootTables";
import { BOUNTY_CAPS, bountyBands, bountyRarityFor, creatureInfo, formatCr, type BountyRarity } from "@/data/creatures";
import CreaturePicker from "@/components/CreaturePicker";
import { ABUNDANCE_WEIGHT, type Abundance } from "@/data/ecology";
import {
  QUALITY_RANK,
  SUPERIOR_BONUS,
  giversFor,
  isRecipeVisible,
  randomItem,
  recipeSet,
  suggestedBountyReward,
  suggestedCommissionReward,
  suggestedProof,
  tableById,
  visibleBountyCreatures,
  visibleCommissionRecipes,
  type DeliveryQuality,
} from "@/data/bounties";

type CharacterLike = { id: string; name: string; isActive?: boolean };
type PoolMaterial = { name: string; qty: number };

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const greenButton = "bg-[#1d5c2e] hover:bg-[#247338] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

let bountyChannelCount = 0;

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

const recipeById = new Map(recipesRaw.map((recipe) => [recipe.id, recipe]));
const norm = (name: string) => name.trim().toLowerCase();

// Hidden when the creature's or recipe's set is switched off for this campaign.
function bountyVisible(row: BountyRow, disabledTags: string[]) {
  if (row.kind === "bounty") {
    const targets = huntTargets(row.target);
    return targets.length === 0 || targets.some((target) => {
      const table = tableById(target.creature);
      return !table || isLootTableVisible(table, disabledTags);
    });
  }
  const recipe = row.target.recipeId ? recipeById.get(row.target.recipeId) : undefined;
  return !recipe || isRecipeVisible(recipe, disabledTags);
}

export default function BountyBoardPanel({
  campaignId,
  characters,
  adminUnlocked,
  claimedCharacterIds,
  materials,
  disabledTags,
  partyLevel,
  abundanceOf,
  onRemoveMaterials,
  onJournal,
  undeadWeight = 1,
  regionCreatureIds = null,
}: {
  // The party's current region: random bounties pick from its creatures.
  regionCreatureIds?: string[] | null;
  // From the threat clock: how much likelier undead are on random bounties.
  undeadWeight?: number;
  abundanceOf: (table: LootTable) => Abundance;
  partyLevel: number;
  // Writes a line to the party journal.
  onJournal: (text: string) => void;
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
  claimedCharacterIds: string[];
  materials: PoolMaterial[];
  disabledTags: string[];
  // Takes materials from the party pool; false when there aren't enough.
  onRemoveMaterials: (items: { name: string; qty: number }[]) => boolean;
}) {
  const [rows, setRows] = useState<BountyRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showDone, setShowDone] = useState(false);
  const { factions } = useCampaignFactions(campaignId);
  // Players don't see factions the party hasn't met.
  const factionName = (id?: string | null) => factions.find((faction) => faction.id === id && (adminUnlocked || !faction.hidden))?.name;
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      try {
        const [bounties, items] = await Promise.all([fetchBounties(campaignId), fetchCampaignInventory(campaignId)]);
        setRows(bounties);
        setInventory(items);
        setMissing(false);
      } catch (error) {
        console.warn("Could not load the bounty board.", error);
        setMissing(true);
      }
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const channel = supabase
      .channel(`campaign-bounties-${campaignId}-${++bountyChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_bounties", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const activeCharacters = characters.filter((character) => character.isActive !== false);
  const nameOf = (id: string | null) =>
    id === PARTY_FUND ? "the party fund" : characters.find((character) => character.id === id)?.name || "someone";
  const payees = [
    ...(adminUnlocked ? activeCharacters : activeCharacters.filter((character) => claimedCharacterIds.includes(character.id))).map(
      (character) => ({ value: character.id, label: character.name })
    ),
    { value: PARTY_FUND, label: "Party fund" },
  ];

  async function run(action: () => Promise<unknown>, done: string, journal?: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
      if (journal) onJournal(journal);
      await reloadRef.current();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const haveMaterial = (name: string) => materials.find((material) => norm(material.name) === norm(name))?.qty ?? 0;

  // Items that satisfy a commission, held by the player's characters or the stash.
  function deliverableRows(row: BountyRow) {
    const min = QUALITY_RANK[(row.target.minQuality || "Normal") as DeliveryQuality] ?? 1;
    return inventory.filter((item) => {
      const sameItem =
        (row.target.recipeId && item.metadata?.recipeId === row.target.recipeId) ||
        norm(item.name) === norm(row.target.recipeName || "");
      const quality = QUALITY_RANK[(item.quality || "Normal") as DeliveryQuality] ?? 1;
      const mine = adminUnlocked || item.character_id === null || claimedCharacterIds.includes(item.character_id);
      return sameItem && quality >= min && mine;
    });
  }

  function turnInBounty(row: BountyRow, payee: string) {
    const proof = row.target.proof || [];
    const character = payee === PARTY_FUND ? claimedCharacterIds[0] || null : payee;
    run(async () => {
      if (proof.some((item) => haveMaterial(item.name) < item.qty)) throw new Error("The party doesn't have all the proof yet.");
      await completeBounty(row.id, payee, character);
      onRemoveMaterials(proof);
    }, `"${row.title}" turned in. ${formatCp(row.reward_cp)} paid to ${nameOf(payee)}.`, `Bounty done: "${row.title}". ${formatCp(row.reward_cp)} paid to ${nameOf(payee)}${repNote(row)}.`);
  }

  function deliverCommission(row: BountyRow, payee: string) {
    const need = Math.max(1, row.target.qty || 1);
    const available = deliverableRows(row);
    // Use the lowest qualifying quality first; Superior pays a bonus only when every item is Superior.
    const units: InventoryRow[] = [];
    for (const item of [...available].sort((a, b) => (QUALITY_RANK[(a.quality || "Normal") as DeliveryQuality] ?? 1) - (QUALITY_RANK[(b.quality || "Normal") as DeliveryQuality] ?? 1))) {
      for (let i = 0; i < item.qty && units.length < need; i += 1) units.push(item);
    }
    const allSuperior = units.length > 0 && units.every((item) => item.quality === "Superior");
    const bonus = allSuperior && row.target.minQuality !== "Superior" ? Math.round(row.reward_cp * SUPERIOR_BONUS) : 0;
    const character = payee === PARTY_FUND ? claimedCharacterIds[0] || null : payee;
    run(async () => {
      if (units.length < need) throw new Error(`You need ${need} ${row.target.recipeName} of the right quality.`);
      await completeBounty(row.id, payee, character, bonus);
      // Take them one at a time, re-reading quantities as stacks shrink.
      const left = new Map<string, number>();
      for (const item of units) {
        const current = left.get(item.id) ?? item.qty;
        await removeOneInventoryItem({ ...item, qty: current });
        left.set(item.id, current - 1);
      }
    }, `"${row.title}" delivered. ${formatCp(row.reward_cp + bonus)} paid to ${nameOf(payee)}${bonus ? " (Superior bonus included)" : ""}.`, `Commission delivered: "${row.title}". ${formatCp(row.reward_cp + bonus)} paid to ${nameOf(payee)}${repNote(row)}.`);
  }

  function repNote(row: BountyRow) {
    const name = factionName(row.faction_id);
    return name && row.rep_reward ? `; standing with ${name} ${row.rep_reward > 0 ? "+" : ""}${row.rep_reward}` : "";
  }

  const visible = rows.filter((row) => adminUnlocked || bountyVisible(row, disabledTags));
  const open = visible.filter((row) => row.status === "open" || row.status === "claimed");
  const finished = visible.filter((row) => row.status === "done" || row.status === "cancelled").slice(0, 15);

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ScrollText className="w-7 h-7" />
            <h2 className="text-3xl font-bold">Bounty Board</h2>
          </div>
          <p className="text-sm">
            Hunts and commissions posted for the party. Bring the proof (or report the job done) to collect the reward. Commissions
            ask for a crafted item; deliver one at Superior quality for a bonus.
          </p>
          {missing && (
            <p className="text-sm font-bold text-[#8b1a1a]">The bounty board table isn&apos;t set up yet. Run the latest SQL in Supabase.</p>
          )}
          {message && <p className="rounded bg-[#fff0c7] p-2 text-sm font-bold">{message}</p>}
        </div>
      </Panel>

      {adminUnlocked && (
        <PostForm
          campaignId={campaignId}
          disabledTags={disabledTags}
          partyLevel={partyLevel}
          factions={factions}
          abundanceOf={abundanceOf}
          undeadWeight={undeadWeight}
          regionCreatureIds={regionCreatureIds}
          busy={busy}
          run={run}
        />
      )}

      <Panel>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold">Open jobs</h3>
          {open.length === 0 && <p className="text-sm italic">Nothing posted right now.</p>}
          {open.map((row) => (
            <BountyCard
              key={row.id}
              row={row}
              adminUnlocked={adminUnlocked}
              hidden={!bountyVisible(row, disabledTags)}
              busy={busy}
              payees={payees}
              claimedCharacterIds={claimedCharacterIds}
              nameOf={nameOf}
              factionLabel={
                factionName(row.faction_id)
                  ? `${factionName(row.faction_id)}${row.rep_reward ? ` (${row.rep_reward > 0 ? "+" : ""}${row.rep_reward} standing)` : ""}`
                  : ""
              }
              haveMaterial={haveMaterial}
              deliverable={row.kind === "commission" ? deliverableRows(row).reduce((sum, item) => sum + item.qty, 0) : 0}
              onTurnIn={(payee) => turnInBounty(row, payee)}
              onDeliver={(payee) => deliverCommission(row, payee)}
              onReport={(characterId) =>
                run(() => updateBounty(row.id, { status: "claimed", claimed_by: characterId }), `Reported "${row.title}" as done. The GM will check it.`)
              }
              onCancel={() => run(() => updateBounty(row.id, { status: "cancelled" }), `"${row.title}" taken down.`)}
              onDelete={() => run(() => deleteBounty(row.id), `"${row.title}" deleted.`)}
            />
          ))}
        </div>
      </Panel>

      {finished.length > 0 && (
        <Panel>
          <button type="button" className="text-lg font-bold underline" onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide" : "Show"} finished jobs ({finished.length})
          </button>
          {showDone && (
            <div className="mt-3 space-y-2 text-sm">
              {finished.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d9bf8c] pb-1">
                  <span>
                    <strong>{row.title}</strong>{" "}
                    {row.status === "done"
                      ? `— done${row.claimed_by ? ` by ${nameOf(row.claimed_by)}` : ""}, paid to ${nameOf(row.paid_to)}`
                      : "— taken down"}
                  </span>
                  {adminUnlocked && (
                    <span className="flex gap-2">
                      {row.status === "cancelled" && (
                        <button className="underline" onClick={() => run(() => updateBounty(row.id, { status: "open" }), `"${row.title}" reposted.`)}>
                          Repost
                        </button>
                      )}
                      <button className="text-[#8b1a1a]" onClick={() => run(() => deleteBounty(row.id), `"${row.title}" deleted.`)} aria-label={`Delete ${row.title}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function BountyCard({
  row,
  adminUnlocked,
  hidden,
  busy,
  payees,
  claimedCharacterIds,
  nameOf,
  factionLabel,
  haveMaterial,
  deliverable,
  onTurnIn,
  onDeliver,
  onReport,
  onCancel,
  onDelete,
}: {
  row: BountyRow;
  adminUnlocked: boolean;
  hidden: boolean;
  busy: boolean;
  payees: { value: string; label: string }[];
  claimedCharacterIds: string[];
  nameOf: (id: string | null) => string;
  factionLabel: string;
  haveMaterial: (name: string) => number;
  deliverable: number;
  onTurnIn: (payee: string) => void;
  onDeliver: (payee: string) => void;
  onReport: (characterId: string | null) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [payee, setPayee] = useState(payees[0]?.value || PARTY_FUND);
  const proof = row.target.proof || [];
  const proofReady = proof.length > 0 && proof.every((item) => haveMaterial(item.name) >= item.qty);
  const need = Math.max(1, row.target.qty || 1);
  const isBounty = row.kind === "bounty";
  const canAct = adminUnlocked || claimedCharacterIds.length > 0;

  return (
    <div className="rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">
            {isBounty ? <ScrollText className="inline h-4 w-4 mr-1" /> : <Hammer className="inline h-4 w-4 mr-1" />}
            {row.title}
          </p>
          <p className="text-xs">
            {isBounty ? "Bounty" : "Commission"}
            {row.giver ? ` · posted by ${row.giver}` : ""}
            {factionLabel ? ` · for ${factionLabel}` : ""}
            {row.status === "claimed" ? ` · reported done by ${nameOf(row.claimed_by)}, waiting on the GM` : ""}
            {hidden ? " · hidden from players (its set is switched off)" : ""}
          </p>
        </div>
        <p className="text-lg font-bold text-[#7a5200]">{formatCp(row.reward_cp)}</p>
      </div>
      {row.description && <p className="text-sm">{row.description}</p>}
      <p className="text-sm">
        {isBounty ? (
          <>
            <strong>Hunt:</strong> {huntTargets(row.target).map((target) => `${target.count}× ${target.label}`).join(", ")}
            {proof.length > 0 && (
              <>
                {" "}· <strong>Proof:</strong>{" "}
                {proof.map((item) => `${item.qty}× ${item.name} (party has ${haveMaterial(item.name)})`).join(", ")}
              </>
            )}
          </>
        ) : (
          <>
            <strong>Wanted:</strong> {need}× {row.target.recipeName}
            {row.target.minQuality && row.target.minQuality !== "Flawed" ? `, ${row.target.minQuality} or better` : ""} · you have {deliverable}
            {row.target.minQuality !== "Superior" ? ` · Superior pays +${Math.round(SUPERIOR_BONUS * 100)}%` : ""}
          </>
        )}
      </p>

      {canAct && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={payee} onChange={(event) => setPayee(event.target.value)} className={fieldClass} aria-label={`Pay ${row.title} reward to`}>
            {payees.map((option) => (
              <option key={option.value} value={option.value}>Pay to {option.label}</option>
            ))}
          </select>
          {isBounty && proof.length > 0 && (
            <Button size="sm" disabled={busy || !proofReady} onClick={() => onTurnIn(payee)} className={greenButton}>
              Turn in proof
            </Button>
          )}
          {isBounty && proof.length === 0 && row.status === "open" && !adminUnlocked && (
            <Button size="sm" disabled={busy} onClick={() => onReport(claimedCharacterIds[0] || null)} className={blueButton}>
              Report done
            </Button>
          )}
          {isBounty && proof.length === 0 && adminUnlocked && (
            <Button size="sm" disabled={busy} onClick={() => onTurnIn(payee)} className={greenButton}>
              {row.status === "claimed" ? "Approve and pay" : "Mark done and pay"}
            </Button>
          )}
          {!isBounty && (
            <Button size="sm" disabled={busy || deliverable < need} onClick={() => onDeliver(payee)} className={greenButton}>
              Deliver
            </Button>
          )}
        </div>
      )}

      {adminUnlocked && (
        <div className="flex flex-wrap gap-3 border-t border-[#d9bf8c] pt-2 text-xs">
          <button className="underline" disabled={busy} onClick={onCancel}>Take down</button>
          <button className="flex items-center gap-1 text-[#8b1a1a]" disabled={busy} onClick={onDelete}>
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Random bounty rewards per creature, by how hard it is for the party.
const RANDOM_REWARD_CP: Record<BountyRarity, number> = { common: 200, rare: 800, epic: 2500 };
const RARITY_WEIGHTS: [BountyRarity, number][] = [["common", 50], ["rare", 35], ["epic", 15]];
// Reputation gained by default, by the toughest creature in the bounty.
const REP_BY_RARITY: Record<BountyRarity, number> = { common: 3, rare: 6, epic: 10 };

type HuntLine = { id: string; count: number };

function PostForm({
  campaignId,
  disabledTags,
  partyLevel,
  factions,
  abundanceOf,
  undeadWeight,
  regionCreatureIds,
  busy,
  run,
}: {
  undeadWeight: number;
  regionCreatureIds: string[] | null;
  campaignId: string;
  disabledTags: string[];
  partyLevel: number;
  factions: FactionRow[];
  abundanceOf: (table: LootTable) => Abundance;
  busy: boolean;
  run: (action: () => Promise<unknown>, done: string, journal?: string) => Promise<void>;
}) {
  const creatures = useMemo(() => visibleBountyCreatures(disabledTags), [disabledTags]);
  const recipes = useMemo(() => visibleCommissionRecipes(disabledTags), [disabledTags]);
  const [kind, setKind] = useState<BountyKind>("bounty");
  const [hunt, setHunt] = useState<HuntLine[]>([]);
  const [useProof, setUseProof] = useState(true);
  const [recipeName, setRecipeName] = useState("");
  const [qty, setQty] = useState(1);
  const [minQuality, setMinQuality] = useState<DeliveryQuality>("Normal");
  const [title, setTitle] = useState("");
  const [giver, setGiver] = useState("");
  const [description, setDescription] = useState("");
  const [rewardGp, setRewardGp] = useState("");
  const [factionId, setFactionId] = useState("");
  const [repReward, setRepReward] = useState("");
  const [mode, setMode] = useState<"gm" | "random">("gm");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolled, setRolled] = useState<BountyRarity | null>(null);
  const bands = bountyBands(partyLevel);
  const byRarity = useMemo(() => {
    const groups: Record<BountyRarity, LootTable[]> = { common: [], rare: [], epic: [] };
    // In a region, random bounties come from the creatures that live there.
    const local = regionCreatureIds ? creatures.filter((table) => regionCreatureIds.includes(table.id)) : [];
    for (const table of local.length ? local : creatures) {
      if (table.defaultTier === "boss" || abundanceOf(table) === "hunted out") continue;
      const rarity = bountyRarityFor(creatureInfo(table), partyLevel);
      if (rarity) groups[rarity].push(table);
    }
    return groups;
  }, [creatures, partyLevel, abundanceOf, regionCreatureIds]);

  const huntTables = hunt
    .map((line) => ({ line, table: creatures.find((item) => item.id === line.id) }))
    .filter((entry): entry is { line: HuntLine; table: LootTable } => Boolean(entry.table));

  function addCreature(table: LootTable) {
    setHunt((current) =>
      current.some((line) => line.id === table.id)
        ? current.map((line) => (line.id === table.id ? { ...line, count: line.count + 1 } : line))
        : [...current, { id: table.id, count: 1 }]
    );
    setRewardGp("");
    setRolled(null);
  }

  function rollRandomBounty() {
    const options = RARITY_WEIGHTS.filter(([rarity]) => byRarity[rarity].length > 0);
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    const rarity = (options.find(([, weight]) => (roll -= weight) <= 0) || options[0])?.[0];
    if (!rarity) return;
    // One to three different creatures (one is most likely), each up to the cap.
    const kinds = Math.min(byRarity[rarity].length, Math.random() < 0.6 ? 1 : Math.random() < 0.75 ? 2 : 3);
    // Plentiful creatures are likelier picks; scarce ones rarely come up.
    const pool: LootTable[] = [];
    const candidates = [...byRarity[rarity]];
    while (pool.length < kinds && candidates.length) {
      // Plentiful creatures come up more; the threat clock makes undead likelier.
      const weights = candidates.map((table) => ABUNDANCE_WEIGHT[abundanceOf(table)] * (table.family === "undead" ? undeadWeight : 1));
      let pick = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
      const index = Math.max(0, weights.findIndex((weight) => (pick -= weight) <= 0));
      pool.push(candidates.splice(index, 1)[0]);
    }
    const lines = pool.map((table) => ({ id: table.id, count: 1 + Math.floor(Math.random() * Math.random() * BOUNTY_CAPS[rarity]) }));
    const totalCount = lines.reduce((sum, line) => sum + line.count, 0);
    setHunt(lines);
    setRolled(rarity);
    setGiver(randomItem(giversFor(pool[0].set)) || "");
    setTitle("");
    const perCreature = Math.round(RANDOM_REWARD_CP[rarity] * (1 + (Math.max(1, partyLevel) - 1) * 0.25));
    setRewardGp(String((perCreature * totalCount) / 100));
    setRepReward(String(REP_BY_RARITY[rarity]));
  }

  const recipe = recipes.find((item) => norm(item.name) === norm(recipeName));
  const proof = useProof ? mergeProof(huntTables.flatMap(({ table, line }) => suggestedProof(table, line.count))) : [];
  const suggestedCp =
    kind === "bounty"
      ? huntTables.reduce((sum, { table, line }) => sum + suggestedBountyReward(table, line.count), 0)
      : recipe
        ? suggestedCommissionReward(recipe, qty)
        : 0;
  const rewardCp = rewardGp.trim() === "" ? suggestedCp : Math.max(0, Math.round(Number(rewardGp) * 100) || 0);
  const autoTitle =
    kind === "bounty"
      ? huntTables.length
        ? `Hunt: ${huntTables.map(({ table, line }) => `${line.count > 1 ? `${line.count}× ` : ""}${table.label}`).join(", ")}`
        : ""
      : recipe
        ? `Commission: ${qty > 1 ? `${qty}× ` : ""}${recipe.name}`
        : "";
  const set = kind === "bounty" ? huntTables[0]?.table.set : recipe ? recipeSet(recipe) : undefined;
  const ready = kind === "bounty" ? huntTables.length > 0 : Boolean(recipe);
  const defaultRep = kind === "bounty" ? Math.max(0, ...huntTables.map(({ table }) => REP_BY_RARITY[bountyRarityFor(creatureInfo(table), partyLevel) || "epic"])) : 3;
  const rep = repReward.trim() === "" ? defaultRep : Math.round(Number(repReward) || 0);

  function randomise() {
    const pick = randomItem(recipes);
    if (!pick) return;
    setRecipeName(pick.name);
    setQty(1);
    setGiver(randomItem(giversFor(recipeSet(pick))) || "");
    setRewardGp("");
    setTitle("");
  }

  function post() {
    if (!ready) return;
    const finalTitle = title.trim() || autoTitle;
    run(
      () =>
        postBounty({
          campaignId,
          kind,
          title: finalTitle,
          giver: giver || factions.find((faction) => faction.id === factionId)?.name || "",
          description,
          rewardCp,
          factionId: factionId || null,
          repReward: factionId ? rep : 0,
          target:
            kind === "bounty"
              ? { creatures: huntTables.map(({ table, line }) => ({ creature: table.id, label: table.label, count: line.count })), proof }
              : { recipeId: recipe!.id, recipeName: recipe!.name, qty, minQuality },
        }),
      `Posted "${finalTitle}".`,
      `${kind === "bounty" ? "New bounty" : "New commission"} posted: "${finalTitle}" (${formatCp(rewardCp)}).`
    ).then(() => {
      setTitle("");
      setDescription("");
      setRewardGp("");
      setRepReward("");
      setHunt([]);
      setRolled(null);
    });
  }

  return (
    <Panel>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold">GM: Post a job</h3>
        <p className="text-xs">Only creatures and recipes from sets that are switched on for this campaign can be posted.</p>
        <div className="flex flex-wrap gap-2">
          {(["bounty", "commission"] as BountyKind[]).map((option) => (
            <Button key={option} size="sm" onClick={() => setKind(option)} className={kind === option ? darkButton : blueButton}>
              {option === "bounty" ? "Bounty (hunt)" : "Commission (craft)"}
            </Button>
          ))}
          {kind === "commission" && (
            <Button size="sm" onClick={randomise} className={blueButton}>
              Suggest one
            </Button>
          )}
        </div>

        {kind === "bounty" ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setMode("gm")} className={mode === "gm" ? darkButton : blueButton}>
                GM&apos;s choice
              </Button>
              <Button size="sm" onClick={() => setMode("random")} className={mode === "random" ? darkButton : blueButton}>
                Random
              </Button>
            </div>
            {mode === "random" && (
              <div className="rounded border border-dashed border-[#9a7b45] p-2 text-xs space-y-1">
                <p>
                  Party level {Math.round(partyLevel)}: <strong>epic</strong> = above CR {formatCr(bands.epic.min)} up to {formatCr(bands.epic.max)} (up to{" "}
                  {BOUNTY_CAPS.epic} each), <strong>rare</strong> = above CR {formatCr(bands.rare.min)} up to {formatCr(bands.rare.max)} (up to{" "}
                  {BOUNTY_CAPS.rare} each), <strong>common</strong> = CR {formatCr(bands.common.max)} and under (up to {BOUNTY_CAPS.common} each). A random
                  bounty has up to 3 different creatures. Where common and rare overlap, predators are common and prey is rare.
                </p>
                <p>
                  Available: {byRarity.common.length} common, {byRarity.rare.length} rare, {byRarity.epic.length} epic.
                </p>
                <Button size="sm" onClick={rollRandomBounty} className={darkButton}>
                  Roll a random bounty
                </Button>
                {rolled && <p className="font-bold">Rolled a {rolled} bounty. Adjust it below or post it as it is.</p>}
              </div>
            )}
            <div className="space-y-1">
              {huntTables.map(({ table, line }) => (
                <div key={table.id} className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} w-16`}
                    value={line.count}
                    onChange={(event) => {
                      const count = Math.max(1, Number(event.target.value) || 1);
                      setHunt((current) => current.map((item) => (item.id === table.id ? { ...item, count } : item)));
                      setRewardGp("");
                    }}
                    aria-label={`How many ${table.label}`}
                  />
                  <span>
                    × <strong>{table.label}</strong>{" "}
                    <span className="text-xs">
                      (CR {formatCr(creatureInfo(table).cr)}
                      {abundanceOf(table) !== "normal" ? `, ${abundanceOf(table)}` : ""})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-[#8b1a1a]"
                    onClick={() => setHunt((current) => current.filter((item) => item.id !== table.id))}
                    aria-label={`Remove ${table.label}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => setPickerOpen(true)} className={blueButton} aria-label="Add creature to hunt">
                  + Add a creature
                </Button>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={useProof} onChange={(event) => setUseProof(event.target.checked)} />
                  Ask for proof
                </label>
                {proof.length > 0 && <span className="text-xs">Proof: {proof.map((item) => `${item.qty}× ${item.name}`).join(", ")}</span>}
              </div>
            </div>
            <CreaturePicker
              creatures={creatures}
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onPick={(picked) => {
                addCreature(picked);
                setPickerOpen(false);
              }}
              title="Add a bounty target"
              note={(table) => (abundanceOf(table) !== "normal" ? abundanceOf(table) : "")}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              list="commission-recipes"
              className={`${fieldClass} min-w-[16rem]`}
              placeholder="Item to craft..."
              value={recipeName}
              onChange={(event) => { setRecipeName(event.target.value); setRewardGp(""); }}
              aria-label="Item to commission"
            />
            <datalist id="commission-recipes">
              {recipes.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
            <label className="flex items-center gap-1">
              How many
              <input type="number" min={1} className={`${fieldClass} w-16`} value={qty} onChange={(event) => { setQty(Math.max(1, Number(event.target.value) || 1)); setRewardGp(""); }} aria-label="How many to craft" />
            </label>
            <select value={minQuality} onChange={(event) => setMinQuality(event.target.value as DeliveryQuality)} className={fieldClass} aria-label="Lowest quality accepted">
              <option value="Flawed">Any quality</option>
              <option value="Normal">Normal or better</option>
              <option value="Superior">Superior only</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
          <input className={fieldClass} placeholder={autoTitle || "Title"} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Job title" />
          <input list="bounty-givers" className={fieldClass} placeholder="Posted by (optional)" value={giver} onChange={(event) => setGiver(event.target.value)} aria-label="Posted by" />
          <datalist id="bounty-givers">
            {giversFor(set).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <label className="flex items-center gap-1">
            Reward (gp)
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${fieldClass} w-24`}
              placeholder={(suggestedCp / 100).toString()}
              value={rewardGp}
              onChange={(event) => setRewardGp(event.target.value)}
              aria-label="Reward in gold"
            />
            <span className="text-xs">{formatCp(rewardCp)}</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={factionId} onChange={(event) => setFactionId(event.target.value)} className={fieldClass} aria-label="Faction posting the job">
            <option value="">No faction</option>
            {factions.map((faction) => (
              <option key={faction.id} value={faction.id}>
                For {faction.name}
                {faction.hidden ? " (hidden from players)" : ""}
              </option>
            ))}
          </select>
          {factionId && (
            <label className="flex items-center gap-1">
              Reputation
              <input
                type="number"
                className={`${fieldClass} w-16`}
                placeholder={String(defaultRep)}
                value={repReward}
                onChange={(event) => setRepReward(event.target.value)}
                aria-label="Reputation reward"
              />
            </label>
          )}
        </div>
        <textarea className={`${fieldClass} w-full`} rows={2} placeholder="Notes for the players (optional)" value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Job notes" />
        <Button disabled={busy || !ready} onClick={post} className={darkButton}>
          Post to the board
        </Button>
      </div>
    </Panel>
  );
}

// Proof for several creatures: same material added together.
function mergeProof(items: { name: string; qty: number }[]) {
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.name, (merged.get(item.name) || 0) + item.qty);
  return [...merged].map(([name, qty]) => ({ name, qty }));
}
