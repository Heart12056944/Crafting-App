import { supabase } from "./supabaseClient";

export type SupabaseCampaign = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function fetchCampaigns(): Promise<SupabaseCampaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createCampaign(name: string): Promise<SupabaseCampaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function renameCampaign(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .update({ name })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);

  if (error) {
    throw error;
  }
}