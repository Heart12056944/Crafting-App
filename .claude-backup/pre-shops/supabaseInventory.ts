import { supabase } from "./supabaseClient";

// Who holds which finished item. Rows live in campaign_inventory_items:
// character_id null = the party stash. Each row is a stack of `qty` identical
// items; for consumables, metadata tracks uses per item and uses left on the
// opened one, so remaining uses = (qty - 1) * usesPerItem + usesLeft.

export type InventoryMetadata = {
  consumable?: boolean;
  usesPerItem?: number;
  usesLeft?: number;
  recipeId?: string | null;
  crafter?: string | null;
};

export type InventoryRow = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  name: string;
  qty: number;
  kind: string;
  rarity: string | null;
  quality: string | null;
  source: string | null;
  description: string | null;
  effect: string[] | null;
  stat_block: string | null;
  metadata: InventoryMetadata;
  created_at: string;
  updated_at: string;
};

export type NewInventoryItem = {
  campaignId: string;
  characterId: string | null;
  name: string;
  qty?: number;
  kind?: string;
  rarity?: string | null;
  quality?: string | null;
  source?: string | null;
  description?: string | null;
  effect?: string[];
  statBlock?: string | null;
  metadata?: InventoryMetadata;
};

export function remainingUses(row: Pick<InventoryRow, "qty" | "metadata">) {
  const meta = row.metadata || {};
  if (!meta.consumable) return null;
  const perItem = Math.max(1, meta.usesPerItem ?? 1);
  const left = Math.min(perItem, Math.max(0, meta.usesLeft ?? perItem));
  return Math.max(0, (row.qty - 1) * perItem + left);
}

export async function fetchCampaignInventory(campaignId: string): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from("campaign_inventory_items")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data as InventoryRow[] | null) || []).map((row) => ({ ...row, metadata: row.metadata || {} }));
}

// Same holder, name, quality and uses-per-item, with no half-used item: stackable.
function stackMatch(row: InventoryRow, item: NewInventoryItem) {
  const meta = row.metadata || {};
  const incoming = item.metadata || {};
  const perItem = meta.usesPerItem ?? 0;
  return (
    row.character_id === item.characterId &&
    row.name === item.name &&
    (row.quality ?? null) === (item.quality ?? null) &&
    Boolean(meta.consumable) === Boolean(incoming.consumable) &&
    perItem === (incoming.usesPerItem ?? 0) &&
    (!meta.consumable || (meta.usesLeft ?? perItem) === perItem)
  );
}

export async function addInventoryItem(item: NewInventoryItem): Promise<void> {
  const qty = Math.max(1, item.qty ?? 1);
  const { data: existing, error: findError } = await supabase
    .from("campaign_inventory_items")
    .select("*")
    .eq("campaign_id", item.campaignId)
    .eq("name", item.name);
  if (findError) throw findError;

  const match = ((existing as InventoryRow[] | null) || []).find((row) => stackMatch({ ...row, metadata: row.metadata || {} }, item));
  if (match) {
    const { error } = await supabase
      .from("campaign_inventory_items")
      .update({ qty: match.qty + qty })
      .eq("id", match.id);
    if (error) throw error;
    return;
  }

  const metadata: InventoryMetadata = { ...(item.metadata || {}) };
  if (metadata.consumable) {
    metadata.usesPerItem = Math.max(1, metadata.usesPerItem ?? 1);
    metadata.usesLeft = metadata.usesPerItem;
  }

  const { error } = await supabase.from("campaign_inventory_items").insert({
    campaign_id: item.campaignId,
    character_id: item.characterId,
    name: item.name,
    qty,
    kind: item.kind || "item",
    rarity: item.rarity ?? null,
    quality: item.quality ?? null,
    source: item.source ?? null,
    description: item.description ?? null,
    effect: item.effect ?? [],
    stat_block: item.statBlock ?? null,
    metadata,
  });
  if (error) throw error;
}

// Spend one use. Returns the remaining uses (0 means the stack is gone).
export async function spendInventoryUse(row: InventoryRow): Promise<number> {
  const meta = row.metadata || {};
  if (!meta.consumable) return remainingUses(row) ?? 0;

  const perItem = Math.max(1, meta.usesPerItem ?? 1);
  let qty = row.qty;
  let usesLeft = Math.min(perItem, Math.max(0, meta.usesLeft ?? perItem)) - 1;
  if (usesLeft <= 0) {
    qty -= 1;
    usesLeft = perItem;
  }

  if (qty <= 0) {
    await deleteInventoryItem(row.id);
    return 0;
  }

  const { error } = await supabase
    .from("campaign_inventory_items")
    .update({ qty, metadata: { ...meta, usesLeft } })
    .eq("id", row.id);
  if (error) throw error;
  return remainingUses({ qty, metadata: { ...meta, usesLeft } }) ?? 0;
}

// Move `count` items (default: the whole stack) to a character or the stash (null).
// A half-used consumable stays with the giver unless the whole stack moves.
export async function moveInventoryItem(row: InventoryRow, toCharacterId: string | null, count?: number): Promise<void> {
  if (row.character_id === toCharacterId) return;
  const meta = row.metadata || {};
  const perItem = meta.usesPerItem ?? 0;
  const opened = Boolean(meta.consumable) && (meta.usesLeft ?? perItem) < perItem;
  const movable = opened ? row.qty - 1 : row.qty;
  const moving = Math.min(count ?? row.qty, row.qty);

  if (moving >= row.qty) {
    const { error } = await supabase
      .from("campaign_inventory_items")
      .update({ character_id: toCharacterId })
      .eq("id", row.id);
    if (error) throw error;
    return;
  }

  const amount = Math.min(moving, movable);
  if (amount <= 0) return;

  const { error } = await supabase
    .from("campaign_inventory_items")
    .update({ qty: row.qty - amount })
    .eq("id", row.id);
  if (error) throw error;

  await addInventoryItem({
    campaignId: row.campaign_id,
    characterId: toCharacterId,
    name: row.name,
    qty: amount,
    kind: row.kind,
    rarity: row.rarity,
    quality: row.quality,
    source: row.source,
    description: row.description,
    effect: row.effect || [],
    statBlock: row.stat_block,
    metadata: { ...meta, usesLeft: meta.usesPerItem },
  });
}

export async function updateInventoryItem(
  id: string,
  changes: Partial<Pick<InventoryRow, "qty" | "metadata" | "name" | "description">>
): Promise<void> {
  const { error } = await supabase.from("campaign_inventory_items").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from("campaign_inventory_items").delete().eq("id", id);
  if (error) throw error;
}
