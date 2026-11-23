import { supabase } from "./supabaseClient";
import type { Coins } from "@/data/coins";
import type { StockEntry } from "@/data/shops";

// Shops live in campaign_shops. Players only see shops the GM has opened.

export type ShopRow = {
  id: string;
  campaign_id: string;
  name: string;
  kind: string;
  description: string | null;
  is_open: boolean;
  stock: StockEntry[];
  sort: number;
  created_at: string;
};

export async function fetchShops(campaignId: string): Promise<ShopRow[]> {
  const { data, error } = await supabase
    .from("campaign_shops")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as ShopRow[] | null) || []).map((row) => ({ ...row, stock: Array.isArray(row.stock) ? row.stock : [] }));
}

export async function createShop(input: { campaignId: string; name: string; kind: string; description: string; stock: StockEntry[] }) {
  const { error } = await supabase.from("campaign_shops").insert({
    campaign_id: input.campaignId,
    name: input.name,
    kind: input.kind,
    description: input.description,
    stock: input.stock,
    is_open: false,
  });
  if (error) throw error;
}

export async function updateShop(id: string, changes: Partial<Pick<ShopRow, "name" | "description" | "is_open" | "stock">>) {
  const { error } = await supabase.from("campaign_shops").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteShop(id: string) {
  const { error } = await supabase.from("campaign_shops").delete().eq("id", id);
  if (error) throw error;
}

// Takes limited stock and pays from the buyer's purse in one database step.
// `payment` is the coin change from paymentPlan (negative = spent).
export async function shopPurchase(input: {
  shopId: string;
  item: string;
  qty: number;
  holder: string;
  payment: Coins;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("shop_purchase", {
    p_shop: input.shopId,
    p_item: input.item,
    p_qty: input.qty,
    p_holder: input.holder,
    p_cp: input.payment.cp,
    p_sp: input.payment.sp,
    p_ep: input.payment.ep,
    p_gp: input.payment.gp,
    p_pp: input.payment.pp,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message || "The purchase was refused.");
}
