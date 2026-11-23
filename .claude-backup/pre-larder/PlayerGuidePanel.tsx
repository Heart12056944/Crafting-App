"use client";

import React from "react";
import { BookMarked, Coins, Hammer, Pickaxe, Store, UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { GATHERING_ATTEMPTS_PER_DAY } from "@/data/gatheringSpots";

// Plain-language guide to what players can do in the Codex. Keep it in step
// with the features: claiming, inventories, coins, shops, salvage, upgrades,
// gathering and cooking.

type Rule = { title: string; body: React.ReactNode };
type Section = { title: string; icon: React.ComponentType<{ className?: string }>; intro?: string; rules: Rule[] };

const SECTIONS: Section[] = [
  {
    title: "Your Characters",
    icon: UserRound,
    rules: [
      {
        title: "Claim your character",
        body: "Use the bar under the tabs to claim the character(s) you play. A claim locks that character to your computer, and nobody else can pick it. Crafting, looting, gathering, shops and your inventory then use your characters automatically.",
      },
      {
        title: "Changing computers",
        body: "Press release on your character to free it, then claim it again on the new computer. If you can't get back to the old one, ask the GM to release it.",
      },
    ],
  },
  {
    title: "Inventory & Consumables",
    icon: Hammer,
    rules: [
      {
        title: "Who holds what",
        body: "Finished items belong to a character or the party stash. Things you craft go to you, and gear you loot goes to whoever harvested it. Materials are different: they always go to the party's shared pool on the Materials tab.",
      },
      {
        title: "Using consumables",
        body: "Potions, meals, bombs, ammunition, oils and bait track their uses. Press Use whenever you drink, eat, throw, fire or apply one. A stack shows uses left on the opened one and in total. Gear like rods, tents and climbing kits is never used up.",
      },
      {
        title: "Giving items",
        body: "Give 1 or Give all to another character or the party stash. A half-used consumable stays with you unless you give the whole stack.",
      },
      {
        title: "Upgrades",
        body: "A crafted upgrade (a bowstring, armour plating, a weapon fitting and so on) shows Apply upgrade to… Pick a piece of your gear and the upgrade is fitted to it for good: it's used up and listed on the item. Upgraded items never stack with plain copies.",
      },
      {
        title: "Salvaging",
        body: (
          <>
            Crafted gear can be broken down with Salvage for materials. You roll the recipe&apos;s tool check (ability modifier + tool proficiency) against its DC. <strong>Beat the DC:</strong> about half the materials back. <strong>Natural 20 or beat it by 10:</strong> about three quarters. <strong>Miss by up to 5:</strong> a quarter. <strong>Worse, or a natural 1:</strong> nothing. The item is used up either way, along with any upgrades on it. Recovered materials go to the party pool.
          </>
        ),
      },
    ],
  },
  {
    title: "Coins",
    icon: Coins,
    rules: [
      {
        title: "Purses",
        body: "Every character has a purse, and the party has a shared fund. Purses hold real coins: platinum, gold, electrum, silver and copper. 10 cp = 1 sp, 5 sp = 1 ep, 2 ep = 1 gp, 10 gp = 1 pp.",
      },
      {
        title: "Sending coins",
        body: "Send coins from your own purse or the party fund to anyone else. The GM can add or take coins from any purse, for rewards, tolls, theft and so on.",
      },
      {
        title: "Making change",
        body: "When you buy something, the shop takes the right coins and gives change automatically. It pays exactly with your biggest coins when it can, and otherwise breaks a larger coin and hands back gold, silver and copper. You can never spend more than you have.",
      },
      {
        title: "The coin log",
        body: "Every coin change is recorded, with who, how much and why. Open it under the purses with Show recent coin changes.",
      },
    ],
  },
  {
    title: "Shops",
    icon: Store,
    intro: "The Shops tab only appears while the GM has a shop open, which happens when the party is near one.",
    rules: [
      {
        title: "What shops sell",
        body: "Basic materials: cloth, cord, fittings, ingots, planks, vials, common herbs, and what everyday hunters bring in (hides, pelts, wool, feathers, meat). Anything from dangerous creatures (monsters, undead, rare drops) is never for sale. You have to hunt or harvest it yourself.",
      },
      {
        title: "Buying",
        body: "Choose whose purse pays (yours or the party fund), set how many, and press Buy. Bought materials go to the party's shared pool, and bought items go to the buyer. Some goods are limited and can sell out.",
      },
      {
        title: "Selling",
        body: "Any open shop buys anything for half its value: party materials, or items from your inventory. A half-used consumable is worth only the uses left on it. The coins go to whoever is selected as paying.",
      },
      {
        title: "What things are worth",
        body: "Materials are priced by tier, from a few silver for raw goods to hundreds of gold for the rarest. Crafted items are worth more the harder the recipe, and Superior items are worth half again as much while Flawed ones are worth half.",
      },
    ],
  },
  {
    title: "Gathering & Cooking",
    icon: Pickaxe,
    rules: [
      {
        title: "Gathering",
        body: `Mine, chop, forage and fish at spots the GM has opened. Each character gets ${GATHERING_ATTEMPTS_PER_DAY} attempts per day (some attribute cards add more), and they come back when the GM passes the day. You need the right tool: a pickaxe, a woodcutter's axe, a herbalism kit or a fishing rod.`,
      },
      {
        title: "The roll and the mini-game",
        body: "Roll first: d20 + the activity's ability + tool proficiency against the spot's DC. Beating the DC makes the mini-game easier, and missing makes it harder. A natural 1 wastes the attempt; a natural 20 adds a loot roll and upgrades one result.",
      },
      {
        title: "Fishing gear",
        body: "A crafted fishing rod counts as your rod and widens the green zone. Bait in your inventory is used automatically, one use per attempt. Grub Bait gives +1 and a longer bite window. A Deeplight Lure gives +2 and upgrades a clean catch.",
      },
      {
        title: "Meat and cuts",
        body: (
          <>
            Harvesting a game animal can give real cuts of meat, in three grades. <strong>Everyday cuts</strong> are common: necks, shanks, brisket, jowl, hocks, drumsticks and fillets. <strong>Choice cuts</strong> are rarer: shoulders, rib racks, hindquarters, loin chops, belly and ham. <strong>Prime cuts</strong> come only from the best harvests: backstrap, tenderloin, a rack or saddle of ram, boar loin and shark loin. Recipes ask for a grade (&ldquo;any meat cut&rdquo;, &ldquo;choice cut or better&rdquo;, &ldquo;prime cut&rdquo;), and any matching cut will do, with the cheapest used first. A few dishes need one particular cut, like a bear haunch or boar belly. Raw meat spoils in a few days unless it&apos;s cooked or cured.
          </>
        ),
      },
      {
        title: "Cooking",
        body: (
          <>
            Cook with Cook&apos;s Utensils. Every dish makes several servings or rations, so press Use as each person eats.{" "}
            <strong>Rations</strong> (dried meat, salted fish, trail cakes) keep you fed on the road for months.{" "}
            <strong>Plain meals</strong> are a hot meal and nothing more.{" "}
            <strong>Good meals</strong> give a small bonus, but only when the cook gets a Superior result.{" "}
            <strong>Fine meals</strong> use the best cuts and rare ingredients (DC 14 and up), and they give real bonuses like temporary HP, extra maximum HP, resistances or swimming, unless the cook botches them.
          </>
        ),
      },
      {
        title: "Attribute cards",
        body: "Gathering and harvesting attribute cards apply on their own. If you have one, its bonus is already in your roll and the mini-game.",
      },
    ],
  },
];

export default function PlayerGuidePanel() {
  return (
    <div className="space-y-7 font-serif">
      <Card
        className="rounded-2xl shadow-2xl border-2"
        style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" }}
      >
        <CardContent className="p-6 md:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <BookMarked className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Player Guide</h2>
          </div>
          <p>
            What you can do in the Codex beyond crafting and looting. The Crafting Rules and Looting Rules tabs cover how those rolls work.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            {SECTIONS.map((section) => (
              <a
                key={section.title}
                href={`#guide-${section.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className="rounded-full border border-[#9a7b45] bg-[#fff0c7] px-3 py-1 font-bold hover:bg-[#f4e3bd]"
              >
                {section.title}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <Card
            key={section.title}
            id={`guide-${section.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            className="rounded-2xl shadow-2xl border-2 scroll-mt-6"
            style={{ background: "linear-gradient(135deg, #f2dfb9, #e7d0a3)", borderColor: "#9a7b45", color: "#251b10" }}
          >
            <CardContent className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3">
                <Icon className="w-7 h-7" />
                <h3 className="text-2xl font-bold">{section.title}</h3>
              </div>
              {section.intro && <p className="text-sm italic">{section.intro}</p>}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {section.rules.map((rule) => (
                  <div key={rule.title} className="rounded-xl border-2 border-[#9a7b45] bg-[#f2dfb9] p-4">
                    <h4 className="text-lg font-bold">{rule.title}</h4>
                    <p className="text-sm leading-relaxed">{rule.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
