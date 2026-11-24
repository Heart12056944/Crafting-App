"use client";

import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REGION_ZONES, visibleRegions, type Region } from "@/data/regions";
import { gatheringActivities, gatheringSpots } from "@/data/gatheringSpots";
import { lootTables } from "@/data/lootTables";
import { speciesById } from "@/data/husbandry";
import { creatureInfo } from "@/data/creatures";

// Where the party is. The GM moves the party between regions; players see
// where they are and what they can gather there. Wildlife is for the GM only.

type Props = {
  adminUnlocked: boolean;
  disabledSets: string[];
  current: Region | null;
  visited: string[];
  enabledSpotIds: string[];
  wildAnimals: string[];
  onSetWildAnimal: (speciesId: string, nearby: boolean) => void;
  onMove: (regionId: string | null) => void;
  // The Still-Burning Forge: free tool repairs.
  brokenToolCount?: number;
  onRepairTools?: () => void;
};

const darkButton = "bg-[#4b3115] hover:bg-[#62401c] text-[#fff0c7]";

export default function RegionPanel(props: Props) {
  const { adminUnlocked, current } = props;
  const regions = visibleRegions(props.disabledSets);
  const [pick, setPick] = useState("");
  if (regions.length === 0) return null;
  const chosen = regions.find((region) => region.id === (pick || current?.id)) || null;
  const shown = adminUnlocked ? chosen : current;

  return (
    <Card className="border border-[#9a7b45] bg-[#fbf2dc] text-[#251b10]">
      <CardContent className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6" /> {current ? current.name : "Where the party is"}
          </h2>
          {current ? <span className="text-sm text-[#6b5432]">{current.zone}</span> : null}
        </div>

        {adminUnlocked ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              className="rounded border border-[#9a7b45] bg-[#fff0c7] px-2 py-1"
              value={chosen?.id || ""}
              onChange={(event) => setPick(event.target.value)}
              aria-label="Region"
            >
              <option value="">Choose a region…</option>
              {REGION_ZONES.map((zone) => (
                <optgroup key={zone} label={zone}>
                  {regions
                    .filter((region) => region.zone === zone)
                    .map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                        {region.id === current?.id ? " (here)" : props.visited.includes(region.id) ? " (visited)" : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <Button
              size="sm"
              className={darkButton}
              disabled={!chosen || chosen.id === current?.id}
              onClick={() => chosen && props.onMove(chosen.id)}
            >
              Move the party here
            </Button>
            {current ? (
              <button type="button" className="underline text-xs" onClick={() => props.onMove(null)}>
                Clear region
              </button>
            ) : null}
          </div>
        ) : null}

        {!shown ? (
          <p className="text-sm italic text-[#6b5432]">
            {adminUnlocked
              ? "Pick a region to preview it. Moving the party there opens its gathering spots and reveals its materials."
              : "The GM hasn't said where the party is yet."}
          </p>
        ) : (
          <RegionDetails region={shown} {...props} preview={adminUnlocked && shown.id !== current?.id} />
        )}
      </CardContent>
    </Card>
  );
}

function RegionDetails(props: Props & { region: Region; preview: boolean }) {
  const { region, adminUnlocked, enabledSpotIds, wildAnimals, onSetWildAnimal, preview } = props;
  const spots = region.spots
    .map((id) => gatheringSpots.find((spot) => spot.id === id))
    .filter((spot): spot is (typeof gatheringSpots)[number] => Boolean(spot))
    .filter((spot) => adminUnlocked || enabledSpotIds.includes(spot.id));
  const creatures = region.creatures.map((id) => lootTables.find((table) => table.id === id)).filter((table): table is (typeof lootTables)[number] => Boolean(table));

  return (
    <div className="space-y-3 text-sm">
      {preview ? <p className="font-semibold text-[#7a3f00]">Preview: the party isn't here yet.</p> : null}
      <p className="italic">{region.description}</p>

      <div>
        <p className="font-semibold">Gathering here</p>
        {spots.length === 0 ? (
          <p className="italic text-[#6b5432]">Nothing to gather here.</p>
        ) : (
          <ul className="list-disc pl-5">
            {spots.map((spot) => (
              <li key={spot.id}>
                {spot.name} <span className="text-[#6b5432]">({gatheringActivities[spot.activity].label}, DC {spot.dc})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {region.id === "still-burning-forge" && !preview ? (
        <div className="rounded-lg border border-[#e8590c] bg-[#ffe3cf] p-3 space-y-2">
          <p className="font-semibold text-[#8a2e00]">The Forge</p>
          <p>Forge-only recipes can be crafted while the party is here, and Forgeborn alloys can be made from what you mine.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className={darkButton} disabled={!props.brokenToolCount} onClick={props.onRepairTools}>
              Repair broken tools{props.brokenToolCount ? ` (${props.brokenToolCount})` : ""}
            </Button>
            {!props.brokenToolCount ? <span className="text-xs">No broken tools.</span> : null}
          </div>
        </div>
      ) : null}

      {adminUnlocked ? (
        <div className="rounded-lg border border-dashed border-[#9a7b45] p-3 space-y-2">
          <p className="font-semibold">Wildlife (GM only)</p>
          <p>
            {creatures
              .map((table) => {
                const info = creatureInfo(table);
                return `${table.label}${info?.cr !== undefined ? ` (CR ${info.cr})` : ""}`;
              })
              .join(", ") || "None."}
          </p>
          {region.wildAnimals.length ? (
            <div className="space-y-1">
              <p className="font-semibold">Can be tamed here</p>
              <div className="flex flex-wrap gap-2">
                {region.wildAnimals.map((speciesId) => {
                  const species = speciesById.get(speciesId);
                  if (!species) return null;
                  const nearby = wildAnimals.includes(speciesId);
                  return (
                    <Button
                      key={speciesId}
                      size="sm"
                      className={nearby ? "bg-[#2f5b2f] hover:bg-[#3b703b] text-[#fff0c7]" : darkButton}
                      onClick={() => onSetWildAnimal(speciesId, !nearby)}
                      aria-label={`${nearby ? "Remove" : "Put nearby"}: ${species.name}`}
                    >
                      {nearby ? `✓ ${species.name} nearby` : `Put a ${species.name} nearby`}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-[#6b5432]">Putting an animal nearby lets the players try to tame it in Husbandry.</p>
            </div>
          ) : null}
          {region.gmNote ? <p className="italic">{region.gmNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
