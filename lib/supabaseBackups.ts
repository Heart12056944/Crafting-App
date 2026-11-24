import { supabase } from "./supabaseClient";

// Campaign backups (campaign_backups). Taking and restoring a backup are done by
// database functions so they happen all at once.

export type BackupRow = { id: string; campaign_id: string; label: string; kind: "manual" | "auto"; created_at: string };

export async function fetchBackups(campaignId: string): Promise<BackupRow[]> {
  const { data, error } = await supabase
    .from("campaign_backups")
    .select("id, campaign_id, label, kind, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data as BackupRow[] | null) || [];
}

export async function createBackup(campaignId: string, label: string, kind: "manual" | "auto" = "manual") {
  const { error } = await supabase.rpc("create_campaign_backup", { p_campaign: campaignId, p_label: label, p_kind: kind });
  if (error) throw new Error(error.message || "Could not take a backup.");
}

// Before something big happens. Never throws: a failed backup shouldn't block play.
export async function autoBackup(campaignId: string, label: string) {
  try {
    await createBackup(campaignId, label, "auto");
  } catch (error) {
    console.warn("Automatic backup failed.", error);
  }
}

export async function restoreBackup(backupId: string) {
  const { error } = await supabase.rpc("restore_campaign_backup", { p_backup: backupId });
  if (error) throw new Error(error.message || "Could not restore that backup.");
}

export async function deleteBackup(backupId: string) {
  const { error } = await supabase.from("campaign_backups").delete().eq("id", backupId);
  if (error) throw error;
}
