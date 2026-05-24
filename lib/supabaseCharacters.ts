import { supabase } from "./supabaseClient";

export type SupabaseCharacter = {
  id: string;
  campaign_id: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  tool_progress: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CharacterPayload = {
  id?: string;
  name: string;
  isAdmin?: boolean;
  isActive?: boolean;
  data: Record<string, unknown>;
};

export async function fetchCampaignCharacters(
  campaignId: string
): Promise<SupabaseCharacter[]> {
  const { data, error } = await supabase
    .from("campaign_characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function insertCampaignCharacter(input: {
  campaignId: string;
  name: string;
  data: Record<string, unknown>;
  isAdmin?: boolean;
  isActive?: boolean;
}): Promise<SupabaseCharacter> {
  const { data, error } = await supabase
    .from("campaign_characters")
    .insert({
      campaign_id: input.campaignId,
      name: input.name,
      is_admin: input.isAdmin ?? false,
      is_active: input.isActive ?? true,
      tool_progress: input.data,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function upsertCampaignCharacter(input: {
  id?: string;
  campaignId: string;
  name: string;
  data: Record<string, unknown>;
  isAdmin?: boolean;
  isActive?: boolean;
}): Promise<SupabaseCharacter> {
  if (!input.id) {
    return insertCampaignCharacter({
      campaignId: input.campaignId,
      name: input.name,
      data: input.data,
      isAdmin: input.isAdmin,
      isActive: input.isActive,
    });
  }

  const { data, error } = await supabase
    .from("campaign_characters")
    .upsert(
      {
        id: input.id,
        campaign_id: input.campaignId,
        name: input.name,
        is_admin: input.isAdmin ?? false,
        is_active: input.isActive ?? true,
        tool_progress: input.data,
      },
      {
        onConflict: "id",
      }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function replaceCampaignCharacters(
  campaignId: string,
  characters: CharacterPayload[]
): Promise<SupabaseCharacter[]> {
  const { error: deleteError } = await supabase
    .from("campaign_characters")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) throw deleteError;

  if (characters.length === 0) return [];

  const { data, error: insertError } = await supabase
    .from("campaign_characters")
    .insert(
      characters.map((character) => ({
        campaign_id: campaignId,
        name: character.name,
        is_admin: character.isAdmin ?? false,
        is_active: character.isActive ?? true,
        tool_progress: character.data,
      }))
    )
    .select("*");

  if (insertError) throw insertError;
  return data || [];
}

export async function deleteCampaignCharacter(id: string): Promise<void> {
  const { error } = await supabase.from("campaign_characters").delete().eq("id", id);
  if (error) throw error;
}
