import { supabase } from "./supabaseClient";

export type SupabaseCraftedItem = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  recipe_id: string | null;
  name: string;
  rarity: string | null;
  category: string | null;
  quality: string | null;
  description: string | null;
  effect: string[] | null;
  stat_block: string | null;
  phase_effect: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchCampaignCraftedItems(
  campaignId: string
): Promise<SupabaseCraftedItem[]> {
  const { data, error } = await supabase
    .from("crafted_items")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function insertCraftedItem(input: {
  campaignId: string;
  characterId?: string | null;
  recipeId?: string | null;
  name: string;
  rarity?: string;
  category?: string;
  quality?: string;
  description?: string;
  effect?: string[];
  statBlock?: string;
  phaseEffect?: Record<string, unknown> | null;
}): Promise<SupabaseCraftedItem> {
  const { data, error } = await supabase
    .from("crafted_items")
    .insert({
      campaign_id: input.campaignId,
      character_id: input.characterId ?? null,
      recipe_id: input.recipeId ?? null,
      name: input.name,
      rarity: input.rarity ?? null,
      category: input.category ?? null,
      quality: input.quality ?? null,
      description: input.description ?? null,
      effect: input.effect ?? [],
      stat_block: input.statBlock ?? null,
      phase_effect: input.phaseEffect ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCraftedItem(id: string): Promise<void> {
  const { error } = await supabase.from("crafted_items").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function replaceCampaignCraftedItems(
  campaignId: string,
  items: {
    name: string;
    rarity?: string;
    category?: string;
    quality?: string;
    description?: string;
    effect?: string[];
    statBlock?: string;
    phaseEffect?: Record<string, unknown> | null;
    recipeId?: string | null;
    characterId?: string | null;
  }[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("crafted_items")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) return;

  const { error: insertError } = await supabase.from("crafted_items").insert(
    items.map((item) => ({
      campaign_id: campaignId,
      character_id: item.characterId ?? null,
      recipe_id: item.recipeId ?? null,
      name: item.name,
      rarity: item.rarity ?? null,
      category: item.category ?? null,
      quality: item.quality ?? null,
      description: item.description ?? null,
      effect: item.effect ?? [],
      stat_block: item.statBlock ?? null,
      phase_effect: item.phaseEffect ?? null,
    }))
  );

  if (insertError) {
    throw insertError;
  }
}