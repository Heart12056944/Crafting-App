import { supabase } from "./supabaseClient";

export type SupabaseLootLog = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  creature_queue_id: string | null;
  creature_table_id: string | null;
  creature_label: string | null;
  creature_tier: string | null;
  loot_quality: string | null;
  loot_name: string;
  qty: number;
  kind: string;
  roll_text: string | null;
  natural_roll: number | null;
  total_roll: number | null;
  dc: number | null;
  created_at: string;
};

export type NewLootLogEntry = {
  campaignId: string;
  characterId?: string | null;
  creatureQueueId?: string | null;
  creatureTableId?: string | null;
  creatureLabel?: string | null;
  creatureTier?: string | null;
  lootQuality?: string | null;
  lootName: string;
  qty: number;
  kind: string;
  rollText?: string | null;
  naturalRoll?: number | null;
  totalRoll?: number | null;
  dc?: number | null;
};

export async function fetchCampaignLootLog(campaignId: string): Promise<SupabaseLootLog[]> {
  const { data, error } = await supabase
    .from("campaign_loot_log")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function insertCampaignLootLog(input: NewLootLogEntry): Promise<SupabaseLootLog> {
  const { data, error } = await supabase
    .from("campaign_loot_log")
    .insert({
      campaign_id: input.campaignId,
      character_id: input.characterId ?? null,
      creature_queue_id: input.creatureQueueId ?? null,
      creature_table_id: input.creatureTableId ?? null,
      creature_label: input.creatureLabel ?? null,
      creature_tier: input.creatureTier ?? null,
      loot_quality: input.lootQuality ?? null,
      loot_name: input.lootName,
      qty: Math.max(0, Math.floor(input.qty || 0)),
      kind: input.kind,
      roll_text: input.rollText ?? null,
      natural_roll: input.naturalRoll ?? null,
      total_roll: input.totalRoll ?? null,
      dc: input.dc ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
