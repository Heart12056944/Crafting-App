"use client";

import React, { useEffect, useRef, useState } from "react";
import { Coins as CoinsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import {
  PARTY_FUND,
  changePurse,
  fetchCoinLog,
  fetchPurses,
  moveCoins,
  purseCoins,
  type CoinLogRow,
  type PurseRow,
} from "@/lib/supabaseCoins";
import { COIN_KEYS, COIN_NAMES, coinsToCp, emptyCoins, formatCoins, formatCp, type CoinKey, type Coins } from "@/data/coins";

type CharacterLike = { id: string; name: string; isActive?: boolean };

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const blueButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const fieldClass = "rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1 text-sm";

const COIN_COLORS: Record<CoinKey, string> = {
  pp: "#8fa3b8",
  gp: "#c9a227",
  ep: "#a3a86b",
  sp: "#a8a8a8",
  cp: "#b06a35",
};

// Live purses and coin log for a campaign. Used by the Inventory and Shops tabs.
export function useCampaignPurses(campaignId: string) {
  const [purses, setPurses] = useState<PurseRow[]>([]);
  const [log, setLog] = useState<CoinLogRow[]>([]);

  const reload = useRef(async () => {});

  // Declared first, so the ref is current before the effect below uses it.
  useEffect(() => {
    reload.current = async () => {
      if (!campaignId) return;
      try {
        const [nextPurses, nextLog] = await Promise.all([fetchPurses(campaignId), fetchCoinLog(campaignId)]);
        setPurses(nextPurses);
        setLog(nextLog);
      } catch (error) {
        console.warn("Could not load purses.", error);
      }
    };
  });

  useEffect(() => {
    if (!campaignId) return;
    reload.current();
    const channel = supabase
      .channel(`campaign-purses-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_purses", filter: `campaign_id=eq.${campaignId}` }, () =>
        reload.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const coinsOf = (holder: string): Coins => purseCoins(purses.find((row) => row.holder === holder));
  return { purses, log, coinsOf, reload: () => reload.current() };
}

export function CoinChips({ coins }: { coins: Coins }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {COIN_KEYS.map((key) => (
        <span
          key={key}
          title={COIN_NAMES[key]}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold"
          style={{ borderColor: COIN_COLORS[key], opacity: coins[key] ? 1 : 0.45 }}
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COIN_COLORS[key] }} />
          {coins[key]} {key}
        </span>
      ))}
    </span>
  );
}

function CoinInputs({ value, onChange }: { value: Coins; onChange: (next: Coins) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {COIN_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-1 text-xs">
          <input
            type="number"
            min={0}
            className={`${fieldClass} w-16`}
            value={value[key] || ""}
            placeholder="0"
            onChange={(event) => onChange({ ...value, [key]: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
            aria-label={COIN_NAMES[key]}
          />
          {key}
        </label>
      ))}
    </div>
  );
}

function PurseCard({
  campaignId,
  holder,
  label,
  coins,
  canSend,
  adminUnlocked,
  targets,
  onDone,
}: {
  campaignId: string;
  holder: string;
  label: string;
  coins: Coins;
  canSend: boolean;
  adminUnlocked: boolean;
  targets: { value: string; label: string }[];
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"" | "gm" | "send">("");
  const [amount, setAmount] = useState<Coins>(emptyCoins());
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await action();
      setAmount(emptyCoins());
      setReason("");
      onDone(done);
    } catch (error) {
      onDone(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const amountText = formatCoins(amount);
  const hasAmount = coinsToCp(amount) > 0;
  const negative = Object.fromEntries(COIN_KEYS.map((key) => [key, -amount[key]])) as Coins;

  return (
    <div className="rounded-xl border border-[#9a7b45] bg-[#f7e7c5] p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{label}</strong>
        <span className="text-xs">worth {formatCp(coinsToCp(coins))}</span>
      </div>
      <CoinChips coins={coins} />
      <div className="flex flex-wrap gap-2">
        {adminUnlocked && (
          <Button size="sm" className={darkButton} onClick={() => setMode(mode === "gm" ? "" : "gm")}>
            GM: add / subtract
          </Button>
        )}
        {canSend && targets.length > 0 && (
          <Button size="sm" className={blueButton} onClick={() => setMode(mode === "send" ? "" : "send")}>
            Send coins
          </Button>
        )}
      </div>

      {mode !== "" && (
        <div className="space-y-2 rounded-lg border border-[#d9bf8c] bg-[#fff0c7] p-2">
          <CoinInputs value={amount} onChange={setAmount} />
          {mode === "send" && (
            <select className={fieldClass} value={target} onChange={(event) => setTarget(event.target.value)} aria-label={`Send coins from ${label} to`}>
              <option value="">Send to...</option>
              {targets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          <input
            className={`${fieldClass} w-full`}
            placeholder={mode === "gm" ? "Reason (e.g. quest reward, toll, theft)" : "Note (optional)"}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {mode === "gm" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || !hasAmount}
                className={darkButton}
                onClick={() => run(() => changePurse(campaignId, holder, amount, reason || "GM added"), `Added ${amountText} to ${label}.`)}
              >
                Add
              </Button>
              <Button
                size="sm"
                disabled={busy || !hasAmount}
                className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7] disabled:opacity-50"
                onClick={() => run(() => changePurse(campaignId, holder, negative, reason || "GM removed"), `Removed ${amountText} from ${label}.`)}
              >
                Subtract
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={busy || !hasAmount || !target}
              className={blueButton}
              onClick={() => {
                const to = targets.find((option) => option.value === target)?.label || "someone";
                const from = label.replace(/ \(you\)$/, "");
                run(() => moveCoins(campaignId, holder, target, amount, reason || `${from} → ${to}`), `${from} sent ${amountText} to ${to}.`);
              }}
            >
              Send
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoinPurses({
  campaignId,
  characters,
  adminUnlocked,
  claimedCharacterIds,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
  claimedCharacterIds: string[];
}) {
  const { log, coinsOf, reload } = useCampaignPurses(campaignId);
  const [message, setMessage] = useState("");
  const [showLog, setShowLog] = useState(false);

  const visible = characters.filter((character) => adminUnlocked || character.isActive !== false);
  const nameOf = (holder: string) => (holder === PARTY_FUND ? "Party fund" : characters.find((c) => c.id === holder)?.name || "Unknown");

  const holders: { id: string; label: string }[] = [
    ...claimedCharacterIds.map((id) => ({ id, label: `${nameOf(id)} (you)` })),
    { id: PARTY_FUND, label: "Party fund" },
    ...visible.filter((character) => !claimedCharacterIds.includes(character.id)).map((character) => ({ id: character.id, label: character.name })),
  ];

  // Players move coins out of their own purses and the party fund; the GM can move anyone's.
  const canSend = (holder: string) =>
    adminUnlocked || claimedCharacterIds.includes(holder) || (holder === PARTY_FUND && claimedCharacterIds.length > 0);

  const targetsFor = (holder: string) =>
    [{ id: PARTY_FUND, label: "Party fund" }, ...visible.map((character) => ({ id: character.id, label: character.name }))]
      .filter((option) => option.id !== holder)
      .map((option) => ({ value: option.id, label: option.label }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CoinsIcon className="h-6 w-6" />
        <h3 className="text-2xl font-bold">Coin Purses</h3>
      </div>
      <p className="text-sm">
        10 cp = 1 sp, 5 sp = 1 ep, 2 ep = 1 gp, 10 gp = 1 pp. Shops make change automatically.
        {adminUnlocked ? " As GM you can add or subtract any coins from any purse." : ""}
      </p>
      {message && <p className="font-bold">{message}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {holders.map((holder) => (
          <PurseCard
            key={holder.id}
            campaignId={campaignId}
            holder={holder.id}
            label={holder.label}
            coins={coinsOf(holder.id)}
            canSend={canSend(holder.id)}
            adminUnlocked={adminUnlocked}
            targets={targetsFor(holder.id)}
            onDone={(text) => {
              setMessage(text);
              reload();
            }}
          />
        ))}
      </div>
      <button type="button" className="text-sm font-bold underline" onClick={() => setShowLog(!showLog)}>
        {showLog ? "Hide" : "Show"} recent coin changes
      </button>
      {showLog && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-[#9a7b45] bg-[#fff0c7] p-2 text-xs space-y-1">
          {log.length === 0 && <p className="italic">No coin changes yet.</p>}
          {log.map((row) => {
            const parts = COIN_KEYS.filter((key) => row[key]).map((key) => `${row[key] > 0 ? "+" : ""}${row[key]} ${key}`);
            return (
              <p key={row.id}>
                <strong>{nameOf(row.holder)}</strong> {parts.join(", ")} {row.reason ? `· ${row.reason}` : ""}{" "}
                <span className="opacity-60">{new Date(row.created_at).toLocaleString()}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
