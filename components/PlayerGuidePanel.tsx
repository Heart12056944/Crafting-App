"use client";

import React from "react";
import { BookMarked, BookOpenText, Castle, CloudSun, Coins, Flag, Hammer, HeartPulse, Hourglass, PawPrint, Pickaxe, Scroll, Sprout, Store, UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { GATHERING_ATTEMPTS_PER_DAY } from "@/data/gatheringSpots";
import { PROFICIENCY_BY_LEVEL } from "@/data/abilityScores";
import { MOUNT_RULES } from "@/data/husbandry";

// Plain-language guide to what players can do in the Codex. Keep it in step
// with the features: claiming, inventories, coins, shops, salvage, upgrades,
// gathering and cooking.

type Rule = { title: string; body: React.ReactNode };
type Section = { title: string; icon: React.ComponentType<{ className?: string }>; intro?: string; rules: Rule[] };

const SECTIONS: Section[] = [
  {
    title: "Finding your way",
    icon: BookMarked,
    rules: [
      {
        title: "Tab groups",
        body: "The tabs are grouped: Character (your sheet, inventory, cards and the journal), Crafting (recipes, materials, gathering, the herd, looting and the larder), World (travel, shops, the bounty board, factions and the homestead) and Game Master (the GM's own pages, and the GM sign-in). Pick a group, then a tab; each group remembers the tab you last used.",
      },
      {
        title: "Saving and backups",
        body: "Everything saves as you go, one character at a time, so two players changing their own characters never overwrite each other. The GM also keeps backups of the whole campaign, taken automatically before each Pass Day, long time skip and the end of a combat, and can put the campaign back to any of them if something goes wrong.",
      },
    ],
  },
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
      {
        title: "My Character",
        body: "The My Character tab shows your character at a glance: ability scores, skills, tools, attribute cards, coin purse, everything you carry, and the animals you keep or ride. If you play more than one, switch between them with the tabs at the top.",
      },
      {
        title: "Future characters",
        body: "The GM can make a character you'll play later claimable before it joins the party. You can claim it now, but it stays out of everything else until the GM makes it active.",
      },
      {
        title: "Level and proficiency bonus",
        body: `Each character has a level; the GM's Level Up Party button adds one to everyone. Your proficiency bonus comes from your level (${PROFICIENCY_BY_LEVEL.map((row) => `levels ${row.levels}: +${row.bonus}`).join(", ")}) and is used in every crafting, harvesting, gathering, salvage and Animal Handling check. Expertise is double.`,
      },
      {
        title: "Skills",
        body: "Your proficiency in Harvesting, Mining, Woodcutting, Foraging, Fishing and Animal Handling is set on the Characters tab to match your character sheet. A gathering check uses the skill or the tool proficiency, whichever is higher.",
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
        title: "Carry weight",
        body: "Everything you carry has a weight, and coins weigh a pound per 50. My Character shows your total against your carrying capacity (STR × 15 lb, more with a bigger pack such as a Farmhand's Pack); over it, your speed drops to 5 ft. Inventory shows each holder's total. Your mount can carry more: see its card.",
      },
      {
        title: "Sending items",
        body: "Press Send beside an item, choose how many, then pick the character (or the party stash) to send it to. Only characters active in the party are listed. A half-used consumable stays with you unless you send the whole stack.",
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
    title: "Husbandry",
    icon: PawPrint,
    intro: "Keep prey animals for what they give. The Husbandry tab shows the day count, any wild animals nearby, and your herd.",
    rules: [
      {
        title: "Taming a wild animal",
        body: "When the GM places a wild animal nearby (a mountain ram, ridge stag, tuskback boar or reedfowl), one of your characters can try to tame it: d20 + WIS + Animal Handling proficiency against the animal's DC. Each animal gets one attempt. On a success it joins you; on a failure it bolts.",
      },
      {
        title: "Dogs and cats",
        body: "Wolves, direwolves, foxes, jackals, feral hounds, snow cats, mousers, lynxes, panthers and sabretooths can be tamed too, but they're hard: DC 17, up to 19 for the biggest. Tamed hunters bring back game meat every few days, and a direwolf or sabretooth can even be ridden. A creature you subdue in a fight can be marked \"Tame\" when the combat ends, and it waits in Husbandry for the roll.",
      },
      {
        title: "Convincing instead",
        body: "A druid, a ranger, or anyone who can speak with animals may convince the animal instead: the DC is 2 lower and you roll with advantage. The GM marks who can do this.",
      },
      {
        title: "Farm animals",
        body: "Kine (cows), hogs, coop fowl and skerry goats are bought, not tamed. Pay from your purse and the GM adds them to your herd.",
      },
      {
        title: "Butchering",
        body: "Rams, stags, boars, kine and hogs can be butchered from their details. The animal goes onto the Looting table and is harvested like any creature, so the cuts depend on the harvest rolls.",
      },
      {
        title: "Collecting",
        body: "Each animal gives things on a schedule: milk and eggs every day, wool every week, shed antler every month, and a boar will root up food daily. Some only come from females (milk, eggs) or males (shed antler). Press the button when it says ready. Everything goes to the party's materials, and the day only moves on when the GM presses Pass Day.",
      },
      {
        title: "Milk and cheese",
        body: "Milk sours in a day or two, so turn it into cheese with Cook's Utensils: kine milk into curd, ewe's milk into ridge wheel, hind's milk into hind cheese, goat's milk into brinecheese. Farm milk and cheese can also be bought at markets.",
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
        title: "Preserving",
        body: "Curing salt, vinegar, smoke and fat keep food for months. Cure belly from a boar or hog into smokebelly, make hard spiced or dry-cured sausages, hams, brined brisket, potted meat, pickles and pickled eggs. Preserved foods are rations: press Use as each one is eaten.",
      },
      {
        title: "Vegetables, fruit & herbs",
        body: "Forage wild produce past the Wall: tubers, ferns and smoky herbs on the rock slopes, berries and frost-pods by the tarns, and rarer things in the warm springs. Farm and island produce (roots, leaves, beans, orchard and island fruit, seaweed) is sold at markets. Recipes may ask for a particular one or for \"any vegetable\", \"any fruit\" or \"any culinary herb\". The Larder tab shows what every food looks like.",
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
  {
    title: "Bounty Board",
    icon: Scroll,
    intro: "Jobs the GM posts for the party. Only creatures and items from this campaign appear.",
    rules: [
      {
        title: "How bounties are chosen",
        body: "A bounty can ask for several kinds of creature. The GM either picks them and how many, or rolls a random bounty sized to the party's level: common jobs (easy prey and small predators) ask for up to 8, rare ones (a fair fight) up to 5, and epic ones (a challenging fight) up to 3. Tough prey is rarer than predators of the same strength.",
      },
      {
        title: "Bounties",
        body: "Hunt the named creature. If the bounty asks for proof (a pelt, teeth, a claw...), harvest it from the kill on the Looting tab, then press Turn in proof: the proof leaves the party's materials and the reward is paid to whoever you choose. Without proof, press Report done and the GM pays out once they've checked.",
      },
      {
        title: "Commissions",
        body: "Someone wants an item crafted. Make it (or find it), then press Deliver with it in your pack or the party stash. Deliver at Superior quality, when Superior wasn't required, for 50% more.",
      },
    ],
  },
  {
    title: "Travel & Camp",
    icon: CloudSun,
    intro: "The calendar, the weather, food and mounts.",
    rules: [
      {
        title: "Regions",
        body: "The top of the Travel & Camp tab shows where the party is, from the village at the base of the Unwavering up to the Vigil, along the Wall, and past it. When the GM moves the party somewhere new, that region's gathering spots open (mining, woodcutting, foraging and fishing), and the materials you can find or harvest there show up in the codex. The Gathering tab shows the spots where you are right now, and random bounties come from the creatures that live there.",
      },
      {
        title: "The Still-Burning Forge",
        body: "Deep past the Wall, a dwarven forge still burns. Some recipes can only be made there: they're marked \"Only at the Still-Burning Forge\" and show up once you've found everything they need. At the Forge you can also smelt Forgeborn alloys (a rarity found nowhere else) and get broken tools repaired for free.",
      },
      {
        title: "Calendar",
        body: "Each Pass Day moves the date on. A year has four seasons of three 30-day months (Early, Mid and Late). Years are counted from the end of the Crimson Crusade: PCR for the years since (the Undying Vigil begins in 240 PCR), and BCR for the years before it.",
      },
      {
        title: "Weather",
        body: "A new day's weather is rolled for the season and climate. It can change gathering (rain helps fishing, storms stop it, snow slows foraging), make travel harder, spook mounts, or call for saves against cold or heat. The Travel & Camp tab shows today's effects.",
      },
      {
        title: "Dressing for the weather",
        body: "The Vigil has hard winters, rainy springs and autumns, and hot summers. On harsh days the GM may call for CON saves from anyone out in it: a winter coat (or wolf-leather jerkin, fur cloak) gives advantage against cold, and mittens stop frostbite; an oilskin cloak, or a tarp or tent for the camp, keeps the rain off; summer linens help in a heat wave, and without a waterskin the save is at disadvantage. A failed save is a level of exhaustion. The Travel & Camp tab shows what each character is carrying. Goggles, snowshoes and crampons help with snow glare, deep snow and ice.",
      },
      {
        title: "Long stretches of time",
        body: "The GM can pass weeks, months or years at once (resting at the Vigil, or time between chapters). They choose what happens: whether you eat from your packs, food spoils, wounds heal, downtime carries on, the herd's produce is collected, and so on. It's all written in the Journal.",
      },
      {
        title: "Rations",
        body: "Each Pass Day every active character eats one day's food: one ration or one serving of a dish, from their own pack first, then the party stash. Fresh meals are eaten before rations that keep. You can go 3 + your CON modifier days (at least 1) without food; after that, each day without food adds a level of exhaustion (−2 to d20 tests and −5 ft speed per level). A day with food and rest takes one level away. If an inn or host feeds you, the GM ticks Meals provided and nothing is eaten.",
      },
      {
        title: "Eating for a bonus",
        body: "Your daily food is eaten for you. Press Use on a meal only when you eat it for its bonus.",
      },
    ],
  },
  {
    title: "Journal & rumours",
    icon: BookOpenText,
    intro: "The party's story so far, written as it happens.",
    rules: [
      {
        title: "The log",
        body: "Every new day, fight, bounty, purchase and sale, tamed animal, injury, illness and bit of downtime is written in the Journal by day. Handy for recaps.",
      },
      {
        title: "Rumours",
        body: "Things the party has heard, posted by the GM. Chase them or don't; the GM marks them resolved when they're settled.",
      },
    ],
  },
  {
    title: "Factions",
    icon: Flag,
    intro: "Where the party stands with the groups it deals with, from −100 to 100.",
    rules: [
      {
        title: "Gaining standing",
        body: "Jobs on the Bounty Board can be posted for a faction; finishing them raises your standing with it. The GM can also raise or lower it for what you do in play.",
      },
      {
        title: "What standing does",
        body: "A faction's shops give 5% off when you're Friendly (15+), 10% when Honoured (40+) and 15% when Exalted (75+), and pay a little more for what you sell. Unfriendly factions charge 10% more; hostile ones won't trade at all.",
      },
      {
        title: "The Order of the Undying Vigil",
        body: "In a Vigil campaign, My Character shows your rank in the Order: the Unlit, the Kindled, the Steadfast, the Tempered, the Unwavering, and the Vigil itself. The ranks are not a chain of command; they record what Verath has witnessed in you. The GM names you to a new rank and records the deeds the fire has seen, and each rank shows what it would take to reach the next. The Tempered carry Verath's mark, and no more than nine are ever Unwavering.",
      },
    ],
  },
  {
    title: "Prices",
    icon: Store,
    intro: "Shops react to what you buy and sell.",
    rules: [
      {
        title: "Supply and demand",
        body: "Each purchase pushes that item's price up a little at that shop; each sale floods it and the shop pays less. The effect fades a day at a time, so it pays to sell your pelts in more than one place, or to wait.",
      },
    ],
  },
  {
    title: "Homestead",
    icon: Castle,
    intro: "The party's base. At the Vigil, everything is already built.",
    rules: [
      {
        title: "Facilities",
        body: "A forge, workshop, apothecary and kitchen give +1 to +3 to crafting checks with their tools. An infirmary helps against disease and speeds healing, stables hold more animals, a training yard shortens downtime training, and a library helps research.",
      },
    ],
  },
  {
    title: "Injuries & illness",
    icon: HeartPulse,
    intro: "Wounds that linger and diseases that spread.",
    rules: [
      {
        title: "Lingering injuries",
        body: "When the GM calls for it (dropping to 0 HP, a brutal critical), roll on the lingering injury table from My Character. Most heal with days of rest; losing an eye or a hand needs powerful magic.",
      },
      {
        title: "Diseases",
        body: "Grave rot from undead bites, marsh ague from the tarns, wound fever, frostbite and rattle cough. Each Pass Day you make a CON save: three in a row and you recover, failures make it worse. Use the listed remedy from your pack (a Rotbane Poultice or Bitterleaf Draught, say) to cure it, or a helping item for advantage on the next save.",
      },
    ],
  },
  {
    title: "Downtime",
    icon: Hourglass,
    intro: "What your character does on days off. Set it on My Character; it happens at each Pass Day.",
    rules: [
      {
        title: "Activities",
        body: "Training (learn a tool: 5 gp a day for 10 − INT workweeks), Working (earn coin), Recuperating (advantage against disease, faster healing), Researching (1 gp a day; the GM answers your rolls) and Carousing (1 gp a day; make contacts or trouble).",
      },
    ],
  },
  {
    title: "The wild",
    icon: Sprout,
    intro: "The land reacts to the party.",
    rules: [
      {
        title: "Seasons",
        body: "Plants, eggs and some fish only grow in their seasons: frostcurl in spring, berries in summer and autumn, embergourds in autumn, and rimepods only after a hard frost. A gathering spot tells you what's out of season.",
      },
      {
        title: "Picked-over spots",
        body: "After three attempts at the same spot, each attempt adds +1 to its DC (up to +5). Spots recover one attempt a day.",
      },
      {
        title: "Hunting pressure",
        body: "Kill a lot of one creature and it thins out, gets scarce, then is hunted out for a while. Hunt the predators hard and the prey animals thrive.",
      },
    ],
  },
  {
    title: "Mounts",
    icon: PawPrint,
    intro: "Horses, mules and ponies are bought; tamed ridge stags and tuskback boars can be ridden too. Track them on the Travel & Camp tab.",
    rules: MOUNT_RULES,
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
