import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// The party journal (campaign_journal): events the app logs as they happen,
// and rumours the GM posts.

export type JournalRow = {
  id: string;
  campaign_id: string;
  day: number;
  kind: "event" | "rumour";
  text: string;
  gm_only: boolean;
  status: "open" | "resolved";
  created_at: string;
};

export async function fetchJournal(campaignId: string, limit = 300): Promise<JournalRow[]> {
  const { data, error } = await supabase
    .from("campaign_journal")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as JournalRow[] | null) || [];
}

// Never throws: the journal is a log, and a failed entry shouldn't break the action that made it.
export async function addJournalEntry(input: { campaignId: string; day: number; text: string; kind?: "event" | "rumour"; gmOnly?: boolean }) {
  if (!input.campaignId || !input.text.trim()) return;
  const { error } = await supabase.from("campaign_journal").insert({
    campaign_id: input.campaignId,
    day: input.day,
    kind: input.kind || "event",
    text: input.text.trim(),
    gm_only: Boolean(input.gmOnly),
  });
  if (error) console.warn("Could not write to the journal.", error);
}

export async function updateJournalEntry(id: string, changes: Partial<Pick<JournalRow, "text" | "status" | "gm_only">>) {
  const { error } = await supabase.from("campaign_journal").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteJournalEntry(id: string) {
  const { error } = await supabase.from("campaign_journal").delete().eq("id", id);
  if (error) throw error;
}

let journalChannelCount = 0;

export function useCampaignJournal(campaignId: string) {
  const [entries, setEntries] = useState<JournalRow[]>([]);
  const [missing, setMissing] = useState(false);
  const reloadRef = useRef(async () => {});

  useEffect(() => {
    reloadRef.current = async () => {
      if (!campaignId) return;
      try {
        setEntries(await fetchJournal(campaignId));
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
      .channel(`campaign-journal-${campaignId}-${++journalChannelCount}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_journal", filter: `campaign_id=eq.${campaignId}` }, () =>
        reloadRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return { entries, missing, reload: () => reloadRef.current() };
}
