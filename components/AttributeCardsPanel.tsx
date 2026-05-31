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
  { id: 1183, name: "Ageless", tags: ["Cursed","Passive","Undead"], score: -10, desc: "You do not require air, food, or water. You do not age and cannot die from old age. You are considered an Undead creature for the purposes of spells and effects. Your consciousness is anchored within your skull. Destruction of your body does not kill you, provided your skull remains intact. However, you may still be reduced to 0 HP, incapacitated, restrained, or otherwise defeated normally. Perfect Disguise: Your undead nature is hidden beneath a flawless recreation of your former living appearance. You appear alive in every way, including skin tone, breathing, heartbeat, body temperature, scent, and other natural biological functions. This disguise cannot be detected through ordinary observation, medicine checks, or most magical means. However, members of the Order of the Undying Vigil and exceptionally powerful members of other faiths may perceive the truth of your condition at the DM's discretion. You may alter minor cosmetic details of your appearance during a Long Rest, but must retain your general identity and recognizable features." },
  { id: 1184, name: "Valkyrie", tags: ["Cursed","Passive","Basic"], score: 8, desc: "Your character must be female. You have wings which grant you a fly speed of 30 ft. while falling, you may glide and take no fall damage." },
  { id: 1185, name: "Lycanthrope", tags: ["Cursed","Passive","DM Granted","Basic"], score: 4, desc: "Gain 3 random beast companion options selected by the DM and choose one. At midnight, while outside under the moon, or upon taking a Critical Hit, you shapeshift into your Beast form and gain access to its abilities. Your HP does not change and you retain access to your other abilities." },
  { id: 1186, name: "Medusa", tags: ["Cursed","Passive","Basic"], score: -4, desc: "You can attempt to dominate the minds of others with your gaze. On a Critical Hit, the target must succeed on a Wisdom saving throw (DC 15) or become your Charmed Companion for life." },
  { id: 1187, name: "Vampire", tags: ["Cursed","Passive","Basic"], score: 5, desc: "You are in constant search for your soulmate. You have advantage on Insight and Perception checks to see through disguises and detect lies." },
  // Season 3 cards (definitive versions)
  { id: 3661, name: "Strong", tags: ["Passive","Basic"], score: 5, desc: "Your character has powerful muscles and is naturally athletic. Your melee attacks deal an extra 5 damage." },
  { id: 3662, name: "Believer", tags: ["Passive","Basic"], score: 3, desc: "You are not who you believe you are — you are instead living out the story of someone else entirely. You lack the ability of self-awareness and cannot be convinced otherwise." },
  { id: 3663, name: "Intelligent", tags: ["Passive","Basic"], score: -3, desc: "You have studied the arcane arts extensively. Choose one spell of 3rd level or lower. You may cast this spell once per Long Rest without expending a spell slot. The spell is cast at 3rd level when applicable. Intelligence is your spellcasting ability for this spell." },
  { id: 3664, name: "Quick", tags: ["Passive","Basic"], score: 1, desc: "You speak quickly and move even quicker. You can move up to 10 additional spaces (50 ft.) using your Movement Action each turn." },
  { id: 3665, name: "Eccentric", tags: ["Passive","Basic"], score: -8, desc: "You speak with a posh accent and come from considerable wealth. You have 500 extra gold to spend at character creation, but you have disadvantage on Constitution saving throws and suffer terribly from emotional distress." },
  { id: 3666, name: "Charismatic", tags: ["Passive","Basic"], score: 4, desc: "You are irresistibly attractive to races and genders of your choosing. Outside of combat, you may attempt to beguile any NPC into becoming your Companion with a Charisma (Persuasion) check. You must have the appropriate Companion slot available." },
  { id: 3667, name: "Durable", tags: ["Passive","Basic"], score: 10, desc: "You never cut or shave your hair. Your Armor Class, regardless of whether you wear armor or not, always grants at least 40 temporary hit points at the start of each long rest." },
  { id: 3668, name: "Psychic", tags: ["Passive","Basic"], score: -8, desc: "You can read the minds of others. The Dungeon Master must reveal the surface thoughts of any creature on the battlefield whenever you ask for them as a bonus action." },
  { id: 3669, name: "Seadog", tags: ["Passive","Basic"], score: 8, desc: "You are a natural sailor who longs for the waves. You have a swim speed equal to your walking speed and automatically succeed on Athletics checks to swim or dive." },
  { id: 3670, name: "Cursed", tags: ["Passive","Basic"], score: -4, desc: "You are deeply superstitious and paranoid of others. Whenever another party member makes a Death Saving Throw, you immediately take 50 damage." },
  { id: 3671, name: "Beastmaster", tags: ["Passive","Basic"], score: 5, desc: "You have a deep bond with animals and are a gifted handler of wild creatures. Once per campaign, you may permanently charm a Beast creature to become your Companion without a roll." },
  { id: 3672, name: "Doomed", tags: ["Passive","Basic"], score: -10, desc: "Death calls to your character. Whenever you roll a Critical Failure (natural 1), you must immediately make a Death Saving Throw." },
  { id: 3673, name: "Klutz", tags: ["Passive","Basic"], score: -3, desc: "You are dangerously clumsy and your allies know it. Whenever you roll a Critical Hit (natural 20), roll 3 additional d20s. If any of them are a natural 1, the action becomes a Critical Failure instead." },
  { id: 3674, name: "Overweight", tags: ["Passive","Basic"], score: 3, desc: "You are portly and sluggish in battle. Your movement speed is reduced to 15 ft. and you may only move up to 3 spaces with your Movement Action." },
  { id: 3675, name: "Halfwit", tags: ["Passive","Basic"], score: 7, desc: "You are easily fooled and blissfully dim. The Dungeon Master may veto any action in combat that would be too tactically clever for your character, at their discretion." },
  { id: 3676, name: "Peasant", tags: ["Passive","DM Granted","Basic"], score: 10, desc: "You are untrained in weapons and magic, having lived a humble commoner's life until now. Replace your Class with the Peasant Class, which has no purchasable items or abilities. Gain 8 random companion abilities selected by the DM instead." },
  { id: 3677, name: "Patient", tags: ["Passive","Basic"], score: 1, desc: "You remain calm and composed even in the most chaotic situations. Once per campaign, you may restore all expended Reactions and bonus actions in a single turn." },
  { id: 3678, name: "Blasphemous", tags: ["Passive","Basic"], score: -3, desc: "You do not believe in gods, divine beings, or draconic patrons. You cannot cast spells of the Divination or Evocation schools, nor any spell with the Divine descriptor." },
  { id: 3679, name: "Cackling", tags: ["Passive","Basic"], score: -4, desc: "You possess an unmistakably villainous laugh that you deploy constantly. Whenever you suffer the effects of a Critical Failure, you may force one willing or unwilling Ally to take the consequences in your place." },
  { id: 3680, name: "Drunk", tags: ["Passive","Basic"], score: -1, desc: "Your character is perpetually intoxicated and slurs their speech. In combat, you may only move diagonally. Despite this, you have advantage on saving throws against being Frightened." },
  { id: 3681, name: "Blind", tags: ["Passive","Basic"], score: -2, desc: "Your character is blind and permanently has the Blinded condition. However, you do not miss with basic attacks or abilities as long as you did not move last round, having learned to fight by sound and instinct." },
  { id: 3682, name: "Chatterbox", tags: ["Passive","Basic"], score: 3, desc: "You talk endlessly about things of no consequence. You are Immune to the Silenced condition. Whenever a creature attempts to Silence you, you gain a Bonus Action immediately." },
  { id: 3683, name: "Adopted", tags: ["Passive","DM Granted","Basic"], score: -3, desc: "You were raised by another race entirely. Get a background assigned by the DM to replace your original Background." },
  { id: 3684, name: "Colossal", tags: ["Passive","Basic"], score: 5, desc: "You are enormous in height and build. You now occupy a Large creature space. Gnomes and Halflings gain all benefits of the Large size category while still appearing as a stout Dwarf in height." },
  { id: 3685, name: "Insane", tags: ["Passive","Basic"], score: 7, desc: "You are demented and twisted to your core. Whenever you roll a Critical Failure, you become Charmed by the nearest enemy creature until you take damage or fall below half hit points." },
  { id: 3686, name: "Criminal", tags: ["Passive","DM Granted","Basic"], score: -4, desc: "You have deep ties to criminal organisations across the realm. At character creation, gain 3 random treasures selected by the DM and add them to your inventory. You may sell them to other players at any price you name." },
  { id: 3687, name: "Deformed", tags: ["Passive","Basic"], score: 8, desc: "Your appearance is deeply unsettling due to a severe physical abnormality. You cannot be Charmed and are Immune to the Charmed condition. You also cannot benefit from Persuasion checks based on attraction." },
  { id: 3688, name: "Alpha", tags: ["Passive","Basic"], score: 3, desc: "You are a natural leader who commands respect in battle. At the start of combat, you may grant your entire party a Bonus Action on their first turn." },
  { id: 3689, name: "Beta", tags: ["Passive","Basic"], score: -3, desc: "You are a follower who lacks conviction. At character creation, you may not begin building your character until all other players have finished theirs." },
  { id: 3690, name: "Filthy", tags: ["Passive","Basic"], score: 10, desc: "You are perpetually unwashed and reek of decay. At the start of every round, all creatures adjacent to you must succeed on a Constitution saving throw (DC 12) or gain the Poisoned condition until the start of their next turn." },
  { id: 3691, name: "Melodick", tags: ["Passive","Basic"], score: -2, desc: "You express all passive aggression through unsolicited song. Whenever you are about to take damage, you may teleport an adjacent Ally into your space and have them take the damage instead, without their consent." },
  { id: 3692, name: "Creepy", tags: ["Passive","DM Granted","Basic"], score: -5, desc: "Others find your presence deeply unsettling. At character creation, gain 2 random Dark or Necromancy cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3693, name: "Daredevil", tags: ["Passive","Basic"], score: -3, desc: "You are recklessly fearless and throw yourself at danger. Once per campaign, you may declare your next used ability or attack an automatic Critical Hit before you roll." },
  { id: 3694, name: "Narcissistic", tags: ["Passive","Basic"], score: 2, desc: "You are obsessed with your own greatness and cannot bear watching others succeed. Whenever an Ally reduces an enemy to 0 hit points, you immediately gain a Bonus Action." },
  { id: 3695, name: "Devout", tags: ["Passive","Basic"], score: 1, desc: "You are a true and unwavering believer in the gods and divine powers. Once per campaign, you may choose to ignore one Critical Failure you roll or one Critical Hit you receive." },
  { id: 3696, name: "Romantic", tags: ["Passive","Basic"], score: -2, desc: "You are a hopeless romantic who falls deeply and completely. Once per campaign, you may cause a hostile creature to fall in love with you and become your Companion, until one of you dies." },
  { id: 3697, name: "Bookworm", tags: ["Passive","DM Granted","Basic"], score: -4, desc: "You are perpetually absorbed in tomes and scrolls. At character creation, gain 12 random spell scrolls selected by the DM and place them in a single inventory slot. You may only cast them in the order determined by the DM." },
  { id: 3698, name: "Alchemist", tags: ["Passive","DM Granted","Basic"], score: -1, desc: "You are somber and deeply sarcastic in conversation. At character creation, gain 8 random potions selected by the DM and add them to your inventory." },
  { id: 3699, name: "Famous", tags: ["Passive","Basic"], score: -3, desc: "Almost everyone in the realm knows your name. The Dungeon Master and other players may invent facts about your character's past at any time, and those facts become true." },
  { id: 3700, name: "Artistic", tags: ["Passive","Basic"], score: -5, desc: "You are deeply creative across many art forms, which is tragically useless in the life of an adventurer. The DM may call upon this talent at dramatically inopportune moments." },
  { id: 3701, name: "Hoarder", tags: ["Passive","Basic"], score: -6, desc: "You cannot resist collecting things, useful or otherwise. You cannot use Consumable items unless your own life is in immediate danger. Gain 4 random consumables selected by the DM and add them to your inventory." },
  { id: 3702, name: "Liar", tags: ["Passive","Basic"], score: 1, desc: "You are a notorious deceiver who rarely tells the truth. At the end of character creation, remove one Ability from your character. You must claim to possess this ability for the entire campaign." },
  { id: 3703, name: "Gullible", tags: ["Passive","Basic"], score: 2, desc: "You will believe almost anything told to you. Your character has no critical thinking skills whatsoever and never questions information given to them by any source." },
  { id: 3704, name: "Greedy", tags: ["Passive","Basic"], score: -3, desc: "You care only for gold and treasure above all else. At the end of character creation you must have at least 200 gold remaining or this Attribute becomes Doomed. You start with an additional 200 gold." },
  { id: 3705, name: "Nature Warden", tags: ["Passive","DM Granted","Basic"], score: 4, desc: "You are one with nature and care deeply for all living things. At character creation, gain 2 random Druid or Earth cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3706, name: "Pyromaniac", tags: ["Passive","DM Granted","Basic"], score: -5, desc: "You are obsessed with fire in a way that makes others uncomfortable. At character creation, gain 2 random Fire cantrips or 1st-level spells selected by the DM. Each spell may be cast once per Long Rest without expending a spell slot." },
  { id: 3707, name: "Ancient", tags: ["Passive","Basic"], score: -10, desc: "You have lived since the age of the world's hatching and have witnessed all of recorded history. Gain the Elf ancestry change as determined by the DM. You are now an Elf but gain the benefits of both ancestry cards." },
  { id: 3708, name: "Follower of the Light", tags: ["Passive","Basic"], score: 5, desc: "You are a devoted servant of a god of light and radiance. At character creation, add the Divine Favor spell to your character. You may cast it once per long rest without expending a spell slot." },
  { id: 3709, name: "Sigil of Flame", tags: ["Passive","Basic"], score: 5, desc: "You carry the brand of a god of fire and destruction. Your basic attacks deal triple damage instead of double on a Critical Hit." },
  { id: 3710, name: "Child of Rokesh", tags: ["Passive","Basic"], score: 5, desc: "You are blessed by a god of tenacity and brotherhood. While all other party members are alive and conscious, you are Immune to Death Saving Throws and cannot be reduced below 1 HP." },
  { id: 3711, name: "Frostborn", tags: ["Passive","Basic"], score: 5, desc: "You carry the blessing of a god of ice and stillness. High rolls (15+) on basic attack rolls cause the target to be Restrained by ice until the start of their next turn." },
  { id: 3712, name: "Seeker of Knowledge", tags: ["Passive","DM Granted","Basic"], score: 5, desc: "You are devoted to a god of arcane secrets and forbidden lore. At character creation, gain 1 random Legendary Spell Scroll selected by the DM and add it to your inventory." },
  { id: 3713, name: "Herald of Bones", tags: ["Passive","Basic"], score: 5, desc: "You serve a god of death and undeath. Whenever you score a Critical Hit against a target, that target must immediately make a Death Saving Throw." },
  { id: 3714, name: "Heart of Gold", tags: ["Passive","Basic"], score: 5, desc: "You are genuinely, unconditionally generous. At character creation, receive 300 extra gold. You must distribute all of it to other players however you choose. You may keep none of it." },
  { id: 3715, name: "Coward", tags: ["Passive","Basic"], score: -1, desc: "You are deeply afraid of violence and conflict. You cannot attack any creature that attacked you during the previous round." },
  { id: 3716, name: "Lucky", tags: ["Passive","Basic"], score: 7, desc: "Fortune favours you more than most. You now score a Critical Hit on any High Roll (18, 19, or 20)." },
  { id: 3717, name: "Unlucky", tags: ["Passive","Basic"], score: -7, desc: "Nothing ever seems to go your way. You now suffer a Critical Failure on any Low Roll (1, 2, or 3)." },
  { id: 3718, name: "Illiterate", tags: ["Passive","Basic"], score: -2, desc: "You cannot read. You are unable to use Spell Scrolls or decipher any written text. The rest of this card is unreadable to you: ajdsid ale kfsdlkw jsiuw sslshw ksjwla lianra lair fsdm." },
  { id: 3719, name: "Narcoleptic", tags: ["Passive","Basic"], score: 3, desc: "You are prone to sudden, uncontrollable sleep. At the start of every round, roll a d20. On a roll of 5 or lower, you are Stunned for the remainder of that round." },
  { id: 3720, name: "Honorable", tags: ["Passive","Basic"], score: 4, desc: "You seek justice and fairness even against your enemies. You cannot attack any creature that is not aware of your presence or is not facing you." },
  { id: 3721, name: "Well Endowed", tags: ["Passive","Basic"], score: 10, desc: "Your defining physical characteristics are remarkably large and pronounced. No further mechanical benefit is required from a card such as this." },
  { id: 3722, name: "Emo", tags: ["Passive","DM Granted","Basic"], score: 1, desc: "You are burdened by a deep melancholy and believe life holds little joy. Gain 200 gold, 2 random cantrips or 1st-level spells, 1 random treasure, and 1 random companion selected by the DM — thanks to the privilege you refuse to acknowledge." },
  { id: 2844, name: "Demonic Possession", tags: ["Legendary","Cursed","Passive"], score: 0, desc: "A demon shares your body. Each turn roll a d20 — on a 5 or lower the demon seizes control. While possessed, the demon uses Pyromancer spells (Fireball, Heat Wave, Lava Pool). The demon may use your class abilities, but doing so costs you 5 HP and requires a DC 13 Wisdom saving throw to regain control." },
  { id: 3016, name: "Ironclad Arm", tags: ["Armor","Basic"], score: 10, desc: "When you were young you lost your arm and had it replaced by a mechanical construct. Your unarmed strikes deal at least 5 damage. This arm can be damaged by Critical Failures and must be repaired by a skilled artisan." },
  { id: 3018, name: "Bloodthirsty", tags: ["Cursed","Basic"], score: 5, desc: "You are always seeking battle and revel in carnage. The sight of blood fills you with savage energy. Whenever any creature (ally or enemy) takes damage that causes bleeding, you regain 1 HP." },
  // Custom campaign attribute cards
  { id: 5001, name: "Giant", tags: ["Passive","Basic"], score: 10, desc: "You were born unnaturally large for your species. Your melee attacks deal an extra 4 damage and your character is one size category larger than normal for your species." },
  { id: 5002, name: "Arcane-Touched", tags: ["Passive","Basic"], score: 3, desc: "Magic seems drawn to you. Choose one cantrip from any spell list. You may cast it at will. Intelligence, Wisdom, or Charisma (your choice) is your spellcasting ability for this spell." },
  { id: 5003, name: "Stormborn", tags: ["Passive","Basic"], score: 4, desc: "Lightning refuses to harm you. You have Resistance to Lightning damage. Once per Long Rest, when you take Lightning damage, you may instead take no damage and regain HP equal to your proficiency bonus." },
  { id: 5004, name: "Herbalist", tags: ["Passive", "DM Granted","Basic"], score: 2, desc: "You have extensive knowledge of plants and natural remedies. At the end of each Long Rest, gain 1 random common potion selected by the DM." },
  { id: 5005, name: "Lucky Find", tags: ["Passive", "DM Granted","Basic"], score: 2, desc: "Fortune smiles upon you. At the start of each adventure or dungeon, gain 1 random common treasure selected by the DM." },
  { id: 5006, name: "Duelist", tags: ["Passive","Basic"], score: 3, desc: "You thrive in single combat. Once per Long Rest, when attacking a creature with no allies within 5 feet of it, you may gain Advantage on the attack roll." },
  { id: 5007, name: "Silver Tongue", tags: ["Passive","Basic"], score: 4, desc: "Words come naturally to you. Once per Long Rest, you may treat a Persuasion, Deception, or Performance check as though you rolled a 15 before modifiers." },
  { id: 5008, name: "Tinkerer", tags: ["Passive", "DM Granted","Basic"], score: 2, desc: "You are constantly building strange devices. During a Long Rest, create one of the following: Smoke Bomb, Flash Bomb, or Grappling Device. The item lasts until your next Long Rest." },
  { id: 5009, name: "Tracker", tags: ["Passive","Basic"], score: 2, desc: "You are exceptionally skilled at following signs and trails. Gain proficiency in Survival. If already proficient, gain Expertise." },
  { id: 5010, name: "Arcane Apprentice", tags: ["Passive", "DM Granted","Basic"], score: 3, desc: "Gain 1 random Arcane cantrip or 1st-level spell selected by the DM. The spell may be cast once per Long Rest without expending a spell slot." },
  { id: 5011, name: "Blessed", tags: ["Passive","Basic"], score: 4, desc: "Fate seems to intervene on your behalf. Once per Long Rest, add 1d6 to any attack roll, ability check, or saving throw after seeing the result but before knowing the outcome." },
  { id: 5012, name: "Night Watcher", tags: ["Passive","Basic"], score: 2, desc: "Years of vigilance have sharpened your senses. Gain Darkvision 60 feet. If you already have Darkvision, increase its range by 30 feet." },
  { id: 5013, name: "Treasure Hunter", tags: ["Passive", "DM Granted","Basic"], score: -2, desc: "You cannot resist investigating valuables. Whenever the party discovers treasure, you must immediately inspect it. Gain 2 random treasures selected by the DM at character creation." },
  { id: 5014, name: "Pyrophobic", tags: ["Passive","Basic"], score: -3, desc: "Fire terrifies you. You have disadvantage on saving throws against being Frightened by creatures dealing Fire damage." },
  { id: 5015, name: "Superstitious", tags: ["Passive","Basic"], score: -2, desc: "You carry countless charms and rituals. Whenever a natural 1 is rolled within 30 feet of you, gain Inspiration." },
  { id: 5016, name: "Arcane Scarred", tags: ["Passive","Basic"], score: -1, desc: "A magical accident left permanent marks upon your body. Gain Resistance to Force damage. Whenever you cast a spell, roll 1d20. On a 1, sparks and strange magical effects briefly erupt around you." },
  { id: 5017, name: "Dungeon Delver", tags: ["Passive","Basic"], score: 3, desc: "You have spent years exploring ruins and forgotten places. Gain proficiency in Investigation. If already proficient, gain Expertise." },
  { id: 5018, name: "Cook", tags: ["Passive","Basic"], score: 1, desc: "During a Long Rest, prepare enough food for up to 6 creatures. Those creatures gain temporary hit points equal to your proficiency bonus." },
  { id: 5019, name: "Gambler", tags: ["Passive","Basic"], score: 0, desc: "Whenever you roll a natural 20, gain Inspiration. Whenever you roll a natural 1, lose Inspiration if you have it." },
  { id: 5020, name: "Dragonblooded", tags: ["Passive","Basic"], score: 5, desc: "Choose one damage type: Fire, Cold, Lightning, Poison, or Acid. You gain Resistance to that damage type." },
  { id: 5021, name: "Haunted", tags: ["Cursed", "Passive","Basic"], score: -4, desc: "A spirit follows you wherever you go. The DM may occasionally provide cryptic warnings, visions, or information. The spirit is not always helpful." },
  { id: 5022, name: "Collector", tags: ["Passive", "DM Granted","Basic"], score: -2, desc: "Gain 3 random treasures selected by the DM. You may never willingly sell a treasure you own." },
  // Verath attribute cards
  { id: 6001, name: "The Kindled", tags: ["Passive", "Verath"], score: 2, desc: "When reduced to 0 HP for the first time each Long Rest, drop to 1 HP instead. \"The flame has caught.\"" },
  { id: 6002, name: "The Steadfast", tags: ["Passive", "Verath"], score: 3, desc: "Gain Advantage on the first Death Save you make. \"Another day. I choose it.\"" },
  { id: 6003, name: "The Tempered", tags: ["Passive", "Verath"], score: 4, desc: "Whenever you fail a saving throw, gain 1 Tempered Charge, maximum 1 charge. Spend the charge to reroll any failed save. Refreshes after a Long Rest. \"Steel is not forged in comfort.\"" },
  { id: 6004, name: "The Unwavering", tags: ["Passive", "Verath"], score: 5, desc: "Allies within 10 feet gain +1 on Death Saves. \"The flame has become structural.\"" },
  { id: 6005, name: "Emberbound", tags: ["Passive", "Verath"], score: 3, desc: "Once per Long Rest, as a Reaction when an ally within 30 feet takes damage, reduce that damage by 2d8. You take half the prevented damage. \"The ember is meant to be shared.\"" },
  { id: 6006, name: "Last Wall", tags: ["Passive", "Verath"], score: 4, desc: "Once per Long Rest, when an ally within 30 feet is reduced to 0 HP, move up to your speed toward them as a Free Action. This movement does not trigger opportunity attacks. \"Someone must still be standing.\"" },
  { id: 6007, name: "The Vigil's Flame", tags: ["Passive", "Verath"], score: 5, desc: "Gain one Cleric spell of 3rd level or lower, chosen by the player. Cast it at 3rd level once per Long Rest. \"Verath's attention lingers.\"" },
  { id: 6008, name: "The Named", tags: ["Passive", "Verath"], score: 3, desc: "Choose one deceased NPC ally, mentor, crew member, or family member. Once per Long Rest, gain Advantage on one attack roll, saving throw, or ability check of your choice. \"They still stand beside you.\"" },
  { id: 6009, name: "Dawn Standing", tags: ["Passive", "Verath"], score: 2, desc: "After finishing a Long Rest, choose one: +10 movement, +1 AC, or Advantage on Initiative. The benefit lasts until your next Long Rest. \"I am still here.\"" },
  { id: 6010, name: "Witnessed", tags: ["Passive", "Verath"], score: 4, desc: "You are immune to the Frightened condition. \"She remembers.\"" },
  { id: 6011, name: "Undying Ember", tags: ["Passive", "Verath"], score: 5, desc: "Once per combat, when you succeed on a Death Save, recover HP equal to 1d6 + your Proficiency Bonus. \"The ember does not ask to be a bonfire.\"" },
  { id: 6012, name: "Shared Flame", tags: ["Passive", "Verath"], score: 3, desc: "Whenever you receive healing, one ally within 30 feet heals HP equal to your Proficiency Bonus. \"The fire is not diminished by being shared.\"" },
  { id: 6013, name: "Refusal", tags: ["Passive", "Verath"], score: 5, desc: "Once per Long Rest, when you fail a saving throw, choose to succeed instead. Afterward, gain 1 level of Exhaustion. \"No.\"" },
  { id: 6014, name: "Against the Darkness", tags: ["Passive", "Verath"], score: 4, desc: "Gain Resistance to Necrotic Damage. If you already have Resistance, gain Advantage against Necrotic effects. \"Hope is resistance.\"" },
  { id: 6015, name: "The Last Light", tags: ["Passive", "Verath"], score: 5, desc: "If you are the last conscious party member, gain Advantage on attacks, Advantage on saving throws, and +10 movement until another ally is revived. \"The ember holds because it refuses not to.\"" },
  // Campaign themed attribute cards
  { id: 6101, name: "Sea Legs", tags: ["Passive", "Sea"], score: 2, desc: "You cannot be knocked prone by non-magical effects." },
  { id: 6102, name: "Salt-Blooded", tags: ["Passive", "Sea"], score: 3, desc: "Gain a Swim Speed equal to your movement speed." },
  { id: 6103, name: "Boarding Veteran", tags: ["Passive", "Sea"], score: 3, desc: "The first melee attack you make after moving 15+ feet deals +1d6 damage." },
  { id: 6104, name: "Buccaneer's Luck", tags: ["Passive", "Sea"], score: 4, desc: "Once per Long Rest, reroll any d20 roll. You must use the new result." },
  { id: 6105, name: "Rum-Fueled Courage", tags: ["Passive", "Sea"], score: 2, desc: "You have Advantage against Fear." },
  { id: 6111, name: "Officer's Presence", tags: ["Passive", "Navy"], score: 3, desc: "Once per combat, choose an ally within 30 feet. They gain Advantage on their next attack." },
  { id: 6112, name: "Iron Discipline", tags: ["Passive", "Navy"], score: 4, desc: "You have Advantage against Charm." },
  { id: 6113, name: "Hold The Line", tags: ["Passive", "Navy"], score: 5, desc: "While within 10 feet of an ally, gain +1 AC." },
  { id: 6114, name: "Veteran Sailor", tags: ["Passive", "Navy"], score: 3, desc: "Ignore difficult terrain caused by ships, docks, ropes, debris, or rigging." },
  { id: 6121, name: "Black Flag Survivor", tags: ["Passive", "Armada"], score: 3, desc: "You have Advantage against Intimidation." },
  { id: 6122, name: "Fog Walker", tags: ["Passive", "Armada"], score: 4, desc: "Lightly obscured terrain never imposes disadvantage on you." },
  { id: 6123, name: "Unseen Hunter", tags: ["Passive", "Armada"], score: 5, desc: "Once per Long Rest, become Invisible until the end of your next turn." },
  { id: 6131, name: "Pathfinder", tags: ["Passive", "Romley"], score: 3, desc: "Gain proficiency in Survival. If already proficient, gain Expertise." },
  { id: 6132, name: "Cartographer", tags: ["Passive", "Romley"], score: 2, desc: "Gain Advantage on Investigation checks involving maps, ruins, navigation, or exploration." },
  { id: 6133, name: "Explorer's Resolve", tags: ["Passive", "Romley"], score: 4, desc: "Ignore one level of Exhaustion. Refreshes after a Long Rest." },
  { id: 6134, name: "First Footsteps", tags: ["Passive", "Romley"], score: 5, desc: "Once per Long Rest, automatically succeed on one exploration-related ability check." },
  { id: 6141, name: "Draconic Resilience", tags: ["Passive", "Dragon"], score: 3, desc: "Choose Lightning, Poison, or Cold. Gain Resistance to that damage type." },
  { id: 6142, name: "Dragon's Presence", tags: ["Passive", "Dragon"], score: 4, desc: "Gain proficiency in Intimidation. If already proficient, gain Expertise." },
  { id: 6143, name: "Scaled Soul", tags: ["Passive", "Dragon"], score: 5, desc: "Once per Long Rest, gain temporary HP equal to 3 \u00d7 your level." },
  { id: 6144, name: "Draconic Fury", tags: ["Passive", "Dragon"], score: 4, desc: "When below half HP, gain +2 damage on weapon attacks." },
  { id: 6151, name: "Deep Walker", tags: ["Passive", "Leviathan"], score: 5, desc: "Gain Darkvision 120 feet. If you already have Darkvision, increase its range by 60 feet." },
  { id: 6152, name: "Pressure Born", tags: ["Passive", "Leviathan"], score: 4, desc: "Gain Resistance to Cold Damage." },
  { id: 6153, name: "Abyssal Awareness", tags: ["Passive", "Leviathan"], score: 5, desc: "You cannot be surprised." },
  { id: 6154, name: "Leviathan's Gaze", tags: ["Passive", "Leviathan"], score: 5, desc: "Once per Long Rest, gain Advantage on all Wisdom checks for 1 minute." },
  { id: 6161, name: "Gifted", tags: ["Passive", "Arcane School"], score: 3, desc: "Learn one Cantrip from any class. It uses your choice of INT, WIS, or CHA." },
  { id: 6162, name: "Scholar", tags: ["Passive", "Arcane School"], score: 2, desc: "Gain proficiency in Arcana. If already proficient, gain Expertise." },
  { id: 6163, name: "Arcane Memory", tags: ["Passive", "Arcane School"], score: 4, desc: "Once per Long Rest, reroll a failed Arcana check." },
  { id: 6164, name: "Apprentice's Spark", tags: ["Passive", "Arcane School"], score: 3, desc: "Learn one Level 1 spell. You may cast it once per Long Rest." },
  { id: 6165, name: "Graduate", tags: ["Passive", "Arcane School"], score: 5, desc: "Choose one Level 3 or lower spell. Cast it once per Long Rest at Level 3. It uses your choice of INT, WIS, or CHA." },
  { id: 6171, name: "Grave Survivor", tags: ["Passive", "Undead"], score: 3, desc: "You have Advantage against Disease." },
  { id: 6172, name: "Death-Touched", tags: ["Passive", "Undead"], score: 4, desc: "Gain Resistance to Necrotic Damage." },
  { id: 6173, name: "Soul's Defiance", tags: ["Passive", "Undead"], score: 5, desc: "Gain Advantage on Death Saves." },
  { id: 6174, name: "Returned", tags: ["Passive", "Undead"], score: 5, desc: "Once per Long Rest, when reduced to 0 HP, drop to 1 HP instead." },
  { id: 6181, name: "Chosen by Fate", tags: ["Passive", "Destiny", "Legendary"], score: 5, desc: "Once per Long Rest, treat any d20 roll as a Natural 20. Declare this before rolling." },
  { id: 6182, name: "Hero of the Sea", tags: ["Passive", "Destiny", "Legendary"], score: 5, desc: "Gain one additional Inspiration at the start of each session." },
  { id: 6183, name: "Unbreakable", tags: ["Passive", "Destiny", "Legendary"], score: 5, desc: "You are immune to the Frightened condition." },
  { id: 6184, name: "Legend in the Making", tags: ["Passive", "Destiny", "Legendary"], score: 5, desc: "Choose one permanent benefit: +10 Movement, +1 AC, or +2 Initiative." },
  // Additional undead attribute cards
  { id: 6201, name: "Witness of the Grave", tags: ["Passive", "Undead"], score: 3, desc: "You can instinctively recognize other undead hiding among the living. You have Advantage on Insight checks to determine if a creature is undead. Once per Long Rest, automatically know whether a creature within 30 feet is living or undead." },
  { id: 6202, name: "Borrowed Flesh", tags: ["Passive", "Undead"], score: 2, desc: "Your Perfect Disguise has become easier to maintain. You have Advantage on Deception checks involving your identity. Magical attempts to reveal your undead nature are made with disadvantage." },
  { id: 6203, name: "Forgotten Death", tags: ["Passive", "Undead"], score: 4, desc: "You no longer remember the moment of your death. Once per Long Rest, reroll a failed Wisdom, Intelligence, or Charisma saving throw." },
  { id: 6204, name: "Echoes of the Tomb", tags: ["Passive", "Undead"], score: 3, desc: "The dead occasionally whisper useful knowledge. Once per Long Rest, gain Advantage on one Arcana, History, Investigation, or Religion check." },
  { id: 6205, name: "Unfinished Purpose", tags: ["Passive", "Undead"], score: 5, desc: "Something still ties you to the world. Choose a personal goal, oath, or mission. Whenever acting directly toward that purpose, gain +1 on attack rolls, ability checks, and saving throws related to that goal." },
  { id: 6211, name: "The First Grave", tags: ["Passive", "Undead", "Legendary"], score: -15, desc: "Nobody knows who died first. Some claim it was you. Ancient Persistence: You are immune to Disease and Poison. You do not require air, food, water, or sleep. Forgotten by Death: Once per Long Rest, when reduced to 0 HP, you may instead remain conscious until the end of your next turn. You still make Death Saving Throws normally. Primordial Undeath: Undead creatures automatically begin with a Friendly disposition toward you unless controlled by another creature. \"Death learned its craft from someone.\"" },
  { id: 6212, name: "The King Beneath", tags: ["Passive", "Undead", "Legendary"], score: -15, desc: "The dead recognize authority in your presence, even if you do not. Sovereign of Bones: Gain proficiency in Persuasion and Intimidation. If already proficient, gain Expertise. Command the Fallen: Once per Long Rest, choose an Undead creature within 60 feet. It must succeed on a Wisdom Saving Throw (DC = 8 + PB + CHA modifier) or become Charmed by you for 1 minute. This effect automatically fails against Legendary creatures. The Silent Court: Whenever you enter a crypt, graveyard, tomb, mausoleum, battlefield, or similar place of death, the DM must provide one useful piece of information about the area. \"Every grave remembers its king.\"" },
  { id: 6213, name: "The Last Witness", tags: ["Passive", "Undead", "Legendary"], score: -20, desc: "You remember things that should have been forgotten. Before Kingdoms: Gain proficiency in Arcana, History, and Religion. If already proficient, gain Expertise. Echoes of Ages: Once per Long Rest, ask the DM one question about a location, artifact, historical event, or creature. The answer must be truthful, though it may be cryptic. Burden of Memory: You can never be surprised. \"I watched this happen the first time.\"" },
  { id: 6214, name: "Death Refused", tags: ["Cursed", "Passive", "Undead", "Legendary"], score: -20, desc: "You died. Death disagreed. The Rejected Soul: You have Advantage on Death Saving Throws. Not Yet: Once per Long Rest, when you fail your third Death Save, instead reset your Death Saves to zero. You remain unconscious. Death's Mark: Clerics, paladins, undead, and celestial creatures can instinctively sense that something about you is wrong. They may not know what, but they know. \"Even Death has standards.\"" },
  { id: 6215, name: "The Hollow Emperor", tags: ["Cursed", "Passive", "Undead", "Legendary"], score: -25, desc: "A throne exists somewhere that belongs to you. You do not remember where. Perfect Disguise: Gain all benefits of Ageless' Perfect Disguise. Majesty of the Damned: Gain proficiency in Persuasion, Deception, and Intimidation. If already proficient, gain Expertise. Crown of Forgotten Bones: Once per Long Rest, as an Action, all creatures of your choice within 30 feet must make a Wisdom Saving Throw. On a failure, they are Charmed for 1 minute. They may repeat the save at the end of each turn. Ancient Authority: Undead creatures with CR less than your level automatically begin one attitude step friendlier toward you. \"The throne still waits.\"" },
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
  "DM Granted": "#5b3b8c",
  Basic: "#3d5a3d",
  Verath: "#9b5c2e",
  Sea: "#1f6f8b",
  Navy: "#25466b",
  Armada: "#2f2a4f",
  Romley: "#6b5b2a",
  Dragon: "#7b2f24",
  Leviathan: "#105b63",
  "Arcane School": "#4f3b8f",
  Undead: "#4a5a4a",
  Destiny: "#a67c00",
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

    const selectedCharacter = activeCharacters.find((character) => character.id === selectedCharacterId);
    if (!selectedCharacter) {
      setMessage("Choose a valid campaign character before vetoing.");
      setSelectedCharacterId(activeCharacters[0]?.id || "");
      return;
    }

    if (hasVetoUsed(selectedCharacter.id)) {
      setMessage("This character has already used their one attribute veto.");
      return;
    }

    const vetoedCardId = drawPool[0].id;

    const { error } = await supabase.from("campaign_character_attribute_vetoes").upsert(
      {
        campaign_id: campaignId,
        character_id: selectedCharacter.id,
        used: true,
      },
      { onConflict: "campaign_id,character_id" }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setVetoRows((current) => [
      ...current.filter((row) => row.character_id !== selectedCharacter.id),
      { campaign_id: campaignId, character_id: selectedCharacter.id, used: true },
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
