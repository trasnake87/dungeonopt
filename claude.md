# Queslar Dungeon Optimizer

## Overview
Stat optimizer for Queslar fighters to maximize win rate against dungeons.

## Files
- `test-api.js` - Verifies simulator works with API (1.617% at level 600)
- `optimizer.js` - Main optimizer with two-phase gold-based stat reallocation
- `battle-diagnostic.js` - Analyzes mob stats, hit/dodge rates, damage exchange at various levels
- `stat-analysis.js` - Tests optimal stat ratio theories (health/defense, hit/dodge, damage/crit)
- `dung/` - Original QueslarDungeonSim code (unchanged)

## Configuration
- API Key: `qs_P1e4LELHO7fVSWOPYS6MKfS0YoJTZ5S1`
- Dungeon Level: 650
- Battles per test: 10,000,000
- Worker threads: 8
- Gold budgets: 20M -> 10M -> 5M (adaptive)

## Running
```bash
# Main optimizer
node optimizer.js

# Diagnostic (see mob stats, win rates at different levels)
node battle-diagnostic.js

# Stat ratio analysis
node stat-analysis.js
```

## How Optimizer Works
1. Loads fighters from API: `https://http.v2.queslar.com/api/character/fighter/presets`
2. Calculates baseline win rate
3. **Phase 1**: Test adding gold to each stat (5 fighters × 6 stats = 30 tests)
4. **Phase 2**: Test removing gold from each stat to fund best destination (29 tests)
5. Applies best improvement, repeats
6. Reduces gold budget when no improvements found

## Cost Formula
Gold cost for N stat points: `(N × (N+1) / 2) × 10,000`

| Gold | Points |
|------|--------|
| 20M  | 62 pts |
| 10M  | 44 pts |
| 5M   | 31 pts |

Key functions:
- `pointsToGold(points)` - Calculate gold cost
- `pointsToRemoveForGold(currentPoints, targetGold)` - Points to remove to free up gold
- `pointsToAddForGold(currentPoints, targetGold)` - Points gained from adding gold

## Stat Formulas
| Stat | Formula | Per Point |
|------|---------|-----------|
| Health | 500 + 100 × pts | +100 HP |
| Damage | 100 + 25 × pts | +25 dmg |
| Hit | 50 + 50 × pts | +50 hit |
| Dodge | 50 + 50 × pts | +50 dodge |
| Defense | 25 + 10 × pts | +10 def (pre-calc) |
| Crit | 0.25 × pts / 100 | +0.25% crit |

Defense calculation: `min(1 - 1/((1 + (def + min(20k, def)*9)/50k)^0.25), 0.95)`

Hit chance: `min(0.25 + 0.75 × (hit / (hit + dodge)), 0.95)`

## Fighter Classes
- **Shadow Dancer**: Double damage on next attack after dodging
- **Crusader**: +20% damage per dead ally
- **Paladin**: 25% damage reduction aura for team
- **Bastion**: +50% dodge aura for team
- **Priest**: Heals allies

## Current Team (Level 650)
| Fighter | Class | Position | Key Stats |
|---------|-------|----------|-----------|
| Fighter 1 | Shadow Dancer | [1,0] | 149k HP, 21k dmg, 39k dodge, 80% crit |
| Fighter 2 | Bastion | [1,1] | Dodge aura support |
| Fighter 3 | Priest | [2,1] | Healer |
| Fighter 4 | Paladin | [2,0] | DR aura support |
| Fighter 5 | Crusader | [0,1] | Damage dealer |

## Stat Analysis Results (Level 300)
Best ratios for Shadow Dancer:
- **Health vs Defense**: 100% health / 0% defense
- **Hit vs Dodge**: 0% hit / 100% dodge
- **Damage vs Crit**: 100% damage / 0% crit
- **Category split**: 20% survival / 80% offense

Key insight: Defense has severe diminishing returns; dodge provides both defense AND offense (double damage proc).

## Win Rates by Level
| Level | Full Squad | Notes |
|-------|------------|-------|
| 400 | 99.997% | Trivial |
| 500 | 68.3% | Competitive |
| 600 | 1.6% | Current baseline |
| 650 | 0.018% | Target level |

## Technical Notes
- ES Modules: `{"type": "module"}` in package.json
- Clone fighters: `Object.create(Object.getPrototypeOf(original))` + `Object.assign`
- Mock `window.i18nManager` with all methods for Node.js
- FightersSquad constructor: `(f00, f10, f20, f01, f11, f21)` - column-first
- API placement: use `placement.column` for row (inverted)
- Find dungeon preset: `data.output.find(item => item.preset.assignment === 'dungeon')`

## Baseline (Nov 2025)
- Level 600: 1.617% win rate
- Level 650: 0.018% win rate
