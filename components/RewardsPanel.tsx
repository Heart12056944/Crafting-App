"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Upload } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import {
  REWARD_CATEGORIES,
  REWARD_DEFINITIONS,
  REWARD_RARITY_WEIGHTS,
  type RewardCategory,
  type RewardDefinition,
  type RewardRarity,
} from "@/data/rewardDefinitions";

type CharacterLike = {
  id: string;
  name: string;
  isActive?: boolean;
};

type DbRewardDefinition = {
  id: string;
  category: RewardCategory;
  rarity: RewardRarity;
  name: string;
  value_gp: number | null;
  description: string | null;
  tags: string[] | null;
};

type CampaignRewardRow = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  reward_definition_id: string;
  quantity: number;
  created_at: string;
  reward_definitions?: DbRewardDefinition | null;
};

const RARITIES: RewardRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

function rollWeightedRarity(): RewardRarity {
  const entries = Object.entries(REWARD_RARITY_WEIGHTS) as [RewardRarity, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return "Common";
}

function pickReward(pool: DbRewardDefinition[], rarityFilter: RewardRarity | "Any") {
  if (pool.length === 0) return null;

  if (rarityFilter !== "Any") {
    const rarityPool = pool.filter((reward) => reward.rarity === rarityFilter);
    if (rarityPool.length === 0) return null;
    return rarityPool[Math.floor(Math.random() * rarityPool.length)];
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const rarity = rollWeightedRarity();
    const rarityPool = pool.filter((reward) => reward.rarity === rarity);
    if (rarityPool.length > 0) {
      return rarityPool[Math.floor(Math.random() * rarityPool.length)];
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function rarityBadgeClass(rarity: string) {
  switch (rarity) {
    case "Common":
      return "bg-[#315c38]";
    case "Uncommon":
      return "bg-[#1f6f46]";
    case "Rare":
      return "bg-[#1f4f8f]";
    case "Epic":
      return "bg-[#5b2f8f]";
    case "Legendary":
      return "bg-[#9b6b16]";
    default:
      return "bg-[#333]";
  }
}

export default function RewardsPanel({
  campaignId,
  characters,
  adminUnlocked,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
}) {
  const [definitions, setDefinitions] = useState<DbRewardDefinition[]>([]);
  const [campaignRewards, setCampaignRewards] = useState<CampaignRewardRow[]>([]);
  const [category, setCategory] = useState<RewardCategory | "Any">("Any");
  const [rarity, setRarity] = useState<RewardRarity | "Any">("Any");
  const [quantity, setQuantity] = useState(1);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [rolledRewards, setRolledRewards] = useState<DbRewardDefinition[]>([]);
  const [catalogCategory, setCatalogCategory] = useState<RewardCategory | "Any">("Any");
  const [catalogRarity, setCatalogRarity] = useState<RewardRarity | "Any">("Any");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeCharacters = useMemo(
    () => characters.filter((character) => adminUnlocked || character.isActive !== false),
    [characters, adminUnlocked]
  );

  useEffect(() => {
    if (!selectedCharacterId && activeCharacters[0]?.id) {
      setSelectedCharacterId(activeCharacters[0].id);
    }
  }, [activeCharacters, selectedCharacterId]);

  async function loadRewards() {
    if (!campaignId) return;

    setIsLoading(true);
    const [{ data: definitionRows, error: definitionError }, { data: rewardRows, error: rewardError }] = await Promise.all([
      supabase
        .from("reward_definitions")
        .select("id, category, rarity, name, value_gp, description, tags")
        .order("category")
        .order("rarity")
        .order("name"),
      supabase
        .from("campaign_rewards")
        .select("id, campaign_id, character_id, reward_definition_id, quantity, created_at, reward_definitions(id, category, rarity, name, value_gp, description, tags)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false }),
    ]);

    setIsLoading(false);

    if (definitionError || rewardError) {
      setMessage(definitionError?.message || rewardError?.message || "Failed to load rewards.");
      return;
    }

    setDefinitions((definitionRows || []) as DbRewardDefinition[]);

    const normalizedCampaignRewards: CampaignRewardRow[] = ((rewardRows || []) as unknown[]).map((row: any) => ({
      ...row,
      reward_definitions: Array.isArray(row.reward_definitions)
        ? row.reward_definitions[0] ?? null
        : row.reward_definitions ?? null,
    }));

    setCampaignRewards(normalizedCampaignRewards);
  }

  useEffect(() => {
    loadRewards();

    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-rewards-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_rewards", filter: `campaign_id=eq.${campaignId}` }, loadRewards)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_definitions" }, loadRewards)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  async function syncRewardDefinitions() {
    if (!adminUnlocked) return;

    setIsSyncing(true);
    setMessage("Syncing reward definitions...");

    const rows = REWARD_DEFINITIONS.map((reward: RewardDefinition) => ({
      category: reward.category,
      rarity: reward.rarity,
      name: reward.name,
      value_gp: reward.valueGp ?? 0,
      description: reward.description,
      tags: Array.from(new Set([...(reward.tags || []), reward.requiresAttunement ? "Requires Attunement" : ""])).filter(Boolean),
    }));

    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("reward_definitions").insert(chunk);

      if (error) {
        setIsSyncing(false);
        setMessage(`Sync failed: ${error.message}`);
        return;
      }
    }

    setIsSyncing(false);
    setMessage(`Synced ${rows.length} reward definitions.`);
    loadRewards();
  }

  function rollRewards() {
    const pool = definitions.filter((reward) => {
      const categoryMatch = category === "Any" || reward.category === category;
      return categoryMatch;
    });

    if (pool.length === 0) {
      setMessage("No rewards match that category. Sync the reward definitions first if this is empty.");
      setRolledRewards([]);
      return;
    }

    const next: DbRewardDefinition[] = [];

    for (let i = 0; i < Math.max(1, quantity); i += 1) {
      const reward = pickReward(pool, rarity);
      if (reward) next.push(reward);
    }

    if (next.length === 0) {
      setMessage("No rewards match that rarity/category combination.");
      setRolledRewards([]);
      return;
    }

    setMessage("");
    setRolledRewards(next);
  }

  async function assignReward(reward: DbRewardDefinition, characterId: string | null = selectedCharacterId || null) {
    if (!campaignId) return;

    const { error } = await supabase.from("campaign_rewards").insert({
      campaign_id: campaignId,
      character_id: characterId,
      reward_definition_id: reward.id,
      quantity: 1,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(characterId ? `${reward.name} assigned.` : `${reward.name} added to campaign rewards.`);
    loadRewards();
  }

  async function removeCampaignReward(rowId: string) {
    if (!adminUnlocked) return;

    const { error } = await supabase.from("campaign_rewards").delete().eq("id", rowId);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadRewards();
  }

  const categoryCounts = useMemo(() => {
    return definitions.reduce<Record<string, number>>((acc, reward) => {
      acc[reward.category] = (acc[reward.category] || 0) + 1;
      return acc;
    }, {});
  }, [definitions]);

  const rewardsByCharacter = useMemo(() => {
    const map = new Map<string, CampaignRewardRow[]>();
    campaignRewards.forEach((reward) => {
      const key = reward.character_id || "campaign";
      map.set(key, [...(map.get(key) || []), reward]);
    });
    return map;
  }, [campaignRewards]);

  const catalogRewards = useMemo(() => {
    const searchText = catalogSearch.trim().toLowerCase();

    return definitions
      .filter((reward) => {
        const categoryMatch = catalogCategory === "Any" || reward.category === catalogCategory;
        const rarityMatch = catalogRarity === "Any" || reward.rarity === catalogRarity;
        const searchMatch =
          !searchText ||
          `${reward.name} ${reward.category} ${reward.rarity} ${reward.description || ""} ${(reward.tags || []).join(" ")}`
            .toLowerCase()
            .includes(searchText);

        return categoryMatch && rarityMatch && searchMatch;
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.rarity.localeCompare(b.rarity) || a.name.localeCompare(b.name));
  }, [definitions, catalogCategory, catalogRarity, catalogSearch]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-7">
      <div className="rounded-2xl border-2 border-[#9a7b45] bg-[#ead6ad] p-6 text-[#251b10] shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Gift className="h-8 w-8" />
          <h2 className="font-serif text-3xl font-bold">Rewards</h2>
        </div>

        {message && <div className="mb-4 rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-3 text-sm">{message}</div>}

        {definitions.length === 0 && adminUnlocked && (
          <div className="mb-5 rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-4">
            <p className="mb-3 font-bold">No reward definitions found.</p>
            <button
              onClick={syncRewardDefinitions}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded bg-[#4b3115] px-4 py-2 font-bold text-[#fff0c7] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {isSyncing ? "Syncing..." : "Sync Reward Definitions"}
            </button>
          </div>
        )}

        {adminUnlocked && definitions.length > 0 && (
          <div className="mb-5 rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">Reward Generator</p>
              <button
                onClick={loadRewards}
                className="inline-flex items-center gap-2 rounded border border-[#9a7b45] bg-[#ead6ad] px-3 py-1 text-sm font-bold"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-bold">Category</span>
                <select className="w-full rounded border border-[#9a7b45] bg-[#f2dfb9] p-2" value={category} onChange={(event) => setCategory(event.target.value as RewardCategory | "Any")}>
                  <option value="Any">Any</option>
                  {REWARD_CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry} ({categoryCounts[entry] || 0})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-bold">Rarity</span>
                <select className="w-full rounded border border-[#9a7b45] bg-[#f2dfb9] p-2" value={rarity} onChange={(event) => setRarity(event.target.value as RewardRarity | "Any")}>
                  <option value="Any">Any Weighted</option>
                  {RARITIES.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-bold">Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                  className="w-full rounded border border-[#9a7b45] bg-[#f2dfb9] p-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-bold">Assign To</span>
                <select className="w-full rounded border border-[#9a7b45] bg-[#f2dfb9] p-2" value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
                  {activeCharacters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <button onClick={rollRewards} className="mt-4 w-full rounded bg-[#4b3115] px-4 py-2 font-bold text-[#fff0c7]">
              Roll Reward
            </button>
          </div>
        )}

        <div className="space-y-3">
          {rolledRewards.map((reward, index) => (
            <RewardCard
              key={`${reward.id}-${index}`}
              reward={reward}
              adminUnlocked={adminUnlocked}
              onAssign={() => assignReward(reward, selectedCharacterId)}
              onAddToCampaign={() => assignReward(reward, null)}
            />
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-4">
          <h3 className="mb-3 font-serif text-2xl font-bold">Reward Codex</h3>
          <p className="mb-3 text-sm">
            Browse every reward that exists in the campaign. Rarity is shown here for reference, but random rolls still happen behind the scenes.
          </p>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2 md:col-span-1"
              placeholder="Search rewards..."
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
            />

            <select className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2" value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value as RewardCategory | "Any")}>
              <option value="Any">All Categories</option>
              {REWARD_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry} ({categoryCounts[entry] || 0})
                </option>
              ))}
            </select>

            <select className="rounded border border-[#9a7b45] bg-[#f2dfb9] p-2" value={catalogRarity} onChange={(event) => setCatalogRarity(event.target.value as RewardRarity | "Any")}>
              <option value="Any">All Rarities</option>
              {RARITIES.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </div>

          {definitions.length === 0 ? (
            <p className="text-sm">No rewards are loaded yet.</p>
          ) : catalogRewards.length === 0 ? (
            <p className="text-sm">No rewards match your filters.</p>
          ) : (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">
              {catalogRewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  adminUnlocked={false}
                  onAssign={() => undefined}
                  onAddToCampaign={() => undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#9a7b45] bg-[#ead6ad] p-6 text-[#251b10] shadow-2xl">
        <h3 className="mb-4 font-serif text-2xl font-bold">Campaign Rewards</h3>
        {isLoading && <p>Loading rewards...</p>}

        {campaignRewards.length === 0 ? (
          <p>No rewards assigned yet.</p>
        ) : (
          <div className="space-y-5">
            <RewardOwnerSection
              title="Unassigned / Campaign Rewards"
              rewards={rewardsByCharacter.get("campaign") || []}
              adminUnlocked={adminUnlocked}
              onRemove={removeCampaignReward}
            />

            {activeCharacters.map((character) => (
              <RewardOwnerSection
                key={character.id}
                title={character.name}
                rewards={rewardsByCharacter.get(character.id) || []}
                adminUnlocked={adminUnlocked}
                onRemove={removeCampaignReward}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RewardOwnerSection({
  title,
  rewards,
  adminUnlocked,
  onRemove,
}: {
  title: string;
  rewards: CampaignRewardRow[];
  adminUnlocked: boolean;
  onRemove: (id: string) => void;
}) {
  if (rewards.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 font-serif text-xl font-bold">{title}</h4>
      <div className="space-y-2">
        {rewards.map((row) => {
          const reward = row.reward_definitions;
          if (!reward) return null;

          return (
            <div key={row.id} className="rounded-xl border border-[#9a7b45] bg-[#fff0c7] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{reward.name}</p>
                  <p className="text-xs">
                    {reward.category} • {reward.rarity} • {reward.value_gp || 0} GP
                  </p>
                </div>
                {adminUnlocked && (
                  <button onClick={() => onRemove(row.id)} className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RewardCard({
  reward,
  adminUnlocked,
  onAssign,
  onAddToCampaign,
}: {
  reward: DbRewardDefinition;
  adminUnlocked: boolean;
  onAssign: () => void;
  onAddToCampaign: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#9a7b45] bg-[#fff0c7] p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-2xl font-bold">{reward.name}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#fff0c7]">
            <span className="rounded px-2 py-1 bg-[#4b3115]">{reward.category}</span>
            <span className={`rounded px-2 py-1 ${rarityBadgeClass(reward.rarity)}`}>{reward.rarity}</span>
            <span className="rounded bg-[#5b4630] px-2 py-1">{reward.value_gp || 0} GP</span>
          </div>
        </div>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed">{reward.description}</p>

      {(reward.tags || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(reward.tags || []).slice(0, 8).map((tag) => (
            <span key={tag} className="rounded border border-[#9a7b45] bg-[#ead6ad] px-2 py-0.5 text-[10px] font-bold uppercase">
              {tag}
            </span>
          ))}
        </div>
      )}

      {adminUnlocked && (
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          <button onClick={onAssign} className="rounded bg-[#1f4d2e] px-3 py-2 text-sm font-bold text-[#fff0c7]">
            Assign To Character
          </button>
          <button onClick={onAddToCampaign} className="rounded bg-[#4b3115] px-3 py-2 text-sm font-bold text-[#fff0c7]">
            Add To Campaign
          </button>
        </div>
      )}
    </div>
  );
}
