# Queslar Dungeon Optimizer

Stat optimizer for Queslar fighters to maximize win rate against dungeons.

**Battle simulation by [anfneub](https://anfneub.github.io/QueslarDungeonSim/)**

## What It Does

This optimizer reallocates stat points across your 5-fighter dungeon team to maximize win rate. It uses a two-phase approach:

1. **Phase 1**: Find the best stat to add points to (tests all 30 fighter×stat combinations)
2. **Phase 2**: Find the best stat to remove points from to fund that addition

The optimizer runs millions of battle simulations per test to find statistically significant improvements.

## Features

- **Adaptive test counts**: Full scan on round 1, then top 5→10 for efficiency
- **Residual gold spending**: Automatically invests accumulated gold when ≥10M
- **Free gold investment**: Ask user for available gold and recommend best stat allocations
- **Parallel workers**: Uses 8 threads for fast simulation

## Requirements

- Node.js 18+
- `node-fetch` package
- **8 CPU cores** (default) - can be lowered for systems with fewer cores

```bash
npm install node-fetch
```

### Adjusting Worker Threads

The optimizer uses 8 parallel worker threads by default. If your system has fewer cores, edit this line in the optimizer file:

```javascript
const NUM_WORKERS = 8;  // Change to match your CPU cores
```

Recommended settings:
- 8+ cores: `NUM_WORKERS = 8`
- 4 cores: `NUM_WORKERS = 4`
- 2 cores: `NUM_WORKERS = 2`

More workers = faster simulation, but using more workers than CPU cores will slow things down.

## Configuration

Edit these values in `optimizer3.js`:

```javascript
const DUNGEON_LEVEL = 650;        // Target dungeon level
const BATTLES_PER_TEST = 2500000; // More = accurate but slower
const NUM_WORKERS = 8;            // Parallel threads
const API_KEY = 'your-api-key';   // Queslar API key
```

## Usage

```bash
node optimizer3.js
```

The optimizer will:
1. Fetch your current fighter stats from the Queslar API
2. Ask if you have free gold to invest (optional)
3. Show recommendations for free gold investment
4. Run continuous optimization, reallocating gold between stats
5. Display improvements as they're found

## How Gold/Points Work

Gold cost follows triangular numbers: `(n × (n+1) / 2) × 10,000`

| Gold | Points |
|------|--------|
| 20M  | 62 pts |
| 10M  | 44 pts |
| 5M   | 31 pts |

## Files

- `optimizer3.js` - **Recommended** - Full optimizer with free gold investment feature
  - Asks if you have free gold to invest before optimization
  - Shows ranked recommendations for where to spend new gold
  - Includes adaptive test counts and residual gold spending

- `optimizer2.js` - Optimizer without free gold investment
  - Use this for continuous background optimization
  - Same adaptive test counts and residual gold spending
  - Doesn't prompt for input, just runs

- `dung/` - Battle simulation engine (by anfneub)

## Credits

- Battle simulation: [anfneub's QueslarDungeonSim](https://anfneub.github.io/QueslarDungeonSim/)
