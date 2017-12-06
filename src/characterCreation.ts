/*
Copyright 2014 darkf, Stratege
Copyright 2017 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Character Creation

// TODO: "Melee Weapons" skill is called "Melee" in the PRO

class SkillSet {
    baseSkills: { [name: string]: number } = {};
    tagged: string[] = [];

    constructor(baseSkills?: { [name: string]: number }, tagged?: string[]) {
        // Copy construct a SkillSet
        if(baseSkills) this.baseSkills = baseSkills;
        if(tagged) this.tagged = tagged;
    }

    clone(): SkillSet {
        return new SkillSet(this.baseSkills, this.tagged);
    }

    static fromPro(skills: any): SkillSet {
        console.warn("fromPro: %o", skills);

        return new SkillSet(skills);
    }

    getBase(skill: string): number {
        return this.baseSkills[skill] || 0;
    }

    get(skill: string, stats: StatSet): number {
        const base = this.getBase(skill);
        const skillDep = skillDependencies[skill];

        if(!skillDep)
            throw Error(`No dependencies for skill '${skill}'`);

        let skillValue = base;
        for(const dep of skillDep.dependencies) {
            if(dep.statType)
                skillValue += Math.floor(stats.get(dep.statType) * dep.multiplicator);
        }

        return skillValue;
    }
}

class StatSet {
    baseStats: { [name: string]: number } = {};

    constructor(baseStats?: { [name: string]: number }) {
        // Copy construct a StatSet
        if(baseStats) this.baseStats = baseStats;
    }

    clone(): StatSet {
        return new StatSet(this.baseStats);
    }

    static fromPro(pro: any): StatSet {
        console.warn("stats fromPro: %o", pro);

        const { baseStats, bonusStats } = pro.extra;

        const stats = Object.assign({}, baseStats);

        for(const stat in stats) {
            if(bonusStats[stat] !== undefined)
                stats[stat] += bonusStats[stat];
        }

        // TODO: armor, appears to be hardwired into the proto?

        // Define Max HP = HP if it does not exist
        if(stats["Max HP"] === undefined && stats["HP"] !== undefined)
            stats["Max HP"] = stats["HP"];

        // Define HP = Max HP if it does not exist
        if(stats["HP"] === undefined && stats["Max HP"] !== undefined)
            stats["HP"] = stats["Max HP"];

        return new StatSet(stats);
    }

    getBase(stat: string): number {
        // TODO: statDependencies[stat].defaultVal
        return this.baseStats[stat] || 5;
    }

    get(stat: string): number {
        return this.getBase(stat);

        /* TODO: clamp
        clamp(statDependencies[stat].min, statDependencies[stat].max, rawStat + calculateStatValueAddition(obj, stat))
        */
    }
}

/*
if(obj.tempChanges.skills[skill] !== undefined) {
    obj.tempChanges.skills[skill] = 2 * obj.tempChanges.skills[skill] + 20
}else{
    obj.tempChanges.skills[skill] = 20
}
*/

function increaseStat(obj, stat, amount, useTemp, costsPoints, allowOverBounds) {
    var statValue = critterGetStat(obj, stat)
    var curTemp =  (useTemp && obj.tempChanges.stats[stat] !== undefined) ? obj.tempChanges.stats[stat] : 0
    if(allowOverBounds === false && statValue !== null && curTemp + critterGetRawStat(obj, stat) + amount > statDependencies[stat].max) {
        amount = statDependencies[stat].max - (critterGetRawStat(obj, stat) + curTemp)
        if(amount <= 0)
            return false
    }
    if(costsPoints === true) {
        if(obj.StatPoints === undefined || obj.StatPoints < amount)
            return false
        obj.StatPoints -= amount
    }
    if(useTemp) {
        if(obj.tempChanges.stats[stat] === undefined)
            obj.tempChanges.stats[stat] = 0
        obj.tempChanges.stats[stat] += amount
    }else{
        critterSetRawStat(obj, stat, statValue + amount)
    }
    return true
}

function decreaseStat(obj, stat, amount, useTemp, costsPoints, allowOverBounds) {
    if(obj.stats[stat] === undefined || (useTemp && obj.tempChanges.stats[stat] === undefined))
        return false
    var statValue = critterGetStat(obj, stat)
    var curTemp =  (useTemp && obj.tempChanges.stats[stat] !== undefined) ? obj.tempChanges.stats[stat] : 0
    if(allowOverBounds === false && statValue !== null && (curTemp + critterGetRawStat(obj, stat)-amount) < statDependencies[stat].min) {
        amount = curTemp + critterGetRawStat(obj, stat) - statDependencies[stat].min
        if(amount <= 0)
            return false
    }
    if(costsPoints === true) {
        if(obj.StatPoints === undefined)
            obj.StatPoints = 0
        obj.StatPoints += amount
    }
    if(useTemp) {
        obj.tempChanges.stats[stat] -= 1
    }else{
        critterSetRawStat(obj, stat, statValue - amount)
    }
    return true
}
