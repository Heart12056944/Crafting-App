import { supabase } from "./supabaseClient";

export type SupabaseMaterial = {
  id: string;
  campaign_id: string;
  name: string;
  qty: number;
  tier: number | null;
  created_at: string;
  updated_at: string;
};

export async function fetchCampaignMaterials(
  campaignId: string
): Promise<SupabaseMaterial[]> {
  const { data, error } = await supabase
    .from("campaign_materials")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function upsertCampaignMaterial(input: {
  campaignId: string;
  name: string;
  qty: number;
  tier?: number;
}): Promise<SupabaseMaterial> {
  const { data, error } = await supabase
    .from("campaign_materials")
    .upsert(
      {
        campaign_id: input.campaignId,
        name: input.name,
        qty: input.qty,
        tier: input.tier ?? null,
      },
      {
        onConflict: "campaign_id,name",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function replaceCampaignMaterials(
  campaignId: string,
  materials: { name: string; qty: number; tier?: number }[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("campaign_materials")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) {
    throw deleteError;
  }

  if (materials.length === 0) return;

  const { error: insertError } = await supabase.from("campaign_materials").insert(
    materials.map((material) => ({
      campaign_id: campaignId,
      name: material.name,
      qty: material.qty,
      tier: material.tier ?? null,
    }))
  );

  if (insertError) {
    throw insertError;
  }
}

export async function deleteCampaignMaterial(
  campaignId: string,
  name: string
): Promise<void> {
  const { error } = await supabase
    .from("campaign_materials")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("name", name);

  if (error) {
    throw error;
  }
}