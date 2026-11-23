"use client";

import React, { useEffect, useState } from "react";
import { Backpack, ChevronDown, ChevronRight, Package, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { fetchCampaignCraftedItems } from "@/lib/supabaseCraftedItems";
import {
  addInventoryItem,
  deleteInventoryItem,
  fetchCampaignInventory,
  moveInventoryItem,
  remainingUses,
  updateInventoryItem,
  spendInventoryUse,
  type InventoryRow,
} from "@/lib/supabaseInventory";
import { consumableInfo } from "@/data/consumables";

type CharacterLike = { id: string; name: string; isActive?: boolean };

export type InventoryRecipe = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  rarity: string;
  description: string;
  normalOutcome?: string;
};

const RARITY_COLORS: Record<string, string> = {
  common: "#6b6b6b",
  uncommon: "#2f9e44",
  rare: "#1c7ed6",
  epic: "#9c36b5",
  ascendant: "#2aa9b8",
  legendary: "#b8860b",
  artifact: "#c92a2a",
};

const STASH = "__stash__";

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

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

function usesLabel(row: InventoryRow) {
  const total = remainingUses(row);
  if (total === null) return null;
  const perItem = Math.max(1, row.metadata.usesPerItem ?? 1);
  if (perItem === 1) return `${total} use${total === 1 ? "" : "s"} left`;
  const left = row.metadata.usesLeft ?? perItem;
  return `${left}/${perItem} on the open one · ${total} total`;
}

function ItemRow({
  row,
  holderName,
  targets,
  canAct,
  adminUnlocked,
  busy,
  onUse,
  onGive,
  onDelete,
  onAdjust,
}: {
  row: InventoryRow;
  holderName: string;
  targets: { value: string; label: string }[];
  canAct: boolean;
  adminUnlocked: boolean;
  busy: boolean;
  onUse: (row: InventoryRow) => void;
  onGive: (row: InventoryRow, target: string, count?: number) => void;
  onDelete: (row: InventoryRow) => void;
  onAdjust: (row: InventoryRow, change: { qty?: number; usesLeft?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const color = RARITY_COLORS[(row.rarity || "common").toLowerCase()] || RARITY_COLORS.common;
  const uses = usesLabel(row);
  const consumable = Boolean(row.metadata.consumable);
  const perItem = Math.max(1, row.metadata.usesPerItem ?? 1);

  return (
    <div className="rounded-xl border-2 bg-[#f7e7c5] p-3 space-y-2" style={{ borderColor: color }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-start gap-1 text-left">
          {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
          <span>
            <strong style={{ color }}>{row.name}</strong>
            {row.qty > 1 && <strong> ×{row.qty}</strong>}
            <span className="block text-xs">
              {[row.rarity, row.quality && row.quality !== "Normal" ? row.quality : null, row.source, row.metadata.crafter ? `made by ${row.metadata.crafter}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {uses && <span className="block text-xs font-bold">{uses}</span>}
          </span>
        </button>
        {canAct && consumable && (
          <Button size="sm" disabled={busy} onClick={() => onUse(row)} className={darkButton}>
            Use
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-1 text-sm">
          {row.description && <p className="leading-relaxed">{row.description}</p>}
          {row.stat_block && <p><strong>Stat block:</strong> {row.stat_block}</p>}
          {(row.effect || []).filter((line) => line && line !== row.description).map((line) => (
            <p key={line} className="text-xs">{line}</p>
          ))}
        </div>
      )}

      {canAct && targets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={target} onChange={(event) => setTarget(event.target.value)} className={fieldClass} aria-label={`Give ${row.name} to`}>
            <option value="">Give to...</option>
            {targets.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button size="sm" disabled={!target || busy} onClick={() => onGive(row, target, 1)} className={blueButton}>
            Give 1
          </Button>
          {row.qty > 1 && (
            <Button size="sm" disabled={!target || busy} onClick={() => onGive(row, target)} className={blueButton}>
              Give all
            </Button>
          )}
        </div>
      )}

      {adminUnlocked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#d9bf8c] pt-2 text-xs">
          <span className="font-bold">GM:</span>
          <span>Qty</span>
          <button className="rounded border border-[#9a7b45] px-2" disabled={busy} onClick={() => onAdjust(row, { qty: row.qty - 1 })}>−</button>
          <strong>{row.qty}</strong>
          <button className="rounded border border-[#9a7b45] px-2" disabled={busy} onClick={() => onAdjust(row, { qty: row.qty + 1 })}>+</button>
          {consumable && perItem > 1 && (
            <>
              <span className="ml-2">Uses on open one</span>
              <button className="rounded border border-[#9a7b45] px-2" disabled={busy} onClick={() => onAdjust(row, { usesLeft: (row.metadata.usesLeft ?? perItem) - 1 })}>−</button>
              <strong>{row.metadata.usesLeft ?? perItem}</strong>
              <button className="rounded border border-[#9a7b45] px-2" disabled={busy} onClick={() => onAdjust(row, { usesLeft: (row.metadata.usesLeft ?? perItem) + 1 })}>+</button>
            </>
          )}
          <button className="ml-auto flex items-center gap-1 text-[#8b1a1a]" disabled={busy} onClick={() => onDelete(row)} aria-label={`Delete ${row.name}`}>
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <span className="w-full text-[11px] opacity-70">Held by {holderName}</span>
        </div>
      )}
    </div>
  );
}

export default function InventoryPanel({
  campaignId,
  characters,
  adminUnlocked,
  claimedCharacterIds,
  recipes,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
  // Characters claimed on this computer (players only act on these and the stash).
  claimedCharacterIds: string[];
  recipes: InventoryRecipe[];
}) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [legacyCount, setLegacyCount] = useState(0);
  const [newItem, setNewItem] = useState({ name: "", qty: 1, holder: STASH });

  const visibleCharacters = characters.filter((character) => adminUnlocked || character.isActive !== false);
  const nameOf = (id: string | null) => (id ? characters.find((character) => character.id === id)?.name || "Unknown character" : "Party stash");

  async function reload() {
    if (!campaignId) return;
    try {
      const next = await fetchCampaignInventory(campaignId);
      setRows(next);
      setLoaded(true);
      if (next.length === 0 && adminUnlocked) {
        const legacy = await fetchCampaignCraftedItems(campaignId);
        setLegacyCount(legacy.length);
      } else {
        setLegacyCount(0);
      }
    } catch (error) {
      setMessage(`Could not load inventories: ${error instanceof Error ? error.message : String(error)}`);
      setLoaded(true);
    }
  }

  const reloadRef = React.useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const channel = supabase
      .channel(`campaign-inventory-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_inventory_items", filter: `campaign_id=eq.${campaignId}` },
        () => reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, adminUnlocked]);

  // Owners act on their own items; anyone with a claimed character can use the
  // stash; the GM can act on everything.
  function canAct(row: InventoryRow) {
    if (adminUnlocked) return true;
    if (claimedCharacterIds.length === 0) return false;
    return row.character_id === null || claimedCharacterIds.includes(row.character_id);
  }

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      if (done) setMessage(done);
    } catch (error) {
      setMessage(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      await reload();
    }
  }

  function handleUse(row: InventoryRow) {
    run(async () => {
      const left = await spendInventoryUse(row);
      setMessage(left > 0 ? `${nameOf(row.character_id)} used ${row.name}. ${left} use${left === 1 ? "" : "s"} left.` : `${nameOf(row.character_id)} used the last of ${row.name}.`);
    });
  }

  function handleGive(row: InventoryRow, target: string, count?: number) {
    const to = target === STASH ? null : target;
    run(() => moveInventoryItem(row, to, count), `${count === 1 ? "1" : "All"} ${row.name} → ${nameOf(to)}.`);
  }

  function handleDelete(row: InventoryRow) {
    run(() => deleteInventoryItem(row.id), `Deleted ${row.name}.`);
  }

  function handleAdjust(row: InventoryRow, change: { qty?: number; usesLeft?: number }) {
    const perItem = Math.max(1, row.metadata.usesPerItem ?? 1);
    if (change.qty !== undefined && change.qty <= 0) {
      handleDelete(row);
      return;
    }
    run(() =>
      updateInventoryItem(row.id, {
        ...(change.qty !== undefined ? { qty: change.qty } : {}),
        ...(change.usesLeft !== undefined
          ? { metadata: { ...row.metadata, usesLeft: Math.max(1, Math.min(perItem, change.usesLeft)) } }
          : {}),
      })
    );
  }

  function addManualItem() {
    const name = newItem.name.trim();
    if (!adminUnlocked || !name) return;
    const recipe = recipes.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const info = recipe ? consumableInfo(recipe, recipe.normalOutcome || recipe.description) : { consumable: false, usesPerItem: 0 };
    run(
      () =>
        addInventoryItem({
          campaignId,
          characterId: newItem.holder === STASH ? null : newItem.holder,
          name: recipe?.name || name,
          qty: Math.max(1, newItem.qty),
          kind: recipe?.category || "item",
          rarity: recipe?.rarity || null,
          quality: "Normal",
          source: "GM",
          description: recipe ? recipe.normalOutcome || recipe.description : null,
          metadata: { consumable: info.consumable, usesPerItem: info.usesPerItem, recipeId: recipe?.id || null },
        }),
      `Added ${newItem.qty}× ${recipe?.name || name} to ${nameOf(newItem.holder === STASH ? null : newItem.holder)}.`
    );
    setNewItem((current) => ({ ...current, name: "", qty: 1 }));
  }

  function importLegacy() {
    run(async () => {
      const legacy = await fetchCampaignCraftedItems(campaignId);
      for (const item of legacy) {
        const recipe = recipes.find((entry) => entry.id === item.recipe_id || entry.name === item.name);
        const info = recipe ? consumableInfo(recipe, (item.effect || []).join(" ") || recipe.description) : { consumable: false, usesPerItem: 0 };
        await addInventoryItem({
          campaignId,
          characterId: item.character_id,
          name: item.name,
          kind: item.category || "item",
          rarity: item.rarity,
          quality: item.quality,
          source: "Crafted",
          description: (item.effect || [])[0] || item.description,
          effect: item.effect || [],
          statBlock: item.stat_block,
          metadata: { consumable: info.consumable, usesPerItem: info.usesPerItem, recipeId: item.recipe_id },
        });
      }
    }, "Copied the crafted item list into inventories.");
  }

  const holders: { id: string | null; label: string }[] = [
    ...claimedCharacterIds.map((id) => ({ id, label: `${nameOf(id)} (you)` })),
    { id: null, label: "Party stash" },
    ...visibleCharacters
      .filter((character) => !claimedCharacterIds.includes(character.id))
      .map((character) => ({ id: character.id, label: character.name })),
  ];

  const targetsFor = (holderId: string | null) => [
    ...(holderId !== null ? [{ value: STASH, label: "Party stash" }] : []),
    ...visibleCharacters.filter((character) => character.id !== holderId).map((character) => ({ value: character.id, label: character.name })),
  ];

  const recipeNames = recipes.filter((recipe) => recipe.category !== "material-refinement").map((recipe) => recipe.name);

  return (
    <div className="space-y-6 font-serif">
      <Panel>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Backpack className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Inventories</h2>
          </div>
          <p>
            Finished items belong to a character or the party stash. Crafted items go to the crafter and looted gear to the harvester. Consumables track their uses: press <strong>Use</strong> when you drink, throw or set one. Materials stay in the shared pool on the Materials tab.
          </p>
          {claimedCharacterIds.length === 0 && !adminUnlocked && (
            <p className="rounded-lg border border-[#c97716] bg-[#ffe0a3] p-2 text-sm font-bold">Claim your character (top of the page) to use and give your items.</p>
          )}
          {message && <p className="font-bold">{message}</p>}

          {adminUnlocked && legacyCount > 0 && (
            <div className="rounded-lg border border-[#9a7b45] bg-[#fff0c7] p-3 text-sm space-y-2">
              <p>The Crafted Item List has {legacyCount} item{legacyCount === 1 ? "" : "s"} from before inventories existed.</p>
              <Button size="sm" disabled={busy} onClick={importLegacy} className={darkButton}>
                Copy them into inventories
              </Button>
            </div>
          )}

          {adminUnlocked && (
            <div className="rounded-lg border border-[#9a7b45] bg-[#f2dfb9] p-3 space-y-2">
              <p className="font-bold">GM: Give an item</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_80px_200px_auto]">
                <input
                  list="inventory-recipe-names"
                  className={fieldClass}
                  placeholder="Item name (pick a recipe to fill in its details and uses)"
                  value={newItem.name}
                  onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
                />
                <datalist id="inventory-recipe-names">
                  {recipeNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  value={newItem.qty}
                  onChange={(event) => setNewItem((current) => ({ ...current, qty: Math.max(1, Number(event.target.value) || 1) }))}
                  aria-label="Quantity"
                />
                <select
                  className={fieldClass}
                  value={newItem.holder}
                  onChange={(event) => setNewItem((current) => ({ ...current, holder: event.target.value }))}
                  aria-label="Give to"
                >
                  <option value={STASH}>Party stash</option>
                  {visibleCharacters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name}</option>
                  ))}
                </select>
                <Button disabled={busy || !newItem.name.trim()} onClick={addManualItem} className={darkButton}>
                  Give
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {!loaded ? (
        <Panel><p>Loading inventories...</p></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {holders.map((holder) => {
            const items = rows.filter((row) => row.character_id === holder.id);
            return (
              <Panel key={holder.id ?? STASH}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-6 h-6" />
                    <h3 className="text-2xl font-bold">{holder.label}</h3>
                    <span className="text-sm">({items.reduce((sum, row) => sum + row.qty, 0)} items)</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm italic">Nothing here yet.</p>
                  ) : (
                    items.map((row) => (
                      <ItemRow
                        key={row.id}
                        row={row}
                        holderName={holder.label}
                        targets={targetsFor(holder.id)}
                        canAct={canAct(row)}
                        adminUnlocked={adminUnlocked}
                        busy={busy}
                        onUse={handleUse}
                        onGive={handleGive}
                        onDelete={handleDelete}
                        onAdjust={handleAdjust}
                      />
                    ))
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
