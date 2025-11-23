import { Mob } from "../characters/Mob.js";

function getMob(level, place) {
  if (place === 1) {
    if (level >= 25) return new Mob(level);
    return null;
  }

  if (place === 2) {
    if (level >= 50) return new Mob(level);
    return null;
  }

  if (place === 3) {
    if (level >= 75) return new Mob(level);
    return null;
  }

  if (place === 4) {
    if (level >= 100) return new Mob(level);
    return null;
  }

  if (place === 5) {
    if (level >= 125) return new Mob(level);
    return null;
  }
}

export class MobsSquad {
  constructor(level) {
    this.mobs = [
      [new Mob(level), getMob(level - 75, 3)],
      [getMob(level - 25, 1), getMob(level - 100, 4)],
      [getMob(level - 50, 2), getMob(level - 125, 5)],
    ];
  }
}
