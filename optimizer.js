// Queslar Dungeon Stat Optimizer
// Greedy hill-climbing optimizer that moves stat points between fighters

import nodeFetch from 'node-fetch';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';

global.fetch = nodeFetch;

// Mock browser globals for the simulator
global.window = {
  location: { search: '' },
  i18nManager: {
    getBattleMsg: () => '',
    getTranslation: () => '',
    getMobInfo: () => 'Mob',
    getUIElement: () => '',
    getFighterName: (name) => name,
    getConsoleMsg: () => ''
  }
};
global.document = { getElementById: () => null };

import { Fighter } from './dung/characters/Fighter.js';
import { FightersSquad } from './dung/squads/FightersSquad.js';
import { MobsSquad } from './dung/squads/MobsSquad.js';
import { Battle } from './dung/battle/Battle.js';

const NUM_WORKERS = 8;
const __filename = fileURLToPath(import.meta.url);

// Configuration
const API_KEY = 'qs_P1e4LELHO7fVSWOPYS6MKfS0YoJTZ5S1';
const DUNGEON_LEVEL = 650;
const NUM_BATTLES = 2500000;

// Class mapping
const CLASS_MAPPING = {
  assassin: "Assassin",
  brawler: "Brawler",
  hunter: "Hunter",
  mage: "Mage",
  priest: "Priest",
  shadow_dancer: "Shadow Dancer",
  shadowDancer: "Shadow Dancer",
  shadowdancer: "Shadow Dancer",
  berserker: "Berserker",
  paladin: "Paladin",
  crusader: "Crusader",
  sentinel: "Sentinel",
  bastion: "Bastion",
};

// Tier multipliers
const TIER_MULTIPLIERS = {
  1: 1.1, 2: 1.2, 3: 1.3, 4: 1.4, 5: 1.5, 6: 1.75,
  7: 2, 8: 2.25, 9: 2.5, 10: 2.75, 11: 3, 12: 3.5,
};

// Stat names
const STATS = ['health', 'damage', 'hit', 'defense', 'critDamage', 'dodge'];

// Gold cost formula: n points costs (n * (n+1) / 2) * 10000 gold
function pointsToGold(points) {
  return (points * (points + 1) / 2) * 10000;
}

// Calculate how many points can be removed from currentPoints to free up targetGold
function pointsToRemoveForGold(currentPoints, targetGold) {
  // Cost of current points
  const currentCost = pointsToGold(currentPoints);
  // We want to reduce to a cost that's targetGold less
  const targetCost = currentCost - targetGold;
  if (targetCost < 0) return currentPoints; // Remove all

  // Find points for targetCost: points = (-1 + sqrt(1 + 8*cost/10000)) / 2
  const newPoints = Math.floor((-1 + Math.sqrt(1 + 8 * targetCost / 10000)) / 2);
  return currentPoints - newPoints;
}

// Calculate how many points can be added with targetGold starting from currentPoints
function pointsToAddForGold(currentPoints, targetGold) {
  const currentCost = pointsToGold(currentPoints);
  const newCost = currentCost + targetGold;
  const newPoints = Math.floor((-1 + Math.sqrt(1 + 8 * newCost / 10000)) / 2);
  return newPoints - currentPoints;
}

async function loadFromAPI() {
  console.log('Loading fighters from API...');
  const response = await fetch('https://http.v2.queslar.com/api/character/fighter/presets', {
    method: 'GET',
    headers: { 'QUESLAR-API-KEY': API_KEY }
  });
  const data = await response.json();

  const dungeonPreset = data.output.find(
    item => item.preset && item.preset.assignment === 'dungeon'
  );

  if (!dungeonPreset) {
    throw new Error('No dungeon preset found');
  }

  const fighters = dungeonPreset.fighters || [];
  const fighterData = [];

  for (const apiData of fighters) {
    const stats = apiData.stats || {};
    const equipment = apiData.equipment || {};
    const equipmentStats = equipment.stats || [];

    // Calculate equipment bonuses
    let equipmentBonuses = {
      health: 0, damage: 0, hit: 0, defense: 0, critDamage: 0, dodge: 0
    };

    equipmentStats.forEach(stat => {
      if (!stat || !stat.type) return;
      const tier = Math.max(1, parseInt(stat.tier) || 1);
      const multiplier = TIER_MULTIPLIERS[tier] || 1.0;

      let value;
      if (stat.type.toLowerCase().includes('crit')) {
        value = Math.max(0, parseFloat(stat.value) || 0) * multiplier * 100;
      } else {
        value = Math.round(Math.max(0, parseInt(stat.value) || 0) * multiplier);
      }

      switch (stat.type.toLowerCase()) {
        case 'health': equipmentBonuses.health += value; break;
        case 'damage': equipmentBonuses.damage += value; break;
        case 'hit': equipmentBonuses.hit += value; break;
        case 'defense':
        case 'defence': equipmentBonuses.defense += value; break;
        case 'critdamage':
        case 'crit_damage':
        case 'critical_damage': equipmentBonuses.critDamage += value; break;
        case 'dodge':
        case 'evasion': equipmentBonuses.dodge += value; break;
      }
    });

    const fighterClass = CLASS_MAPPING[apiData.class?.toLowerCase()] || "No Class";
    const row = apiData.placement.column;
    const col = apiData.placement.row;

    fighterData.push({
      name: apiData.name,
      class: fighterClass,
      row, col,
      stats: {
        health: parseInt(stats.health || 0),
        damage: parseInt(stats.damage || 0),
        hit: parseInt(stats.hit || 0),
        defense: parseInt(stats.defense || 0),
        critDamage: parseInt(stats.critDamage || 0),
        dodge: parseInt(stats.dodge || 0),
      },
      equipment: equipmentBonuses
    });

    console.log(`  ${apiData.name} (${fighterClass}) at [${row},${col}]`);
    const s = fighterData[fighterData.length - 1].stats;
    console.log(`    Stats: H:${s.health} D:${s.damage} Hit:${s.hit} Def:${s.defense} CD:${s.critDamage} Dg:${s.dodge}`);
  }

  return fighterData;
}

function createFightersGrid(fighterData) {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));

  for (const fd of fighterData) {
    const fighter = new Fighter(fd.class, {
      name: fd.name,
      fighter_health: fd.stats.health,
      fighter_damage: fd.stats.damage,
      fighter_hit: fd.stats.hit,
      fighter_defense: fd.stats.defense,
      fighter_crit: fd.stats.critDamage,
      fighter_dodge: fd.stats.dodge,
      object_health: fd.equipment.health,
      object_damage: fd.equipment.damage,
      object_hit: fd.equipment.hit,
      object_defense: fd.equipment.defense,
      object_crit: fd.equipment.critDamage,
      object_dodge: fd.equipment.dodge,
    });
    grid[fd.row][fd.col] = fighter;
  }

  return grid;
}

// Worker thread code
if (!isMainThread) {
  const { fighterData, numBattles, dungeonLevel } = workerData;

  // Recreate grid from fighter data
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));
  for (const fd of fighterData) {
    const fighter = new Fighter(fd.class, {
      name: fd.name,
      fighter_health: fd.stats.health,
      fighter_damage: fd.stats.damage,
      fighter_hit: fd.stats.hit,
      fighter_defense: fd.stats.defense,
      fighter_crit: fd.stats.critDamage,
      fighter_dodge: fd.stats.dodge,
      object_health: fd.equipment.health,
      object_damage: fd.equipment.damage,
      object_hit: fd.equipment.hit,
      object_defense: fd.equipment.defense,
      object_crit: fd.equipment.critDamage,
      object_dodge: fd.equipment.dodge,
    });
    grid[fd.row][fd.col] = fighter;
  }

  let wins = 0;
  for (let i = 0; i < numBattles; i++) {
    const newGrid = [];
    for (let row = 0; row < 3; row++) {
      newGrid[row] = [];
      for (let col = 0; col < 2; col++) {
        if (grid[row][col]) {
          const original = grid[row][col];
          const clone = Object.create(Object.getPrototypeOf(original));
          Object.assign(clone, original);
          clone.current_health = clone.total_health;
          clone.hit_counter = 0;
          newGrid[row][col] = clone;
        } else {
          newGrid[row][col] = null;
        }
      }
    }

    const fightersSquad = new FightersSquad(
      newGrid[0][0], newGrid[1][0], newGrid[2][0],
      newGrid[0][1], newGrid[1][1], newGrid[2][1]
    );
    const mobsSquad = new MobsSquad(dungeonLevel);
    const battle = new Battle(fightersSquad, mobsSquad);

    const result = battle.battle();
    if (result[0] === 'fighters') wins++;
  }

  parentPort.postMessage(wins);
}

// Run battles in parallel across worker threads
async function runBattles(fighterData, numBattles) {
  const battlesPerWorker = Math.floor(numBattles / NUM_WORKERS);
  const workers = [];

  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(__filename, {
      workerData: {
        fighterData,
        numBattles: battlesPerWorker,
        dungeonLevel: DUNGEON_LEVEL
      }
    });
    workers.push(new Promise((resolve, reject) => {
      worker.on('message', resolve);
      worker.on('error', reject);
    }));
  }

  const results = await Promise.all(workers);
  const totalWins = results.reduce((sum, wins) => sum + wins, 0);
  return totalWins / (battlesPerWorker * NUM_WORKERS);
}

function printCurrentStats(fighterData) {
  console.log('\nCurrent optimal stat allocation:');
  console.log('  | Fighter                   | health | damage | hit | defense | critDamage | dodge |');
  console.log('  |---------------------------|--------|--------|-----|---------|------------|-------|');

  let totalGold = 0;
  for (const fd of fighterData) {
    const s = fd.stats;
    const name = `${fd.name} (${fd.class})`.padEnd(25);
    console.log(`  | ${name} | ${String(s.health).padStart(6)} | ${String(s.damage).padStart(6)} | ${String(s.hit).padStart(3)} | ${String(s.defense).padStart(7)} | ${String(s.critDamage).padStart(10)} | ${String(s.dodge).padStart(5)} |`);

    // Calculate gold for this fighter
    for (const stat of STATS) {
      totalGold += pointsToGold(s[stat]);
    }
  }

  console.log(`\n  Total gold invested: ${(totalGold / 1000000).toFixed(2)}M`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('QUESLAR DUNGEON STAT OPTIMIZER');
  console.log('='.repeat(60));
  console.log(`Dungeon Level: ${DUNGEON_LEVEL}`);
  console.log(`Battles per test: ${NUM_BATTLES.toLocaleString()}`);
  console.log('');

  const fighterData = await loadFromAPI();

  // Calculate baseline
  console.log('\nCalculating baseline win rate...');
  const baselineRate = await runBattles(fighterData, NUM_BATTLES);
  console.log(`Baseline win rate: ${(baselineRate * 100).toFixed(3)}%`);

  let currentRate = baselineRate;
  let goldBudget = 20000000; // Start with 20M gold moves
  let improvementsThisRound = 0;
  let totalImprovements = 0;
  let round = 1;

  // Build list of all stats (fighter index + stat name)
  const allStats = [];
  for (let idx = 0; idx < fighterData.length; idx++) {
    for (const stat of STATS) {
      allStats.push({ idx, stat });
    }
  }

  console.log(`\nTotal stats to optimize: ${allStats.length}`);
  console.log('Starting two-phase optimization (30 + 29 tests per round)...\n');

  while (true) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round} - Testing ${(goldBudget/1000000).toFixed(0)}M gold moves`);
    console.log('='.repeat(60));

    // PHASE 1: Find best destination (add gold to each stat)
    console.log('\n  Phase 1: Finding best stat to invest in...');
    let bestDst = null;
    let bestDstRate = 0;
    let bestDstPointsAdded = 0;

    for (let i = 0; i < allStats.length; i++) {
      const dst = allStats[i];
      const dstFighter = fighterData[dst.idx];
      const dstPoints = dstFighter.stats[dst.stat];

      // Calculate points to add with goldBudget
      const pointsToAdd = pointsToAddForGold(dstPoints, goldBudget);
      if (pointsToAdd <= 0) continue;

      // Add the points
      dstFighter.stats[dst.stat] += pointsToAdd;

      // Test
      const rate = await runBattles(fighterData, NUM_BATTLES);

      process.stdout.write(`\r    Testing ${i + 1}/${allStats.length} destinations - Best: ${(bestDstRate * 100).toFixed(3)}%`);

      if (rate > bestDstRate) {
        bestDstRate = rate;
        bestDst = dst;
        bestDstPointsAdded = pointsToAdd;
      }

      // Undo
      dstFighter.stats[dst.stat] -= pointsToAdd;
    }

    console.log('');

    if (!bestDst) {
      console.log('  No valid destination found');
      break;
    }

    console.log(`    Best destination: ${fighterData[bestDst.idx].name}.${bestDst.stat} (+${bestDstPointsAdded}pts) = ${(bestDstRate * 100).toFixed(3)}%`);

    // PHASE 2: Find best source (remove gold from each stat except destination)
    console.log('\n  Phase 2: Finding best stat to pull from...');
    let bestSrc = null;
    let bestSrcRate = 0;
    let bestSrcPointsRemoved = 0;

    // First add the destination points
    fighterData[bestDst.idx].stats[bestDst.stat] += bestDstPointsAdded;

    for (let i = 0; i < allStats.length; i++) {
      const src = allStats[i];

      // Skip if same as destination
      if (src.idx === bestDst.idx && src.stat === bestDst.stat) continue;

      const srcFighter = fighterData[src.idx];
      const srcPoints = srcFighter.stats[src.stat];

      // Check if this stat has at least goldBudget invested
      const currentGold = pointsToGold(srcPoints);
      if (currentGold < goldBudget) continue;

      // Calculate points to remove for goldBudget
      const pointsToRemove = pointsToRemoveForGold(srcPoints, goldBudget);
      if (pointsToRemove <= 0) continue;

      // Remove the points
      srcFighter.stats[src.stat] -= pointsToRemove;

      // Test
      const rate = await runBattles(fighterData, NUM_BATTLES);

      process.stdout.write(`\r    Testing ${i + 1}/${allStats.length} sources - Best: ${(bestSrcRate * 100).toFixed(3)}%`);

      if (rate > bestSrcRate) {
        bestSrcRate = rate;
        bestSrc = src;
        bestSrcPointsRemoved = pointsToRemove;
      }

      // Undo
      srcFighter.stats[src.stat] += pointsToRemove;
    }

    // Undo destination add
    fighterData[bestDst.idx].stats[bestDst.stat] -= bestDstPointsAdded;

    console.log('');

    if (!bestSrc) {
      console.log('  No valid source found');
      break;
    }

    console.log(`    Best source: ${fighterData[bestSrc.idx].name}.${bestSrc.stat} (-${bestSrcPointsRemoved}pts)`);

    // Check if move improves over current
    if (bestSrcRate > currentRate) {
      // Apply the move
      fighterData[bestSrc.idx].stats[bestSrc.stat] -= bestSrcPointsRemoved;
      fighterData[bestDst.idx].stats[bestDst.stat] += bestDstPointsAdded;

      console.log(`\n  IMPROVEMENT FOUND!`);
      console.log(`  ${fighterData[bestSrc.idx].name}.${bestSrc.stat} (-${bestSrcPointsRemoved}pts) -> ${fighterData[bestDst.idx].name}.${bestDst.stat} (+${bestDstPointsAdded}pts)`);
      console.log(`  Win rate: ${(currentRate * 100).toFixed(3)}% -> ${(bestSrcRate * 100).toFixed(3)}%`);
      console.log(`  Improvement: +${((bestSrcRate - currentRate) * 100).toFixed(3)}%`);

      currentRate = bestSrcRate;
      totalImprovements++;

      printCurrentStats(fighterData);
    } else {
      console.log(`\n  No improvement found at ${(goldBudget/1000000).toFixed(0)}M gold level`);
      console.log(`  Best possible: ${(bestSrcRate * 100).toFixed(3)}% vs current: ${(currentRate * 100).toFixed(3)}%`);

      // Reduce budget
      if (goldBudget === 20000000) {
        goldBudget = 10000000;
        console.log('  Reducing to 10M gold moves...');
      } else if (goldBudget === 10000000) {
        goldBudget = 5000000;
        console.log('  Reducing to 5M gold moves...');
      } else {
        console.log('\n  Optimization complete - no further improvements possible');
        break;
      }
    }

    round++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('OPTIMIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total improvements: ${totalImprovements}`);
  console.log(`Final win rate: ${(currentRate * 100).toFixed(3)}%`);
  console.log(`Improvement from baseline: +${((currentRate - baselineRate) * 100).toFixed(3)}%`);
  printCurrentStats(fighterData);
}

if (isMainThread) {
  main().catch(console.error);
}
