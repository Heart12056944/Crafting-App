import { supabase } from "./supabaseClient";

// The bounty board (campaign_bounties). Bounties are hunts; commissions are
// items to craft. Rewards are paid by the complete_bounty database function so
// a bounty can never be paid twice.

export type BountyKind = "bounty" | "commission";
export type BountyStatus = "open" | "claimed" | "done" | "cancelled";

export type HuntTarget = { creature: string; label: string; count: number };

export type BountyTarget = {
  // Bounties: any number of creature types. (Older bounties use creature/label/count.)
  creatures?: HuntTarget[];
  creature?: string;
  label?: string;
  count?: number;
  proof?: { name: string; qty: number }[];
  // Commissions
  recipeId?: string;
  recipeName?: string;
  qty?: number;
  minQuality?: "Flawed" | "Normal" | "Superior";
};

export type BountyRow = {
  id: string;
  campaign_id: string;
  kind: BountyKind;
  title: string;
  giver: string | null;
  description: string | null;
  target: BountyTarget;
  reward_cp: number;
  status: BountyStatus;
  claimed_by: string | null;
  paid_to: string | null;
  completed_at: string | null;
  faction_id?: string | null;
  rep_reward?: number;
  created_at: string;
};

// The creatures a bounty asks for, old single-creature bounties included.
export function huntTargets(target: BountyTarget): HuntTarget[] {
  if (target.creatures?.length) return target.creatures;
  return target.creature ? [{ creature: target.creature, label: target.label || target.creature, count: target.count || 1 }] : [];
}

export async function fetchBounties(campaignId: string): Promise<BountyRow[]> {
  const { data, error } = await supabase
    .from("campaign_bounties")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as BountyRow[] | null) || []).map((row) => ({ ...row, target: row.target || {} }));
}

export async function postBounty(input: {
  campaignId: string;
  kind: BountyKind;
  title: string;
  giver: string;
  description: string;
  target: BountyTarget;
  rewardCp: number;
  factionId?: string | null;
  repReward?: number;
}): Promise<void> {
  const { error } = await supabase.from("campaign_bounties").insert({
    ...(input.factionId ? { faction_id: input.factionId, rep_reward: Math.round(input.repReward || 0) } : {}),
    campaign_id: input.campaignId,
    kind: input.kind,
    title: input.title,
    giver: input.giver || null,
    description: input.description || null,
    target: input.target,
    reward_cp: Math.max(0, Math.round(input.rewardCp)),
  });
  if (error) throw error;
}

export async function updateBounty(id: string, changes: Partial<Pick<BountyRow, "status" | "claimed_by" | "reward_cp" | "title" | "description" | "giver">>) {
  const { error } = await supabase.from("campaign_bounties").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteBounty(id: string) {
  const { error } = await supabase.from("campaign_bounties").delete().eq("id", id);
  if (error) throw error;
}

// Marks it done and pays reward (+ bonus) to holder: a character id or "party".
export async function completeBounty(id: string, holder: string, characterId: string | null, bonusCp = 0) {
  const { error } = await supabase.rpc("complete_bounty", {
    p_bounty: id,
    p_holder: holder,
    p_character: characterId,
    p_bonus_cp: Math.max(0, Math.round(bonusCp)),
  });
  if (error) throw new Error(error.message || "Could not finish that bounty.");
}
