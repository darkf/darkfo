/*
Copyright 2014-2015 darkf, Stratege

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

// Critical Effects system

"use strict";

module CriticalEffects {
    interface Dict<T> {
        [key: string]: T;
    }

    interface NumDict<T> {
        [key: number]: T;
    }
    
    type EffectsFunction = (target: Critter) => void;

    const generalRegionName: { [region: number]: string } = {
        0: "head", 1: "leftArm", 2: "rightArm", 3: "torso", 4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin", 8: "uncalled"
    };

    // TODO: make this table account for different weapon types. It appears melee weapons use a second one
    // though it appears to only be a /2 for melee
    export const regionHitChanceDecTable: { [region: string]: number } = {
        "torso": 0, "leftLeg": 20, "rightLeg": 20, "groin": 30, "leftArm": 30, "rightArm": 30, "head": 40, "eyes": 60
    };

    let critterTable: Dict<CritType[]>[];

    const critFailEffects: Dict<EffectsFunction> = {
        damageSelf: function(target: Critter) {
            console.log(target.name + " has damaged themselves. This does not do anything yet")
        },

        crippleRandomAppendage: function(target: Critter) {
            console.log(target.name + " has crippled a random appendage. This does not do anything yet")
        },

        hitRandomly: function(target: Critter) {
            console.log(target.name + " has hit randomly. This does not do anything yet")
        },

        hitSelf: function(target: Critter) {
            console.log(target.name + " has hit themselves. This does not do anything yet")
        },

        loseAmmo: function(target: Critter) {
            console.log(target.name + " has lost their ammo. This does not do anything yet")
        },

        destroyWeapon: function(target: Critter) {
            console.log(target.name + " has had their weapon blow up in their face. Ouch. This does not do anything yet")
        }
    }

    const critterEffects: Dict<(target: Critter) => void> = {
        knockout: function(target: Critter) {
            console.log(target.name + " has been knocked out. This does not do anything yet")
        },

        knockdown: function(target: Critter) {
            console.log(target.name + " has been knocked down. This does not do anything yet")
        },

        crippledLeftLeg: function(target: Critter) {
            console.log(target.name + " has been crippled in the left leg. This does not do anything yet")
        },

        crippledRightLeg: function(target: Critter) {
            console.log(target.name + " has been crippled in the right leg. This does not do anything yet")
        },

        crippledLeftArm: function(target: Critter) {
            console.log(target.name + " has been crippled in the left arm. This does not do anything yet")
        },

        crippledRightArm: function(target: Critter) {
            console.log(target.name + " has been crippled in the right arm. This does not do anything yet")
        },

        blinded: function(target: Critter) {
            console.log(target.name + " has been blinded by delight. This does not do anything yet")
        },

        death: function(target: Critter) {
            console.log(target.name + " has met the reaperpony. This does not do anything yet")
        },

        onFire: function(target: Critter) {
            console.log(target.name + " just got a flame lit in their heart. This does not do anything yet")
        },

        bypassArmor: function(target: Critter) {
            console.log(target.name + " is being hit by an armor bypassing bullet, blame the Zebras. This does not do anything yet")
        },

        droppedWeapon: function(target: Critter) {
            console.log(target.name + " needs to drop their weapon like it's hot. The documentation claims this is broken. This does not do anything yet")
        },

        loseNextTurn: function(target: Critter) {
            console.log(target.name + " lost their next turn. This does not do anything yet")
        },

        random: function(target: Critter) {
            console.log(target.name + " is affected by a random effect. How random! This does not do anything yet")
        }
    }

    class Effects {
        effects : EffectsFunction[]

        constructor(effectCallbackList : EffectsFunction[]) {
            this.effects = effectCallbackList
        }

        doEffectsOn(target: any): void {
            for(var i = 0; i < this.effects.length; i++)
                this.effects[i](target)
        }
    }

    class StatCheck {
        stat: string;
        modifier: number;
        effects: Effects;
        failEffectMessageID: number;
        //stat = number, probably

        constructor(stat: string, modifier: number, effects: Effects, failEffectMessageID: number) {
            this.stat = stat
            this.modifier = modifier
            this.effects = effects
            this.failEffectMessageID = failEffectMessageID
        }

        // This should return "Maybe msgID"
        doEffectsOn(target: Critter): any {
            // stat being undefined means there is no stat check to be done
            if(this.stat === undefined)
                return {success: false}

            var statToRollAgainst = critterGetStat(target, this.stat)
            statToRollAgainst += this.modifier

            // if our target fails their skillcheck, they have to suffer the added effects.
            // We do *10 so we can reuse the skillCheck function which goes from 0 to 100, while stat is 1 to 10
            if(!rollSkillCheck(statToRollAgainst*10, 0, false)) {
                this.effects.doEffectsOn(target)
                return {success: true, msgID: this.failEffectMessageID}
            }

            return {success: false}
        }
    }

    class CritType {
        DM: number
        effects: Effects
        statCheck: StatCheck
        msgID: number

        constructor(damageMultiplier: number, effects: Effects, statCheck: StatCheck, effectMsg: number) {
            this.DM = damageMultiplier
            this.effects = effects
            this.statCheck = statCheck
            this.msgID = effectMsg
        }

        doEffectsOn(target: Critter) {
            var returnMsgID = this.msgID
            //we need to check for results before we apply the other effects, to ensure the checks in statCheck aren't modified by the effects of the crit.
            var statCheckResults = this.statCheck.doEffectsOn(target)

            this.effects.doEffectsOn(target)

            //did statCheck do its effects as well?
            if(statCheckResults.success === true)
                returnMsgID = statCheckResults.msgID

            return {DM: this.DM, msgID: returnMsgID}
        }
    }

    interface CritLevelData {
        statCheck: { stat: number, checkModifier: number, failureEffect: string[], failureMessage: number };
        dmgMultiplier: number;
        critEffect: string[];
        msg: number;
    }

    function parseCritLevel(critLevel: CritLevelData): CritType {
        var stat = critLevel.statCheck
        var statVal : string = undefined
        if(stat.stat != -1)
            statVal = StatType[stat.stat]
        var tempStatCheck = new StatCheck(statVal, stat.checkModifier, parseEffects(stat.failureEffect), stat.failureMessage)
        var retCritLevel = new CritType(critLevel.dmgMultiplier, parseEffects(critLevel.critEffect), tempStatCheck, critLevel.msg)
        return retCritLevel
    }

    // takes a List of effect names, gets the appropriate effects from the table and stores it in a Effects object
    function parseEffects(effects: string[]): Effects {
        var tempEffects = []
        for(var i = 0; i < effects.length; i++)
            tempEffects[i] = critterEffects[effects[i]]
        return new Effects(tempEffects)
    }

    // tries to obtain the CritType object partaining to the critLevel of the region of the critterType in question, returns a default CritType object otherwise
    export function getCritical(critterKillType: number, region: string, critLevel: number): CritType {
        var ret: CritType = undefined

        try {
            // ensure we aren't exceeding the highest crit level existing for this type of critter and region
            const actualLevel = Math.min(critLevel, critterTable[critterKillType][region].length - 1)
            // get the appropriate CritType from the table
            ret = critterTable[critterKillType][region][actualLevel]
        }
        catch(e) {
        }

        if(ret === undefined) {
            console.log("error: could not find critical: " + critterKillType + "/" + region + "/" + critLevel)
            ret = defaultCritType(critterKillType, region, critLevel)
        }

        return ret
    }

    // constructs a default Crit Type object which doesn't apply any modifications to the shot, only changes the logging.
    function defaultCritType(critterKillType: number, region: string, critLevel: number): CritType
    {
        return new CritType(2, new Effects([]), new StatCheck(undefined, undefined, undefined, undefined),undefined)
    }

    export function getCriticalFail(weaponType: string, failLevel: number): EffectsFunction[]
    {
        var ret: EffectsFunction[] = undefined
        try {
            // get the appropriate Critical Fail from the table
            ret = criticalFailTable[weaponType][failLevel]
        }
        catch(e) {
        }

        if(ret === undefined)
            //default crit fail error, which doesn't do anything but print an error message
            ret = [function(critter) { console.log("error: could not find critical fail: " + weaponType + "/" + failLevel); }];

        return ret;
    }

    export function loadTable() {
        // read in the global table
        var haveTable = true;

        //console.log("loading critical table...");
        var table = getFileJSON("lut/criticalTables.json", () => {
            haveTable = false;
        });

        if(!haveTable) {
            console.log("lut/criticalTables.json not found, not loading critical hit/miss table");
            return;
        }

        critterTable = new Array(table.length);
        for(var i = 0; i < table.length; i++) {
            critterTable[i] = {};

            for(var region in table[i]) {
                critterTable[i][region] = new Array(table[i][region].length);

                for(var critLevel = 0; critLevel < table[i][region].length; critLevel++)
                    critterTable[i][region][critLevel] = parseCritLevel(table[i][region][critLevel]);
            }
        }
        //console.log("parsed critical table with " + critterTable.length + " entries")
    }

    export const criticalFailTable: Dict<NumDict<EffectsFunction[]>> = {
        unarmed: {
            1: [],
            2: [critterEffects.loseNextTurn],
            3: [critterEffects.loseNextTurn],
            4: [critFailEffects.damageSelf, critterEffects.knockdown],
            5: [critFailEffects.crippleRandomAppendage]
        },
        melee: {
            1: [],
            2: [critterEffects.loseNextTurn],
            3: [critterEffects.droppedWeapon],
            4: [critFailEffects.hitRandomly],
            5: [critFailEffects.hitSelf]
        },
        firearms: {
            1: [],
            2: [critFailEffects.loseAmmo],
            3: [critterEffects.droppedWeapon],
            4: [critFailEffects.hitRandomly],
            5: [critFailEffects.destroyWeapon]
        },
        energy: {
            1: [critterEffects.loseNextTurn],
            2: [critFailEffects.loseAmmo, critterEffects.loseNextTurn],
            3: [critterEffects.droppedWeapon, critterEffects.loseNextTurn],
            4: [critFailEffects.hitRandomly],
            5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn]
        },
        grenades: {
            1: [],
            2: [critterEffects.droppedWeapon],
            3: [critFailEffects.damageSelf, critterEffects.droppedWeapon],
            4: [critFailEffects.hitRandomly],
            5: [critFailEffects.destroyWeapon]
        },
        rocketlauncher: {
            1: [critterEffects.loseNextTurn],
            2: [], //yes that appears backwards but seems to be the case in FO
            3: [critFailEffects.destroyWeapon],
            4: [critFailEffects.hitRandomly],
            5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn, critterEffects.knockdown]
        },
        flamers: {
            1: [],
            2: [critterEffects.loseNextTurn],
            3: [critFailEffects.hitRandomly],
            4: [critFailEffects.destroyWeapon],
            5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn, critterEffects.onFire]
        }
    }

    export function temporaryDoCritFail(critFail: EffectsFunction[], target: Critter) {
        for (var i = 0; i < critFail.length; i++) {
            critFail[i](target)
        }
    }
}
