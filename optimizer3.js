// Queslar Dungeon Stat Optimizer v3
// Optimized version with adaptive test counts + free gold investment feature

import nodeFetch from 'node-fetch';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

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
  const currentCost = pointsToGold(currentPoints);
  const targetCost = currentCost - targetGold;
  if (targetCost < 0) return currentPoints;

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

// Calculate total gold invested across all fighters
function getTotalGoldInvested(fighterData) {
  let totalGold = 0;
  for (const fd of fighterData) {
    for (const stat of STATS) {
      totalGold += pointsToGold(fd.stats[stat]);
    }
  }
  return totalGold;
}

function printCurrentStats(fighterData, totalBudget = null) {
  console.log('\nCurrent optimal stat allocation:');
  console.log('  | Fighter                   | health | damage | hit | defense | critDamage | dodge |');
  console.log('  |---------------------------|--------|--------|-----|---------|------------|-------|');

  let totalGold = 0;
  for (const fd of fighterData) {
    const s = fd.stats;
    const name = `${fd.name} (${fd.class})`.padEnd(25);
    console.log(`  | ${name} | ${String(s.health).padStart(6)} | ${String(s.damage).padStart(6)} | ${String(s.hit).padStart(3)} | ${String(s.defense).padStart(7)} | ${String(s.critDamage).padStart(10)} | ${String(s.dodge).padStart(5)} |`);

    for (const stat of STATS) {
      totalGold += pointsToGold(s[stat]);
    }
  }

  console.log(`\n  Total gold invested: ${(totalGold / 1000000).toFixed(2)}M`);
  if (totalBudget) {
    const residual = totalBudget - totalGold;
    console.log(`  Residual gold: ${(residual / 1000000).toFixed(2)}M`);
  }
}

// Spend residual gold - test adding to each stat and pick the best
async function spendResidualGold(fighterData, residualGold, allStats, currentRate) {
  console.log(`\n  ${'~'.repeat(50)}`);
  console.log(`  RESIDUAL ROUND: Spending ${(residualGold / 1000000).toFixed(2)}M residual gold`);
  console.log(`  ${'~'.repeat(50)}`);

  let bestDst = null;
  let bestRate = currentRate;
  let bestPointsAdded = 0;

  for (let i = 0; i < allStats.length; i++) {
    const dst = allStats[i];
    const dstFighter = fighterData[dst.idx];
    const dstPoints = dstFighter.stats[dst.stat];

    const pointsToAdd = pointsToAddForGold(dstPoints, residualGold);
    if (pointsToAdd <= 0) continue;

    dstFighter.stats[dst.stat] += pointsToAdd;
    const rate = await runBattles(fighterData, NUM_BATTLES);
    dstFighter.stats[dst.stat] -= pointsToAdd;

    process.stdout.write(`\r    Testing ${i + 1}/${allStats.length} - Best: ${(bestRate * 100).toFixed(3)}%`);

    if (rate > bestRate) {
      bestRate = rate;
      bestDst = dst;
      bestPointsAdded = pointsToAdd;
    }
  }

  console.log('');

  if (bestDst && bestRate > currentRate) {
    fighterData[bestDst.idx].stats[bestDst.stat] += bestPointsAdded;
    console.log(`  Residual spent: ${fighterData[bestDst.idx].name}.${bestDst.stat} (+${bestPointsAdded}pts)`);
    console.log(`  Win rate: ${(currentRate * 100).toFixed(3)}% -> ${(bestRate * 100).toFixed(3)}%`);
    return bestRate;
  } else {
    console.log(`  No improvement from residual spending`);
    return currentRate;
  }
}

// Ask user for input
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// Invest free gold - test in 20M increments across top 5 stats
async function investFreeGold(fighterData, freeGoldMillions, allStats, currentRate) {
  const freeGold = freeGoldMillions * 1000000;

  console.log(`\n${'#'.repeat(60)}`);
  console.log(`FREE GOLD INVESTMENT: ${freeGoldMillions}M gold`);
  console.log('#'.repeat(60));

  // First, find top 5 stats by testing 20M addition to each
  console.log('\nPhase 1: Finding top 5 stats to invest in...');
  let statResults = [];

  for (let i = 0; i < allStats.length; i++) {
    const dst = allStats[i];
    const dstFighter = fighterData[dst.idx];
    const dstPoints = dstFighter.stats[dst.stat];

    const pointsToAdd = pointsToAddForGold(dstPoints, 20000000);
    if (pointsToAdd <= 0) continue;

    dstFighter.stats[dst.stat] += pointsToAdd;
    const rate = await runBattles(fighterData, NUM_BATTLES);
    dstFighter.stats[dst.stat] -= pointsToAdd;

    statResults.push({ stat: dst, rate, pointsAdded: pointsToAdd });
    process.stdout.write(`\r  Testing ${i + 1}/${allStats.length}...`);
  }

  console.log('');

  // Sort and get top 5
  statResults.sort((a, b) => b.rate - a.rate);
  const top5 = statResults.slice(0, 5);

  console.log('\nTop 5 stats for investment:');
  for (let i = 0; i < top5.length; i++) {
    const t = top5[i];
    console.log(`  ${i + 1}. ${fighterData[t.stat.idx].name}.${t.stat.stat} = ${(t.rate * 100).toFixed(3)}%`);
  }

  // Now test investing in 20M increments
  console.log(`\nPhase 2: Testing ${freeGoldMillions}M investment in 20M increments...`);

  const numIncrements = Math.floor(freeGold / 20000000);
  const recommendations = [];

  for (const candidate of top5) {
    const dst = candidate.stat;
    const dstFighter = fighterData[dst.idx];
    const originalPoints = dstFighter.stats[dst.stat];

    // Test adding full amount
    let totalPointsAdded = 0;
    let currentPts = originalPoints;
    for (let inc = 0; inc < numIncrements; inc++) {
      const ptsToAdd = pointsToAddForGold(currentPts, 20000000);
      totalPointsAdded += ptsToAdd;
      currentPts += ptsToAdd;
    }

    if (totalPointsAdded <= 0) continue;

    dstFighter.stats[dst.stat] = originalPoints + totalPointsAdded;
    const rate = await runBattles(fighterData, NUM_BATTLES);
    dstFighter.stats[dst.stat] = originalPoints;

    recommendations.push({
      fighter: dstFighter.name,
      stat: dst.stat,
      pointsToAdd: totalPointsAdded,
      newRate: rate,
      improvement: rate - currentRate
    });
  }

  // Sort by improvement
  recommendations.sort((a, b) => b.improvement - a.improvement);

  console.log(`\n${'='.repeat(60)}`);
  console.log('INVESTMENT RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log(`Current win rate: ${(currentRate * 100).toFixed(3)}%\n`);

  for (let i = 0; i < recommendations.length; i++) {
    const r = recommendations[i];
    console.log(`${i + 1}. ${r.fighter}.${r.stat}`);
    console.log(`   Add ${r.pointsToAdd} points`);
    console.log(`   New win rate: ${(r.newRate * 100).toFixed(3)}% (+${(r.improvement * 100).toFixed(3)}%)`);
    console.log('');
  }

  if (recommendations.length > 0) {
    const best = recommendations[0];
    console.log(`\nBEST: Invest ${freeGoldMillions}M in ${best.fighter}.${best.stat} (+${best.pointsToAdd} pts)`);
    console.log(`Expected improvement: ${(currentRate * 100).toFixed(3)}% -> ${(best.newRate * 100).toFixed(3)}%`);
  }

  console.log('#'.repeat(60));
  return recommendations;
}

async function main() {
  console.log('='.repeat(60));
  console.log('QUESLAR DUNGEON STAT OPTIMIZER v3');
  console.log('='.repeat(60));
  console.log(`Dungeon Level: ${DUNGEON_LEVEL}`);
  console.log(`Battles per test: ${NUM_BATTLES.toLocaleString()}`);
  console.log('Optimization: Adaptive test counts (30->5->10->10->10->10 cycle)');
  console.log('');

  const fighterData = await loadFromAPI();

  // Calculate baseline
  console.log('\nCalculating baseline win rate...');
  const baselineRate = await runBattles(fighterData, NUM_BATTLES);
  console.log(`Baseline win rate: ${(baselineRate * 100).toFixed(3)}%`);

  let currentRate = baselineRate;
  let goldBudget = 20000000;
  let totalImprovements = 0;
  let round = 1;

  // Calculate total budget (initial gold invested)
  const totalBudget = getTotalGoldInvested(fighterData);
  console.log(`Total budget: ${(totalBudget / 1000000).toFixed(2)}M gold`);

  // Build list of all stats (fighter index + stat name)
  const allStats = [];
  for (let idx = 0; idx < fighterData.length; idx++) {
    for (const stat of STATS) {
      allStats.push({ idx, stat });
    }
  }

  // Ask user if they have free gold to invest
  const freeGoldInput = await askQuestion('\nDo you have free gold to invest? Enter amount in millions (e.g., 100) or 0/Enter to skip: ');
  const freeGoldMillions = parseInt(freeGoldInput) || 0;

  if (freeGoldMillions >= 20) {
    await investFreeGold(fighterData, freeGoldMillions, allStats, currentRate);
    console.log('\nNote: The above are recommendations only. Optimizer will now continue with reallocation optimization.\n');
  } else if (freeGoldMillions > 0) {
    console.log(`\nFree gold (${freeGoldMillions}M) is less than 20M minimum. Skipping investment analysis.\n`);
  }

  // Track top performers
  let topDestinations = []; // Array of { stat, rate, pointsAdded }
  let topSources = []; // Array of { stat, rate, pointsRemoved }
  let cycleRound = 1; // 1-6, resets after 6

  console.log(`\nTotal stats to optimize: ${allStats.length}`);
  console.log('Starting optimized two-phase optimization...\n');

  while (true) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round} (Cycle ${cycleRound}/6) - Testing ${(goldBudget/1000000).toFixed(0)}M gold moves`);
    console.log('='.repeat(60));

    // Determine which stats to test this round
    let dstStatsToTest, srcStatsToTest;

    if (cycleRound === 1) {
      // Full scan - test all 30/29
      dstStatsToTest = allStats;
      srcStatsToTest = allStats;
      console.log('  Full scan: testing all stats');
    } else if (cycleRound === 2) {
      // Test top 5 only
      dstStatsToTest = topDestinations.slice(0, 5).map(t => t.stat);
      srcStatsToTest = topSources.slice(0, 5).map(t => t.stat);
      console.log('  Quick scan: testing top 5 stats');
    } else {
      // Test top 10
      dstStatsToTest = topDestinations.slice(0, 10).map(t => t.stat);
      srcStatsToTest = topSources.slice(0, 10).map(t => t.stat);
      console.log('  Normal scan: testing top 10 stats');
    }

    // PHASE 1: Find best destination
    console.log(`\n  Phase 1: Finding best stat to invest in (${dstStatsToTest.length} tests)...`);
    let dstResults = [];
    let bestDstRate = 0;

    for (let i = 0; i < dstStatsToTest.length; i++) {
      const dst = dstStatsToTest[i];
      const dstFighter = fighterData[dst.idx];
      const dstPoints = dstFighter.stats[dst.stat];

      const pointsToAdd = pointsToAddForGold(dstPoints, goldBudget);
      if (pointsToAdd <= 0) continue;

      dstFighter.stats[dst.stat] += pointsToAdd;
      const rate = await runBattles(fighterData, NUM_BATTLES);
      dstFighter.stats[dst.stat] -= pointsToAdd;

      dstResults.push({ stat: dst, rate, pointsAdded: pointsToAdd });

      if (rate > bestDstRate) bestDstRate = rate;
      process.stdout.write(`\r    Testing ${i + 1}/${dstStatsToTest.length} destinations - Best: ${(bestDstRate * 100).toFixed(3)}%`);
    }

    console.log('');

    // Sort and update top destinations (only on full scan)
    dstResults.sort((a, b) => b.rate - a.rate);
    if (cycleRound === 1) {
      topDestinations = dstResults.slice(0, 10);
    }

    if (dstResults.length === 0) {
      console.log('  No valid destination found');
      break;
    }

    const bestDst = dstResults[0];
    console.log(`    Best destination: ${fighterData[bestDst.stat.idx].name}.${bestDst.stat.stat} (+${bestDst.pointsAdded}pts) = ${(bestDst.rate * 100).toFixed(3)}%`);

    // PHASE 2: Find best source
    console.log(`\n  Phase 2: Finding best stat to pull from (${srcStatsToTest.length} tests)...`);
    let srcResults = [];
    let bestSrcRate = 0;

    // Add destination points first
    fighterData[bestDst.stat.idx].stats[bestDst.stat.stat] += bestDst.pointsAdded;

    for (let i = 0; i < srcStatsToTest.length; i++) {
      const src = srcStatsToTest[i];

      // Skip if same as destination
      if (src.idx === bestDst.stat.idx && src.stat === bestDst.stat.stat) continue;

      const srcFighter = fighterData[src.idx];
      const srcPoints = srcFighter.stats[src.stat];

      const currentGold = pointsToGold(srcPoints);
      if (currentGold < goldBudget) continue;

      const pointsToRemove = pointsToRemoveForGold(srcPoints, goldBudget);
      if (pointsToRemove <= 0) continue;

      srcFighter.stats[src.stat] -= pointsToRemove;
      const rate = await runBattles(fighterData, NUM_BATTLES);
      srcFighter.stats[src.stat] += pointsToRemove;

      srcResults.push({ stat: src, rate, pointsRemoved: pointsToRemove });

      if (rate > bestSrcRate) bestSrcRate = rate;
      process.stdout.write(`\r    Testing ${i + 1}/${srcStatsToTest.length} sources - Best: ${(bestSrcRate * 100).toFixed(3)}%`);
    }

    // Undo destination add
    fighterData[bestDst.stat.idx].stats[bestDst.stat.stat] -= bestDst.pointsAdded;

    console.log('');

    // Sort and update top sources (only on full scan)
    srcResults.sort((a, b) => b.rate - a.rate);
    if (cycleRound === 1) {
      topSources = srcResults.slice(0, 10);
    }

    if (srcResults.length === 0) {
      console.log('  No valid source found');
      break;
    }

    const bestSrc = srcResults[0];
    console.log(`    Best source: ${fighterData[bestSrc.stat.idx].name}.${bestSrc.stat.stat} (-${bestSrc.pointsRemoved}pts)`);

    // Check if move improves over current
    if (bestSrc.rate > currentRate) {
      // Apply the move
      fighterData[bestSrc.stat.idx].stats[bestSrc.stat.stat] -= bestSrc.pointsRemoved;
      fighterData[bestDst.stat.idx].stats[bestDst.stat.stat] += bestDst.pointsAdded;

      console.log(`\n  IMPROVEMENT FOUND!`);
      console.log(`  ${fighterData[bestSrc.stat.idx].name}.${bestSrc.stat.stat} (-${bestSrc.pointsRemoved}pts) -> ${fighterData[bestDst.stat.idx].name}.${bestDst.stat.stat} (+${bestDst.pointsAdded}pts)`);
      console.log(`  Win rate: ${(currentRate * 100).toFixed(3)}% -> ${(bestSrc.rate * 100).toFixed(3)}%`);
      console.log(`  Improvement: +${((bestSrc.rate - currentRate) * 100).toFixed(3)}%`);

      currentRate = bestSrc.rate;
      totalImprovements++;

      printCurrentStats(fighterData, totalBudget);

      // Check for residual gold >= 10M and spend it
      const currentInvested = getTotalGoldInvested(fighterData);
      const residualGold = totalBudget - currentInvested;
      if (residualGold >= 10000000) {
        currentRate = await spendResidualGold(fighterData, residualGold, allStats, currentRate);
        printCurrentStats(fighterData, totalBudget);
      }

      // Advance cycle
      cycleRound++;
      if (cycleRound > 6) cycleRound = 1;
    } else {
      console.log(`\n  No improvement found at ${(goldBudget/1000000).toFixed(0)}M gold level`);
      console.log(`  Best possible: ${(bestSrc.rate * 100).toFixed(3)}% vs current: ${(currentRate * 100).toFixed(3)}%`);

      // Reduce budget and reset cycle
      if (goldBudget === 20000000) {
        goldBudget = 10000000;
        console.log('  Reducing to 10M gold moves...');
        cycleRound = 1; // Reset to full scan
      } else if (goldBudget === 10000000) {
        goldBudget = 5000000;
        console.log('  Reducing to 5M gold moves...');
        cycleRound = 1; // Reset to full scan
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
