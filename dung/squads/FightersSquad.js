import { Fighter } from '../characters/Fighter.js';

export class FightersSquad {
    constructor(fighter00 = null, fighter10 = null, fighter20 = null, fighter01 = null, fighter11 = null, fighter21 = null) {
        this.all_fighters = [
            [fighter00, fighter01],
            [fighter10, fighter11],
            [fighter20, fighter21]
        ];

        this.fighters = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                if (this.all_fighters[i][j] !== null) this.fighters.push(this.all_fighters[i][j]);
            }
        }
    }
}


