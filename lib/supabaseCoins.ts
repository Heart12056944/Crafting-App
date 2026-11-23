import { supabase } from "./supabaseClient";
import { COIN_KEYS, emptyCoins, type Coins } from "@/data/coins";

// Purses live in campaign_purses: holder = a character id, or PARTY_FUND.
// Every change goes through the change_purse database function, which locks
// the purse and refuses to let any coin go below zero.

export const PARTY_FUND = "party";

export type PurseRow = Coins & {
  id: string;
  campaign_id: string;
  holder: string;
  updated_at: string;
};

export type CoinLogRow = Coins & {
  id: string;
  campaign_id: string;
  holder: string;
  reason: string | null;
  created_at: string;
};

export function purseCoins(row: Partial<Coins> | undefined | null): Coins {
  const coins = emptyCoins();
  if (!row) return coins;
  for (const key of COIN_KEYS) coins[key] = Number(row[key] || 0);
  return coins;
}

function coinArgs(delta: Partial<Coins>) {
  return {
    p_cp: Math.trunc(delta.cp || 0),
    p_sp: Math.trunc(delta.sp || 0),
    p_ep: Math.trunc(delta.ep || 0),
    p_gp: Math.trunc(delta.gp || 0),
    p_pp: Math.trunc(delta.pp || 0),
  };
}

function friendly(error: { message?: string } | null) {
  return new Error(error?.message || "The coin change was refused.");
}

export async function fetchPurses(campaignId: string): Promise<PurseRow[]> {
  const { data, error } = await supabase.from("campaign_purses").select("*").eq("campaign_id", campaignId);
  if (error) throw error;
  return (data as PurseRow[] | null) || [];
}

export async function fetchCoinLog(campaignId: string, limit = 30): Promise<CoinLogRow[]> {
  const { data, error } = await supabase
    .from("campaign_coin_log")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CoinLogRow[] | null) || [];
}

// Add (positive) or remove (negative) coins from one purse.
export async function changePurse(campaignId: string, holder: string, delta: Partial<Coins>, reason: string): Promise<void> {
  const { error } = await supabase.rpc("change_purse", {
    p_campaign: campaignId,
    p_holder: holder,
    ...coinArgs(delta),
    p_reason: reason,
  });
  if (error) throw friendly(error);
}

// Hand coins from one purse to another (all positive amounts).
export async function moveCoins(campaignId: string, from: string, to: string, coins: Partial<Coins>, reason: string): Promise<void> {
  const { error } = await supabase.rpc("move_coins", {
    p_campaign: campaignId,
    p_from: from,
    p_to: to,
    ...coinArgs(coins),
    p_reason: reason,
  });
  if (error) throw friendly(error);
}
