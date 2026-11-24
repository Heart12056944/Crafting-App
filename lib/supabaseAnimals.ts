import { supabase } from "./supabaseClient";
import type { AnimalSex } from "@/data/husbandry";

// The party's animals (campaign_animals). last_collected maps a product id to
// the campaign day it was last collected.

export type AnimalRow = {
  id: string;
  campaign_id: string;
  species: string;
  name: string;
  sex: AnimalSex;
  character_id: string | null;
  tamed_by: string | null;
  last_collected: Record<string, number>;
  notes: string | null;
  // Mounts: riding state (missing on databases without the column yet).
  mount_state?: MountState;
  created_at: string;
};

export type MountState = {
  // HP after damage, on campaign day hpDay. A night's rest (a later day) restores full HP.
  hp?: number;
  hpDay?: number;
  rider?: string | null;
  mode?: "controlled" | "independent";
  saddle?: "none" | "riding" | "military";
};

export async function fetchCampaignAnimals(campaignId: string): Promise<AnimalRow[]> {
  const { data, error } = await supabase
    .from("campaign_animals")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as AnimalRow[] | null) || []).map((row) => ({ ...row, last_collected: row.last_collected || {}, mount_state: row.mount_state || {} }));
}

export async function addAnimal(input: {
  campaignId: string;
  species: string;
  name: string;
  sex: AnimalSex;
  characterId: string | null;
  tamedBy: string;
  // Products start counting from this day, so nothing is ready the day it arrives.
  today: number;
  productIds: string[];
}): Promise<void> {
  const { error } = await supabase.from("campaign_animals").insert({
    campaign_id: input.campaignId,
    species: input.species,
    name: input.name,
    sex: input.sex,
    character_id: input.characterId,
    tamed_by: input.tamedBy,
    last_collected: Object.fromEntries(input.productIds.map((id) => [id, input.today])),
  });
  if (error) throw error;
}

export async function updateAnimal(
  id: string,
  changes: Partial<Pick<AnimalRow, "name" | "sex" | "character_id" | "notes" | "last_collected" | "mount_state">>
): Promise<void> {
  const { error } = await supabase.from("campaign_animals").update(changes).eq("id", id);
  if (error) throw error;
}

export async function releaseAnimal(id: string): Promise<void> {
  const { error } = await supabase.from("campaign_animals").delete().eq("id", id);
  if (error) throw error;
}
