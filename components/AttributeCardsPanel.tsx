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
  // Generated from Attribute_Cards_Complete.docx; flavor lines are intentionally omitted.
  { id: 7001, name: "Large", tags: ["Passive", "Basic"], score: 5, desc: "You are one size category larger than normal for your species. You have advantage on Strength checks and saving throws. You cannot fit through spaces designed for Medium or smaller creatures without squeezing." },
  { id: 3684, name: "Colossal", tags: ["Passive", "Basic"], score: 15, desc: "You are enormous beyond all natural proportion. You are two size categories larger than normal for your species — a Medium creature becomes Huge; a Small creature becomes Large. Your melee attacks deal an extra 6 damage and roll one additional damage die on every attack. You cannot fit through standard doorways, ride most mounts, or wear armour not specifically crafted for your size. Furniture rarely survives your presence." },
  { id: 7002, name: "Very Tall", tags: ["Passive", "Basic"], score: 10, desc: "You are notably taller than others of your species without being a full size category larger. You have a reach of 10 ft. with melee attacks instead of 5 ft. You have disadvantage on Stealth checks in any environment where height is a liability. You may also look over most walls and partitions without attempting a check." },
  { id: 3661, name: "Strong", tags: ["Passive", "Basic"], score: 10, desc: "Your Strength score increases by 4. You have advantage on all Strength checks and saving throws." },
  { id: 3716, name: "Lucky", tags: ["Passive", "Basic"], score: 8, desc: "Once per session, you may reroll any single die roll and take the higher result. This can be applied to any roll — your own or another creature's — before the result is declared." },
  { id: 7003, name: "Born Lucky", tags: ["Passive", "Basic"], score: 7, desc: "Once per Long Rest, after any d20 roll is made but before the result is announced, you may declare it Lucky. Reroll the die and take the higher result. This applies to any roll — attack, save, skill check, or death save — including rolls made by others that directly affect you." },
  { id: 7004, name: "Sixth Sense", tags: ["Passive", "Basic"], score: 5, desc: "You have an instinctive sense for when something is wrong. You cannot be surprised, and once per session you may ask the DM whether the current situation is about to go badly — they must answer honestly, though not in detail. You cannot turn this sense off. It makes sleeping in unfamiliar places difficult." },
  { id: 7005, name: "Extremely Punctual", tags: ["Passive", "Basic"], score: 5, desc: "You always act first in the first round of any combat, regardless of initiative roll. This applies once per combat and does not stack with other initiative-granting abilities." },
  { id: 7006, name: "Restless", tags: ["Passive", "Basic"], score: 6, desc: "Your movement speed increases by 10 ft. If you make an attack on a turn in which you have not moved at least 1 ft., you have disadvantage on that attack. If you move 10 ft. or more before attacking on the same turn, you have advantage on that attack instead. You have disadvantage on checks that require remaining perfectly still." },
  { id: 7007, name: "Snorer", tags: ["Passive", "Basic"], score: 0, desc: "Your snoring is legendary. During any Long Rest taken in a shared space, all other creatures must succeed on a DC 11 Constitution saving throw or gain one level of Exhaustion from poor sleep. You yourself always sleep soundly and gain full Long Rest benefits regardless of conditions." },
  { id: 7008, name: "Incredibly Average", tags: ["Passive", "Basic"], score: 5, desc: "You are, in every measurable way, perfectly unremarkable. HP: +5. You are immune to the Frightened condition caused by your own appearance, and witnesses rarely remember describing you accurately." },
  { id: 7009, name: "Chronic Complainer", tags: ["Passive", "Basic"], score: 8, desc: "The DM must describe at least one minor inconvenience per session that affects only you — the weather, the mattress, the soup temperature. You must acknowledge it aloud." },
  { id: 7010, name: "Unnaturally Warm", tags: ["Passive", "Basic"], score: 8, desc: "You radiate gentle heat at all times. You are immune to the effects of environmental cold. Allies who begin their turn adjacent to you may remove the Chilled condition if they have it." },
  { id: 7011, name: "Light Sleeper", tags: ["Passive", "Basic"], score: 6, desc: "You cannot be surprised while asleep. You always wake at the slightest disturbance and are never considered to be in a Resting state for the purposes of enemy stealth." },
  { id: 7012, name: "Tragically Hapless", tags: ["Passive", "Basic"], score: 14, desc: "Once per session, the DM may declare that something minor goes wrong for you at an inopportune moment — a buckle breaks, a torch falls, a very important item drops into a river. This is non-negotiable." },
  { id: 7013, name: "Opinionated", tags: ["Passive", "Basic"], score: 8, desc: "You must vocally weigh in on every major party decision before any action is taken, whether or not your input is useful. The party may still proceed — but they must hear you first." },
  { id: 7014, name: "Terrifyingly Cheerful", tags: ["Passive", "Basic"], score: 8, desc: "You are immune to the Frightened and Shaken conditions. Your relentless optimism is deeply unsettling — creatures you Persuade with a High Roll are also Unnerved for 1 minute." },
  { id: 7015, name: "Suspiciously Healthy", tags: ["Passive", "Basic"], score: 8, desc: "You are immune to the Poisoned and Diseased conditions. Healers who examine you become visibly uncomfortable and cannot explain why. Members of the Order of the Undying Vigil may look at you twice." },
  { id: 7016, name: "Insomniac", tags: ["Passive", "Basic"], score: 4, desc: "You do not sleep. You still benefit from Long Rests by remaining still and quiet for 8 hours. You are always considered alert during night watch and cannot be surprised while on watch. Allies sleeping near you gain advantage on their own saving throws against the Frightened condition." },
  { id: 7017, name: "Conspiracy Theorist", tags: ["Passive", "Basic"], score: 3, desc: "Once per session, you may declare that something suspicious is happening before there is any evidence of it. The DM must confirm or deny whether you are correct. If you are correct, gain Inspiration. If you are wrong, the party learns you said it, and the DM may use this narratively." },
  { id: 7018, name: "Seasick", tags: ["Passive", "Basic"], score: 6, desc: "While aboard any waterborne vessel, you suffer disadvantage on attack rolls and ability checks. On land, you gain advantage on Constitution saving throws — your system has become aggressively stable in compensation." },
  { id: 7019, name: "Pathologically Honest", tags: ["Passive", "Basic"], score: 0, desc: "You cannot knowingly speak a false statement. You may stay silent, deflect, or decline to answer — but an outright lie is physically impossible. You have advantage on Insight checks to detect deception in others." },
  { id: 7020, name: "Natural Mimic", tags: ["Passive", "Basic"], score: 5, desc: "You can perfectly replicate any voice, accent, or speech pattern you have heard for at least 10 minutes. Once per session, a Deception check involving mimicry automatically succeeds without a roll. Creatures who know the person being mimicked may still make an Insight check at DM discretion." },
  { id: 7021, name: "Town Crier", tags: ["Passive", "Basic"], score: 3, desc: "Once per session, in any settlement, you may spend 30 minutes talking to people and learn one piece of current local information — a rumour, a recent event, a person of interest, or something someone badly wants kept quiet. The DM determines what you learn. It is always accurate." },
  { id: 7022, name: "Striking", tags: ["Passive", "Basic"], score: 6, desc: "People remember you as more impressive than the encounter warranted. After any social interaction, NPCs recall you as one attitude step more favourable than their actual experience would suggest. Wanted posters of you are noticeably more flattering than accurate, imposing disadvantage on checks to identify you from a description alone." },
  { id: 7023, name: "Nobody", tags: ["Passive", "Basic"], score: 6, desc: "You are supernaturally difficult to remember. After any interaction, NPCs must succeed on a DC 14 Wisdom saving throw to recall your face, name, or presence after 10 minutes have passed. Wanted posters of you are always wrong. Guards who arrested you yesterday will not recognise you tomorrow. This does not affect creatures with Truesight or those who have spent more than an hour in your company." },
  { id: 7024, name: "Unnervingly Quiet", tags: ["Passive", "Basic"], score: 4, desc: "You have advantage on Stealth checks. Creatures that fail a Perception check to notice you must succeed on a DC 12 Wisdom saving throw when you do announce your presence or gain the Frightened condition until the end of their next turn." },
  { id: 7025, name: "Self-Narrator", tags: ["Passive", "Basic"], score: 5, desc: "You narrate your reasoning aloud without noticing. You have advantage on all Intelligence checks made to solve puzzles, recall information, or plan. Stealth checks that require silence automatically fail unless you succeed on a DC 13 Wisdom saving throw to stay quiet for the duration." },
  { id: 7026, name: "Dramatic", tags: ["Passive", "Basic"], score: 4, desc: "Once per session, you may declare a moment Dramatic. The DM must pause the scene and give you uninterrupted time to deliver a speech, make an entrance, or otherwise perform. Any Persuasion, Intimidation, or Deception check made during or immediately after this moment has advantage. NPCs who witness it remember you specifically and favourably regardless of the outcome." },
  { id: 3701, name: "Hoarder", tags: ["Passive", "Basic"], score: 0, desc: "Your carrying capacity is doubled. You always have a mundane item that could plausibly be useful in any non-combat situation — rope, a candle, chalk, a small mirror, twine. The DM determines what you have; you may not always have the right thing, but you always have something." },
  { id: 7027, name: "Iron Stomach", tags: ["Passive", "Basic"], score: 5, desc: "You are immune to the Poisoned condition caused by ingested substances. Poisons delivered via injury or contact still affect you normally. Once per Long Rest, you may consume something of dubious origin and gain a minor beneficial effect — the DM determines what it does." },
  { id: 7028, name: "Compulsive Reader", tags: ["Passive", "Basic"], score: 4, desc: "You can read any language you have encountered at least one written sample of, given enough time. You have proficiency in History. Whenever you find a written document of any kind, you must attempt to read it before doing anything else. The DM may use this at inconvenient moments." },
  { id: 7029, name: "Loud", tags: ["Passive", "Basic"], score: 6, desc: "Your voice carries further than most people are comfortable with. You cannot whisper. You are immune to the Silenced condition. Stealth checks that involve staying quiet automatically fail, and the DM may rule that you have announced the party's presence in any quiet environment without rolling." },
  { id: 7030, name: "Beastfriends", tags: ["Passive", "Basic"], score: 4, desc: "Animals are instinctively calm around you. You have advantage on all Animal Handling checks and can attempt to calm hostile beasts as a bonus action. Magical beasts and trained war-animals still require a full Action. Once per Long Rest, you may ask a non-intelligent animal a single yes or no question — the animal cannot lie, but it can be wrong." },
  { id: 7031, name: "Beastfriends Forever", tags: ["Passive", "Basic"], score: 12, desc: "With DM approval, one non-hybrid animal of your choice becomes your permanent companion. It acts on your initiative, obeys your commands, and gains HP equal to your level each time you level up. If it dies, you may bond with a new companion after one full Long Rest. Animals are instinctively calm around you. You have advantage on all Animal Handling checks and can attempt to calm hostile beasts as a bonus action. Magical beasts and trained war-animals still require a full Action. Once per Long Rest, you may ask a non-intelligent animal a single yes or no question — the animal cannot lie, but it can be wrong." },
  { id: 7032, name: "Mana Sensitivity", tags: ["Passive", "Basic"], score: 3, desc: "Whenever you are targeted by a spell — friendly or hostile — you immediately begin sneezing and cannot take Reactions until the start of your next turn. You have Resistance to all spell damage, as your body rejects it violently." },
  { id: 7033, name: "Cat Allergy", tags: ["Passive", "Basic"], score: 6, desc: "You are violently allergic to cats and cat-adjacent creatures. Within 10 feet of any feline creature, you suffer disadvantage on Perception and Concentration checks. Familiars of the cat variety actively seek you out at the worst possible moments, at the DM's discretion." },
  { id: 7034, name: "Floral Allergy", tags: ["Passive", "Basic"], score: 8, desc: "Within 10 feet of flowering plants, pollen, or spores, you gain the Poisoned condition until you move away and spend a bonus action clearing your airways. Druid spells that summon or create plant life within range trigger this automatically." },
  { id: 7035, name: "Dust Allergy", tags: ["Passive", "Basic"], score: 5, desc: "Whenever you enter a location described as dusty, long-abandoned, or filled with debris, you must succeed on a DC 10 Constitution saving throw or be Incapacitated for 1 round. Animated objects and earth-based creatures trigger this on a successful attack against you." },
  { id: 7036, name: "Shellfish Allergy", tags: ["Passive", "Basic"], score: 8, desc: "Consuming any seafood of the crustacean or mollusc variety immediately causes the Poisoned condition for 1 hour and deals 1d10 damage. Aquatic creatures with shells or carapaces deal an additional 2 damage on any attack that hits you." },
  { id: 7037, name: "Bee Sting Allergy", tags: ["Passive", "Basic"], score: 5, desc: "Any attack from a bee, wasp, or insectoid creature that deals piercing damage immediately deals an additional 1d10 damage from the allergic reaction and causes the Stunned condition until the end of your next turn. Druids who summon swarms are aware of this. Some of them find it funny." },
  { id: 7038, name: "Sun Allergy", tags: ["Passive", "Basic"], score: 5, desc: "After 1 hour of unprotected sun exposure, you gain the Poisoned condition until you are out of direct sunlight for 10 minutes. You have Superior Darkvision — you see in darkness as if it were bright light out to 60 ft., and dim light as if it were bright light for a further 30 ft. Your eyes adjusted. They overadjusted." },
  { id: 7039, name: "Peanut Allergy", tags: ["Passive", "Basic"], score: 4, desc: "Consuming any food containing ground nuts immediately deals 1d10 damage and causes the Poisoned condition for 1 hour. You have learned to ask. Nobody ever tells you the truth the first time." },
  { id: 7040, name: "Wheat Allergy", tags: ["Passive", "Basic"], score: 4, desc: "Consuming any food made from wheat or grain causes 1d6 damage and the Poisoned condition for 1 hour. You have developed an encyclopaedic knowledge of what is and is not safe to eat, granting you proficiency in Nature checks related to identifying plants and foodstuffs." },
  { id: 7041, name: "Alcohol Allergy", tags: ["Passive", "Basic"], score: 4, desc: "Consuming any alcoholic beverage deals 1d8 damage and causes the Poisoned condition for 1 hour. You have advantage on all Wisdom saving throws — years of being the only sober person in the room have made you exceptionally clear-headed." },
  { id: 7042, name: "Fur Allergy", tags: ["Passive", "Basic"], score: 3, desc: "Within 10 feet of any creature with significant fur or thick animal hair, you suffer disadvantage on Perception checks and Concentration saves. Creatures of the Beast type that are fur-bearing trigger this automatically." },
  { id: 7043, name: "Ink Allergy", tags: ["Passive", "Basic"], score: 4, desc: "Direct contact with standard writing ink causes your skin to blister and swell. You cannot write with conventional ink without taking 1 damage per round of contact. Magical inks and anything used in scroll-casting deal 1d6 damage on contact and cause the Poisoned condition for 10 minutes." },
  { id: 7044, name: "Cold Allergy", tags: ["Passive", "Basic"], score: 4, desc: "You have vulnerability to Cold damage. In exchange, you have Resistance to Fire damage — your body runs hot in constant compensation." },
  { id: 1183, name: "Ageless", tags: ["Cursed", "Passive", "Undead"], score: -10, desc: "You do not require air, food, or water. You do not age and cannot die from old age. You are considered an Undead creature for the purposes of spells and effects. Your consciousness is anchored within your skull — destruction of your body does not kill you, provided your skull remains intact. Perfect Disguise: Your undead nature is hidden beneath a flawless recreation of your former living appearance. You appear alive in every way. This disguise cannot be detected through ordinary observation, medicine checks, or most magical means. Members of the Order of the Undying Vigil may perceive the truth at the DM's discretion." },
  { id: 1187, name: "Vampire", tags: ["Cursed", "Passive", "Undead"], score: -15, desc: "You are a vampire. You do not age, do not require food or water, and are immune to poison and disease. You have advantage on Perception and Stealth checks. You must consume blood once per Long Rest or gain one level of Exhaustion. Sunlight deals 1d6 Radiant damage to you per round of exposure. You cannot enter a dwelling without being invited. Running water imposes disadvantage on all checks. You may charm a humanoid with eye contact as an Action — DC 14 Wisdom save to resist." },
  { id: 7045, name: "Shedding-Born", tags: ["Passive", "Undead", "The Waking", "DM Granted"], score: -10, desc: "You were identified as a candidate through the Shedding process and underwent the transformation willingly. You are Ageless — gain all benefits and conditions of the Ageless attribute card. You have a known connection to the Waking faction. Varek is aware of your existence. The Order of the Undying Vigil and the Eternal Flame both have doctrinal responses to what you are." },
  { id: 7046, name: "Forced Ageless", tags: ["Passive", "Undead", "The Waking", "DM Granted"], score: -6, desc: "You were made Ageless without consent — by Varek or another member of the Waking. You carry all the mechanical properties of the Ageless condition. You are not integrated into the Waking faction and may be actively hostile to it. The breath-survivors consider you theologically invalid. The Order does not make distinctions based on how you became what you are." },
  { id: 7047, name: "Remnant Paladin", tags: ["Passive", "Undead", "Basic", "DM Granted"], score: -5, desc: "You are one of the undead paladins raised at the Battle of the Final Spire — one of Ashvael's last. You retain full intelligence, identity, and your paladin abilities. You do not age and do not require food, water, or air. Your undead nature is apparent to careful observation. The Order of the Undying Vigil knows of your kind and has complicated feelings about you. You have been walking the world for over two centuries." },
  { id: 7048, name: "Crusade Survivor", tags: ["Passive", "Basic"], score: 20, desc: "You lived through the Crimson Crusade. You have proficiency in all weapons regardless of class restrictions. However, you suffer the Frightened condition automatically whenever you encounter a swarm of undead creatures of 5 or more." },
  { id: 7049, name: "Child of the Ashen Interior", tags: ["Passive", "Basic"], score: 4, desc: "You grew up in or near the dead zone of the Ashen Interior. You have Resistance to Necrotic damage and cannot be Frightened by undead creatures of CR 3 or lower. You are deeply mistrusted on sight by religious institutions." },
  { id: 7050, name: "Dead God's Mark", tags: ["Passive", "Basic", "DM Granted"], score: -2, desc: "You carry a brand, scar, or symbol connected to one of the gods who died in the Crimson Crusade. Gain proficiency in Religion. Once per Long Rest, you may commune with the residual divine presence — the DM will describe what you receive. The Order of the Undying Vigil and the Eternal Flame's senior clergy will notice the mark immediately." },
  { id: 7051, name: "Crusade Orphan", tags: ["Passive", "Basic"], score: 3, desc: "Your family was destroyed in the Crimson Crusade. Choose one: you have proficiency in Survival, Medicine, or Persuasion. You cannot be Charmed by any creature that openly serves an institution connected to the Crusade's aftermath until they have earned your trust over at least one full session." },
  { id: 7052, name: "Pilgrim Road Walker", tags: ["Passive", "Basic"], score: 5, desc: "You have walked the Vaelthari Pilgrim Roads that connect the surviving holy sites of dead and living gods. You have proficiency in Religion. When you encounter a dead god's ruin, artefact, or residual divine energy, you automatically sense its presence within 30 ft. and know which god it belonged to." },
  { id: 7053, name: "Sunken Archives Scholar", tags: ["Passive", "Basic", "DM Granted"], score: 5, desc: "You have studied artefacts or records recovered from the Sunken Archives of the Covenant Sea. You have proficiency in History and Arcana. Once per Long Rest, you may recall a piece of pre-Crusade knowledge relevant to the current situation — the DM will determine what you know. The things that live in those ruins remember your face." },
  { id: 7054, name: "Veil Crossing Survivor", tags: ["Passive", "Basic", "DM Granted"], score: 7, desc: "You passed through the Pale Ocean's Veil Crossing and came out changed. You can understand — but not speak — one dead language of the DM's choosing. You have advantage on saving throws against fear effects caused by supernatural or divine sources. Once per campaign, you may recall something you heard in the fog — the DM will tell you what." },
  { id: 7055, name: "Compact Deserter", tags: ["Passive", "Basic", "DM Granted"], score: 15, desc: "You abandoned your post in the Ironwall Compact. Proficiency with Heavy Armour. You cannot enter any Compact garrison or controlled territory without risking immediate arrest. Compact soldiers recognise your insignia on a Perception check of 14 or higher." },
  { id: 7056, name: "Wall-Born", tags: ["Passive", "Basic"], score: 7, desc: "You were raised in a Compact garrison town. You have proficiency in Perception and Athletics. You have advantage on saving throws against the Frightened condition caused by undead creatures and on checks to identify undead by type." },
  { id: 7057, name: "Interior Scout", tags: ["Passive", "Basic", "DM Granted"], score: 5, desc: "You served as a scout in the Ashen Interior. You have proficiency in Stealth and Survival. You have Resistance to Necrotic damage and advantage on checks to navigate blighted terrain. You have also seen things in the Interior that you have never reported — the DM knows what those are." },
  { id: 7058, name: "Surath Fugitive", tags: ["Passive", "Basic", "DM Granted"], score: -4, desc: "You are a named fugitive in the Surath Dominion. Gain 200 gold and 1 random treasure selected by the DM. Eternal Flame clergy, Ardent soldiers, and Dominion officials have standing orders regarding your arrest. The nature of your crime is decided at character creation with the DM." },
  { id: 7059, name: "Romley Islander", tags: ["Passive", "Basic"], score: 5, desc: "You grew up in the Romley Archipelago. You have proficiency in Water Vehicles and advantage on checks to navigate the southern hemisphere. Navy officers treat you as a local problem. Buccaneers treat you as one of their own." },
  { id: 7060, name: "Buccaneer Born", tags: ["Passive", "Basic"], score: 4, desc: "You were raised in the buccaneer tradition. You have proficiency in Water Vehicles, Sleight of Hand, and one weapon of your choice. You know at least three safe harbours the Navy's charts don't show." },
  { id: 7061, name: "Maelstrom Survivor", tags: ["Passive", "Basic"], score: 6, desc: "You survived a maelstrom at sea. You have advantage on all saving throws made while aboard a vessel in combat or storm conditions. Once per Long Rest, when your ship would take structural damage, you may reduce that damage by half." },
  { id: 7062, name: "The Sea Owes You Nothing", tags: ["Passive", "Basic"], score: -3, desc: "You have suffered a catastrophic loss at sea — ship, crew, family, cargo, or something else you decide at character creation. You have advantage on all checks related to maritime survival and navigation. However, you have disadvantage on Wisdom saving throws when the option to pursue or avenge what you lost becomes available. This disadvantage is yours to roleplay." },
  { id: 7063, name: "Fog-Reader", tags: ["Passive", "Basic"], score: 6, desc: "You ignore disadvantage on Perception and attack rolls that fog and heavy obscurement normally impose. Once per Long Rest, while in fog, you may identify the direction and approximate number of ships within 500 feet without a roll." },
  { id: 7064, name: "Lower Docks Regular", tags: ["Passive", "Basic"], score: 5, desc: "You are a known face in Port Meridian's Lower Docks. Once per session, you may call on a contact for a favour — information, shelter, a black-market item, or a rumour. The contact expects something in return eventually." },
  { id: 7065, name: "Silent Vault Clearance", tags: ["Passive", "Basic", "DM Granted"], score: 6, desc: "You have been granted, earned, or stolen clearance to the Silent Vault beneath Port Meridian's Grand Admiralty. You have proficiency in Arcana and History. You have read at least one document within the Vault — the DM determines which one and what you know. The Grand Admiralty is aware of this." },
  { id: 7066, name: "Star-Sextant Initiate", tags: ["Passive", "Basic", "DM Granted"], score: 4, desc: "You have trained in the Star-Sextant Tower. You have proficiency in Navigator's Tools and History. You know that several of Romley's original markings refer to locations not on any current Navy chart. You know where three of them are." },
  { id: 7067, name: "Ruin Reader", tags: ["Passive", "Basic"], score: 5, desc: "You can identify the approximate age of any constructed ruin within 250 years, and recognise when a ruin predates the Crimson Crusade. Once per Long Rest, in any Romley Archipelago ruin, you may find one detail others missed — an inscription, a door, a mechanism — that the DM must confirm is genuinely present." },
  { id: 7068, name: "Romley's Cartographer", tags: ["Passive", "Basic", "DM Granted"], score: 4, desc: "You have studied a fragment of Jaimen Romley's original survey work. You know the location of one site in the Romley Archipelago not on Navy charts — the DM determines its nature. You also have proficiency in Navigator's Tools and advantage on checks to navigate the Romley Sea." },
  { id: 7069, name: "Shadowy Armada Defector", tags: ["Passive", "Basic", "DM Granted"], score: -7, desc: "You served in the Shadowy Armada before leaving. You have proficiency in Stealth and Intimidation. You know the Armada's signals, codes, and basic operational doctrine — enough to pass as a current member on a Deception check of 14 or lower. The Armada has not forgotten you exist." },
  { id: 7070, name: "Armada Marked", tags: ["Passive", "Basic"], score: -4, desc: "The Shadowy Armada has designated you a named target — the reason is player-decided. You have advantage on checks to identify Armada ships, signals, and tactics. Armada agents in any port will eventually learn you are present." },
  { id: 7071, name: "Marked by the Deep", tags: ["Passive", "Basic", "DM Granted"], score: -6, desc: "The Leviathan is aware of your existence. You have advantage on saving throws against effects from creatures of the Monstrosity or Titan type. Once per campaign, the Leviathan acts in a way that incidentally protects or assists you — the DM determines when and how. Whatever it wants from you, it has not decided to take it yet." },
  { id: 7072, name: "Abyssal Survivor", tags: ["Passive", "Basic"], score: 4, desc: "You have been to depths that should have killed you. You have advantage on Constitution saving throws made underwater. You have Darkvision 120 ft. that functions even in magical darkness. You also have disadvantage on Charisma checks when people ask you what you saw down there, because your face does something involuntary." },
  { id: 7073, name: "Merfolk Pact", tags: ["Passive", "Basic"], score: 5, desc: "You have entered into a binding agreement with a merfolk community — terms are player-decided. Merfolk will not attack you unprovoked. Once per Long Rest, you may call on the pact: a merfolk within 1 mile will surface to deliver a message or one piece of information about the waters you are in." },
  { id: 7074, name: "Tide-Speaker", tags: ["Passive", "Basic"], score: 3, desc: "You can speak and understand Aquan. You have advantage on Persuasion checks when interacting with aquatic creatures willing to communicate. Merfolk who encounter you underwater treat you as a curiosity on first contact — they may still become hostile, but you get a conversation first." },
  { id: 7075, name: "Port God's Favour", tags: ["Passive", "Basic", "DM Granted"], score: 3, desc: "You have honoured one of the small port-gods of the southern hemisphere. In that port, you always find lodging and merchants extend slightly better prices. Once per campaign, that port-god may intervene in a minor way on your behalf — the DM determines when and how." },
  { id: 7076, name: "Tide-Caller's Rite", tags: ["Passive", "Basic"], score: 4, desc: "You have performed the Tide-Caller's Rite — an old southern tradition predating the Navy's presence in the Romley Sea. You have advantage on all saving throws made in or on the water. Once per Long Rest, difficult terrain created by water does not affect you for 1 hour." },
  { id: 7077, name: "League Factor", tags: ["Passive", "Basic", "DM Granted"], score: 6, desc: "You work for or have worked for the Pale Merchants' League. Once per session, you may call upon your contacts to learn the current market value of any item, the last known location of any named ship, or one piece of intelligence about any named faction or port. In return, the League occasionally asks you for things. You are expected to say yes." },
  { id: 7078, name: "Spiritwood-Born", tags: ["Passive", "Basic"], score: 8, desc: "You were raised in or near Khevara's Spiritwood. You have advantage on Perception and Survival checks in forested environments. Once per Long Rest, you may ask the local flora or fauna a yes or no question — the answer comes as a feeling, not words, and is always accurate." },
  { id: 7079, name: "Spirit-Touched", tags: ["Passive", "Religion — Khevarai Nature Spirits"], score: 5, desc: "One of Khevara's local nature spirits has acknowledged you. You have proficiency in Nature and Animal Handling. Once per Long Rest, in any natural environment, you may call on the spirit for guidance — the DM will answer one question about the natural world or the spirit's domain truthfully." },
  { id: 7080, name: "Thornkeeper's Student", tags: ["Passive", "Religion — Khevarai Nature Spirits", "DM Granted"], score: 4, desc: "You have studied under a druidic guardian of Khevara's Spiritwood. You have proficiency in Survival and Nature. Beasts will not attack you without provocation. Once per Long Rest, you may pass through any natural terrain without leaving any trace of your passage for 1 hour." },
  { id: 7081, name: "Arcane Fusion Subject", tags: ["Passive", "Basic", "DM Granted"], score: -8, desc: "You were subjected to Arcane Fusion and survived with your identity intact. Choose one: you have Resistance to Lightning, Cold, or Poison damage. You have visible mutations that mark you as a hybrid and cannot easily hide this. The Navy, the Order of the Undying Vigil, and the Pale Merchants' League all have standing interest in speaking to you." },
  { id: 7082, name: "Blackspire Survivor", tags: ["Passive", "Basic", "DM Granted"], score: -6, desc: "You escaped Blackspire Academy. You have proficiency in Arcana and advantage on checks to identify hybrid creatures and Arcane Fusion signatures. You cannot be Charmed by creatures wearing an Arcane Dominator Collar. The sight of student robes on a Failed Hybrid requires a DC 13 Wisdom save or you gain the Shaken condition until the end of your next turn." },
  { id: 7083, name: "Draconic Heritage", tags: ["Passive", "Basic"], score: 6, desc: "You carry trace draconic blood. Choose one: Lightning, Fire, Cold, Acid, or Poison. You have Resistance to that damage type. Once per Long Rest, you may exhale a breath weapon: a 15 ft. cone dealing 2d6 damage of that type. Creatures studying Arcane Fusion find you extremely interesting." },
  { id: 7084, name: "Phase-Touched", tags: ["Passive", "Basic", "DM Granted"], score: 5, desc: "You were exposed to phase energy and it left a mark. Once per Long Rest, as a bonus action, you may shift partially out of phase: you become invisible and can move through solid objects until the start of your next turn. You may not end your turn inside solid matter. Each time you use this ability, the DM rolls a d20 privately. On a 1, the instability advances." },
  { id: 7085, name: "Half-Dragon", tags: ["Passive", "Basic", "DM Granted"], score: -6, desc: "You are one of the Blue Alchemist's creations — a magically unstable blue half-dragon. You have Resistance to Lightning damage and a breath weapon: a 15 ft. line dealing 3d6 Lightning damage (DC 13 Dexterity save for half), usable once per Short Rest. Your draconic appearance cannot be concealed through mundane means. The Navy wants to study you. Vael Torris wants to know how you were made." },
  { id: 7086, name: "Ashvael's Last", tags: ["Passive", "Basic", "DM Granted"], score: 5, desc: "You are a surviving member or descendant of the Order of the Ashvael Blade. You have proficiency in Religion and Insight. You carry residual divine energy from a dead god: your weapon attacks deal an additional 1d4 Radiant damage. The Order of the Undying Vigil will recognise your heritage immediately." },
  { id: 7087, name: "Triad-Faithful", tags: ["Passive", "Religion — The Vaelthari Triad"], score: 4, desc: "You are a practising member of the Vaelthari Triad faith. You have proficiency in Religion. Once per Long Rest, you may invoke one of the three aspects of the Triad for a minor boon — the DM determines its form. The Eternal Flame considers this incomplete. You consider the Eternal Flame's opinion irrelevant." },
  { id: 7088, name: "Remnant Order Faithful", tags: ["Passive", "Religion — Remnant Orders", "DM Granted"], score: 3, desc: "You maintain devotion to a god who died in the Crimson Crusade, worshipping in secret. You have proficiency in Religion and History. Once per session, the residual divine energy of your dead god provides one piece of relevant information or a minor boon. Most governments tolerate this. The Eternal Flame does not." },
  { id: 7089, name: "Aethros Navy Enlisted", tags: ["Passive", "Basic"], score: 5, desc: "You have served in the Aethros Navy. You have proficiency in Water Vehicles, Navigator's Tools, and one weapon of your choice. Navy officers recognise your service manner and will extend professional courtesy. You are also subject to Navy jurisdiction and can be recalled to active service in a declared emergency — at the DM's discretion." },
  { id: 7090, name: "Ardent-Blooded", tags: ["Passive", "Religion — Eternal Flame"], score: 5, desc: "You are descended from a Flamekeeper. Your melee and unarmed attacks deal an additional 1d4 Fire damage. Once per Long Rest, when you are reduced to 0 HP, the flame briefly asserts itself — you regain 1 HP and may immediately make one attack before falling unconscious if the saving throw ultimately fails." },
  { id: 7091, name: "Tested by Fire", tags: ["Passive", "Religion — Eternal Flame"], score: 5, desc: "You have undergone and survived a clerical ordeal of the Eternal Flame. You have Immunity to the Frightened condition and Resistance to Fire damage. The Eternal Flame's clergy treat you with formal recognition, which opens doors in Surath and closes them elsewhere." },
  { id: 7092, name: "Purifier", tags: ["Passive", "Religion — Eternal Flame"], score: 3, desc: "Your attacks against undead creatures deal an additional 1d6 Fire damage. Whenever you reduce an undead creature to 0 HP, it cannot be raised or reanimated by any means for 24 hours." },
  { id: 7093, name: "Flame Legion Veteran", tags: ["Passive", "Religion — Eternal Flame"], score: 4, desc: "You served in the Surath Dominion's Flame Legions. You have proficiency in Heavy Armour and two martial weapons of your choice. Dominion soldiers recognise your service bearing. Dominion clergy will also notice you and ask questions." },
  { id: 7094, name: "Ordeal-Marked", tags: ["Passive", "Religion — Eternal Flame"], score: 5, desc: "You bear the burn-scars of an Eternal Flame clerical ordeal. You have Immunity to Fire damage from non-magical sources. Flamekeepers treat you with specific respect — you have been tested and found worthy by the god's own mechanism." },
  { id: 7095, name: "Salt-Sworn", tags: ["Passive", "Religion — The Deep Current"], score: -3, desc: "You have made a private oath to the Deep Current — terms known only to you and the DM. You gain advantage on Navigation, Weather-reading, and Survival checks at sea. If you break your oath, you gain the Cursed condition until you return to open water and make recompense." },
  { id: 7096, name: "Acknowledged", tags: ["Passive", "Religion — The Deep Current"], score: 4, desc: "The Deep Current has acknowledged your presence. Once per session, the DM must give you one piece of information via the behaviour of water, weather, or sea creatures — wherever you are, the god finds a way to communicate. This information is accurate but will not always be immediately interpretable." },
  { id: 7097, name: "Drowned Choir Initiate", tags: ["Passive", "Religion — The Deep Current", "DM Granted"], score: 2, desc: "You have trained with the Drowned Choir in the practice of the Listening. Once per Long Rest, you may spend 10 minutes in contact with salt water and attempt a DC 15 Wisdom check. On a success, the DM will share one piece of information about a recent death connected to the current location or a current threat." },
  { id: 7098, name: "Storm-Read", tags: ["Passive", "Religion — The Deep Current"], score: 5, desc: "You have advantage on all checks to predict, navigate through, or survive storms and extreme weather at sea. Once per Long Rest, you may ask the DM whether the weather in the next 24 hours will be safe or dangerous for sailing — the answer is always accurate." },
  { id: 7099, name: "The Below Watches", tags: ["Passive", "Religion — The Deep Current"], score: 4, desc: "Aquatic creatures of CR 3 or lower will not attack you unless commanded. Once per Long Rest, if you are submerged in salt water, you may sense the direction of the nearest significant threat within 1 mile — the god does not name it, but it points." },
  { id: 7100, name: "Ember-Touched", tags: ["Passive", "Religion — Order of the Undying Vigil"], score: 5, desc: "You have stood before the Vigil Fire and it welcomed you. You have Resistance to Necrotic damage. Undead creatures of CR 2 or lower will not willingly approach within 10 feet of you unless commanded. Members of the Order treat you as a person of established character." },
  { id: 7101, name: "Warden-Trained", tags: ["Passive", "Religion — Order of the Undying Vigil"], score: 4, desc: "You have studied under a Warden of the Order. You have Advantage on all checks to track, identify, and locate undead creatures. While you are actively hunting a designated undead target, that creature cannot use supernatural senses to detect your presence." },
  { id: 7102, name: "Ember Holder", tags: ["Passive", "Religion — Order of the Undying Vigil"], score: 15, desc: "Once per Long Rest, when an ally within 30 feet of you would be reduced to 0 HP, you may use your Reaction to have them instead drop to 1 HP. This does not require line of sight." },
  { id: 7103, name: "The Final Patrol", tags: ["Passive", "Religion — Order of the Undying Vigil"], score: 6, desc: "Any undead creature you reduce to 0 HP cannot be raised, reanimated, or restored by any means. This includes Ageless — if their skull is subsequently destroyed. The Order will hear about you if they haven't already." },
  { id: 7104, name: "Warden's Discipline", tags: ["Passive", "Religion — Order of the Undying Vigil"], score: 4, desc: "At the start of every combat, gain temporary HP equal to your proficiency bonus. You have advantage on saving throws against the Frightened and Charmed conditions when the source is an undead creature." },
  { id: 7105, name: "Oath-Bound", tags: ["Passive", "Religion — The Ironbound"], score: 5, desc: "You have entered into a formal oath with the Ironbound — terms set with the DM at character creation. While you honour your oath, you cannot be Charmed or Frightened, and attacks made against you while fulfilling a sworn duty deal 2 less damage. If you break your oath, you gain the Doomed condition until the Ironbound's clergy ritually releases you." },
  { id: 7106, name: "Honourable End", tags: ["Passive", "Religion — The Ironbound"], score: 4, desc: "You have Resistance to damage from undead creatures. When you reach 0 HP for the first time in any combat, you may choose the manner of your incapacitation — falling dramatically, collapsing in a specific direction, or making one final statement before losing consciousness." },
  { id: 7107, name: "Compact Sworn", tags: ["Passive", "Religion — The Ironbound"], score: 6, desc: "You have taken an Ironwall Compact service oath witnessed by Ironbound clergy. You have Resistance to necrotic damage and advantage on saving throws against the Frightened condition when facing undead. Compact soldiers recognise your oath-mark and will treat you as a fellow soldier." },
  { id: 7108, name: "Last Rites", tags: ["Passive", "Religion — The Ironbound"], score: 3, desc: "When you perform last rites over a fallen creature, that creature cannot be raised as undead by any means for 7 days. This takes 10 minutes and requires the body to be sufficiently intact." },
  { id: 7109, name: "Word as Iron", tags: ["Passive", "Religion — The Ironbound"], score: 4, desc: "When you make a spoken promise in front of at least one witness, you are magically compelled to fulfil it by any means available. You cannot be magically compelled to break a promise you have made. You gain advantage on all Persuasion checks — people instinctively sense that when you say something, you mean it." },
  { id: 7110, name: "Thread-Reader", tags: ["Passive", "Religion — The Weaver", "DM Granted"], score: 5, desc: "Once per Long Rest, you may ask the DM a yes/no question about the future of a current situation — the answer reflects what the Weaver has recorded of fate's current thread. This is not prophecy. The thread can be cut. But it is accurate as of this moment." },
  { id: 7111, name: "Memory-Keeper", tags: ["Passive", "Religion — The Weaver"], score: 3, desc: "You have a perfect and indelible memory for everything you have personally witnessed. You cannot be magically compelled to forget, and illusions that attempt to overwrite your memories automatically fail against you. Once per session, you may ask the DM to confirm one detail of something you witnessed — they must answer accurately." },
  { id: 7112, name: "Hidden Congregation", tags: ["Passive", "Religion — The Weaver"], score: 4, desc: "You are a member of a Weaver congregation. You know the signs and safe-house codes that Weaver faithful use across all three continents. Once per session, in any settlement of 500 people or more, you may attempt a DC 12 Investigation check to locate a Weaver contact who can provide shelter, information, or passage." },
  { id: 7113, name: "The Pattern Shifts", tags: ["Passive", "Religion — The Weaver", "DM Granted"], score: 5, desc: "Once per campaign, the Weaver shows you a moment where fate's current thread has been severed and replaced with something new. The DM will describe what you perceive — not the cause, but the before and after. This vision is always accurate and always relevant." },
  { id: 7114, name: "Magic Denier", tags: ["Cursed", "Passive", "Legendary"], score: -30, desc: "You are completely immune to all magical effects — harmful and beneficial alike. Spells cannot target you, magical auras do not affect you, healing magic does not work on you, and enchantments slide off you entirely. You must be a fully martial class with no magical ability — Fighter, Barbarian, Ranger, Rogue, or Monk. Any multiclass into a spellcasting class immediately removes this card. You recover HP only through rest, medicine, or mundane means. Magic simply does not acknowledge your existence, and you return the favour." },
  { id: 6214, name: "Death Refused", tags: ["Cursed", "Passive", "Undead", "Legendary"], score: -20, desc: "The Rejected Soul: You have Advantage on Death Saving Throws. Not Yet: Once per Long Rest, when you fail your third Death Save, instead reset your Death Saves to zero. You remain unconscious. Death's Mark: Clerics, paladins, undead, and celestial creatures can instinctively sense that something about you is wrong." },
  { id: 6215, name: "The Hollow Emperor", tags: ["Cursed", "Passive", "Undead", "Legendary"], score: -25, desc: "Perfect Disguise: Gain all benefits of Ageless' Perfect Disguise. Majesty of the Damned: Gain proficiency in Persuasion, Deception, and Intimidation — Expertise if already proficient. Crown of Forgotten Bones: Once per Long Rest, as an Action, all creatures of your choice within 30 feet must make a Wisdom Saving Throw or be Charmed for 1 minute. Ancient Authority: Undead creatures with CR less than your level automatically begin one attitude step friendlier toward you." },
  { id: 6213, name: "The Last Witness", tags: ["Passive", "Undead", "Legendary"], score: -20, desc: "Before Kingdoms: Gain proficiency in Arcana, History, and Religion — Expertise if already proficient. Echoes of Ages: Once per Long Rest, ask the DM one question about a location, artifact, historical event, or creature. The answer must be truthful, though it may be cryptic. Burden of Memory: You can never be surprised." },
  { id: 7115, name: "Varreth's Echo", tags: ["Passive", "Undead", "The Waking", "Legendary", "DM Granted"], score: -15, desc: "You are one of the original breath-survivors. You are Ageless — gain all benefits and conditions of the Ageless attribute card. Once per Long Rest, as an Action, you may exhale Varreth's breath. Any target struck that is reduced to 10 HP or fewer must succeed on a DC 14 Constitution saving throw or immediately become a Brainless under your command. The Order of the Undying Vigil would consider you their highest-priority target on Aethros if they knew." },
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
  "Arcane School": "#4f3b8f",
  Armada: "#2f2a4f",
  Armor: "#1a3a5c",
  Basic: "#3d5a3d",
  Cursed: "#8B0000",
  "DM Granted": "#5b3b8c",
  Destiny: "#a67c00",
  Dragon: "#7b2f24",
  Legendary: "#7B5800",
  Leviathan: "#105b63",
  Navy: "#25466b",
  Passive: "#2d4a2d",
  "Religion — Eternal Flame": "#333",
  "Religion — Khevarai Nature Spirits": "#315c38",
  "Religion — Order of the Undying Vigil": "#7a4f19",
  "Religion — Remnant Orders": "#333",
  "Religion — The Deep Current": "#105b63",
  "Religion — The Eternal Flame": "#9b3a16",
  "Religion — The Ironbound": "#59616b",
  "Religion — The Vaelthari Triad": "#333",
  "Religion — The Weaver": "#534489",
  Romley: "#6b5b2a",
  Sea: "#1f6f8b",
  "The Waking": "#3d234d",
  Undead: "#4a5a4a",
  Verath: "#9b5c2e",
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

  function tagVisibilityStats(tagName: string) {
    const taggedCards = ATTRIBUTE_CARDS.filter((card) => card.tags.includes(tagName));
    const visibleCount = taggedCards.filter((card) => isCardVisible(card.id, visibility)).length;

    return {
      total: taggedCards.length,
      visible: visibleCount,
      hidden: taggedCards.length - visibleCount,
      allVisible: taggedCards.length > 0 && visibleCount === taggedCards.length,
    };
  }

  async function setTagVisibility(tagName: string, isVisible: boolean) {
    if (!adminUnlocked || !campaignId) return;

    const taggedCards = ATTRIBUTE_CARDS.filter((card) => card.tags.includes(tagName));
    if (taggedCards.length === 0) return;

    const rows = taggedCards.map((card) => ({
      campaign_id: campaignId,
      card_id: card.id,
      is_visible: isVisible,
    }));

    setVisibility((current) => {
      const next = { ...current };
      taggedCards.forEach((card) => {
        next[card.id] = isVisible;
      });
      return next;
    });

    const { error } = await supabase
      .from("campaign_attribute_visibility")
      .upsert(rows, { onConflict: "campaign_id,card_id" });

    if (error) {
      setMessage(error.message);
      loadAttributeData();
      return;
    }

    setMessage(`${tagName} attributes are now ${isVisible ? "visible" : "hidden"}.`);
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
          {adminUnlocked && (
            <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 text-[#251b10]">
              <div className="mb-3">
                <h3 className="font-serif text-xl font-bold">GM Tag Visibility</h3>
                <p className="text-sm">Toggle entire attribute groups on or off without opening each card.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {allTags.filter((tagName) => tagName !== "All").map((tagName) => {
                  const stats = tagVisibilityStats(tagName);

                  return (
                    <div key={tagName} className="flex items-center gap-2 rounded-lg border border-[#9a7b45] bg-[#fff0c7] px-3 py-2">
                      <span
                        className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e8d5a3]"
                        style={{ background: TAG_COLORS[tagName] || "#333", borderColor: "rgba(200,170,100,0.3)" }}
                      >
                        {tagName}
                      </span>
                      <span className="text-xs">
                        {stats.visible}/{stats.total} visible
                      </span>
                      <button
                        onClick={() => setTagVisibility(tagName, !stats.allVisible)}
                        className={`rounded px-2 py-1 text-xs font-bold ${stats.allVisible ? "bg-[#5b1f1f] text-[#fff0c7]" : "bg-[#1f4d2e] text-[#fff0c7]"}`}
                      >
                        {stats.allVisible ? "Hide Tag" : "Show Tag"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
