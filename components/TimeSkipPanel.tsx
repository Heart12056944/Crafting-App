"use client";

import React, { useState } from "react";
import { Hourglass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_TIME_SKIP, TIME_SKIP_LABELS, TIME_UNITS, describeSpan, type TimeSkipOptions } from "@/data/timeSkip";

// GM: pass a long stretch at once (weeks resting at the Vigil, years between
// chapters), choosing what changes.
export default function TimeSkipPanel({ onPassTime }: { onPassTime: (days: number, options: TimeSkipOptions) => Promise<string[]> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState("weeks");
  const [options, setOptions] = useState<TimeSkipOptions>(DEFAULT_TIME_SKIP);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const days = Math.max(1, Math.round(amount)) * (TIME_UNITS.find((item) => item.id === unit)?.days || 1);

  async function go() {
    setBusy(true);
    try {
      setReport(await onPassTime(days, options));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-fit bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7]">
        <Hourglass className="mr-1 h-4 w-4" /> Pass longer time...
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border-2 border-[#9a7b45] bg-[#f7e7c5] p-3 text-sm text-[#251b10]">
      <div className="flex items-center justify-between">
        <p className="font-bold">Pass a longer stretch of time</p>
        <button type="button" className="text-xs underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          className="w-20 rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1"
          value={amount}
          onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))}
          aria-label="How much time"
        />
        <select className="rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1" value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Time unit">
          {TIME_UNITS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <span>= {days} days ({describeSpan(days)})</span>
      </div>
      <p className="text-xs">The calendar, weather, prices and the wild always move on. Choose what else happens:</p>
      <div className="space-y-1">
        {(Object.keys(TIME_SKIP_LABELS) as (keyof TimeSkipOptions)[]).map((key) => (
          <label key={key} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={options[key]} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} />
            <span>{TIME_SKIP_LABELS[key]}</span>
          </label>
        ))}
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">Pass {describeSpan(days)}? A backup is taken first, so you can restore it from the Today tab.</span>
          <Button disabled={busy} onClick={go} className="bg-[#8b1a1a] hover:bg-[#a52222] text-[#fff0c7]">
            {busy ? "Passing time..." : "Pass the time"}
          </Button>
          <button type="button" className="underline" onClick={() => setConfirming(false)}>Back</button>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)} className="bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]">
          Pass {describeSpan(days)}
        </Button>
      )}
      {report.length > 0 && (
        <div className="space-y-1 rounded bg-[#fff0c7] p-2 text-xs">
          {report.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
