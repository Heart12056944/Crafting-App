import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Factions and the party's standing with each (campaign_factions).

export type FactionRow = {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  reputation: number;
  // Hidden from players until the party makes contact.
  hidden?: boolean;
  created_at: string;
};

export const REPUTATION_TIERS: { min: number; label: string; discount: number; note: string }[] = [
  { min: 75, label: "Exalted", discount: 0.15, note: "15% off at their shops; their best jobs and stock are open to you." },
  { min: 40, label: "Honoured", discount: 0.1, note: "10% off at their shops; trusted with important work." },
  { min: 15, label: "Friendly", discount: 0.05, note: "5% off at their shops." },
  { min: -14, label: "Neutral", discount: 0, note: "No special treatment." },
  { min: -49, label: "Unfriendly", discount: -0.1, note: "Their shops charge 10% more." },
  { min: -100, label: "Hostile", discount: -1, note: "Their shops won't trade with you." },
];

export function reputationTier(reputation: number) {
  return REPUTATION_TIERS.find((tier) => reputation >= tier.min) || REPUTATION_TIERS[REPUTATION_TIERS.length - 1];
}

export async function fetchFactions(campaignId: string): Promise<FactionRow[]> {
  const { data, error } = await supabase.from("campaign_factions").select("*").eq("campaign_id", campaignId).order("created_at");
  if (error) throw error;
  return (data as FactionRow[] | null) || [];
}

export async function createFaction(campaignId: string, name: string, description: string, hidden = false) {
  const { error } = await supabase
    .from("campaign_factions")
    .insert({ campaign_id: campaignId, name, description: description || null, ...(hidden ? { hidden: true } : {}) });
  if (error) throw error;
}

export async function updateFaction(id: string, changes: Partial<Pick<FactionRow, "name" | "description" | "reputation" | "hidden">>) {
  const next = { ...changes };
  if (next.reputation !== undefined) next.reputation = Math.max(-100, Math.min(100, Math.round(next.reputation)));
  const { error } = await supabase.from("campaign_factions").update(next).eq("id", id);
  if (error) throw error;
}

export async function deleteFaction(id: string) {
  const { error } = await supabase.from("campaign_factions").delete().eq("id", id);
  if (error) throw error;
}

let factionChannelCount = 0;

// Live list of the campaign's factions. missing = the table isn't set up yet.
export function useCampaignFactions(campaignId: string) {
  const [factions, setFactions] = useState<FactionRow[]>([]);
  const [missing, setMissing] = useState(false);
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      try {
        setFactions(await fetchFactions(campaignId));
        setMissing(false);
      } catch {
        setMissing(true);
      }
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reloadRef.current();
    const channel = supabase
      .channel(`campaign-factions-${campaignId}-${++factionChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_factions", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return { factions, missing, reload: () => reloadRef.current() };
}
