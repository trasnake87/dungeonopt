// Battle Diagnostic - Watch what actually happens in combat

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

// Mob stat calculator
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

// Test different dungeon levels to find where we can compete
const levels = [100, 200, 300, 400, 500, 600, 650];

console.log('='.repeat(70));
console.log('MOB STATS BY DUNGEON LEVEL');
console.log('='.repeat(70));
console.log('Level  | Health      | Damage    | Hit       | Dodge     | Def%');
console.log('-'.repeat(70));

for (const level of levels) {
  const health = getMobStatValue(100, 400, level);
  const damage = getMobStatValue(25, 50, level);
  const hit = getMobStatValue(0, 50, level);
  const dodge = getMobStatValue(0, 50, level);
  const defPre = getMobStatValue(5, 10, level);
  const def = calculateDefense(defPre);

  console.log(`${level.toString().padStart(5)}  | ${health.toLocaleString().padStart(11)} | ${damage.toLocaleString().padStart(9)} | ${hit.toLocaleString().padStart(9)} | ${dodge.toLocaleString().padStart(9)} | ${(def * 100).toFixed(1)}%`);
}

// Your current Shadow Dancer stats for comparison
console.log('\n' + '='.repeat(70));
console.log('YOUR SHADOW DANCER STATS (from API)');
console.log('='.repeat(70));
const sdHealth = Math.ceil(500 + 100 * 233) + 125535;
const sdDamage = Math.ceil(100 + 25 * 236) + 15691;
const sdHit = Math.ceil(50 + 50 * 116) + 23457;
const sdDefPre = 25 + 10 * 86 + 2798;
const sdDef = calculateDefense(sdDefPre);
const sdCrit = (0.0 + 0.25 * 67 + 62.8) / 100.0;
const sdDodge = Math.ceil(50.0 + 50.0 * 317) + 23457;

console.log(`Health: ${sdHealth.toLocaleString()}`);
console.log(`Damage: ${sdDamage.toLocaleString()}`);
console.log(`Hit: ${sdHit.toLocaleString()}`);
console.log(`Defense: ${sdDefPre} -> ${(sdDef * 100).toFixed(2)}%`);
console.log(`Crit: ${(sdCrit * 100).toFixed(2)}%`);
console.log(`Dodge: ${sdDodge.toLocaleString()}`);

// Calculate expected hit chances
console.log('\n' + '='.repeat(70));
console.log('HIT/DODGE ANALYSIS');
console.log('='.repeat(70));

for (const level of [500, 600, 650]) {
  const mobHit = getMobStatValue(0, 50, level);
  const mobDodge = getMobStatValue(0, 50, level);

  // Your hit chance vs mob dodge
  const yourHitChance = Math.min(0.25 + (sdHit / (sdHit + mobDodge)) * 0.75, 0.95);
  // Mob hit chance vs your dodge
  const mobHitChance = Math.min(0.25 + (mobHit / (mobHit + sdDodge)) * 0.75, 0.95);

  console.log(`\nLevel ${level}:`);
  console.log(`  Your hit chance: ${(yourHitChance * 100).toFixed(1)}% (your ${sdHit.toLocaleString()} hit vs mob ${mobDodge.toLocaleString()} dodge)`);
  console.log(`  Mob hit chance: ${(mobHitChance * 100).toFixed(1)}% (mob ${mobHit.toLocaleString()} hit vs your ${sdDodge.toLocaleString()} dodge)`);
}

// Calculate expected damage
console.log('\n' + '='.repeat(70));
console.log('DAMAGE ANALYSIS');
console.log('='.repeat(70));

for (const level of [500, 600, 650]) {
  const mobDamage = getMobStatValue(25, 50, level);
  const mobDefPre = getMobStatValue(5, 10, level);
  const mobDef = calculateDefense(mobDefPre);
  const mobHealth = getMobStatValue(100, 400, level);

  // Your damage to mob (after mob defense)
  const yourDmgToMob = sdDamage * (1 - mobDef) * (1 + 0.1 * sdCrit);
  // Mob damage to you (after your defense)
  const mobDmgToYou = mobDamage * (1 - sdDef);

  // Hits to kill
  const hitsToKillMob = Math.ceil(mobHealth / yourDmgToMob);
  const hitsToKillYou = Math.ceil(sdHealth / mobDmgToYou);

  console.log(`\nLevel ${level}:`);
  console.log(`  Your dmg to mob: ${Math.floor(yourDmgToMob).toLocaleString()} (${hitsToKillMob} hits to kill mob with ${mobHealth.toLocaleString()} HP)`);
  console.log(`  Mob dmg to you: ${Math.floor(mobDmgToYou).toLocaleString()} (${hitsToKillYou} hits to kill you with ${sdHealth.toLocaleString()} HP)`);
}

// Now run actual battles and track stats
console.log('\n' + '='.repeat(70));
console.log('ACTUAL BATTLE SIMULATIONS');
console.log('='.repeat(70));

function createFullSquad() {
  // Your actual team from API
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));

  // Fighter 1 (Shadow Dancer) at [1,0]
  grid[1][0] = new Fighter('Shadow Dancer', {
    name: 'Fighter 1',
    fighter_health: 233, fighter_damage: 236, fighter_hit: 116,
    fighter_defense: 86, fighter_crit: 67, fighter_dodge: 317,
    object_health: 125535, object_damage: 15691, object_hit: 23457,
    object_defense: 2798, object_crit: 62.8, object_dodge: 23457,
  });

  // Fighter 2 (Bastion) at [1,1]
  grid[1][1] = new Fighter('Bastion', {
    name: 'Fighter 2',
    fighter_health: 75, fighter_damage: 150, fighter_hit: 77,
    fighter_defense: 0, fighter_crit: 24, fighter_dodge: 56,
    object_health: 0, object_damage: 15691, object_hit: 23457,
    object_defense: 2582, object_crit: 21.5, object_dodge: 9383,
  });

  // Fighter 3 (Priest) at [2,1]
  grid[2][1] = new Fighter('Priest', {
    name: 'Fighter 3',
    fighter_health: 0, fighter_damage: 106, fighter_hit: 74,
    fighter_defense: 0, fighter_crit: 1, fighter_dodge: 26,
    object_health: 0, object_damage: 15691, object_hit: 23457,
    object_defense: 0, object_crit: 26.9, object_dodge: 8713,
  });

  // Fighter 4 (Paladin) at [2,0]
  grid[2][0] = new Fighter('Paladin', {
    name: 'Fighter 4',
    fighter_health: 170, fighter_damage: 175, fighter_hit: 97,
    fighter_defense: 63, fighter_crit: 0, fighter_dodge: 120,
    object_health: 73735, object_damage: 12901, object_hit: 21914,
    object_defense: 2300, object_crit: 16.2, object_dodge: 12522,
  });

  // Fighter 5 (Crusader) at [0,1]
  grid[0][1] = new Fighter('Crusader', {
    name: 'Fighter 5',
    fighter_health: 154, fighter_damage: 204, fighter_hit: 131,
    fighter_defense: 62, fighter_crit: 64, fighter_dodge: 176,
    object_health: 103229, object_damage: 12901, object_hit: 17218,
    object_defense: 2123, object_crit: 20.6, object_dodge: 17218,
  });

  return grid;
}

// Test win rates at different levels
for (const level of [400, 500, 600, 650]) {
  const numBattles = 100000;
  let wins = 0;
  let totalRounds = 0;

  for (let i = 0; i < numBattles; i++) {
    const grid = createFullSquad();

    // Clone for battle
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
    const mobsSquad = new MobsSquad(level);
    const battle = new Battle(fightersSquad, mobsSquad);

    const result = battle.battle();
    if (result[0] === 'fighters') wins++;
    totalRounds += result[1];
  }

  console.log(`\nLevel ${level}: ${(wins/numBattles*100).toFixed(3)}% win rate, avg ${(totalRounds/numBattles).toFixed(1)} rounds`);
}

console.log('\n' + '='.repeat(70));
console.log('SINGLE FIGHTER TESTING');
console.log('='.repeat(70));
console.log('Testing just Shadow Dancer alone to understand baseline...\n');

// Test single Shadow Dancer at different levels
for (const level of [100, 200, 300, 400, 500]) {
  const numBattles = 100000;
  let wins = 0;

  for (let i = 0; i < numBattles; i++) {
    const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));

    grid[1][0] = new Fighter('Shadow Dancer', {
      name: 'Fighter 1',
      fighter_health: 233, fighter_damage: 236, fighter_hit: 116,
      fighter_defense: 86, fighter_crit: 67, fighter_dodge: 317,
      object_health: 125535, object_damage: 15691, object_hit: 23457,
      object_defense: 2798, object_crit: 62.8, object_dodge: 23457,
    });

    // Clone
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
    const mobsSquad = new MobsSquad(level);
    const battle = new Battle(fightersSquad, mobsSquad);

    const result = battle.battle();
    if (result[0] === 'fighters') wins++;
  }

  console.log(`Level ${level}: ${(wins/numBattles*100).toFixed(2)}% win rate (Shadow Dancer alone)`);
}
