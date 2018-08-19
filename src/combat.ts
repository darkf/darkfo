/*
Copyright 2014 darkf, Stratege
Copyright 2015 darkf

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

// Turn-based combat system

class ActionPoints {
    combat: number = 0; // Combat AP
    move: number = 0; // Move AP
    attachedCritter: Critter;

    constructor(obj: Critter) {
        this.attachedCritter = obj
        this.resetAP()
    }

    resetAP() {
        var AP = this.getMaxAP()
        this.combat = AP.combat
        this.move = AP.move
    }

    getMaxAP(): {combat: number; move: number} {
        var bonusCombatAP = 0 // TODO: replace with get function
        var bonusMoveAP = 0 // TODO: replace with get function

        return {combat: 5 + Math.floor(critterGetStat(this.attachedCritter, "AGI") / 2) + bonusCombatAP, move: bonusMoveAP}
    }

    getAvailableMoveAP(): number {
        return this.combat + this.move
    }

    getAvailableCombatAP() {
        return this.combat
    }

    subtractMoveAP(value: number): boolean {
        if(this.getAvailableMoveAP() < value)
            return false

        this.move -= value
        if(this.move < 0) {
            if(this.subtractCombatAP(-this.move)) {
                this.move = 0
                return true
            }
            return false
        }

        return true
    }

    subtractCombatAP(value: number): boolean {
        if(this.combat < value)
            return false

        this.combat -= value
        return true
    }
}

class AI {
    static aiTxt: any = null; // AI.TXT: packet num -> key/value
    combatant: Critter;
    info: any;

    static init(): void {
        // load and parse AI.TXT
        if(AI.aiTxt !== null) // already loaded
            return;

        AI.aiTxt = {}
        var ini = parseIni(getFileText("data/data/ai.txt"))
        if(ini === null) throw "couldn't load AI.TXT"
        for(var key in ini) {
            ini[key].keyName = key
            AI.aiTxt[ini[key].packet_num] = ini[key]
        }
    }

    static getPacketInfo(aiNum: number): any {
        return AI.aiTxt[aiNum] || null
    }

    constructor(combatant: Critter) {
        this.combatant = combatant

        // load if necessary
        if(AI.aiTxt === null)
            AI.init()

        this.info = AI.getPacketInfo(this.combatant.aiNum)
        if(!this.info)
            throw "no AI packet for " + combatant.toString() +
                  " (packet " + this.combatant.aiNum + ")"
    }
}

// A combat encounter
class Combat {
    combatants: Critter[];
    playerIdx: number;
    player: Player;
    turnNum: number;
    whoseTurn: number;
    inPlayerTurn: boolean;

    constructor(objects: Obj[]) {
        // Gather a list of combatants (critters meeting a certain criteria)
        this.combatants = objects.filter(obj => {
            if(obj instanceof Critter) {
                if(obj.dead || !obj.visible)
                    return false

                // TODO: should we initialize AI elsewhere, like in Critter?
                if(!obj.isPlayer && !obj.ai)
                    obj.ai = new AI(obj)

                if(obj.stats === undefined)
                    throw "no stats"
                obj.dead = false
                obj.AP = new ActionPoints(obj)
                return true
            }
            
            return false
        }) as Critter[];

        this.playerIdx = this.combatants.findIndex(x => x.isPlayer)
        if(this.playerIdx === -1)
            throw "combat: couldn't find player?"

        this.player = this.combatants[this.playerIdx] as Player
        this.turnNum = 1
        this.whoseTurn = this.playerIdx - 1
        this.inPlayerTurn = true

        // Stop the player from walking combat is initiating
        this.player.clearAnim();

        uiStartCombat()
    }


    log(msg: any) {
        // Combat-related debug log
        console.log(msg)
    }

    accountForPartialCover(obj: Critter, target: Critter): number {
        // TODO: get list of intervening critters. Substract 10 for each one in the way
        return 0
    }

    getHitDistanceModifier(obj: Critter, target: Critter, weapon: Obj): number {
        // we calculate the distance between source and target
        // we then substract the source's per modified by the weapon from it (except for scoped weapons)

        // NOTE: this function is supposed to have weird behaviour for multihex sources and targets. Let's ignore that.

        // 4 if weapon has long_range perk
        // 5 if weapon has scope_range perk
        var distModifier = 2
        // 8 if weapon has scope_range perk
        var minDistance = 0 
        var perception = critterGetStat(obj, "PER")
        var distance = hexDistance(obj.position, target.position)
        if(distance < minDistance)
            distance += minDistance // yes supposedly += not =, this means 7 grid distance is the worst
        else
        {
            var tempPER = perception
            if(obj.isPlayer === true)
                tempPER -= 2 // supposedly player gets nerfed like this. WTF?
            distance -= tempPER * distModifier
        }

        // this appears not to have any effect but was found so elsewhere
        // If anyone can tell me why it exists or what it's for I'd be grateful.
        if (-2*perception > distance)
            distance = -2*perception

        // TODO: needs to add sharpshooter perk bonuses on top
        // distance -= 2*sharpshooterRank

        // then we multiply a magic number on top. More if there is eye damage involved by the attacker
        // this means for each field distance after PER modification we lose 4 points of hitchance
        // 12 if we have eyedamage
        var objHasEyeDamage = false
        if(distance >= 0 && objHasEyeDamage)
            distance *= 12
        else 
            distance *= 4

        // and if the result is a positive distance, we return that
        // closeness can not improve hitchance above normal, so we don't return that
        if(distance >= 0)
            return distance
        else
            return 0

    }

    getHitChance(obj: Critter, target: Critter, region: string) {
        // TODO: visibility (= light conditions) and distance
        var weaponObj = critterGetEquippedWeapon(obj)
        if(weaponObj === null) // no weapon equipped (not even melee)
            return {hit: -1, crit: -1}

        var weapon = weaponObj.weapon
        var weaponSkill

        if(!weapon) throw Error("getHitChance: No weapon");

        if(weapon.weaponSkillType === undefined) {
            this.log("weaponSkillType is undefined")
            weaponSkill = 0
        }
        else
            weaponSkill = critterGetSkill(obj, weapon.weaponSkillType)

        var hitDistanceModifier = this.getHitDistanceModifier(obj, target, weaponObj)
        var bonusAC = 0 // TODO: AP at end of turn bonus
        var AC = critterGetStat(target, "AC") + bonusAC
        var bonusCrit = 0 // TODO: perk bonuses, other crit influencing things
        var baseCrit = critterGetStat(obj, "Critical Chance") + bonusCrit
        var hitChance = weaponSkill - AC - CriticalEffects.regionHitChanceDecTable[region] - hitDistanceModifier
        var critChance = baseCrit + CriticalEffects.regionHitChanceDecTable[region]

        if(isNaN(hitChance))
            throw "something went wrong with hit chance calculation"

        // 1 in 20 chance of failing needs to be preserved
        hitChance = Math.min(95, hitChance)

        return {hit: hitChance, crit: critChance}
    }

    rollHit(obj: Critter, target: Critter, region: string): any {
        var critModifer = critterGetStat(obj, "Better Criticals")
        var hitChance = this.getHitChance(obj, target, region)

        // hey kids! Did you know FO only rolls the dice once here and uses the results two times?
        var roll = getRandomInt(1, 101)

        if(hitChance.hit - roll > 0) {
            var isCrit = false
            if(rollSkillCheck(Math.floor(hitChance.hit - roll) / 10, hitChance.crit, false) === true)
                isCrit = true

            // TODO: if Slayer/Sniper perk -> second chance to crit
            if(isCrit === true) {
                var critLevel = Math.floor(Math.max(0, getRandomInt(critModifer, 100 + critModifer)) / 20)
                this.log("crit level: " + critLevel)
                var crit = CriticalEffects.getCritical(critterGetKillType(target)!, region, critLevel)
                var critStatus = crit.doEffectsOn(target)

                return {hit: true, crit: true, DM: critStatus.DM, msgID: critStatus.msgID} // crit
            }

            return {hit: true, crit: false} // hit
        }

        // in reverse because miss -> roll > hitchance.hit
        var isCrit = false
        if(rollSkillCheck(Math.floor(roll - hitChance.hit) / 10, 0, false))
            isCrit = true
        // TODO: jinxed/pariah dog give (nonstacking) 50% chance for critical miss upon miss

        return {hit: false, crit: isCrit} // miss
    }

    getDamageDone(obj: Critter, target: Critter, critModifer: number) {
        var weapon = critterGetEquippedWeapon(obj)
        if(!weapon) throw Error("getDamageDone: No weapon");
        var wep = weapon.weapon
        if(!wep) throw Error("getDamageDone: Weapon has no weapon data");
        var damageType = wep.getDamageType()

        var RD = getRandomInt(wep.minDmg, wep.maxDmg) // rand damage min..max
        var RB = 0 // ranged bonus (via perk)
        var CM = critModifer // critical hit damage multiplier
        var ADR = critterGetStat(target, "DR " + damageType) // damage resistance (TODO: armor)
        var ADT = critterGetStat(target, "DT " + damageType) // damage threshold (TODO: armor)
        var X = 2 // ammo dividend
        var Y = 1 // ammo divisor
        var RM = 0 // ammo resistance modifier
        var CD = 100 // combat difficulty modifier (easy = 75%, normal = 100%, hard = 125%)
        
        var ammoDamageMult = X / Y
        
        var baseDamage = (CM/2) * ammoDamageMult * (RD+RB) * (CD / 100)
        var adjustedDamage = Math.max(0, baseDamage - ADT)
        console.log(`RD: ${RD} | CM: ${CM} | ADR: ${ADR} | ADT: ${ADT} | Base Dmg: ${baseDamage} Adj Dmg: ${adjustedDamage} | Type: ${damageType}`)

        return Math.ceil(adjustedDamage * (1 - (ADR+RM)/100))
    }

    getCombatMsg(id: number) {
        return getMessage("combat", id)
    }

    attack(obj: Critter, target: Critter, region="torso", callback?: () => void) {
        // turn to face the target
        var hex = hexNearestNeighbor(obj.position, target.position)
        if(hex !== null)
            obj.orientation = hex.direction

        // attack!
        critterStaticAnim(obj, "attack", callback)

        var who = obj.isPlayer ? "You" : obj.name
        var targetName = target.isPlayer ? "you" : target.name
        var hitRoll = this.rollHit(obj, target, region)
        this.log("hit% is " + this.getHitChance(obj, target, region).hit)

        if(hitRoll.hit === true) {
            var critModifier = hitRoll.crit ? hitRoll.DM : 2
            var damage = this.getDamageDone(obj, target, critModifier)
            var extraMsg = hitRoll.crit === true ? (this.getCombatMsg(hitRoll.msgID) || "") : ""
            this.log(who + " hit " + targetName + " for " + damage + " damage" + extraMsg)

            critterDamage(target, damage, obj)

            if(target.dead)
                this.perish(target)
        }
        else {
            this.log(who + " missed " + targetName + (hitRoll.crit === true ? " critically" : ""))		
            if(hitRoll.crit === true) {
                var critFailMod = (critterGetStat(obj, "LUK") - 5) * - 5
                var critFailRoll = Math.floor(getRandomInt(1, 100) - critFailMod)
                var critFailLevel = 1
                if(critFailRoll <= 20)
                    critFailLevel = 1
                else if(critFailRoll <= 50)
                    critFailLevel = 2
                else if(critFailRoll <= 75)
                    critFailLevel = 3
                else if(critFailRoll <= 95)
                    critFailLevel = 4
                else
                    critFailLevel = 5

                this.log(who + " failed at fail level "+critFailLevel);

                // TODO: map weapon type to crit fail table types
                var critFailEffect = CriticalEffects.criticalFailTable.unarmed[critFailLevel]
                CriticalEffects.temporaryDoCritFail(critFailEffect, obj)
            }
        }
    }

    perish(obj: Critter) {
        this.log("...And killed them.")
    }

    getCombatAIMessage(id: number) {
        return getMessage("combatai", id)
    }

    maybeTaunt(obj: Critter, type: string, roll: boolean) {
        if(roll === false) return
        var msgID = getRandomInt(parseInt(obj.ai!.info[type+"_start"]),
                                 parseInt(obj.ai!.info[type+"_end"]))
        this.log("[TAUNT " + obj.name + ": " + this.getCombatAIMessage(msgID) + "]")
    }

    findTarget(obj: Critter): Critter|null {
        // TODO: find target according to AI rules
        // Find the closest living combatant on a different team

        const targets = this.combatants.filter(x => !x.dead && x.teamNum !== obj.teamNum);
        if(targets.length === 0)
            return null;
        targets.sort((a, b) => hexDistance(obj.position, a.position) - hexDistance(obj.position, b.position));
        return targets[0];
    }

    walkUpTo(obj: Critter, idx: number, target: Point, maxDistance: number, callback: () => void): boolean {
        // Walk up to `maxDistance` hexes, adjusting AP to fit
        if(obj.walkTo(target, false, callback, maxDistance)) {
            // OK
            if(obj.AP!.subtractMoveAP(obj.path.path.length - 1) === false)
                throw "subtraction issue: has AP: " + obj.AP!.getAvailableMoveAP() +
                       " needs AP:"+obj.path.path.length+" and maxDist was:"+maxDistance
            return true
        }

        return false
    }

    doAITurn(obj: Critter, idx: number, depth: number): void {
        if(depth > Config.combat.maxAIDepth) {
            console.warn(`Bailing out of ${depth}-deep AI turn recursion`);
            return this.nextTurn();
        }
        
        var that = this
        var target = this.findTarget(obj)
        if(!target) {
            console.log("[AI has no target]");
            return this.nextTurn();
        }
        var distance = hexDistance(obj.position, target.position)
        var AP = obj.AP!
        var messageRoll = rollSkillCheck(obj.ai!.info.chance, 0, false)

        if(Config.engine.doLoadScripts === true && obj._script !== undefined) {
            // notify the critter script of a combat event
            if(Scripting.combatEvent(obj, "turnBegin") === true)
                return // end of combat (script override)
        }

        if(AP.getAvailableMoveAP() <= 0) // out of AP
            return this.nextTurn()

        // behaviors

        if(critterGetStat(obj, "HP") <= obj.ai!.info.min_hp) { // hp <= min fleeing hp, so flee
            this.log("[AI FLEES]")

            // todo: pick the closest edge of the map
            this.maybeTaunt(obj, "run", messageRoll)
            const targetPos = {x: 128, y: obj.position.y} // left edge
            const callback = () => {
                obj.clearAnim();
                that.doAITurn(obj, idx, depth+1); // if we can, do another turn
            };

            if(!this.walkUpTo(obj, idx, targetPos, AP.getAvailableMoveAP(), callback)) {
                return this.nextTurn(); // not a valid path, just move on
            }
            
            return;
        }

        var weaponObj = critterGetEquippedWeapon(obj)
        if(!weaponObj) throw Error("AI has no weapon")
        var weapon = weaponObj.weapon
        if(!weapon) throw Error("AI weapon has no weapon data")
        var fireDistance = weapon.getMaximumRange(1)
        this.log("DEBUG: weapon: " + weapon + " fireDistance: " + fireDistance +
                 " obj: " + obj.art + " distance: " + distance)

        // are we in firing distance?
        if(distance > fireDistance) {
            this.log("[AI CREEPS]")
            var neighbors = hexNeighbors(target.position)
            var maxDistance = Math.min(AP.getAvailableMoveAP(), distance - fireDistance)
            this.maybeTaunt(obj, "move", messageRoll)

            // TODO: check nearest direction first
            var didCreep = false
            for(var i = 0; i < neighbors.length; i++) {
                if(obj.walkTo(neighbors[i], false, function() {
                    obj.clearAnim()
                    that.doAITurn(obj, idx, depth+1) // if we can, do another turn
                }, maxDistance) !== false) {
                    // OK
                    didCreep = true
                    if(AP.subtractMoveAP(obj.path.path.length - 1) === false)
                        throw "subtraction issue: has AP: " + AP.getAvailableMoveAP() +
                               " needs AP:"+obj.path.path.length+" and maxDist was:"+maxDistance
                    break
                }
            }

            if(!didCreep) {
                // no path
                this.log("[NO PATH]")
                that.doAITurn(obj, idx, depth+1) // if we can, do another turn
            }
        }
        else if(AP.getAvailableCombatAP() >= 4) { // if we are in range, do we have enough AP to attack?
            this.log("[ATTACKING]")
            AP.subtractCombatAP(4)

            if(critterGetEquippedWeapon(obj) === null)
                throw "combatant has no equipped weapon"

            this.attack(obj, target, "torso", function() {
                obj.clearAnim()
                that.doAITurn(obj, idx, depth+1) // if we can, do another turn
            })
        }
        else {
            console.log("[AI IS STUMPED]")
            this.nextTurn()
        }
    }

    static start(forceTurn?: Critter): void {
        // begin combat
        inCombat = true
        combat = new Combat(gMap.getObjects())

        if(forceTurn)
            combat.forceTurn(forceTurn)

        combat.nextTurn()
        gMap.updateMap()
    }

    end() {
        // TODO: check number of active combatants to see if we can end

        // Set all combatants to non-hostile and remove their outline
        for(const combatant of this.combatants) {
            combatant.hostile = false;
            combatant.outline = null;
        }

        console.log("[end combat]")
        combat = null // todo: invert control
        inCombat = false

        gMap.updateMap()
        uiEndCombat()
    }

    forceTurn(obj: Critter) {
        if(obj.isPlayer)
            this.whoseTurn = this.playerIdx - 1
        else {
            var idx = this.combatants.indexOf(obj)
            if(idx === -1) throw "forceTurn: no combatant '" + obj.name + ''

            this.whoseTurn = idx - 1
        }
    }

    nextTurn(): void {
        // update range checks
        var numActive = 0
        for(var i = 0; i < this.combatants.length; i++) {
            var obj = this.combatants[i]
            if(obj.dead || obj.isPlayer) continue
            var inRange = hexDistance(obj.position, this.player.position) <= obj.ai!.info.max_dist

            if(inRange || obj.hostile) {
                obj.hostile = true;
                obj.outline = obj.teamNum !== player.teamNum ? "red" : "green";
                numActive++;
            }
        }

        if(numActive === 0 && this.turnNum !== 1)
            return this.end()

        this.turnNum++
        this.whoseTurn++

        if(this.whoseTurn >= this.combatants.length)
            this.whoseTurn = 0

        if(this.combatants[this.whoseTurn].isPlayer) {
            // player turn
            this.inPlayerTurn = true
            this.player.AP!.resetAP()
        }
        else {
            this.inPlayerTurn = false
            var critter = this.combatants[this.whoseTurn]
            if(critter.dead === true || critter.hostile !== true)
                return this.nextTurn()

            // TODO: convert unused AP into AC
            critter.AP!.resetAP()
            this.doAITurn(critter, this.whoseTurn, 1)
        }	
    }
}