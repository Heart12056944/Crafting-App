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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Saves the campaign's whole character list. Characters keep their ids (so their
// inventory, animals, claims and cards stay attached); characters no longer in
// the list are deleted. Pass keepIds: false to copy characters into another
// campaign as new characters.
export async function replaceCampaignCharacters(
  campaignId: string,
  characters: CharacterPayload[],
  options: { keepIds?: boolean } = {}
): Promise<SupabaseCharacter[]> {
  const keepIds = options.keepIds ?? true;
  const toRow = (character: CharacterPayload, withId: boolean) => ({
    ...(withId ? { id: character.id } : {}),
    campaign_id: campaignId,
    name: character.name,
    is_admin: character.isAdmin ?? false,
    is_active: character.isActive ?? true,
    tool_progress: character.data,
  });

  if (!keepIds) {
    const { error: deleteError } = await supabase.from("campaign_characters").delete().eq("campaign_id", campaignId);
    if (deleteError) throw deleteError;
    if (characters.length === 0) return [];
    const { data, error: insertError } = await supabase
      .from("campaign_characters")
      .insert(characters.map((character) => toRow(character, false)))
      .select("*");
    if (insertError) throw insertError;
    return data || [];
  }

  const withIds = characters.filter((character) => character.id && UUID.test(character.id));
  const withoutIds = characters.filter((character) => !character.id || !UUID.test(character.id));
  const saved: SupabaseCharacter[] = [];

  if (withIds.length) {
    const { data, error } = await supabase
      .from("campaign_characters")
      .upsert(withIds.map((character) => toRow(character, true)), { onConflict: "id" })
      .select("*");
    if (error) throw error;
    saved.push(...((data as SupabaseCharacter[] | null) || []));
  }
  if (withoutIds.length) {
    const { data, error } = await supabase
      .from("campaign_characters")
      .insert(withoutIds.map((character) => toRow(character, false)))
      .select("*");
    if (error) throw error;
    saved.push(...((data as SupabaseCharacter[] | null) || []));
  }

  // Remove characters that were deleted in the app.
  const keep = new Set(saved.map((row) => row.id));
  const { data: existing, error: listError } = await supabase.from("campaign_characters").select("id").eq("campaign_id", campaignId);
  if (listError) throw listError;
  const gone = ((existing as { id: string }[] | null) || []).map((row) => row.id).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error: deleteError } = await supabase.from("campaign_characters").delete().in("id", gone);
    if (deleteError) throw deleteError;
  }
  return saved;
}

export async function deleteCampaignCharacter(id: string): Promise<void> {
  const { error } = await supabase.from("campaign_characters").delete().eq("id", id);
  if (error) throw error;
}
