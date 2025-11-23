// Stat Analysis - Testing theories for optimal allocation
// Goal: Find formulas to determine optimal stat ratios

import nodeFetch from 'node-fetch';
global.fetch = nodeFetch;

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

const DUNGEON_LEVEL = 300;  // Level where single Shadow Dancer can compete (1.57% baseline)
const NUM_BATTLES = 100000;  // Faster iteration for theory testing

// Mob stats at level 650
function getMobStatValue(baseValue, baseIncrement, level) {
  if (level <= 600) {
    return baseValue + baseIncrement * level;
  }
  let totalValue = baseValue + baseIncrement * 600;
  let currentLevel = level - 600;
  let increment = 2 * baseIncrement;
  while (currentLevel > 200) {
    totalValue += increment * 200;
    currentLevel -= 200;
    increment += baseIncrement;
  }
  return totalValue + currentLevel * increment;
}

function calculateDefense(defense) {
  const capped = Math.min(20000, defense);
  return Math.min(1 - 1 / Math.pow(1 + (defense + capped * 9) / 50000, 0.25), 0.95);
}

// Print mob stats for reference
console.log('='.repeat(60));
console.log('MOB STATS AT LEVEL', DUNGEON_LEVEL);
console.log('='.repeat(60));
const mobHealth = getMobStatValue(100, 400, DUNGEON_LEVEL);
const mobDamage = getMobStatValue(25, 50, DUNGEON_LEVEL);
const mobHit = getMobStatValue(0, 50, DUNGEON_LEVEL);
const mobDodge = getMobStatValue(0, 50, DUNGEON_LEVEL);
const mobDefPre = getMobStatValue(5, 10, DUNGEON_LEVEL);
const mobDef = calculateDefense(mobDefPre);
console.log(`Health: ${mobHealth.toLocaleString()}`);
console.log(`Damage: ${mobDamage.toLocaleString()}`);
console.log(`Hit: ${mobHit.toLocaleString()}`);
console.log(`Dodge: ${mobDodge.toLocaleString()}`);
console.log(`Defense Pre: ${mobDefPre} -> ${(mobDef * 100).toFixed(2)}%`);
console.log('');

// Helper: Create a simple test squad
function createTestSquad(config) {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));

  for (const f of config) {
    const fighter = new Fighter(f.class, {
      name: f.name,
      fighter_health: f.health || 0,
      fighter_damage: f.damage || 0,
      fighter_hit: f.hit || 0,
      fighter_defense: f.defense || 0,
      fighter_crit: f.crit || 0,
      fighter_dodge: f.dodge || 0,
      object_health: f.obj_health || 0,
      object_damage: f.obj_damage || 0,
      object_hit: f.obj_hit || 0,
      object_defense: f.obj_defense || 0,
      object_crit: f.obj_crit || 0,
      object_dodge: f.obj_dodge || 0,
    });
    grid[f.row][f.col] = fighter;
  }

  return grid;
}

function runBattles(grid, numBattles) {
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
    const mobsSquad = new MobsSquad(DUNGEON_LEVEL);
    const battle = new Battle(fightersSquad, mobsSquad);

    const result = battle.battle();
    if (result[0] === 'fighters') wins++;
  }

  return wins / numBattles;
}

// =============================================================================
// TEST 1: Health vs Defense Ratio
// =============================================================================
console.log('='.repeat(60));
console.log('TEST 1: HEALTH vs DEFENSE RATIO');
console.log('='.repeat(60));
console.log('Testing single Shadow Dancer with 500 total points split between health/defense');
console.log('Equipment: 100k health, 15k damage, 20k hit, 20k dodge, 50% crit');
console.log('');

const healthDefenseResults = [];
for (let healthPct = 0; healthPct <= 100; healthPct += 10) {
  const healthPts = Math.floor(500 * healthPct / 100);
  const defensePts = 500 - healthPts;

  const grid = createTestSquad([{
    name: 'Shadow Dancer',
    class: 'Shadow Dancer',
    row: 1, col: 0,
    health: healthPts,
    damage: 200,
    hit: 100,
    defense: defensePts,
    crit: 50,
    dodge: 300,
    obj_health: 100000,
    obj_damage: 15000,
    obj_hit: 20000,
    obj_defense: 0,
    obj_crit: 50,
    obj_dodge: 20000,
  }]);

  const winRate = runBattles(grid, NUM_BATTLES);
  healthDefenseResults.push({ healthPct, healthPts, defensePts, winRate });
  console.log(`H:${healthPts.toString().padStart(3)} D:${defensePts.toString().padStart(3)} -> ${(winRate * 100).toFixed(3)}%`);
}

const bestHD = healthDefenseResults.reduce((a, b) => a.winRate > b.winRate ? a : b);
console.log(`\nBest ratio: ${bestHD.healthPct}% health / ${100 - bestHD.healthPct}% defense = ${(bestHD.winRate * 100).toFixed(3)}%`);

// =============================================================================
// TEST 2: Hit vs Dodge Ratio
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('TEST 2: HIT vs DODGE RATIO');
console.log('='.repeat(60));
console.log('Testing single Shadow Dancer with 500 total points split between hit/dodge');
console.log('');

const hitDodgeResults = [];
for (let hitPct = 0; hitPct <= 100; hitPct += 10) {
  const hitPts = Math.floor(500 * hitPct / 100);
  const dodgePts = 500 - hitPts;

  const grid = createTestSquad([{
    name: 'Shadow Dancer',
    class: 'Shadow Dancer',
    row: 1, col: 0,
    health: 200,
    damage: 200,
    hit: hitPts,
    defense: 50,
    crit: 50,
    dodge: dodgePts,
    obj_health: 100000,
    obj_damage: 15000,
    obj_hit: 20000,
    obj_defense: 2000,
    obj_crit: 50,
    obj_dodge: 20000,
  }]);

  const winRate = runBattles(grid, NUM_BATTLES);
  hitDodgeResults.push({ hitPct, hitPts, dodgePts, winRate });
  console.log(`Hit:${hitPts.toString().padStart(3)} Dg:${dodgePts.toString().padStart(3)} -> ${(winRate * 100).toFixed(3)}%`);
}

const bestHitDodge = hitDodgeResults.reduce((a, b) => a.winRate > b.winRate ? a : b);
console.log(`\nBest ratio: ${bestHitDodge.hitPct}% hit / ${100 - bestHitDodge.hitPct}% dodge = ${(bestHitDodge.winRate * 100).toFixed(3)}%`);

// =============================================================================
// TEST 3: Damage vs Crit Damage
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('TEST 3: DAMAGE vs CRIT DAMAGE');
console.log('='.repeat(60));
console.log('Testing single Shadow Dancer with 500 total points split between damage/crit');
console.log('');

const damageCritResults = [];
for (let damagePct = 0; damagePct <= 100; damagePct += 10) {
  const damagePts = Math.floor(500 * damagePct / 100);
  const critPts = 500 - damagePts;

  const grid = createTestSquad([{
    name: 'Shadow Dancer',
    class: 'Shadow Dancer',
    row: 1, col: 0,
    health: 200,
    damage: damagePts,
    hit: 100,
    defense: 50,
    crit: critPts,
    dodge: 300,
    obj_health: 100000,
    obj_damage: 15000,
    obj_hit: 20000,
    obj_defense: 2000,
    obj_crit: 50,
    obj_dodge: 20000,
  }]);

  const winRate = runBattles(grid, NUM_BATTLES);
  damageCritResults.push({ damagePct, damagePts, critPts, winRate });
  console.log(`Dmg:${damagePts.toString().padStart(3)} Crt:${critPts.toString().padStart(3)} -> ${(winRate * 100).toFixed(3)}%`);
}

const bestDmgCrit = damageCritResults.reduce((a, b) => a.winRate > b.winRate ? a : b);
console.log(`\nBest ratio: ${bestDmgCrit.damagePct}% damage / ${100 - bestDmgCrit.damagePct}% crit = ${(bestDmgCrit.winRate * 100).toFixed(3)}%`);

// =============================================================================
// TEST 4: Shadow Dancer Dodge Value (with Bastion + Paladin)
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('TEST 4: SHADOW DANCER DODGE VALUE');
console.log('='.repeat(60));
console.log('Testing how valuable dodge is for Shadow Dancer double damage proc');
console.log('With Bastion (+50% dodge aura) and Paladin (25% damage reduction)');
console.log('');

const sdDodgeResults = [];
for (let dodgePts = 100; dodgePts <= 500; dodgePts += 50) {
  const grid = createTestSquad([
    // Shadow Dancer (main damage dealer)
    {
      name: 'Shadow Dancer',
      class: 'Shadow Dancer',
      row: 1, col: 0,
      health: 200,
      damage: 250,
      hit: 100,
      defense: 50,
      crit: 50,
      dodge: dodgePts,
      obj_health: 125000,
      obj_damage: 15000,
      obj_hit: 23000,
      obj_defense: 2800,
      obj_crit: 60,
      obj_dodge: 23000,
    },
    // Bastion (provides +50% dodge aura)
    {
      name: 'Bastion',
      class: 'Bastion',
      row: 1, col: 1,
      health: 75,
      damage: 150,
      hit: 77,
      defense: 0,
      crit: 24,
      dodge: 56,
      obj_health: 0,
      obj_damage: 15000,
      obj_hit: 23000,
      obj_defense: 2500,
      obj_crit: 20,
      obj_dodge: 9000,
    },
    // Paladin (provides 25% damage reduction)
    {
      name: 'Paladin',
      class: 'Paladin',
      row: 2, col: 0,
      health: 170,
      damage: 175,
      hit: 97,
      defense: 63,
      crit: 0,
      dodge: 120,
      obj_health: 73000,
      obj_damage: 13000,
      obj_hit: 22000,
      obj_defense: 2300,
      obj_crit: 16,
      obj_dodge: 12500,
    },
  ]);

  const winRate = runBattles(grid, NUM_BATTLES);
  sdDodgeResults.push({ dodgePts, winRate });
  console.log(`SD Dodge: ${dodgePts.toString().padStart(3)} -> ${(winRate * 100).toFixed(3)}%`);
}

// =============================================================================
// TEST 5: All 6 Stats - Find Optimal Distribution
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('TEST 5: STAT CATEGORY DISTRIBUTION');
console.log('='.repeat(60));
console.log('Testing different allocations across the 3 categories:');
console.log('  Survival: Health + Defense + Dodge');
console.log('  Offense: Damage + Hit + Crit');
console.log('Total: 1000 points, equipment provides baseline');
console.log('');

const categoryResults = [];
for (let survivalPct = 20; survivalPct <= 80; survivalPct += 10) {
  const offensePct = 100 - survivalPct;
  const survivalPts = 1000 * survivalPct / 100;
  const offensePts = 1000 * offensePct / 100;

  // Split survival 40% health, 10% defense, 50% dodge (based on earlier tests)
  const healthPts = Math.floor(survivalPts * 0.4);
  const defensePts = Math.floor(survivalPts * 0.1);
  const dodgePts = Math.floor(survivalPts * 0.5);

  // Split offense 60% damage, 30% hit, 10% crit
  const damagePts = Math.floor(offensePts * 0.6);
  const hitPts = Math.floor(offensePts * 0.3);
  const critPts = Math.floor(offensePts * 0.1);

  const grid = createTestSquad([{
    name: 'Shadow Dancer',
    class: 'Shadow Dancer',
    row: 1, col: 0,
    health: healthPts,
    damage: damagePts,
    hit: hitPts,
    defense: defensePts,
    crit: critPts,
    dodge: dodgePts,
    obj_health: 125000,
    obj_damage: 15000,
    obj_hit: 23000,
    obj_defense: 2800,
    obj_crit: 60,
    obj_dodge: 23000,
  }]);

  const winRate = runBattles(grid, NUM_BATTLES);
  categoryResults.push({ survivalPct, offensePct, winRate, healthPts, defensePts, dodgePts, damagePts, hitPts, critPts });
  console.log(`Survival ${survivalPct}% / Offense ${offensePct}% -> ${(winRate * 100).toFixed(3)}%`);
  console.log(`  H:${healthPts} D:${defensePts} Dg:${dodgePts} | Dmg:${damagePts} Hit:${hitPts} Crt:${critPts}`);
}

const bestCat = categoryResults.reduce((a, b) => a.winRate > b.winRate ? a : b);
console.log(`\nBest: ${bestCat.survivalPct}% survival / ${bestCat.offensePct}% offense = ${(bestCat.winRate * 100).toFixed(3)}%`);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Health vs Defense: ${bestHD.healthPct}% / ${100 - bestHD.healthPct}%`);
console.log(`Hit vs Dodge: ${bestHitDodge.hitPct}% / ${100 - bestHitDodge.hitPct}%`);
console.log(`Damage vs Crit: ${bestDmgCrit.damagePct}% / ${100 - bestDmgCrit.damagePct}%`);
console.log(`Survival vs Offense: ${bestCat.survivalPct}% / ${bestCat.offensePct}%`);
