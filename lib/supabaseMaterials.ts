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
// Applies changes as deltas to whatever is in the database now, so two people
// changing materials at once (a player gathering while the GM loots) both
// count instead of the last save overwriting the other. Returns the fresh list.
export async function applyCampaignMaterialDeltas(
  campaignId: string,
  deltas: { name: string; delta: number; tier?: number | null }[]
): Promise<SupabaseMaterial[]> {
  const changes = deltas.filter((item) => item.delta !== 0);
  if (changes.length) {
    const { data: current, error } = await supabase
      .from("campaign_materials")
      .select("*")
      .eq("campaign_id", campaignId)
      .in("name", changes.map((item) => item.name));
    if (error) throw error;
    const byName = new Map(((current as SupabaseMaterial[] | null) || []).map((row) => [row.name, row]));
    const upserts: { campaign_id: string; name: string; qty: number; tier: number | null }[] = [];
    const removals: string[] = [];
    for (const item of changes) {
      const row = byName.get(item.name);
      const qty = Math.max(0, (row?.qty || 0) + item.delta);
      if (qty > 0) upserts.push({ campaign_id: campaignId, name: item.name, qty, tier: row?.tier ?? item.tier ?? null });
      else if (row) removals.push(item.name);
    }
    if (upserts.length) {
      const { error: upsertError } = await supabase.from("campaign_materials").upsert(upserts, { onConflict: "campaign_id,name" });
      if (upsertError) throw upsertError;
    }
    if (removals.length) {
      const { error: deleteError } = await supabase.from("campaign_materials").delete().eq("campaign_id", campaignId).in("name", removals);
      if (deleteError) throw deleteError;
    }
  }
  return fetchCampaignMaterials(campaignId);
}
