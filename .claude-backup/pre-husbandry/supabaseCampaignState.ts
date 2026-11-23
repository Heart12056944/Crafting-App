import { supabase } from "./supabaseClient";

// Shared, per-campaign visibility state.
// Rows are keyed by text (recipe id, material name, tag), so adding new recipes,
// materials or tags in the app never needs a database change.

export type DiscoveryKind = "recipe" | "material" | "gathering-spot";
export type DiscoveryState = "discovered" | "hidden";

export type CampaignDiscoveryRow = {
  campaign_id: string;
  kind: string;
  item_key: string;
  state: string;
};

export type DiscoveryEntry = {
  kind: DiscoveryKind;
  key: string;
  state: DiscoveryState;
};

export async function fetchCampaignDiscoveries(campaignId: string): Promise<CampaignDiscoveryRow[]> {
  const { data, error } = await supabase
    .from("campaign_discoveries")
    .select("campaign_id, kind, item_key, state")
    .eq("campaign_id", campaignId);

  if (error) {
    throw error;
  }

  return (data as CampaignDiscoveryRow[] | null) || [];
}

// state = null removes the row, which means "back to the default rules".
export async function setCampaignDiscovery(
  campaignId: string,
  kind: DiscoveryKind,
  key: string,
  state: DiscoveryState | null
): Promise<void> {
  if (state === null) {
    const { error } = await supabase
      .from("campaign_discoveries")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("item_key", key);

    if (error) {
      throw error;
    }
    return;
  }

  await upsertCampaignDiscoveries(campaignId, [{ kind, key, state }]);
}

export async function upsertCampaignDiscoveries(campaignId: string, entries: DiscoveryEntry[]): Promise<void> {
  if (entries.length === 0) return;

  // Last write wins if the same key appears twice in one batch.
  const unique = new Map<string, DiscoveryEntry>();
  entries.forEach((entry) => unique.set(`${entry.kind}::${entry.key}`, entry));

  const { error } = await supabase.from("campaign_discoveries").upsert(
    [...unique.values()].map((entry) => ({
      campaign_id: campaignId,
      kind: entry.kind,
      item_key: entry.key,
      state: entry.state,
    })),
    { onConflict: "campaign_id,kind,item_key" }
  );

  if (error) {
    throw error;
  }
}

// Character claims reuse the discoveries table: kind "character-claim",
// item_key = character id, state = the claiming device's id. null releases it.
export async function setCharacterClaim(campaignId: string, characterId: string, deviceId: string | null): Promise<void> {
  if (deviceId === null) {
    const { error } = await supabase
      .from("campaign_discoveries")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("kind", "character-claim")
      .eq("item_key", characterId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("campaign_discoveries").upsert(
    { campaign_id: campaignId, kind: "character-claim", item_key: characterId, state: deviceId },
    { onConflict: "campaign_id,kind,item_key" }
  );
  if (error) throw error;
}

export async function clearCampaignDiscoveries(campaignId: string): Promise<void> {
  // Wipes discovered/hidden recipes and materials only; claims and open gathering spots stay.
  const { error } = await supabase
    .from("campaign_discoveries")
    .delete()
    .eq("campaign_id", campaignId)
    .in("kind", ["recipe", "material"]);

  if (error) {
    throw error;
  }
}

export async function fetchCampaignDisabledTags(campaignId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("campaign_disabled_tags")
    .select("tag")
    .eq("campaign_id", campaignId);

  if (error) {
    throw error;
  }

  return ((data as { tag: string }[] | null) || []).map((row) => row.tag);
}

export async function setCampaignTagDisabled(campaignId: string, tag: string, disabled: boolean): Promise<void> {
  if (disabled) {
    const { error } = await supabase
      .from("campaign_disabled_tags")
      .upsert({ campaign_id: campaignId, tag }, { onConflict: "campaign_id,tag", ignoreDuplicates: true });

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .from("campaign_disabled_tags")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("tag", tag);

  if (error) {
    throw error;
  }
}

export async function replaceCampaignDisabledTags(campaignId: string, tags: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("campaign_disabled_tags")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) {
    throw deleteError;
  }

  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length === 0) return;

  const { error } = await supabase
    .from("campaign_disabled_tags")
    .insert(uniqueTags.map((tag) => ({ campaign_id: campaignId, tag })));

  if (error) {
    throw error;
  }
}
