"use client";

import React, { useEffect, useRef, useState } from "react";
import { Axe, Fish, Leaf, Pickaxe } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pickWeightedLootEntry, rollDiceExpression, type LootQuality } from "@/data/lootTables";
import {
  GATHERING_ATTEMPTS_PER_DAY,
  GATHERING_ATTRIBUTE_IDS as CARD,
  gatheringActivities,
  gatheringAttemptsPerDay,
  gatheringAttributeMeta,
  gatheringSpots,
  gatheringTierLabels,
  rollGatheringQuality,
  upgradeQuality,
  type GatheringActivity,
  type GatheringSpot,
} from "@/data/gatheringSpots";

// ---------------------------------------------------------------------------
// Types shared with the page
// ---------------------------------------------------------------------------

type Stat = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
type ProficiencyLevel = "none" | "proficient" | "expertise";

export type GatheringCharacter = {
  id: string;
  name: string;
  isActive: boolean;
  stats: Record<Stat, number>;
  tools: Record<string, ProficiencyLevel>;
  ownedTools: Record<string, boolean>;
  brokenTools: Record<string, boolean>;
  gatheringToday?: number;
};

export type GatheredItem = {
  name: string;
  qty: number;
  quality: LootQuality;
  rollText?: string;
};

type GameResult = {
  lootRolls: number;
  upgrades: number;
  notes: string[];
  bonusItems: GatheredItem[];
  // Woodcutting: every chop clean. Fishing: a fish was landed.
  flawless?: boolean;
  caught?: boolean;
};

// What a character's gathering attribute cards change, worked out once per roll.
type GatherMods = {
  advantage: boolean;
  checkBonus: number;
  natTwentyOn: number;
  nat1Safe: boolean;
  veinMult: number;
  extraStrikes: number;
  gemSense: boolean;
  windowMult: number;
  heartwoodFinder: boolean;
  extraCommonQty: number;
  extraHints: number;
  markLookalikes: boolean;
  extraPicks: number;
  biteMult: number;
  extraCasts: number;
  greenMult: number;
  pullMult: number;
  bigCatch: boolean;
  active: string[];
};

function modsFor(cardIds: Set<number>, activity: GatheringActivity): GatherMods {
  const has = (id: number) => cardIds.has(id);
  const mining = activity === "mining";
  const wood = activity === "woodcutting";
  const forage = activity === "foraging";
  const fish = activity === "fishing";
  return {
    advantage:
      (mining && has(CARD.prospectorsEye)) ||
      (wood && has(CARD.timberSense)) ||
      (forage && has(CARD.herbalistsEye)) ||
      (fish && has(CARD.patientAngler)),
    checkBonus: has(CARD.jackOfTheWilds) ? 2 : 0,
    natTwentyOn: has(CARD.fortuneFavours) ? 19 : 20,
    nat1Safe: has(CARD.cantWalkPastIt),
    veinMult: mining && has(CARD.steadySwing) ? 1.5 : 1,
    extraStrikes: mining && has(CARD.deepDelver) ? 1 : 0,
    gemSense: mining && has(CARD.gemSense),
    windowMult: wood && has(CARD.lumberjacksRhythm) ? 1.5 : 1,
    heartwoodFinder: wood && has(CARD.heartwoodFinder),
    extraCommonQty: (wood && has(CARD.cleanCuts)) || (forage && has(CARD.bountifulGatherer)) ? 1 : 0,
    extraHints: forage && has(CARD.herbalistsEye) ? 1 : 0,
    markLookalikes: forage && has(CARD.lookalikeWise),
    extraPicks: forage && has(CARD.greenThumb) ? 2 : 0,
    biteMult: fish && has(CARD.hairTriggerReflexes) ? 2 : 1,
    extraCasts: fish && has(CARD.hairTriggerReflexes) ? 1 : 0,
    greenMult: fish && has(CARD.steadyLine) ? 1.5 : 1,
    pullMult: fish && has(CARD.steadyLine) ? 0.65 : 1,
    bigCatch: fish && has(CARD.bigCatch),
    active: gatheringAttributeMeta
      .filter((meta) => cardIds.has(meta.id) && (meta.activity === "any" || meta.activity === activity))
      .map((meta) => meta.name),
  };
}

const PROFICIENCY_BONUS: Record<ProficiencyLevel, number> = { none: 0, proficient: 2, expertise: 4 };

const ACTIVITY_ICONS: Record<GatheringActivity, React.ComponentType<{ className?: string }>> = {
  mining: Pickaxe,
  woodcutting: Axe,
  foraging: Leaf,
  fishing: Fish,
};

const TIER_COLORS: Record<GatheringSpot["tier"], string> = {
  common: "#8f8f8f",
  uncommon: "#2f9e44",
  rare: "#1c7ed6",
  epic: "#9c36b5",
};

const TIER_SPEED: Record<GatheringSpot["tier"], number> = { common: 1, uncommon: 1.2, rare: 1.45, epic: 1.7 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card
      className={`rounded-2xl shadow-2xl border-2 ${className}`}
      style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" }}
    >
      <CardContent className="p-6 md:p-8">{children}</CardContent>
    </Card>
  );
}

const primaryButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7] disabled:opacity-50";
const secondaryButton = "bg-[#2f3b4b] hover:bg-[#3d4c60] text-[#fff0c7] disabled:opacity-50";
const box = "rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4";

// Runs `tick(now)` every animation frame while mounted. The latest `tick` is
// always used, so it can read current props without restarting the loop.
function useAnimationFrame(tick: (now: number) => void, running: boolean) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = (now: number) => {
      tickRef.current(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

// Calls `handler` when the space bar is pressed (or released, for holdable games).
function useSpaceKey(onDown: () => void, onUp?: () => void) {
  const downRef = useRef(onDown);
  const upRef = useRef(onUp);
  useEffect(() => {
    downRef.current = onDown;
    upRef.current = onUp;
  });

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      downRef.current();
    }
    function keyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      upRef.current?.();
    }
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Mining: a marker sweeps across the rock; strike while it is over the vein.
// ---------------------------------------------------------------------------

type MiningConfig = { veinWidth: number; speed: number; strikes: number; veinStarts: number[] };

function MiningGame({ config, onFinish }: { config: MiningConfig; onFinish: (result: GameResult) => void }) {
  const [marker, setMarker] = useState(0);
  const [strike, setStrike] = useState(0);
  const [hits, setHits] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const startRef = useRef<number | null>(null);
  const markerRef = useRef(0);
  const done = strike >= config.strikes;

  useAnimationFrame((now) => {
    if (startRef.current === null) startRef.current = now;
    const travelled = ((now - startRef.current) / 1000) * config.speed;
    const position = travelled % 200;
    const value = position > 100 ? 200 - position : position;
    markerRef.current = value;
    setMarker(value);
  }, !done);

  const veinStart = config.veinStarts[Math.min(strike, config.veinStarts.length - 1)];
  const veinEnd = veinStart + config.veinWidth;
  const perfectStart = veinStart + config.veinWidth / 3;
  const perfectEnd = veinEnd - config.veinWidth / 3;

  function swing() {
    if (done) return;
    const position = markerRef.current;
    const inVein = position >= veinStart && position <= veinEnd;
    const perfect = position >= perfectStart && position <= perfectEnd;
    const nextHits = hits + (inVein ? 1 : 0);
    const nextPerfects = perfects + (perfect ? 1 : 0);
    const message = perfect ? "Perfect strike! The vein splits clean." : inVein ? "Hit! Ore breaks loose." : "Miss. Sparks off bare rock.";
    const nextLog = [message, ...log];

    setHits(nextHits);
    setPerfects(nextPerfects);
    setLog(nextLog);
    setStrike(strike + 1);

    if (strike + 1 >= config.strikes) {
      onFinish({
        lootRolls: nextHits,
        upgrades: nextPerfects,
        notes: [`Mining: ${nextHits}/${config.strikes} hits, ${nextPerfects} perfect.`],
        bonusItems: [],
      });
    }
  }

  useSpaceKey(swing);

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Strike {Math.min(strike + 1, config.strikes)} of {config.strikes}. Press <strong>Strike</strong> or the space bar when the marker is over the gold vein. The bright centre is a perfect hit.
      </p>
      <div className="relative h-16 rounded-xl border-2 border-[#5c4a33] overflow-hidden" style={{ background: "repeating-linear-gradient(135deg, #5f5a52, #5f5a52 12px, #57524a 12px, #57524a 24px)" }}>
        <div className="absolute top-0 bottom-0" style={{ left: `${veinStart}%`, width: `${config.veinWidth}%`, background: "rgba(210,173,95,0.55)" }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${perfectStart}%`, width: `${perfectEnd - perfectStart}%`, background: "rgba(255,230,140,0.85)" }} />
        <div className="absolute top-0 bottom-0 w-1.5 -ml-0.5 bg-[#fff0c7] shadow-[0_0_8px_#fff0c7]" style={{ left: `${marker}%` }} />
      </div>
      <Button onClick={swing} disabled={done} className={`w-full py-6 text-lg ${primaryButton}`}>
        <Pickaxe className="w-5 h-5 mr-2" /> Strike
      </Button>
      <GameLog lines={log} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Woodcutting: chop as each closing ring meets the target ring.
// ---------------------------------------------------------------------------

type WoodcuttingConfig = { windowMs: number; beatMs: number; beats: number };

function WoodcuttingGame({ config, onFinish }: { config: WoodcuttingConfig; onFinish: (result: GameResult) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [judged, setJudgedState] = useState<("clean" | "perfect" | "miss")[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const finishedRef = useRef(false);
  const nowRef = useRef(0);
  // Source of truth between frames, so a beat is never judged twice before a re-render.
  const judgedRef = useRef<("clean" | "perfect" | "miss")[]>([]);
  const done = judged.length >= config.beats;

  function setJudged(next: ("clean" | "perfect" | "miss")[]) {
    judgedRef.current = next;
    setJudgedState(next);
  }

  function beatTime(index: number) {
    return (startedAt ?? 0) + config.beatMs * (index + 1);
  }

  function finish(results: ("clean" | "perfect" | "miss")[]) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const clean = results.filter((r) => r !== "miss").length;
    const perfect = results.filter((r) => r === "perfect").length;
    const lootRolls = clean >= 5 ? 3 : clean >= 4 ? 2 : clean >= 2 ? 1 : 0;
    onFinish({
      lootRolls,
      upgrades: perfect >= 3 ? 1 : 0,
      notes: [`Woodcutting: ${clean}/${config.beats} clean chops, ${perfect} perfect.`],
      bonusItems: [],
      flawless: clean === config.beats,
    });
  }

  useAnimationFrame((time) => {
    nowRef.current = time;
    setNow(time);
    if (startedAt === null) return;
    // A beat that passes without a chop counts as a miss.
    const current = judgedRef.current;
    const index = current.length;
    if (index < config.beats && time > beatTime(index) + config.windowMs) {
      const next = [...current, "miss" as const];
      setJudged(next);
      setLog((current) => ["Missed the beat.", ...current]);
      if (next.length >= config.beats) finish(next);
    }
  }, startedAt !== null && !done);

  function start() {
    setStartedAt(performance.now());
  }

  function chop() {
    const current = judgedRef.current;
    if (startedAt === null || current.length >= config.beats) return;
    const index = current.length;
    const diff = Math.abs(nowRef.current - beatTime(index));
    let result: "clean" | "perfect" | "miss" = "miss";
    if (diff <= config.windowMs / 3) result = "perfect";
    else if (diff <= config.windowMs) result = "clean";
    const next = [...current, result];
    setJudged(next);
    setLog((current) => [result === "perfect" ? "Perfect chop!" : result === "clean" ? "Clean chop." : "Glancing blow.", ...current]);
    if (next.length >= config.beats) finish(next);
  }

  useSpaceKey(() => (startedAt === null ? start() : chop()));

  const index = judged.length;
  const untilBeat = startedAt === null ? config.beatMs : beatTime(index) - now;
  const ringScale = clamp(1 + untilBeat / config.beatMs, 0.6, 2.2);
  const inWindow = startedAt !== null && Math.abs(untilBeat) <= config.windowMs;

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Press <strong>Chop</strong> or the space bar when the closing ring meets the target ring. Five beats.
      </p>
      <div className="flex items-center justify-center h-48 rounded-xl border-2 border-[#5c4a33]" style={{ background: "radial-gradient(circle, #6b4a2b 0%, #4a3220 70%)" }}>
        <div className="relative w-24 h-24">
          <div className={`absolute inset-0 rounded-full border-4 ${inWindow ? "border-[#ffe68c]" : "border-[#d2ad5f]"}`} />
          {startedAt !== null && !done && (
            <div className="absolute inset-0 rounded-full border-2 border-[#fff0c7]" style={{ transform: `scale(${ringScale})` }} />
          )}
          <div className="absolute inset-0 flex items-center justify-center text-[#fff0c7] font-bold">
            {done ? "Done" : startedAt === null ? "Ready" : `${index + 1}/${config.beats}`}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: config.beats }).map((_, i) => (
          <span
            key={i}
            className="w-4 h-4 rounded-full border border-[#5c4a33]"
            style={{ background: judged[i] === "perfect" ? "#ffe68c" : judged[i] === "clean" ? "#2f9e44" : judged[i] === "miss" ? "#a40000" : "#ead6ad" }}
          />
        ))}
      </div>
      {startedAt === null ? (
        <Button onClick={start} className={`w-full py-6 text-lg ${primaryButton}`}>Start Chopping</Button>
      ) : (
        <Button onClick={chop} disabled={done} className={`w-full py-6 text-lg ${primaryButton}`}>
          <Axe className="w-5 h-5 mr-2" /> Chop
        </Button>
      )}
      <GameLog lines={log} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Foraging: pick tiles to find herbs; lookalikes are hollowcap.
// ---------------------------------------------------------------------------

type ForageTile = "herb" | "lookalike" | "empty";
type ForagingConfig = {
  tiles: ForageTile[];
  picks: number;
  hinted: number[];
  herbNames: string[];
  markedLookalikes: number[];
  poisonImmune: boolean;
};

function ForagingGame({ config, onFinish }: { config: ForagingConfig; onFinish: (result: GameResult) => void }) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const [picksLeft, setPicksLeft] = useState(config.picks);
  const [found, setFound] = useState(0);
  const [lookalikes, setLookalikes] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const totalHerbs = config.tiles.filter((tile) => tile === "herb").length;

  function finish(herbs: number, bad: number) {
    if (finished) return;
    setFinished(true);
    onFinish({
      lootRolls: herbs,
      upgrades: herbs >= totalHerbs ? 1 : 0,
      notes: [
        `Foraging: found ${herbs} of ${totalHerbs} herbs.`,
        ...(bad > 0
          ? [
              config.poisonImmune
                ? `Picked ${bad} hollowcap lookalike${bad === 1 ? "" : "s"}. Lookalike Wise: no poison.`
                : `Picked ${bad} hollowcap lookalike${bad === 1 ? "" : "s"}: DC 11 CON save or poisoned for 1 hour (each).`,
            ]
          : []),
      ],
      bonusItems: bad > 0 ? [{ name: "Hollowcap", qty: bad, quality: "common", rollText: "Picked lookalikes" }] : [],
    });
  }

  function pick(index: number) {
    if (finished || picksLeft <= 0 || revealed.includes(index)) return;
    const tile = config.tiles[index];
    const nextFound = found + (tile === "herb" ? 1 : 0);
    const nextBad = lookalikes + (tile === "lookalike" ? 1 : 0);
    const nextPicks = picksLeft - 1;
    setRevealed([...revealed, index]);
    setFound(nextFound);
    setLookalikes(nextBad);
    setPicksLeft(nextPicks);
    setLog((current) => [
      tile === "herb" ? "Found a good herb." : tile === "lookalike" ? "A pale mushroom... that's hollowcap. Careful." : "Nothing useful here.",
      ...current,
    ]);
    if (nextPicks <= 0 || nextFound >= totalHerbs) finish(nextFound, nextBad);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Pick tiles to search the patch. <strong>{picksLeft}</strong> picks left. Herbs and lookalikes look the same until you pick them.
        {config.hinted.length > 0 && " Your keen eye marked a likely spot (gold outline)."}
        {config.markedLookalikes.length > 0 && " You can spot the lookalikes (red dashed outline)."}
      </p>
      <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
        {config.tiles.map((tile, index) => {
          const isRevealed = revealed.includes(index);
          const hinted = config.hinted.includes(index) && !isRevealed;
          const flagged = config.markedLookalikes.includes(index) && !isRevealed;
          return (
            <button
              key={index}
              type="button"
              onClick={() => pick(index)}
              disabled={finished || isRevealed}
              className="aspect-square rounded-lg border-2 text-xs font-bold transition"
              style={{
                borderColor: hinted ? "#ffd84a" : flagged ? "#c92a2a" : "#5c4a33",
                borderStyle: flagged ? "dashed" : "solid",
                boxShadow: hinted ? "0 0 10px #ffd84a" : undefined,
                background: !isRevealed
                  ? "radial-gradient(circle at 40% 35%, #6f8f4a, #3f5a2a)"
                  : tile === "herb"
                    ? "#2f9e44"
                    : tile === "lookalike"
                      ? "#d9c7a0"
                      : "#8b7355",
                color: "#fff0c7",
              }}
            >
              {isRevealed ? (tile === "herb" ? "Herb" : tile === "lookalike" ? "Pale cap" : "—") : flagged ? "✕" : ""}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => finish(found, lookalikes)} disabled={finished} className={`flex-1 ${secondaryButton}`}>
          Stop Foraging
        </Button>
      </div>
      <p className="text-xs text-center">Herbs here: {config.herbNames.join(", ")}</p>
      <GameLog lines={log} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fishing: hook on the bite, then hold to keep tension in the green.
// ---------------------------------------------------------------------------

type FishingConfig = { biteWindowMs: number; greenWidth: number; pull: number; casts: number; biteDelays: number[]; bonusRoll: boolean };
type FishPhase = "ready" | "waiting" | "bite" | "reeling" | "lost" | "caught";

function FishingGame({ config, onFinish }: { config: FishingConfig; onFinish: (result: GameResult) => void }) {
  const [phase, setPhaseState] = useState<FishPhase>("ready");
  const [castsUsed, setCastsUsed] = useState(0);
  // Read by the frame loop so a phase change takes effect on the very next frame.
  const phaseRef = useRef<FishPhase>("ready");

  function setPhase(next: FishPhase) {
    phaseRef.current = next;
    setPhaseState(next);
  }
  const [tension, setTension] = useState(50);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const timingRef = useRef({ biteAt: 0, biteStart: 0, last: 0, holding: false, stayedGreen: true, tension: 50, progress: 0 });
  const finishedRef = useRef(false);

  const greenLow = 50 - config.greenWidth / 2;
  const greenHigh = 50 + config.greenWidth / 2;
  const running = phase === "waiting" || phase === "bite" || phase === "reeling";

  function finish(caught: boolean, perfect: boolean) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish({
      lootRolls: caught ? 1 + (config.bonusRoll ? 1 : 0) : 0,
      upgrades: caught && perfect ? 1 : 0,
      notes: [caught ? `Fishing: landed a catch${perfect ? " without the line ever straining" : ""}.` : "Fishing: nothing landed."],
      bonusItems: [],
      caught,
    });
  }

  function lose(message: string) {
    setLog((current) => [message, ...current]);
    if (castsUsed >= config.casts) {
      setPhase("lost");
      finish(false, false);
    } else {
      setPhase("ready");
    }
  }

  useAnimationFrame((now) => {
    const timing = timingRef.current;
    const currentPhase = phaseRef.current;
    if (currentPhase === "waiting" && now >= timing.biteAt) {
      timing.biteStart = now;
      setPhase("bite");
      return;
    }
    if (currentPhase === "bite" && now - timing.biteStart > config.biteWindowMs) {
      lose("Too slow. The fish spat the hook.");
      return;
    }
    if (currentPhase === "reeling") {
      const dt = Math.min(0.05, (now - timing.last) / 1000);
      timing.last = now;
      const fishPull = Math.sin(now / 420) * config.pull + Math.sin(now / 133) * config.pull * 0.4;
      timing.tension = clamp(timing.tension + (timing.holding ? 48 : -42) * dt + fishPull * dt, 0, 100);
      const inGreen = timing.tension >= greenLow && timing.tension <= greenHigh;
      if (!inGreen) timing.stayedGreen = false;
      timing.progress = clamp(timing.progress + (inGreen ? 17 : -7) * dt, 0, 100);
      setTension(timing.tension);
      setProgress(timing.progress);
      if (timing.tension <= 0) {
        lose("The line went slack and the fish slipped free.");
      } else if (timing.tension >= 100) {
        lose("Snap! The line broke.");
      } else if (timing.progress >= 100) {
        setPhase("caught");
        setLog((current) => ["Landed it!", ...current]);
        finish(true, timing.stayedGreen);
      }
    }
  }, running);

  function cast() {
    if (phaseRef.current !== "ready") return;
    const timing = timingRef.current;
    timing.biteAt = performance.now() + config.biteDelays[Math.min(castsUsed, config.biteDelays.length - 1)];
    setCastsUsed(castsUsed + 1);
    setPhase("waiting");
    setLog((current) => [`Cast ${castsUsed + 1} of ${config.casts}...`, ...current]);
  }

  function hook() {
    const timing = timingRef.current;
    if (phaseRef.current === "waiting") {
      lose("You yanked too early and spooked the fish.");
      return;
    }
    if (phaseRef.current !== "bite") return;
    Object.assign(timing, { last: performance.now(), holding: false, stayedGreen: true, tension: 50, progress: 0 });
    setTension(50);
    setProgress(0);
    setPhase("reeling");
    setLog((current) => ["Hooked! Hold to reel, release to ease off.", ...current]);
  }

  function setHolding(holding: boolean) {
    timingRef.current.holding = holding;
  }

  useSpaceKey(
    () => {
      const current = phaseRef.current;
      if (current === "ready") cast();
      else if (current === "waiting" || current === "bite") hook();
      else if (current === "reeling") setHolding(true);
    },
    () => setHolding(false)
  );

  const inGreen = tension >= greenLow && tension <= greenHigh;

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Cast, wait for the bite, then hook it fast. While reeling, <strong>hold</strong> the button or space bar to pull and release to ease off. Keep tension in the green until the catch bar fills.
      </p>
      <div className="rounded-xl border-2 border-[#5c4a33] p-4 h-40 flex flex-col justify-center" style={{ background: "linear-gradient(#36536b, #1d3347)" }}>
        {phase === "ready" && <p className="text-center text-[#fff0c7] font-bold">Ready to cast. Casts left: {config.casts - castsUsed}</p>}
        {phase === "waiting" && <p className="text-center text-[#cfe3f0] font-bold animate-pulse">Waiting for a bite...</p>}
        {phase === "bite" && <p className="text-center text-[#ffe68c] text-3xl font-black">BITE!</p>}
        {phase === "lost" && <p className="text-center text-[#f3c1b8] font-bold">The water goes still.</p>}
        {phase === "caught" && <p className="text-center text-[#b8f0c0] text-2xl font-black">Caught!</p>}
        {phase === "reeling" && (
          <div className="space-y-3">
            <div className="relative h-6 rounded-full bg-[#2a2a2a] overflow-hidden border border-[#cfe3f0]">
              <div className="absolute top-0 bottom-0 bg-[rgba(47,158,68,0.7)]" style={{ left: `${greenLow}%`, width: `${config.greenWidth}%` }} />
              <div className={`absolute top-0 bottom-0 w-1.5 ${inGreen ? "bg-[#fff0c7]" : "bg-[#ff6b6b]"}`} style={{ left: `${tension}%` }} />
            </div>
            <div className="h-3 rounded-full bg-[#2a2a2a] overflow-hidden">
              <div className="h-full bg-[#d2ad5f]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-[#cfe3f0] text-center">Tension (top) · Catch progress (bottom)</p>
          </div>
        )}
      </div>
      {phase === "ready" && <Button onClick={cast} className={`w-full py-6 text-lg ${primaryButton}`}>Cast</Button>}
      {(phase === "waiting" || phase === "bite") && <Button onClick={hook} className={`w-full py-6 text-lg ${primaryButton}`}><Fish className="w-5 h-5 mr-2" /> Hook!</Button>}
      {phase === "reeling" && (
        <Button
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          className={`w-full py-6 text-lg select-none ${primaryButton}`}
        >
          Hold to Reel
        </Button>
      )}
      <GameLog lines={log} />
    </div>
  );
}

function GameLog({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className={index === 0 ? "font-bold" : "opacity-70"}>{line}</p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

type RollState = {
  natural: number;
  rolls: number[];
  total: number;
  margin: number;
  natTwenty: boolean;
  spot: GatheringSpot;
  characterId: string;
  mods: GatherMods;
};

type ActiveGame =
  | { kind: "mining"; config: MiningConfig }
  | { kind: "woodcutting"; config: WoodcuttingConfig }
  | { kind: "foraging"; config: ForagingConfig }
  | { kind: "fishing"; config: FishingConfig };

function buildGame(spot: GatheringSpot, margin: number, mods: GatherMods): ActiveGame {
  const speed = TIER_SPEED[spot.tier];
  if (spot.activity === "mining") {
    const veinWidth = clamp((14 + margin * 1.5) * mods.veinMult, 6, 55);
    const strikes = 3 + mods.extraStrikes;
    return {
      kind: "mining",
      config: {
        veinWidth,
        speed: 70 * speed,
        strikes,
        veinStarts: Array.from({ length: strikes }, () => Math.random() * (100 - veinWidth)),
      },
    };
  }
  if (spot.activity === "woodcutting") {
    return {
      kind: "woodcutting",
      config: {
        windowMs: clamp((130 + margin * 12) * mods.windowMult, 70, 450),
        beatMs: Math.round(950 / speed),
        beats: 5,
      },
    };
  }
  if (spot.activity === "foraging") {
    const lookalikeCount = { common: 3, uncommon: 4, rare: 5, epic: 6 }[spot.tier];
    const tiles: ForageTile[] = [
      ...Array<ForageTile>(5).fill("herb"),
      ...Array<ForageTile>(lookalikeCount).fill("lookalike"),
      ...Array<ForageTile>(25 - 5 - lookalikeCount).fill("empty"),
    ];
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const indexesOf = (kind: ForageTile) => tiles.map((tile, index) => (tile === kind ? index : -1)).filter((index) => index >= 0);
    const hints = (margin >= 10 ? 2 : margin >= 5 ? 1 : 0) + mods.extraHints;
    const herbNames = [...new Set(Object.values(spot.yields).flatMap((entries) => (entries || []).map((entry) => entry.name)))];
    return {
      kind: "foraging",
      config: {
        tiles,
        picks: 4 + (margin >= 5 ? 1 : 0) + (margin >= 10 ? 1 : 0) + mods.extraPicks,
        hinted: indexesOf("herb").slice(0, hints),
        herbNames,
        markedLookalikes: mods.markLookalikes ? indexesOf("lookalike") : [],
        poisonImmune: mods.markLookalikes,
      },
    };
  }
  const casts = 2 + mods.extraCasts;
  return {
    kind: "fishing",
    config: {
      biteWindowMs: clamp((650 + margin * 35) * mods.biteMult, 350, 2600),
      greenWidth: clamp((30 + margin * 1.5) * mods.greenMult, 16, 70),
      pull: 35 * speed * mods.pullMult,
      casts,
      biteDelays: Array.from({ length: casts }, () => 1500 + Math.random() * 3000),
      bonusRoll: margin >= 10,
    },
  };
}

function rollLoot(spot: GatheringSpot, result: GameResult, mods: GatherMods): GatheredItem[] {
  const rank: Record<LootQuality | "none", number> = { none: 0, common: 1, rare: 2, epic: 3 };
  const items: GatheredItem[] = [];
  for (let i = 0; i < result.lootRolls; i++) {
    let quality = rollGatheringQuality(spot.tier);
    if (mods.gemSense && quality === "common") {
      const reroll = rollGatheringQuality(spot.tier);
      if (rank[reroll] > rank[quality]) quality = reroll;
    }
    if (i < result.upgrades) quality = upgradeQuality(quality);
    if (quality === "none") continue;
    const entries = spot.yields[quality] || [];
    if (entries.length === 0) continue;
    const entry = pickWeightedLootEntry(entries);
    const rolled = rollDiceExpression(entry.amount);
    const bonus = quality === "common" ? mods.extraCommonQty : 0;
    items.push({
      name: entry.name,
      qty: rolled + bonus,
      quality,
      rollText: [entry.amount ? `${entry.amount} rolled ${rolled}` : "", bonus ? `+${bonus} from attributes` : ""].filter(Boolean).join(", ") || undefined,
    });
  }
  return [...items, ...result.bonusItems];
}

export default function GatheringPanel(props: {
  characters: GatheringCharacter[];
  adminUnlocked: boolean;
  enabledSpotIds: string[];
  disabledTags: string[];
  onToggleSpot: (spotId: string, enabled: boolean) => void;
  onSpendAttempt: (characterId: string) => void;
  onGathered: (characterId: string, spot: GatheringSpot, items: GatheredItem[]) => void;
  updateCharacterToolOwned: (characterId: string, tool: string, owned: boolean) => void;
  updateCharacterTool: (characterId: string, tool: string, level: ProficiencyLevel) => void;
  // Attribute cards assigned in this campaign (campaign_character_attributes rows).
  characterAttributes: { character_id: string; card_id: number }[];
}) {
  function cardIdsFor(id: string | undefined) {
    return new Set(
      props.characterAttributes.filter((row) => row.character_id === id).map((row) => Number(row.card_id))
    );
  }

  const visibleCharacters = props.characters.filter((character) => props.adminUnlocked || character.isActive !== false);
  const [characterId, setCharacterId] = useState(visibleCharacters[0]?.id || "");
  const [spotId, setSpotId] = useState("");
  const [roll, setRoll] = useState<RollState | null>(null);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [results, setResults] = useState<{ items: GatheredItem[]; notes: string[] } | null>(null);

  const spotsInSet = gatheringSpots.filter((spot) => !spot.set || !props.disabledTags.includes(spot.set));
  const availableSpots = props.adminUnlocked ? spotsInSet : spotsInSet.filter((spot) => props.enabledSpotIds.includes(spot.id));
  const character = visibleCharacters.find((item) => item.id === characterId) || visibleCharacters[0];
  const spot = availableSpots.find((item) => item.id === spotId);
  const activity = spot ? gatheringActivities[spot.activity] : null;
  const cardIds = cardIdsFor(character?.id);
  const attemptsPerDay = gatheringAttemptsPerDay(cardIds);
  const attemptsUsed = character?.gatheringToday ?? 0;
  const attemptsLeft = attemptsPerDay - attemptsUsed;
  const mods = spot ? modsFor(cardIds, spot.activity) : null;
  const toolOwned = Boolean(character && activity && character.ownedTools?.[activity.tool]);
  const toolBroken = Boolean(character && activity && character.brokenTools?.[activity.tool]);
  const busy = Boolean(roll) && !results;

  const statBonus = character && activity ? character.stats[activity.stat] || 0 : 0;
  const profLevel: ProficiencyLevel = character && activity ? character.tools?.[activity.tool] || "none" : "none";
  const profBonus = PROFICIENCY_BONUS[profLevel] || 0;

  const blockedReason = !character
    ? "Choose a character."
    : !spot
      ? "Choose a gathering spot."
      : !toolOwned
        ? `${character.name} needs a ${activity?.tool}.`
        : toolBroken
          ? `${character.name}'s ${activity?.tool} is broken.`
          : attemptsLeft <= 0 && !props.adminUnlocked
            ? `${character.name} has used all ${attemptsPerDay} gathering attempts today.`
            : "";

  function rollCheck() {
    if (!character || !spot || !mods || blockedReason) return;
    const rolls = mods.advantage ? [rollD20(), rollD20()] : [rollD20()];
    const natural = Math.max(...rolls);
    const natTwenty = natural >= mods.natTwentyOn;
    const total = natural + statBonus + profBonus + mods.checkBonus;
    let margin = total - spot.dc;
    if (natTwenty) margin = Math.max(margin, 10);
    props.onSpendAttempt(character.id);
    setResults(null);
    setRoll({ natural, rolls, total, margin, natTwenty, spot, characterId: character.id, mods });

    if (natural === 1 && !mods.nat1Safe) {
      setGame(null);
      setResults({ items: [], notes: [`Natural 1. ${character.name} finds nothing at ${spot.name} and the attempt is spent.`] });
      return;
    }
    setGame(buildGame(spot, margin, mods));
    setGameKey((key) => key + 1);
  }

  function handleFinish(result: GameResult) {
    if (!roll) return;
    const boosted: GameResult = { ...result, notes: [...result.notes] };
    if (roll.natTwenty) {
      boosted.lootRolls += 1;
      boosted.upgrades += 1;
      boosted.notes.push(`Natural ${roll.natural}${roll.natural < 20 ? " (counts as 20)" : ""}: +1 loot roll and +1 quality upgrade.`);
    }
    if (roll.mods.heartwoodFinder && result.flawless) {
      boosted.lootRolls += 1;
      boosted.upgrades += 1;
      boosted.notes.push("Heartwood Finder: +1 loot roll and +1 quality upgrade.");
    }
    if (roll.mods.bigCatch && result.caught) {
      boosted.lootRolls += 1;
      boosted.notes.push("Big Catch: +1 loot roll.");
    }
    const items = rollLoot(roll.spot, boosted, roll.mods);
    setResults({ items, notes: boosted.notes });
    props.onGathered(roll.characterId, roll.spot, items);
  }

  function reset() {
    setRoll(null);
    setGame(null);
    setResults(null);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-7 font-serif">
      <Panel>
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Pickaxe className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Gathering</h2>
          </div>
          <p>
            Mine, chop, forage and fish at the spots your GM has opened. Each character gets {GATHERING_ATTEMPTS_PER_DAY} attempts per day (some attributes add more). Roll first: a better roll makes the mini-game easier.
          </p>

          <label className="block space-y-1">
            <strong>Gatherer</strong>
            <select
              value={character?.id || ""}
              onChange={(event) => setCharacterId(event.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-[#9a7b45] bg-[#f2dfb9] px-3 py-2"
            >
              {visibleCharacters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({Math.max(0, gatheringAttemptsPerDay(cardIdsFor(item.id)) - (item.gatheringToday ?? 0))} attempts left)
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <strong>Gathering Spots</strong>
            {availableSpots.length === 0 && (
              <p className={box}>{props.adminUnlocked ? "No spots in visible recipe sets." : "Your GM hasn't opened any gathering spots yet."}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableSpots.map((item) => {
                const Icon = ACTIVITY_ICONS[item.activity];
                const selected = item.id === spotId;
                const enabled = props.enabledSpotIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border-2 p-3 space-y-1"
                    style={{
                      borderColor: selected ? "#d2ad5f" : TIER_COLORS[item.tier],
                      background: selected ? "#fff0c7" : props.adminUnlocked && !enabled ? "#f5c16c" : "#ead6ad",
                    }}
                  >
                    <button type="button" disabled={busy} onClick={() => setSpotId(item.id)} className="w-full text-left disabled:opacity-70">
                      <span className="flex items-center gap-2 font-bold"><Icon className="w-4 h-4" />{item.name}</span>
                      <span className="block text-xs">
                        {gatheringActivities[item.activity].label} · {gatheringTierLabels[item.tier]} · DC {item.dc}
                      </span>
                      <span className="block text-xs italic mt-1">{item.description}</span>
                    </button>
                    {props.adminUnlocked && (
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input type="checkbox" checked={enabled} onChange={(event) => props.onToggleSpot(item.id, event.target.checked)} />
                        Open to players {!enabled && <span className="text-[#7a3f00]">(hidden)</span>}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {spot && activity && character && (
            <div className={box}>
              <p><strong>Activity:</strong> {activity.label}. {activity.summary}</p>
              <p>
                <strong>Check:</strong> d20{mods?.advantage ? " (advantage)" : ""} + {activity.stat} ({statBonus >= 0 ? "+" : ""}{statBonus})
                {profBonus ? ` + ${activity.tool} proficiency (+${profBonus})` : ""}
                {mods?.checkBonus ? ` + attributes (+${mods.checkBonus})` : ""} vs DC {spot.dc}
              </p>
              <p><strong>Tool:</strong> {activity.tool} {toolOwned ? (toolBroken ? "(broken)" : "(owned)") : "(missing)"}</p>
              <p><strong>Attempts today:</strong> {attemptsUsed}/{attemptsPerDay}{props.adminUnlocked && attemptsLeft <= 0 ? " (GM can continue)" : ""}</p>
            </div>
          )}

          {spot && mods && mods.active.length > 0 && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-3">
              <p className="mb-2 font-bold">Active gathering attributes</p>
              <div className="space-y-1">
                {gatheringAttributeMeta
                  .filter((meta) => mods.active.includes(meta.name))
                  .map((meta) => (
                    <p key={meta.id} className="text-sm"><strong>{meta.name}:</strong> {meta.summary}</p>
                  ))}
              </div>
            </div>
          )}

          {blockedReason && <p className="font-bold text-[#7a3f00]">{blockedReason}</p>}

          <div className="flex gap-3">
            <Button onClick={rollCheck} disabled={Boolean(blockedReason) || busy} className={`flex-1 py-6 text-lg ${primaryButton}`}>
              {activity ? `Roll to ${activity.verb}` : "Roll"}
            </Button>
            {results && (
              <Button onClick={reset} className={`py-6 ${secondaryButton}`}>New Attempt</Button>
            )}
          </div>

          {props.adminUnlocked && (
            <div className="rounded-2xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3">
              <h3 className="text-xl font-bold">GM: Gathering Tools</h3>
              <div className="space-y-3">
                {props.characters.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#b99b62] bg-[#ead6ad] p-3">
                    <p className="font-bold">{item.name}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {Object.values(gatheringActivities).map((def) => (
                        <div key={def.tool} className="flex items-center justify-between gap-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(item.ownedTools?.[def.tool])}
                              onChange={(event) => props.updateCharacterToolOwned(item.id, def.tool, event.target.checked)}
                            />
                            {def.tool}
                          </label>
                          <select
                            value={item.tools?.[def.tool] || "none"}
                            onChange={(event) => props.updateCharacterTool(item.id, def.tool, event.target.value as ProficiencyLevel)}
                            className="rounded border border-[#9a7b45] bg-[#f2dfb9] px-1 py-0.5 text-xs"
                          >
                            <option value="none">Not proficient</option>
                            <option value="proficient">Proficient (+2)</option>
                            <option value="expertise">Expertise (+4)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-4">
          {!roll && (
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">How It Works</h2>
              {Object.entries(gatheringActivities).map(([key, def]) => {
                const Icon = ACTIVITY_ICONS[key as GatheringActivity];
                return (
                  <div key={key} className={box}>
                    <p className="flex items-center gap-2 font-bold"><Icon className="w-4 h-4" />{def.label} ({def.stat}, needs {def.tool})</p>
                    <p className="text-sm">{def.summary}</p>
                  </div>
                );
              })}
              <p className="text-sm">Beating the DC widens the target zones and windows. Missing it makes them tighter. A natural 1 wastes the attempt; a natural 20 adds a loot roll and upgrades one result.</p>
            </div>
          )}

          {roll && (
            <div className={box}>
              <h3 className="text-xl font-bold">{roll.spot.name}</h3>
              <p>
                Rolled <strong>{roll.natural}</strong>{roll.rolls.length > 1 ? ` (advantage: ${roll.rolls.join(" / ")})` : ""} → total <strong>{roll.total}</strong> vs DC {roll.spot.dc}{" "}
                ({roll.margin >= 0 ? `beat it by ${roll.margin}: easier` : `missed by ${-roll.margin}: harder`})
              </p>
            </div>
          )}

          {roll && game && !results && (
            <>
              {game.kind === "mining" && <MiningGame key={gameKey} config={game.config} onFinish={handleFinish} />}
              {game.kind === "woodcutting" && <WoodcuttingGame key={gameKey} config={game.config} onFinish={handleFinish} />}
              {game.kind === "foraging" && <ForagingGame key={gameKey} config={game.config} onFinish={handleFinish} />}
              {game.kind === "fishing" && <FishingGame key={gameKey} config={game.config} onFinish={handleFinish} />}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <h3 className="text-2xl font-bold">Haul</h3>
              {results.notes.map((note) => (
                <p key={note} className="text-sm">{note}</p>
              ))}
              {results.items.length === 0 ? (
                <p className={box}>Nothing worth keeping this time.</p>
              ) : (
                results.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className={`${box} flex justify-between gap-3`}>
                    <div>
                      <strong>{item.name}</strong>
                      <p className="text-sm">{item.quality}{item.rollText ? ` · ${item.rollText}` : ""}</p>
                    </div>
                    <strong>×{item.qty}</strong>
                  </div>
                ))
              )}
              {results.items.length > 0 && <p className="text-sm italic">Added to the campaign inventory and the shared loot log.</p>}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
