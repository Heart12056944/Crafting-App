import { supabase } from "./supabaseClient";

export type SupabaseLootCreature = {
  id: string;
  campaign_id: string;
  creature_table_id: string;
  creature_label: string;
  creature_tier: string;
  qty: number;
  remaining: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NewLootCreature = {
  campaignId: string;
  creatureTableId: string;
  creatureLabel: string;
  creatureTier: string;
  qty: number;
};

export async function fetchCampaignLootCreatures(campaignId: string): Promise<SupabaseLootCreature[]> {
  const { data, error } = await supabase
    .from("campaign_loot_creatures")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .gt("remaining", 0)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertCampaignLootCreature(input: NewLootCreature): Promise<SupabaseLootCreature> {
  const qty = Math.max(1, Math.floor(input.qty || 1));

  const { data, error } = await supabase
    .from("campaign_loot_creatures")
    .insert({
      campaign_id: input.campaignId,
      creature_table_id: input.creatureTableId,
      creature_label: input.creatureLabel,
      creature_tier: input.creatureTier,
      qty,
      remaining: qty,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaignLootCreature(id: string): Promise<void> {
  const { error } = await supabase
    .from("campaign_loot_creatures")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function decrementCampaignLootCreature(id: string, currentRemaining: number): Promise<void> {
  const nextRemaining = Math.max(0, currentRemaining - 1);

  if (nextRemaining <= 0) {
    const { error } = await supabase
      .from("campaign_loot_creatures")
      .update({ remaining: 0, is_active: false })
      .eq("id", id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("campaign_loot_creatures")
    .update({ remaining: nextRemaining })
    .eq("id", id);

  if (error) throw error;
}
