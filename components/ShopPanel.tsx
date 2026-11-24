"use client";

import React, { useEffect, useRef, useState } from "react";
import { Store, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { createShop, deleteShop, fetchShops, recordMarket, shopPurchase, updateShop, type ShopRow } from "@/lib/supabaseShops";
import { useCampaignFactions, reputationTier } from "@/lib/supabaseFactions";
import { buyPriceCp, marketFactor, marketNote, sellPriceCp } from "@/data/market";
import { PARTY_FUND, changePurse } from "@/lib/supabaseCoins";
import { addInventoryItem, fetchCampaignInventory, removeOneInventoryItem, remainingUses, type InventoryRow } from "@/lib/supabaseInventory";
import { CoinChips, useCampaignPurses } from "@/components/CoinPurses";
import { changeForCp, formatCp, paymentPlan } from "@/data/coins";
import {
  SELL_RATE,
  SHOP_TEMPLATES,
  isMaterialName,
  itemValueCp,
  materialValueCp,
  stockFromNames,
  type StockEntry,
} from "@/data/shops";
import { recipesRaw } from "@/data/recipesRaw";
import { materialTierEntries } from "@/data/materialTiers";
import { consumableInfo } from "@/data/consumables";

type CharacterLike = { id: string; name: string; isActive?: boolean };
type PoolMaterial = { name: string; qty: number };

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
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

const recipeByName = new Map(recipesRaw.filter((recipe) => recipe.category !== "material-refinement").map((recipe) => [recipe.name.toLowerCase(), recipe]));

function recipeFor(row: Pick<InventoryRow, "name" | "metadata">) {
  return recipesRaw.find((recipe) => recipe.id === row.metadata?.recipeId) || recipeByName.get(row.name.toLowerCase()) || null;
}

// What a shop pays for one of this item (half its value; a half-used
// consumable is worth only the uses left on it).
export function itemSaleCp(row: InventoryRow) {
  const value = itemValueCp({ recipe: recipeFor(row), rarity: row.rarity, quality: row.quality });
  const meta = row.metadata || {};
  let fraction = 1;
  if (meta.consumable && row.qty === 1) {
    const perItem = Math.max(1, meta.usesPerItem ?? 1);
    fraction = Math.max(0, Math.min(1, (meta.usesLeft ?? perItem) / perItem));
  }
  return Math.max(1, Math.floor(value * SELL_RATE * fraction));
}

// Supabase hands back an already-subscribed channel when a topic name repeats,
// and adding listeners to it throws. The page and the Shops tab both listen to
// shops, so every listener gets its own channel name.
let shopChannelCount = 0;

// Live list of the campaign's shops. The page uses it to show the Shops tab
// only while a shop is open.
export function useCampaignShops(campaignId: string) {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      try {
        setShops(await fetchShops(campaignId));
      } catch (error) {
        console.warn("Could not load shops.", error);
      }
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    fetchShops(campaignId)
      .then((rows) => {
        if (!cancelled) setShops(rows);
      })
      .catch((error) => console.warn("Could not load shops.", error));
    const channel = supabase
      .channel(`campaign-shops-${campaignId}-${++shopChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_shops", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return { shops, reload: () => reloadRef.current() };
}

function parseGp(text: string): number {
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0;
}

function ShopEditor({ shop, onDone }: { shop: ShopRow; onDone: (message: string) => void }) {
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description || "");
  const [stock, setStock] = useState<StockEntry[]>(shop.stock);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateShop(shop.id, { name: name.trim() || shop.name, description, stock });
      onDone(`Saved ${name.trim() || shop.name}.`);
    } catch (error) {
      onDone(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function addEntry() {
    const entryName = newName.trim();
    if (!entryName || stock.some((entry) => entry.name.toLowerCase() === entryName.toLowerCase())) return;
    const recipe = recipeByName.get(entryName.toLowerCase());
    const material = isMaterialName(entryName) || !recipe;
    setStock([
      ...stock,
      {
        name: recipe && !material ? recipe.name : entryName,
        kind: material ? "material" : "item",
        priceCp: material ? materialValueCp(entryName) : itemValueCp({ recipe, quality: "Normal" }),
        qty: null,
      },
    ]);
    setNewName("");
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#d9bf8c] bg-[#fff0c7] p-3 text-sm">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} aria-label="Shop name" />
        <input className={fieldClass} value={description} placeholder="Description" onChange={(event) => setDescription(event.target.value)} aria-label="Shop description" />
      </div>
      <p className="text-xs">Price is in gold (0.2 = 2 sp). Leave stock blank for unlimited.</p>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {stock.map((entry, index) => (
          <div key={entry.name} className="grid grid-cols-[1fr_80px_80px_auto] items-center gap-2">
            <span>
              {entry.name} <span className="text-xs opacity-70">({entry.kind})</span>
            </span>
            <input
              className={fieldClass}
              type="number"
              min={0}
              step="0.01"
              defaultValue={entry.priceCp / 100}
              onChange={(event) => setStock(stock.map((item, i) => (i === index ? { ...item, priceCp: parseGp(event.target.value) } : item)))}
              aria-label={`${entry.name} price in gold`}
            />
            <input
              className={fieldClass}
              type="number"
              min={0}
              placeholder="∞"
              defaultValue={entry.qty ?? ""}
              onChange={(event) =>
                setStock(stock.map((item, i) => (i === index ? { ...item, qty: event.target.value === "" ? null : Math.max(0, Math.floor(Number(event.target.value) || 0)) } : item)))
              }
              aria-label={`${entry.name} stock`}
            />
            <button type="button" className="text-[#8b1a1a]" onClick={() => setStock(stock.filter((_, i) => i !== index))} aria-label={`Remove ${entry.name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          list="shop-stock-names"
          className={`${fieldClass} flex-1`}
          placeholder="Add a material or item"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <Button size="sm" className={blueButton} disabled={!newName.trim()} onClick={addEntry}>
          Add to stock
        </Button>
        <Button size="sm" className={darkButton} disabled={busy} onClick={save}>
          Save shop
        </Button>
      </div>
    </div>
  );
}

export default function ShopPanel({
  campaignId,
  characters,
  adminUnlocked,
  claimedCharacterIds,
  materials,
  onAddMaterials,
  onRemoveMaterials,
  campaignDay,
  onJournal,
}: {
  campaignDay: number;
  onJournal: (text: string) => void;
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
  claimedCharacterIds: string[];
  // The shared material pool.
  materials: PoolMaterial[];
  onAddMaterials: (items: PoolMaterial[]) => void;
  // Returns false (and changes nothing) if the pool doesn't have enough.
  onRemoveMaterials: (items: PoolMaterial[]) => boolean;
}) {
  const { shops, reload } = useCampaignShops(campaignId);
  const { coinsOf, reload: reloadPurses } = useCampaignPurses(campaignId);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [buyer, setBuyer] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState("");
  const [template, setTemplate] = useState(SHOP_TEMPLATES[0].kind);
  const [sellMaterial, setSellMaterial] = useState("");
  const [sellMaterialQty, setSellMaterialQty] = useState(1);
  const [sellShopId, setSellShopId] = useState("");
  const { factions } = useCampaignFactions(campaignId);

  // Standing with the shop's faction: a discount (negative = surcharge; -1 = won't trade).
  function standingFor(shop: ShopRow | undefined) {
    const faction = factions.find((item) => item.id === shop?.faction_id);
    return faction ? { faction, tier: reputationTier(faction.reputation) } : null;
  }
  function priceFor(shop: ShopRow, entry: StockEntry) {
    const standing = standingFor(shop);
    return buyPriceCp(entry.priceCp, marketFactor(shop.market, entry.name, campaignDay), standing ? Math.max(-0.5, standing.tier.discount) : 0);
  }
  function salePrice(shop: ShopRow | undefined, name: string, baseSellCp: number) {
    if (!shop) return baseSellCp;
    const standing = standingFor(shop);
    return sellPriceCp(baseSellCp, marketFactor(shop.market, name, campaignDay), standing ? Math.max(-0.5, standing.tier.discount) : 0);
  }

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    fetchCampaignInventory(campaignId)
      .then((rows) => {
        if (!cancelled) setInventory(rows);
      })
      .catch((error) => console.warn("Could not load inventory for selling.", error));
    return () => {
      cancelled = true;
    };
  }, [campaignId, inventoryVersion]);

  const visible = characters.filter((character) => adminUnlocked || character.isActive !== false);
  const nameOf = (holder: string) => (holder === PARTY_FUND ? "Party fund" : characters.find((c) => c.id === holder)?.name || "Unknown");
  const buyerOptions = adminUnlocked
    ? [{ id: PARTY_FUND, label: "Party fund" }, ...visible.map((character) => ({ id: character.id, label: character.name }))]
    : [
        ...claimedCharacterIds.map((id) => ({ id, label: nameOf(id) })),
        ...(claimedCharacterIds.length ? [{ id: PARTY_FUND, label: "Party fund" }] : []),
      ];
  const activeBuyer = buyerOptions.some((option) => option.id === buyer) ? buyer : buyerOptions[0]?.id || "";
  const purse = coinsOf(activeBuyer);
  const openShops = shops.filter((shop) => shop.is_open);
  const shownShops = adminUnlocked ? shops : openShops;
  const sellShop = (adminUnlocked ? shops : openShops).find((shop) => shop.id === sellShopId) || openShops[0] || (adminUnlocked ? shops[0] : undefined);
  const buyerItems = inventory.filter((row) => (activeBuyer === PARTY_FUND ? row.character_id === null : row.character_id === activeBuyer));
  const poolForSale = materials.filter((material) => material.qty > 0);
  const stockNames = Array.from(new Set([...materialTierEntries.map((entry) => entry.name), ...Array.from(recipeByName.values()).map((recipe) => recipe.name)]));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      reload();
      reloadPurses();
      setInventoryVersion((version) => version + 1);
    }
  }

  function buy(shop: ShopRow, entry: StockEntry) {
    const key = `${shop.id}:${entry.name}`;
    const qty = Math.max(1, quantities[key] || 1);
    const total = priceFor(shop, entry) * qty;
    const plan = paymentPlan(purse, total);
    const standing = standingFor(shop);
    if (standing && standing.tier.discount <= -1) return setMessage(`${shop.name} won't trade with you: ${standing.faction.name} is hostile.`);
    if (!activeBuyer) return setMessage("Claim a character to shop.");
    if (!plan) return setMessage(`${nameOf(activeBuyer)} can't afford ${qty}× ${entry.name} (${formatCp(total)}).`);
    run(async () => {
      await shopPurchase({ shopId: shop.id, item: entry.name, qty, holder: activeBuyer, payment: plan, reason: `Bought ${qty}× ${entry.name} at ${shop.name}` });
      if (entry.kind === "material") {
        onAddMaterials([{ name: entry.name, qty }]);
      } else {
        const recipe = recipeByName.get(entry.name.toLowerCase());
        const outcome = recipe?.outcomes.find((item) => item.quality === "Normal");
        const info = recipe ? consumableInfo(recipe, outcome?.description || recipe.description) : { consumable: false, usesPerItem: 0 };
        await addInventoryItem({
          campaignId,
          characterId: activeBuyer === PARTY_FUND ? null : activeBuyer,
          name: entry.name,
          qty,
          kind: recipe?.category || "item",
          rarity: recipe?.rarity || null,
          quality: "Normal",
          source: `Bought at ${shop.name}`,
          description: outcome?.description || recipe?.description || null,
          metadata: { consumable: info.consumable, usesPerItem: info.usesPerItem, recipeId: recipe?.id || null },
        });
      }
      await recordMarket(shop.id, entry.name, qty, 0, campaignDay);
      setMessage(`${nameOf(activeBuyer)} bought ${qty}× ${entry.name} for ${formatCp(total)}.${entry.kind === "material" ? " It's in the party's materials." : ""}`);
      onJournal(`${nameOf(activeBuyer)} bought ${qty}× ${entry.name} at ${shop.name} for ${formatCp(total)}.`);
    });
  }

  function sellMaterials() {
    const material = poolForSale.find((item) => item.name === sellMaterial);
    if (!material || !activeBuyer) return;
    const qty = Math.min(material.qty, Math.max(1, sellMaterialQty));
    if (sellShop && standingFor(sellShop)?.tier.discount === -1) return setMessage(`${sellShop.name} won't trade with you.`);
    const total = salePrice(sellShop, material.name, Math.floor(materialValueCp(material.name) * SELL_RATE)) * qty;
    if (total <= 0) return setMessage("Nobody will pay for that.");
    run(async () => {
      if (!onRemoveMaterials([{ name: material.name, qty }])) throw new Error(`The party doesn't have ${qty}× ${material.name}.`);
      await changePurse(campaignId, activeBuyer, changeForCp(total), `Sold ${qty}× ${material.name}`);
      if (sellShop) await recordMarket(sellShop.id, material.name, 0, qty, campaignDay);
      setMessage(`Sold ${qty}× ${material.name} for ${formatCp(total)} → ${nameOf(activeBuyer)}.`);
      onJournal(`${nameOf(activeBuyer)} sold ${qty}× ${material.name}${sellShop ? ` to ${sellShop.name}` : ""} for ${formatCp(total)}.`);
      setSellMaterial("");
      setSellMaterialQty(1);
    });
  }

  function sellItem(row: InventoryRow) {
    if (sellShop && standingFor(sellShop)?.tier.discount === -1) return setMessage(`${sellShop.name} won't trade with you.`);
    const total = salePrice(sellShop, row.name, itemSaleCp(row));
    run(async () => {
      await removeOneInventoryItem(row);
      await changePurse(campaignId, activeBuyer, changeForCp(total), `Sold ${row.name}`);
      if (sellShop) await recordMarket(sellShop.id, row.name, 0, 1, campaignDay);
      setMessage(`Sold ${row.name} for ${formatCp(total)} → ${nameOf(activeBuyer)}.`);
      onJournal(`${nameOf(activeBuyer)} sold ${row.name}${sellShop ? ` to ${sellShop.name}` : ""} for ${formatCp(total)}.`);
    });
  }

  function createFromTemplate() {
    const chosen = SHOP_TEMPLATES.find((item) => item.kind === template) || SHOP_TEMPLATES[0];
    run(async () => {
      await createShop({ campaignId, name: chosen.name, kind: chosen.kind, description: chosen.description, stock: stockFromNames(chosen.stock, chosen.items) });
      setMessage(`Created ${chosen.name}. It starts closed: open it when the party is nearby.`);
    });
  }

  return (
    <div className="space-y-6 font-serif">
      <datalist id="shop-stock-names">
        {stockNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <Panel>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Store className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Shops</h2>
          </div>
          <p>
            Shops sell basic materials and everyday hunting goods. Anything from dangerous creatures has to be hunted or harvested. Shops buy anything for half its value. Bought materials go to the party&apos;s shared materials; bought items go to the buyer.
          </p>
          {adminUnlocked && (
            <p className="text-sm">
              As GM you see every shop. Players only see open shops, and the Shops tab disappears for them when none are open.
            </p>
          )}
          {buyerOptions.length === 0 ? (
            <p className="rounded-lg border border-[#c97716] bg-[#ffe0a3] p-2 text-sm font-bold">Claim your character (top of the page) to shop.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#9a7b45] bg-[#fff0c7] p-3">
              <label className="flex items-center gap-2">
                <strong>Paying from:</strong>
                <select className={fieldClass} value={activeBuyer} onChange={(event) => setBuyer(event.target.value)} aria-label="Paying from">
                  {buyerOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <CoinChips coins={purse} />
            </div>
          )}
          {message && <p className="font-bold">{message}</p>}

          {adminUnlocked && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#9a7b45] bg-[#f2dfb9] p-3">
              <strong>GM: New shop</strong>
              <select className={fieldClass} value={template} onChange={(event) => setTemplate(event.target.value)} aria-label="Shop template">
                {SHOP_TEMPLATES.map((item) => (
                  <option key={item.kind} value={item.kind}>{item.kind === "custom" ? "Empty shop" : item.name}</option>
                ))}
              </select>
              <Button size="sm" className={darkButton} disabled={busy} onClick={createFromTemplate}>
                Create
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {shownShops.length === 0 && (
        <Panel>
          <p className="italic">{adminUnlocked ? "No shops yet. Create one above." : "There's no shop nearby."}</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {shownShops.map((shop) => (
          <Panel key={shop.id}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-2xl font-bold">{shop.name}</h3>
                {adminUnlocked && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-1 font-bold">
                      <input
                        type="checkbox"
                        checked={shop.is_open}
                        onChange={(event) => run(async () => updateShop(shop.id, { is_open: event.target.checked }))}
                      />
                      Open to players {!shop.is_open && <span className="text-[#7a3f00]">(closed)</span>}
                    </label>
                    <button type="button" className="underline" onClick={() => setEditing(editing === shop.id ? "" : shop.id)}>
                      {editing === shop.id ? "Close editor" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[#8b1a1a]"
                      onClick={() => run(async () => deleteShop(shop.id))}
                      aria-label={`Delete ${shop.name}`}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
              {shop.description && <p className="text-sm italic">{shop.description}</p>}
              {(() => {
                const standing = standingFor(shop);
                return standing ? (
                  <p className="text-xs">
                    {standing.faction.name}&apos;s shop · you are <strong>{standing.tier.label}</strong> ({standing.faction.reputation}): {standing.tier.note}
                  </p>
                ) : null;
              })()}
              {adminUnlocked && factions.length > 0 && (
                <select
                  className={fieldClass}
                  value={shop.faction_id || ""}
                  onChange={(event) => run(async () => updateShop(shop.id, { faction_id: event.target.value || null }))}
                  aria-label={`${shop.name}'s faction`}
                >
                  <option value="">Independent shop</option>
                  {factions.map((faction) => (
                    <option key={faction.id} value={faction.id}>Run by {faction.name}</option>
                  ))}
                </select>
              )}
              {adminUnlocked && editing === shop.id && (
                <ShopEditor
                  key={`${shop.id}-${shop.stock.length}`}
                  shop={shop}
                  onDone={(text) => {
                    setMessage(text);
                    reload();
                  }}
                />
              )}
              {shop.stock.length === 0 ? (
                <p className="text-sm italic">Nothing for sale.</p>
              ) : (
                <div className="space-y-1">
                  {shop.stock.map((entry) => {
                    const key = `${shop.id}:${entry.name}`;
                    const qty = Math.max(1, quantities[key] || 1);
                    const soldOut = entry.qty !== null && entry.qty <= 0;
                    const price = priceFor(shop, entry);
                    const trend = marketNote(marketFactor(shop.market, entry.name, campaignDay));
                    const affordable = Boolean(paymentPlan(purse, price * qty));
                    return (
                      <div key={entry.name} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg bg-[#f7e7c5] px-2 py-1 text-sm">
                        <span>
                          <strong>{entry.name}</strong>
                          <span className="block text-xs">
                            {formatCp(price)} each{price !== entry.priceCp ? <span className="line-through opacity-60"> {formatCp(entry.priceCp)}</span> : null}
                            {trend ? ` · ${trend}` : ""} · {entry.qty === null ? "plenty in stock" : soldOut ? "sold out" : `${entry.qty} in stock`}
                          </span>
                        </span>
                        <input
                          type="number"
                          min={1}
                          className={`${fieldClass} w-16`}
                          value={qty}
                          onChange={(event) => setQuantities({ ...quantities, [key]: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                          aria-label={`How many ${entry.name}`}
                        />
                        <span className="text-xs w-20 text-right">{formatCp(price * qty)}</span>
                        <Button
                          size="sm"
                          className={darkButton}
                          disabled={busy || soldOut || !activeBuyer || !affordable || (!adminUnlocked && !shop.is_open)}
                          onClick={() => buy(shop, entry)}
                          aria-label={`Buy ${entry.name}`}
                        >
                          Buy
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>

      {(openShops.length > 0 || adminUnlocked) && activeBuyer && (
        <Panel>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">Sell</h3>
            <p className="text-sm">
              Shops pay half of what something is worth, less if they&apos;ve been flooded with it lately, more if they belong to a faction
              that likes you. The coins go to {nameOf(activeBuyer)}.
            </p>
            {(adminUnlocked ? shops : openShops).length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                Sell to
                <select className={fieldClass} value={sellShop?.id || ""} onChange={(event) => setSellShopId(event.target.value)} aria-label="Shop to sell to">
                  {(adminUnlocked ? shops : openShops).map((shop) => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="space-y-2">
              <strong>Party materials</strong>
              {poolForSale.length === 0 ? (
                <p className="text-sm italic">The party has no materials.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select className={fieldClass} value={sellMaterial} onChange={(event) => setSellMaterial(event.target.value)} aria-label="Material to sell">
                    <option value="">Choose a material...</option>
                    {poolForSale.map((material) => (
                      <option key={material.name} value={material.name}>
                        {material.name} (×{material.qty}) · {formatCp(salePrice(sellShop, material.name, Math.floor(materialValueCp(material.name) * SELL_RATE)))} each
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className={`${fieldClass} w-20`}
                    value={sellMaterialQty}
                    onChange={(event) => setSellMaterialQty(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                    aria-label="How many to sell"
                  />
                  <Button size="sm" className={blueButton} disabled={busy || !sellMaterial} onClick={sellMaterials}>
                    Sell
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <strong>{activeBuyer === PARTY_FUND ? "Party stash" : `${nameOf(activeBuyer)}'s items`}</strong>
              {buyerItems.length === 0 ? (
                <p className="text-sm italic">Nothing to sell.</p>
              ) : (
                buyerItems.map((row) => {
                  const uses = remainingUses(row);
                  return (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f7e7c5] px-2 py-1 text-sm">
                      <span>
                        <strong>{row.name}</strong>
                        {row.qty > 1 && ` ×${row.qty}`}
                        {row.quality && row.quality !== "Normal" ? ` · ${row.quality}` : ""}
                        {uses !== null ? ` · ${uses} uses left` : ""}
                        {row.metadata?.upgrades?.length ? ` · ${row.metadata.upgrades.length} upgrade${row.metadata.upgrades.length === 1 ? "" : "s"}` : ""}
                      </span>
                      <Button size="sm" className={blueButton} disabled={busy} onClick={() => sellItem(row)} aria-label={`Sell ${row.name}`}>
                        Sell 1 for {formatCp(salePrice(sellShop, row.name, itemSaleCp(row)))}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
