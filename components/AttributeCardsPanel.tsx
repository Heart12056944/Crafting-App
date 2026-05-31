"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type AttributeCardData = {
  id: number;
  name: string;
  tags: string[];
  score: number;
  desc: string;
};

const ATTRIBUTE_CARDS: AttributeCardData[] = [
  // Season 2 unique cards (not duplicated in S3)
  { id: 1183, name: "Ageless", tags: ["Cursed","Passive"], score: -8, desc: "You do not need air, food, or water to survive. You do not age. You are immune to death as long as your skull remains intact. You are an Undead creature for the purposes of spells and effects." },
  { id: 1184, name: "Valkyrie", tags: ["Cursed","Passive"], score: 8, desc: "Your character must be female. You have wings which grant you a fly speed of 30 ft. while falling, you may glide and take no fall damage." },
  { id: 1185, name: "Lycanthrope", tags: ["Cursed","Passive"], score: 4, desc: "Gain 3 random beast companion options selected by the DM and choose one. At midnight, while outside under the moon, or upon taking a Critical Hit, you shapeshift into your Beast form and gain access to its abilities. Your HP does not change and you retain access to your other abilities." },
  { id: 1186, name: "Medusa", tags: ["Cursed","Passive"], score: -4, desc: "You can attempt to dominate the minds of others with your gaze. On a Critical Hit, the target must succeed on a Wisdom saving throw (DC 15) or become your Charmed Companion for life." },
  { id: 1187, name: "Vampire", tags: ["Cursed","Passive"], score: 5, desc: "You are in constant search for your soulmate. You have advantage on Insight and Perception checks to see through disguises and detect lies." },
  // Season 3 cards (definitive versions)
  { id: 3661, name: "Strong", tags: ["Passive"], score: 5, desc: "Your character has powerful muscles and is naturally athletic. Your unarmed strikes and basic weapon attacks always deal at least 10 damage. Kobolds may redraw this Attribute." },
  { id: 3662, name: "Believer", tags: ["Passive"], score: 3, desc: "You are not who you believe you are — you are instead living out the story of someone else entirely. You lack the ability of self-awareness and cannot be convinced otherwise." },
  { id: 3663, name: "Intelligent", tags: ["Passive"], score: -3, desc: "You have studied the arcane arts extensively. Choose one spell of 3rd level or lower. You may cast this spell once per Long Rest without expending a spell slot. The spell is cast at 3rd level when applicable. Intelligence is your spellcasting ability for this spell." },
  { id: 3664, name: "Quick", tags: ["Passive"], score: 1, desc: "You speak quickly and move even quicker. You can move up to 10 additional spaces (50 ft.) using your Movement Action each turn." },
  { id: 3665, name: "Eccentric", tags: ["Passive"], score: -8, desc: "You speak with a posh accent and come from considerable wealth. You have 500 extra gold to spend at character creation, but you have disadvantage on Constitution saving throws and suffer terribly from emotional distress." },
  { id: 3666, name: "Charismatic", tags: ["Passive"], score: 4, desc: "You are irresistibly attractive to races and genders of your choosing. Outside of combat, you may attempt to beguile any NPC into becoming your Companion with a Charisma (Persuasion) check. You must have the appropriate Companion slot available." },
  { id: 3667, name: "Durable", tags: ["Passive"], score: 10, desc: "You never cut or shave your hair. Your Armor Class, regardless of whether you wear armor or not, always grants at least 40 temporary hit points at the start of each long rest." },
  { id: 3668, name: "Psychic", tags: ["Passive"], score: -8, desc: "You can read the minds of others. The Dungeon Master must reveal the surface thoughts of any creature on the battlefield whenever you ask for them as a bonus action." },
  { id: 3669, name: "Seadog", tags: ["Passive"], score: 8, desc: "You are a natural sailor who longs for the waves. You have a swim speed equal to your walking speed and automatically succeed on Athletics checks to swim or dive." },
  { id: 3670, name: "Cursed", tags: ["Passive"], score: -4, desc: "You are deeply superstitious and paranoid of others. Whenever another party member makes a Death Saving Throw, you immediately take 50 damage." },
  { id: 3671, name: "Beastmaster", tags: ["Passive"], score: 5, desc: "You have a deep bond with animals and are a gifted handler of wild creatures. Once per campaign, you may permanently charm a Beast creature to become your Companion without a roll." },
  { id: 3672, name: "Doomed", tags: ["Passive"], score: -10, desc: "Death calls to your character. Whenever you roll a Critical Failure (natural 1), you must immediately make a Death Saving Throw. If drawn at character creation, you may redraw." },
  { id: 3673, name: "Klutz", tags: ["Passive"], score: -3, desc: "You are dangerously clumsy and your allies know it. Whenever you roll a Critical Hit (natural 20), roll 3 additional d20s. If any of them are a natural 1, the action becomes a Critical Failure instead." },
  { id: 3674, name: "Overweight", tags: ["Passive"], score: 3, desc: "You are portly and sluggish in battle. Your movement speed is reduced to 15 ft. and you may only move up to 3 spaces with your Movement Action." },
  { id: 3675, name: "Halfwit", tags: ["Passive"], score: 7, desc: "You are easily fooled and blissfully dim. The Dungeon Master may veto any action in combat that would be too tactically clever for your character, at their discretion." },
  { id: 3676, name: "Peasant", tags: ["Passive"], score: 10, desc: "You are untrained in weapons and magic, having lived a humble commoner's life until now. Replace your Class with the Peasant Class, which has no purchasable items or abilities. Gain 8 random companion abilities selected by the DM instead." },
  { id: 3677, name: "Patient", tags: ["Passive"], score: 1, desc: "You remain calm and composed even in the most chaotic situations. Once per campaign, you may restore all expended Reactions and bonus actions in a single turn." },
  { id: 3678, name: "Blasphemous", tags: ["Passive"], score: -3, desc: "You do not believe in gods, divine beings, or draconic patrons. You cannot cast spells of the Divination or Evocation schools, nor any spell with the Divine descriptor." },
  { id: 3679, name: "Cackling", tags: ["Passive"], score: -4, desc: "You possess an unmistakably villainous laugh that you deploy constantly. Whenever you suffer the effects of a Critical Failure, you may force one willing or unwilling Ally to take the consequences in your place." },
  { id: 3680, name: "Drunk", tags: ["Passive"], score: -1, desc: "Your character is perpetually intoxicated and slurs their speech. In combat, you may only move diagonally. Despite this, you have advantage on saving throws against being Frightened." },
  { id: 3681, name: "Blind", tags: ["Passive"], score: -2, desc: "Your character is blind and permanently has the Blinded condition. However, you do not miss with basic attacks or abilities as long as you did not move last round, having learned to fight by sound and instinct." },
  { id: 3682, name: "Chatterbox", tags: ["Passive"], score: 3, desc: "You talk endlessly about things of no consequence. You are Immune to the Silenced condition. Whenever a creature attempts to Silence you, you gain a Bonus Action immediately." },
  { id: 3683, name: "Adopted", tags: ["Passive"], score: -3, desc: "You were raised by another race entirely. Draw three Backgrounds and choose one to replace your original Background. You must replace your original because your birth parents abandoned you." },
  { id: 3684, name: "Colossal", tags: ["Passive"], score: 5, desc: "You are enormous in height and build. You now occupy a Large creature space. Gnomes and Halflings gain all benefits of the Large size category while still appearing as a stout Dwarf in height." },
  { id: 3685, name: "Insane", tags: ["Passive"], score: 7, desc: "You are demented and twisted to your core. Whenever you roll a Critical Failure, you become Charmed by the nearest enemy creature until you take damage or fall below half hit points." },
  { id: 3686, name: "Criminal", tags: ["Passive"], score: -4, desc: "You have deep ties to criminal organisations across the realm. At character creation, gain 3 random treasures selected by the DM and add them to your inventory. You may sell them to other players at any price you name." },
  { id: 3687, name: "Deformed", tags: ["Passive"], score: 8, desc: "Your appearance is deeply unsettling due to a severe physical abnormality. You cannot be Charmed and are Immune to the Charmed condition. You also cannot benefit from Persuasion checks based on attraction." },
  { id: 3688, name: "Alpha", tags: ["Passive"], score: 3, desc: "You are a natural leader who commands respect in battle. At the start of combat, you may grant your entire party a Bonus Action on their first turn." },
  { id: 3689, name: "Beta", tags: ["Passive"], score: -3, desc: "You are a follower who lacks conviction. At character creation, you may not begin building your character until all other players have finished theirs." },
  { id: 3690, name: "Filthy", tags: ["Passive"], score: 10, desc: "You are perpetually unwashed and reek of decay. At the start of every round, all creatures adjacent to you must succeed on a Constitution saving throw (DC 12) or gain the Poisoned condition until the start of their next turn." },
  { id: 3691, name: "Melodick", tags: ["Passive"], score: -2, desc: "You express all passive aggression through unsolicited song. Whenever you are about to take damage, you may teleport an adjacent Ally into your space and have them take the damage instead, without their consent." },
  { id: 3692, name: "Creepy", tags: ["Passive"], score: -5, desc: "Others find your presence deeply unsettling. At character creation, gain 2 random Dark or Necromancy cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3693, name: "Daredevil", tags: ["Passive"], score: -3, desc: "You are recklessly fearless and throw yourself at danger. Once per campaign, you may declare your next used ability or attack an automatic Critical Hit before you roll." },
  { id: 3694, name: "Narcissistic", tags: ["Passive"], score: 2, desc: "You are obsessed with your own greatness and cannot bear watching others succeed. Whenever an Ally reduces an enemy to 0 hit points, you immediately gain a Bonus Action." },
  { id: 3695, name: "Devout", tags: ["Passive"], score: 1, desc: "You are a true and unwavering believer in the gods and divine powers. Once per campaign, you may choose to ignore one Critical Failure you roll or one Critical Hit you receive." },
  { id: 3696, name: "Romantic", tags: ["Passive"], score: -2, desc: "You are a hopeless romantic who falls deeply and completely. Once per campaign, you may cause a hostile creature to fall in love with you and become your Companion, until one of you dies." },
  { id: 3697, name: "Bookworm", tags: ["Passive"], score: -4, desc: "You are perpetually absorbed in tomes and scrolls. At character creation, gain 12 random spell scrolls selected by the DM and place them in a single inventory slot. You may only cast them in the order determined by the DM." },
  { id: 3698, name: "Alchemist", tags: ["Passive"], score: -1, desc: "You are somber and deeply sarcastic in conversation. At character creation, gain 8 random potions selected by the DM and add them to your inventory." },
  { id: 3699, name: "Famous", tags: ["Passive"], score: -3, desc: "Almost everyone in the realm knows your name. The Dungeon Master and other players may invent facts about your character's past at any time, and those facts become true." },
  { id: 3700, name: "Artistic", tags: ["Passive"], score: -5, desc: "You are deeply creative across many art forms, which is tragically useless in the life of an adventurer. The DM may call upon this talent at dramatically inopportune moments." },
  { id: 3701, name: "Hoarder", tags: ["Passive"], score: -6, desc: "You cannot resist collecting things, useful or otherwise. You cannot use Consumable items unless your own life is in immediate danger. Draw 4 random Consumables and add them to your inventory." },
  { id: 3702, name: "Liar", tags: ["Passive"], score: 1, desc: "You are a notorious deceiver who rarely tells the truth. At the end of character creation, remove one Ability from your character. You must claim to possess this ability for the entire campaign." },
  { id: 3703, name: "Gullible", tags: ["Passive"], score: 2, desc: "You will believe almost anything told to you. Your character has no critical thinking skills whatsoever and never questions information given to them by any source." },
  { id: 3704, name: "Greedy", tags: ["Passive"], score: -3, desc: "You care only for gold and treasure above all else. At the end of character creation you must have at least 200 gold remaining or this Attribute becomes Doomed. You start with an additional 200 gold." },
  { id: 3705, name: "Nature Warden", tags: ["Passive"], score: 4, desc: "You are one with nature and care deeply for all living things. At character creation, gain 2 random Druid or Earth cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3706, name: "Pyromaniac", tags: ["Passive"], score: -5, desc: "You are obsessed with fire in a way that makes others uncomfortable. At character creation, gain 2 random Fire cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3707, name: "Ancient", tags: ["Passive"], score: -10, desc: "You have lived since the age of the world's hatching and have witnessed all of recorded history. Gain the Elf ancestry change as determined by the DM. You are now an Elf but gain the benefits of both ancestry cards." },
  { id: 3708, name: "Follower of the Light", tags: ["Passive"], score: 5, desc: "You are a devoted servant of a god of light and radiance. At character creation, add the Divine Favor spell to your character. You may cast it once per long rest without expending a spell slot." },
  { id: 3709, name: "Sigil of Flame", tags: ["Passive"], score: 5, desc: "You carry the brand of a god of fire and destruction. Your basic attacks deal triple damage instead of double on a Critical Hit." },
  { id: 3710, name: "Child of Rokesh", tags: ["Passive"], score: 5, desc: "You are blessed by a god of tenacity and brotherhood. While all other party members are alive and conscious, you are Immune to Death Saving Throws and cannot be reduced below 1 HP." },
  { id: 3711, name: "Frostborn", tags: ["Passive"], score: 5, desc: "You carry the blessing of a god of ice and stillness. High rolls (15+) on basic attack rolls cause the target to be Restrained by ice until the start of their next turn." },
  { id: 3712, name: "Seeker of Knowledge", tags: ["Passive"], score: 5, desc: "You are devoted to a god of arcane secrets and forbidden lore. At character creation, gain 1 random Legendary Spell Scroll selected by the DM and add it to your inventory." },
  { id: 3713, name: "Herald of Bones", tags: ["Passive"], score: 5, desc: "You serve a god of death and undeath. Whenever you score a Critical Hit against a target, that target must immediately make a Death Saving Throw." },
  { id: 3714, name: "Heart of Gold", tags: ["Passive"], score: 5, desc: "You are genuinely, unconditionally generous. At character creation, receive 300 extra gold. You must distribute all of it to other players however you choose. You may keep none of it." },
  { id: 3715, name: "Coward", tags: ["Passive"], score: -1, desc: "You are deeply afraid of violence and conflict. You cannot attack any creature that attacked you during the previous round." },
  { id: 3716, name: "Lucky", tags: ["Passive"], score: 7, desc: "Fortune favours you more than most. You now score a Critical Hit on any High Roll (18, 19, or 20)." },
  { id: 3717, name: "Unlucky", tags: ["Passive"], score: -7, desc: "Nothing ever seems to go your way. You now suffer a Critical Failure on any Low Roll (1, 2, or 3)." },
  { id: 3718, name: "Illiterate", tags: ["Passive"], score: -2, desc: "You cannot read. You are unable to use Spell Scrolls or decipher any written text. The rest of this card is unreadable to you: ajdsid ale kfsdlkw jsiuw sslshw ksjwla lianra lair fsdm." },
  { id: 3719, name: "Narcoleptic", tags: ["Passive"], score: 3, desc: "You are prone to sudden, uncontrollable sleep. At the start of every round, roll a d20. On a roll of 5 or lower, you are Stunned for the remainder of that round." },
  { id: 3720, name: "Honorable", tags: ["Passive"], score: 4, desc: "You seek justice and fairness even against your enemies. You cannot attack any creature that is not aware of your presence or is not facing you." },
  { id: 3721, name: "Well Endowed", tags: ["Passive"], score: 10, desc: "Your defining physical characteristics are remarkably large and pronounced. No further mechanical benefit is required from a card such as this." },
  { id: 3722, name: "Emo", tags: ["Passive"], score: 1, desc: "You are burdened by a deep melancholy and believe life holds little joy. Gain 200 gold, 2 random cantrips or 1st-level spells, 1 random treasure, and 1 random companion selected by the DM — thanks to the privilege you refuse to acknowledge." },
  { id: 2844, name: "Demonic Possession", tags: ["Legendary","Cursed","Passive"], score: 0, desc: "A demon shares your body. Each turn roll a d20 — on a 5 or lower the demon seizes control. While possessed, the demon uses Pyromancer spells (Fireball, Heat Wave, Lava Pool). The demon may use your class abilities, but doing so costs you 5 HP and requires a DC 13 Wisdom saving throw to regain control." },
  { id: 3016, name: "Ironclad Arm", tags: ["Armor"], score: 10, desc: "When you were young you lost your arm and had it replaced by a mechanical construct. Your unarmed strikes deal at least 5 damage. This arm can be damaged by Critical Failures and must be repaired by a skilled artisan." },
  { id: 3018, name: "Bloodthirsty", tags: ["Cursed"], score: 5, desc: "You are always seeking battle and revel in carnage. The sight of blood fills you with savage energy. Whenever any creature (ally or enemy) takes damage that causes bleeding, you regain 1 HP." },
];

type CharacterLike = {
  id: string;
  name: string;
  isActive?: boolean;
};

type AttributeAssignment = {
  id: string;
  campaign_id: string;
  character_id: string;
  card_id: number;
};

type VisibilityRow = {
  campaign_id: string;
  card_id: number;
  is_visible: boolean;
};

type VetoRow = {
  campaign_id: string;
  character_id: string;
  used: boolean;
};

const TAG_COLORS: Record<string, string> = {
  Cursed: "#8B0000",
  Passive: "#2d4a2d",
  Legendary: "#7B5800",
  Armor: "#1a3a5c",
};

function scoreColor(score: number) {
  if (score > 5) return "#4caf7a";
  if (score > 0) return "#9acd7a";
  if (score === 0) return "#aaa";
  if (score > -5) return "#e09050";
  return "#e05050";
}

function isCardVisible(cardId: number, visibility: Record<number, boolean>) {
  return visibility[cardId] !== false;
}

function Card({
  card,
  hidden,
  selected,
  onClick,
  compact,
}: {
  card: AttributeCardData;
  hidden?: boolean;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 transition ${onClick ? "cursor-pointer hover:-translate-y-1" : ""}`}
      style={{
        background: "linear-gradient(160deg, #1c1408 0%, #221a08 60%, #1a1205 100%)",
        border: selected ? "2px solid #d4a843" : "1px solid rgba(200,160,60,0.45)",
        opacity: hidden ? 0.35 : 1,
        boxShadow: selected
          ? "0 0 18px rgba(212,168,67,0.5), inset 0 0 30px rgba(0,0,0,0.4)"
          : "0 2px 12px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)",
        minHeight: compact ? 130 : 175,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
          style={{ borderColor: scoreColor(card.score), color: scoreColor(card.score), background: "rgba(0,0,0,0.65)" }}
        >
          {card.score > 0 ? `+${card.score}` : card.score}
        </div>
        <div className="min-w-0 flex-1 text-center font-serif text-lg font-bold text-[#e8d09a]">
          {card.name}
        </div>
      </div>

      <div className="my-2 h-px bg-gradient-to-r from-transparent via-[#9a7b45] to-transparent" />

      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: TAG_COLORS[tag] || "#333", color: "#e8d5a3", borderColor: "rgba(200,170,100,0.3)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {!compact && <p className="text-sm leading-relaxed text-[#c8b888]">{card.desc}</p>}
      {hidden && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#e09050]">Hidden from players</p>}
    </div>
  );
}

export default function AttributeCardsPanel({
  campaignId,
  characters,
  adminUnlocked,
}: {
  campaignId: string;
  characters: CharacterLike[];
  adminUnlocked: boolean;
}) {
  const [subTab, setSubTab] = useState<"browse" | "draw" | "characters">("browse");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("All");
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});
  const [assignments, setAssignments] = useState<AttributeAssignment[]>([]);
  const [vetoRows, setVetoRows] = useState<VetoRow[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [drawPool, setDrawPool] = useState<AttributeCardData[]>([]);
  const [manualAssignCharacterId, setManualAssignCharacterId] = useState("");
  const [manualAssignCardId, setManualAssignCardId] = useState("");
  const [message, setMessage] = useState("");

  const activeCharacters = useMemo(
    () => characters.filter((character) => adminUnlocked || character.isActive !== false),
    [characters, adminUnlocked]
  );

  useEffect(() => {
    if (!selectedCharacterId && activeCharacters[0]?.id) {
      setSelectedCharacterId(activeCharacters[0].id);
    }
    if (!manualAssignCharacterId && activeCharacters[0]?.id) {
      setManualAssignCharacterId(activeCharacters[0].id);
    }
  }, [activeCharacters, selectedCharacterId, manualAssignCharacterId]);

  async function loadAttributeData() {
    if (!campaignId) return;

    const [
      { data: visibilityRows, error: visibilityError },
      { data: assignmentRows, error: assignmentError },
      { data: vetoData, error: vetoError },
    ] = await Promise.all([
      supabase.from("campaign_attribute_visibility").select("campaign_id, card_id, is_visible").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attributes").select("id, campaign_id, character_id, card_id").eq("campaign_id", campaignId),
      supabase.from("campaign_character_attribute_vetoes").select("campaign_id, character_id, used").eq("campaign_id", campaignId),
    ]);

    if (visibilityError || assignmentError || vetoError) {
      setMessage(visibilityError?.message || assignmentError?.message || vetoError?.message || "Failed to load attributes.");
      return;
    }

    const nextVisibility: Record<number, boolean> = {};
    (visibilityRows as VisibilityRow[] | null)?.forEach((row) => {
      nextVisibility[row.card_id] = row.is_visible;
    });

    setVisibility(nextVisibility);
    setAssignments((assignmentRows as AttributeAssignment[] | null) || []);
    setVetoRows((vetoData as VetoRow[] | null) || []);
  }

  useEffect(() => {
    loadAttributeData();

    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-attributes-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_attribute_visibility", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attributes", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_character_attribute_vetoes", filter: `campaign_id=eq.${campaignId}` }, loadAttributeData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const allTags = useMemo(() => ["All", ...Array.from(new Set(ATTRIBUTE_CARDS.flatMap((card) => card.tags))).sort()], []);

  const visibleCards = useMemo(
    () => ATTRIBUTE_CARDS.filter((card) => adminUnlocked || isCardVisible(card.id, visibility)),
    [visibility, adminUnlocked]
  );

  const filteredCards = visibleCards.filter((card) => {
    const matchesSearch = `${card.name} ${card.desc}`.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tag === "All" || card.tags.includes(tag);
    return matchesSearch && matchesTag;
  });

  function characterCards(characterId: string, includeHidden = adminUnlocked) {
    const ids = assignments.filter((assignment) => assignment.character_id === characterId).map((assignment) => assignment.card_id);
    return ids
      .map((id) => ATTRIBUTE_CARDS.find((card) => card.id === id))
      .filter((card): card is AttributeCardData => Boolean(card))
      .filter((card) => includeHidden || isCardVisible(card.id, visibility));
  }

  async function toggleVisibility(card: AttributeCardData) {
    if (!adminUnlocked || !campaignId) return;

    const next = !isCardVisible(card.id, visibility);
    setVisibility((current) => ({ ...current, [card.id]: next }));

    const { error } = await supabase.from("campaign_attribute_visibility").upsert(
      {
        campaign_id: campaignId,
        card_id: card.id,
        is_visible: next,
      },
      { onConflict: "campaign_id,card_id" }
    );

    if (error) {
      setMessage(error.message);
      loadAttributeData();
    }
  }

  function hasVetoUsed(characterId: string) {
    return vetoRows.some((row) => row.character_id === characterId && row.used);
  }

  function drawOne(excludeCardIds: number[] = []) {
    setMessage("");
    if (!selectedCharacterId) {
      setMessage("Choose a character first.");
      return;
    }

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId).map((assignment) => assignment.card_id);
    if (owned.length >= 2) {
      setMessage("This character already has the maximum of 2 attribute cards.");
      setDrawPool([]);
      return;
    }

    const pool = ATTRIBUTE_CARDS.filter(
      (card) =>
        isCardVisible(card.id, visibility) &&
        !owned.includes(card.id) &&
        !excludeCardIds.includes(card.id)
    );

    if (pool.length === 0) {
      setMessage("No visible attribute cards are available to draw.");
      setDrawPool([]);
      return;
    }

    const drawn = pool[Math.floor(Math.random() * pool.length)];
    setDrawPool([drawn]);
  }

  async function vetoDrawnCard() {
    if (!campaignId || !selectedCharacterId || drawPool.length === 0) return;

    if (hasVetoUsed(selectedCharacterId)) {
      setMessage("This character has already used their one attribute veto.");
      return;
    }

    const vetoedCardId = drawPool[0].id;

    const { error } = await supabase.from("campaign_character_attribute_vetoes").upsert(
      {
        campaign_id: campaignId,
        character_id: selectedCharacterId,
        used: true,
      },
      { onConflict: "campaign_id,character_id" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setVetoRows((current) => [
      ...current.filter((row) => row.character_id !== selectedCharacterId),
      { campaign_id: campaignId, character_id: selectedCharacterId, used: true },
    ]);

    drawOne([vetoedCardId]);
  }

  async function assignCard(card: AttributeCardData) {
    if (!campaignId || !selectedCharacterId) return;

    const owned = assignments.filter((assignment) => assignment.character_id === selectedCharacterId);
    if (owned.length >= 2) {
      setMessage("This character already has the maximum of 2 attribute cards.");
      return;
    }

    if (owned.some((assignment) => assignment.card_id === card.id)) {
      setMessage("That character already has this attribute.");
      return;
    }

    const { error } = await supabase.from("campaign_character_attributes").insert({
      campaign_id: campaignId,
      character_id: selectedCharacterId,
      card_id: card.id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${card.name} assigned.`);
    setDrawPool([]);
    loadAttributeData();
  }

  async function assignSpecificCard() {
    if (!adminUnlocked || !campaignId || !manualAssignCharacterId || !manualAssignCardId) return;

    const cardId = Number(manualAssignCardId);
    const card = ATTRIBUTE_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
      setMessage("Choose an attribute card first.");
      return;
    }

    const owned = assignments.filter((assignment) => assignment.character_id === manualAssignCharacterId);
    if (owned.length >= 2) {
      setMessage("That character already has the maximum of 2 attribute cards.");
      return;
    }

    if (owned.some((assignment) => assignment.card_id === cardId)) {
      setMessage("That character already has this attribute.");
      return;
    }

    const { error } = await supabase.from("campaign_character_attributes").insert({
      campaign_id: campaignId,
      character_id: manualAssignCharacterId,
      card_id: cardId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setManualAssignCardId("");
    setMessage(`${card.name} assigned by GM.`);
    loadAttributeData();
  }

  async function removeAssignment(characterId: string, cardId: number) {
    if (!adminUnlocked) return;

    const { error } = await supabase
      .from("campaign_character_attributes")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .eq("card_id", cardId);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadAttributeData();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#9a7b45] bg-[#ead6ad] p-4 text-[#251b10] shadow-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold">Attributes</h2>
            <p className="text-sm">Browse attributes, draw one visible card at a time, and track up to 2 cards per character. Each character has one veto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["browse", "draw", "characters"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSubTab(tab)}
                className={`rounded-lg border px-3 py-2 font-serif text-sm capitalize ${subTab === tab ? "bg-[#251b10] text-[#fff0c7] border-[#251b10]" : "bg-[#fff0c7] text-[#251b10] border-[#9a7b45]"}`}
              >
                {tab === "characters" ? "Character Cards" : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-3 text-[#251b10]">{message}</div>}

      {subTab === "browse" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10] md:flex-row">
            <input
              className="min-w-0 flex-1 rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
              placeholder="Search attribute cards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2" value={tag} onChange={(event) => setTag(event.target.value)}>
              {allTags.map((tagName) => <option key={tagName} value={tagName}>{tagName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => {
              const hidden = !isCardVisible(card.id, visibility);
              return (
                <div key={card.id} className="relative">
                  <Card card={card} hidden={hidden} />
                  {adminUnlocked && (
                    <button
                      onClick={() => toggleVisibility(card)}
                      className={`absolute bottom-2 right-2 rounded border px-2 py-1 text-xs font-bold ${hidden ? "bg-[#5b1f1f] text-[#fff0c7]" : "bg-[#1f4d2e] text-[#fff0c7]"}`}
                    >
                      {hidden ? "Hidden" : "Visible"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === "draw" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
            <label className="block space-y-1">
              <strong>Character</strong>
              <select className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2" value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
                {activeCharacters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name} ({characterCards(character.id).length}/2)</option>
                ))}
              </select>
            </label>
            <button onClick={() => drawOne()} className="mt-3 rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
              Draw 1 Visible Card
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {drawPool.map((card) => (
              <div key={card.id} className="space-y-3">
                <Card card={card} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => assignCard(card)} className="rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
                    Keep Attribute
                  </button>
                  <button
                    onClick={vetoDrawnCard}
                    disabled={hasVetoUsed(selectedCharacterId)}
                    className="rounded bg-[#7a3f00] px-4 py-2 font-serif text-[#fff0c7] disabled:opacity-50"
                  >
                    Veto & Draw Again
                  </button>
                </div>
                <p className="text-sm text-[#251b10]">
                  Veto: {hasVetoUsed(selectedCharacterId) ? "Used" : "Available"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "characters" && (
        <div className="space-y-4">
          {adminUnlocked && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
              <h3 className="mb-3 text-xl font-bold">GM: Assign Attribute</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select
                  className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
                  value={manualAssignCharacterId}
                  onChange={(event) => setManualAssignCharacterId(event.target.value)}
                >
                  {activeCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} ({characterCards(character.id, true).length}/2)
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
                  value={manualAssignCardId}
                  onChange={(event) => setManualAssignCardId(event.target.value)}
                >
                  <option value="">Choose attribute...</option>
                  {ATTRIBUTE_CARDS.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} {isCardVisible(card.id, visibility) ? "" : "(hidden)"}
                    </option>
                  ))}
                </select>
                <button onClick={assignSpecificCard} className="rounded bg-[#4b3115] px-4 py-2 font-serif text-[#fff0c7]">
                  Assign
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activeCharacters.map((character) => {
            const cards = characterCards(character.id, adminUnlocked);
            return (
              <div key={character.id} className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
                <h3 className="mb-3 text-xl font-bold">{character.name} <span className="text-sm font-normal">({cards.length}/2)</span></h3>
                {cards.length === 0 ? (
                  <p className="text-sm italic">No attributes assigned.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {cards.map((card) => {
                      const hidden = !isCardVisible(card.id, visibility);
                      return (
                        <div key={card.id} className="relative">
                          <Card card={card} hidden={hidden} compact />
                          {adminUnlocked && (
                            <button
                              onClick={() => removeAssignment(character.id, card.id)}
                              className="absolute bottom-2 right-2 rounded bg-[#5b1f1f] px-2 py-1 text-xs text-[#fff0c7]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
