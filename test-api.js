// Simple test to verify simulator works with API data
// Uses the original QueslarDungeonSim code directly

import nodeFetch from 'node-fetch';
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

const API_KEY = 'qs_P1e4LELHO7fVSWOPYS6MKfS0YoJTZ5S1';
const DUNGEON_LEVEL = 600;
const NUM_BATTLES = 2000000;

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

// Tier multipliers (from app.js)
const TIER_MULTIPLIERS = {
  1: 1.1, 2: 1.2, 3: 1.3, 4: 1.4, 5: 1.5, 6: 1.75,
  7: 2, 8: 2.25, 9: 2.5, 10: 2.75, 11: 3, 12: 3.5,
};

async function loadFromAPI() {
  console.log('Loading fighters from API...');
  const response = await fetch('https://http.v2.queslar.com/api/character/fighter/presets', {
    method: 'GET',
    headers: {
      'QUESLAR-API-KEY': API_KEY
    }
  });
  const data = await response.json();

  // Find dungeon preset
  const dungeonPreset = data.output.find(
    item => item.preset && item.preset.assignment === 'dungeon'
  );

  if (!dungeonPreset) {
    console.error('No dungeon preset found! Available presets:',
      data.output.map(item => item.preset?.assignment));
    throw new Error('No dungeon preset found');
  }

  const fighters = dungeonPreset.fighters || [];
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => null));

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

    const fighterData = {
      name: apiData.name,
      fighter_health: parseInt(stats.health || 0),
      fighter_damage: parseInt(stats.damage || 0),
      fighter_hit: parseInt(stats.hit || 0),
      fighter_defense: parseInt(stats.defense || 0),
      fighter_crit: parseInt(stats.critDamage || 0),
      fighter_dodge: parseInt(stats.dodge || 0),
      object_health: equipmentBonuses.health,
      object_damage: equipmentBonuses.damage,
      object_hit: equipmentBonuses.hit,
      object_defense: equipmentBonuses.defense,
      object_crit: equipmentBonuses.critDamage,
      object_dodge: equipmentBonuses.dodge,
    };

    // Create Fighter instance
    const fighter = new Fighter(fighterClass, fighterData);

    // API has row/column inverted
    const row = apiData.placement.column;
    const col = apiData.placement.row;
    grid[row][col] = fighter;

    console.log(`  ${apiData.name} (${fighterClass}) at [${row},${col}]`);
    console.log(`    Stats: H:${fighterData.fighter_health} D:${fighterData.fighter_damage} Hit:${fighterData.fighter_hit} Def:${fighterData.fighter_defense} CD:${fighterData.fighter_crit} Dg:${fighterData.fighter_dodge}`);
    console.log(`    Equip: H:${equipmentBonuses.health} D:${equipmentBonuses.damage} Hit:${equipmentBonuses.hit} Def:${equipmentBonuses.defense} CD:${equipmentBonuses.critDamage.toFixed(1)} Dg:${equipmentBonuses.dodge}`);
  }

  return grid;
}

function runBattles(grid, numBattles) {
  let wins = 0;

  // Store fighter data for recreation each battle
  const fighterDataGrid = [];
  for (let i = 0; i < 3; i++) {
    fighterDataGrid[i] = [];
    for (let j = 0; j < 2; j++) {
      if (grid[i][j]) {
        const f = grid[i][j];
        fighterDataGrid[i][j] = {
          class: f.fighter_class,
          data: {
            name: f.name,
            fighter_health: 0, // Will recalculate from totals
            fighter_damage: 0,
            fighter_hit: 0,
            fighter_defense: 0,
            fighter_crit: 0,
            fighter_dodge: 0,
            object_health: 0,
            object_damage: 0,
            object_hit: 0,
            object_defense: 0,
            object_crit: 0,
            object_dodge: 0,
          },
          // Store original stats for recreation
          total_health: f.total_health,
          damage: f.damage,
          hit: f.hit,
          defense_pre: f.defense_pre,
          crit: f.crit,
          dodge: f.dodge
        };
      } else {
        fighterDataGrid[i][j] = null;
      }
    }
  }

  for (let i = 0; i < numBattles; i++) {
    // Create fresh fighters for each battle
    const newGrid = [];
    for (let row = 0; row < 3; row++) {
      newGrid[row] = [];
      for (let col = 0; col < 2; col++) {
        if (grid[row][col]) {
          // Clone the fighter by creating a new instance
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

    // FightersSquad expects: fighter00, fighter10, fighter20, fighter01, fighter11, fighter21
    const fightersSquad = new FightersSquad(
      newGrid[0][0], newGrid[1][0], newGrid[2][0],
      newGrid[0][1], newGrid[1][1], newGrid[2][1]
    );
    const mobsSquad = new MobsSquad(DUNGEON_LEVEL);
    const battle = new Battle(fightersSquad, mobsSquad);

    const result = battle.battle();
    if (result[0] === 'fighters') wins++;

    // Progress update every 100k battles
    if ((i + 1) % 100000 === 0) {
      const currentRate = (wins / (i + 1) * 100).toFixed(3);
      process.stdout.write(`\r  Progress: ${((i + 1) / numBattles * 100).toFixed(1)}% - Current win rate: ${currentRate}%`);
    }
  }

  console.log(''); // newline after progress
  return wins / numBattles;
}

async function main() {
  console.log('='.repeat(60));
  console.log('QUESLAR DUNGEON SIMULATOR TEST');
  console.log('='.repeat(60));
  console.log(`Dungeon Level: ${DUNGEON_LEVEL}`);
  console.log(`Battles: ${NUM_BATTLES.toLocaleString()}`);
  console.log('');

  const grid = await loadFromAPI();

  console.log('');
  console.log('Running battles...');
  const winRate = runBattles(grid, NUM_BATTLES);

  console.log('');
  console.log('='.repeat(60));
  console.log(`WIN RATE: ${(winRate * 100).toFixed(3)}%`);
  console.log('='.repeat(60));
}

main().catch(console.error);
