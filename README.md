# JSON Content Refactor

Place these files in your project using this structure:

```text
data/
├─ attributes/
│  └─ attributeCards.json
├─ rewards/
│  └─ rewardDefinitions.json
├─ companions/
│  └─ companionDefinitions.json
├─ crafting/
│  ├─ materials.json
│  ├─ lootTables.json
│  ├─ recipes.json
│  ├─ refinementChains.json
│  └─ craftingRules.json
├─ attributeCards.ts
├─ rewardDefinitions.ts
├─ companionDefinitions.ts
├─ materialTiers.ts
├─ lootTables.ts
├─ recipesRaw.ts
├─ craftingRules.ts
└─ phaseEffects.ts
```

Also replace these components:

```text
components/AttributeCardsPanel.tsx
components/CompanionPanel.tsx
components/RewardsPanel.tsx
```

Important rename choices:
- `blackspireMaterials.json` is now `data/crafting/materials.json`
- `blackspireLootTables.json` is now `data/crafting/lootTables.json`
- `blackspireRecipes.json` is now `data/crafting/recipes.json`
- `blackspireRefinementChains.json` is now `data/crafting/refinementChains.json`

The TypeScript files now act as small adapters that preserve your existing imports/exports while loading the real content from JSON.
