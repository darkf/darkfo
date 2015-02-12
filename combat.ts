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

var ActionPoints = function(obj) {
	this.combat = 0
	this.move = 0
	this.attachedObject = obj
	this.resetAP()
}

ActionPoints.prototype.getMaxAP = function() {
	var bonusCombatAP = 0 //todo: replace with get function
	var bonusMoveAP = 0 //todo: replace with get function
	return {combat: 5 + Math.floor(critterGetStat(this.attachedObject,'AGI')/2) + bonusCombatAP, move: bonusMoveAP}
}

ActionPoints.prototype.resetAP = function() {
	var AP = this.getMaxAP()
	this.combat = AP.combat
	this.move = AP.move
}

ActionPoints.prototype.getAvailableMoveAP = function() {
	return this.combat + this.move
}

ActionPoints.prototype.getAvailableCombatAP = function() {
	return this.combat
}

ActionPoints.prototype.subtractMoveAP = function(value) {
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

ActionPoints.prototype.subtractCombatAP = function(value) {
	if(this.combat < value)
		return false

	this.combat -= value
	return true
}

class AI {
	static aiTxt: any = null; // AI.TXT: packet num -> key/value
	combatant: any;
	info: any;

	constructor(combatant) {
		this.combatant = combatant

		if(AI.aiTxt === null) { // load AI.TXT
			AI.aiTxt = {}
			var ini = parseIni(getFileText("data/data/AI.TXT"))
			if(ini === null) throw "couldn't load AI.TXT"
			for(var key in ini) {
				ini[key].keyName = key
				AI.aiTxt[ini[key].packet_num] = ini[key]
			}
		}

		this.info = AI.aiTxt[this.combatant.aiNum]
		if(this.info === undefined)
			throw "no AI packet for " + combatant.toString() +
				  " (packet " + this.combatant.aiNum + ")"
	}
}


class Combat {
	combatants: any[]; // TODO: Critter[]
	playerIdx: number;
	player: any;
	turnNum: number;
	whoseTurn: number;
	inPlayerTurn: boolean;

	constructor(objects) {
		this.combatants = []
		this.playerIdx = -1

		for(var i = 0; i < objects.length; i++) {
			if(objects[i].type === "critter") {
				if(objects[i].dead === true) continue
				if(objects[i].visible === false) continue
				this.combatants.push(objects[i])

				if(!objects[i].isPlayer)
					objects[i].ai = new AI(objects[i])
				else this.playerIdx = this.combatants.length - 1

				if(objects[i].stats === undefined)
					throw "no stats"
				objects[i].dead = false
				objects[i].AP = new ActionPoints(objects[i])
			}
		}

		if(this.playerIdx === -1)
			throw "combat: couldn't find player?"

		this.player = this.combatants[this.playerIdx]
		this.turnNum = 1
		this.whoseTurn = this.playerIdx - 1
		this.inPlayerTurn = true

		uiStartCombat()
	}


	log(msg: any) {
		// Combat-related debug log
		console.log(msg)
	}

	accountForPartialCover(obj, target) {
		//todo: get list of intervening critters. Substract 10 for each one in the way
		return 0
	}

	getHitDistanceModifier(obj, target, weapon) {
		//we calculate the distance between source and target
		//we then substract the source's per modified by the weapon from it (except for scoped weapons)

		//note: this function is supposed to have weird behaviour for multihex sources and targets. Let's ignore that.

	    //4 if weapon has long_range perk
	    //5 if weapon has scope_range perk
		var distModifier = 2
		//8 if weapon has scope_range perk
		var minDistance = 0 
		var perception = critterGetStat(obj, "PER")
		var distance = hexDistance(obj.position, target.position)
		if(distance < minDistance)
			distance += minDistance //yes supposedly += not =, this means 7 grid distance is the worst
		else
		{
			var tempPER = perception
			if(obj.isPlayer === true)
				tempPER -= 2 //supposedly player gets nerfed like this. WTF?
			distance -= tempPER * distModifier
		}

		//this appears not to have any effect but was found so elsewhere
		//If anyone can tell me why it exists or what it's for I'd be grateful.
		if (-2*perception > distance)
			distance = -2*perception

		//needs to add sharpshooter perk bonuses on top
		//distance -= 2*sharpshooterRank


		//then we multiply a magic number on top. More if there is eye damage involved by the attacker
		//this means for each field distance after PER modification we lose 4 points of hitchance
		//12 if we have eyedamage
		var objHasEyeDamage = false
		if(distance >= 0 && objHasEyeDamage)
			distance *= 12
		else 
			distance *= 4

		//and if the result is a positive distance, we return that
		//closeness can not improve hitchance above normal, so we don't return that
		if(distance >= 0)
			return distance
		else
			return 0

	}

	getHitChance(obj: any, target: any, region: any) {
		// TODO: visibility (= light conditions) and distance
		var weaponObj = critterGetEquippedWeapon(obj)
		if(weaponObj === null)
			return {hit: -1, crit: -1}
		var weapon = weaponObj.weapon
		var weaponSkill
		if(weapon.weaponSkillType === undefined) {
			this.log("weaponSkillType is undefined")
			weaponSkill = 0
		}
		else
			weaponSkill = critterGetSkill(obj, weapon.weaponSkillType)
		var hitDistanceModifier = this.getHitDistanceModifier(obj, target, weapon)
		var bonusAC = 0 // TODO: AP at end of turn bonus
		var AC = critterGetStat(target, "AC") + bonusAC
		var bonusCrit = 0 // TODO: perk bonuses, other crit influencing things
		var baseCrit = critterGetStat(obj, "Critical Chance") + bonusCrit
		var hitChance = weaponSkill - AC - CriticalEffects.regionHitChanceDecTable[region] - hitDistanceModifier
		var critChance = baseCrit + CriticalEffects.regionHitChanceDecTable[region]
		if(isNaN(hitChance)) throw "something went wrong with hit chance calculation"
		//1 in 20 chance of failing needs to be preserved
		hitChance = Math.min(95, hitChance)
		return {hit: hitChance, crit: critChance}
	}

	rollHit(obj: Critter, target: Critter, region: string): any {
		var critModifer = critterGetStat(obj, "Better Criticals")
		var hitChance = this.getHitChance(obj, target, region)

		//hey kids! Did you know FO only rolls the dice once here and uses the results two times?
		var roll = getRandomInt(1,101)

		if(hitChance.hit - roll > 0) {
			var isCrit = false
			if(rollSkillCheck(Math.floor(hitChance.hit - roll)/10, hitChance.crit, false) === true)
				isCrit = true
			//todo: if Slayer/Sniper perk -> second chance to crit
			if(isCrit === true) {
				var critLevel = Math.floor(Math.max(0, getRandomInt(critModifer,100+critModifer)) / 20)
				this.log("crit level: " + critLevel)
				var crit = CriticalEffects.getCritical(critterGetKillType(target), region, critLevel)
				var critStatus = crit.doEffectsOn(target)
				return {hit: true, crit: true, DM: critStatus.DM, msgID: critStatus.msgID} // crit
			}

			return {hit: true, crit: false} // hit
		}

		//in reverse because miss -> roll > hitchance.hit
		var isCrit = false
		if(rollSkillCheck(Math.floor(roll - hitChance.hit)/10,0,false))
			isCrit = true
		//todo: jinxed/pariah dog give (nonstacking) 50% chance for critical miss upon miss

		return {hit: false, crit: isCrit} // miss
	}

	getDamageDone(obj, target, critModifer) {
		var wep = critterGetEquippedWeapon(obj).weapon
		var typeOfDamge = damageType[wep.getDamageType()]

		var RD = getRandomInt(wep.minDmg, wep.maxDmg) // rand damage min..max
		var RB = 0 // ranged bonus (via perk)
		var CM = critModifer // critical hit damage multiplier
		var ADR = critterGetStat(target,"DR "+typeOfDamge) // damage resistance (TODO: armor)
		var ADT = critterGetStat(target,"DT "+typeOfDamge) // damage threshold (TODO: armor)
		var X = 2 // ammo dividend
		var Y = 1 // ammo divisor
		var RM = 0 // ammo resistance modifier
		var CD = 100 // combat difficulty modifier (easy = 75%, normal = 100%, hard = 125%)
		
		var ammoDamageMult = X / Y
		
		var baseDamage = (CM/2) * ammoDamageMult * (RD+RB) * (CD / 100)
		var adjustedDamage = Math.max(0, baseDamage - ADT)
		console.log("RD: "+RD+" CM: "+CM+" ADR: "+ADR+" ADT: "+ADT+" baseDamage: "+baseDamage+" adjustedDamage: "+adjustedDamage)
		return Math.ceil(adjustedDamage * (1 - (ADR+RM)/100))
	}

	getCombatMsg(id) {
		return getMessage("combat", id)
	}

	attack(obj: Critter, target: Critter, region="torso", callback?: () => void) {
		// turn to face the target
		var hex = hexNearestNeighbor(obj.position, target.position)
		if(hex !== null)
			obj.orientation = hex.direction

		// attack!
		critterStaticAnim(obj, "attack", callback)

		var who = obj.isPlayer ? "You" : critterGetName(obj)
		var targetName = target.isPlayer ? "you" : critterGetName(target)
		var hitRoll = this.rollHit(obj, target, region)
		this.log("hit% is " + this.getHitChance(obj, target, region).hit)

		if(hitRoll.hit === true) {
			var critModifier = hitRoll.crit ? hitRoll.DM : 2
			var damage = this.getDamageDone(obj, target, critModifier)
			var extraMsg = hitRoll.crit === true ? this.getCombatMsg(hitRoll.msgID) : ""
			this.log(who + " hit " + targetName + " for " + damage + " damage" + extraMsg)

			critterDamage(target, damage, obj)
			if(target.dead === true)
				combat.perish(target)
		}
		else
		{
			this.log(who + " missed " + targetName + (hitRoll.crit === true ? " critically" : ""))		
			if(hitRoll.crit === true)
			{
				var critFailMod = (critterGetStat(obj, "LUK") - 5) * - 5
				var critFailRoll = Math.floor(getRandomInt(1,100) - critFailMod)
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
				//todo: map weapon type to crit fail table types
				var critFailEffect = CriticalEffects.criticalFailTable.unarmed[critFailLevel]
				CriticalEffects.temporaryDoCritFail(critFailEffect, obj)
			}
		}
	}

	perish(obj) {
		this.log("...And killed them.")
	}

	getCombatAIMessage(id) {
		return getMessage("combatai", id)
	}

	maybeTaunt(obj, type, roll) {
		if(roll === false) return
		var msgID = getRandomInt(parseInt(obj.ai.info[type+"_start"]),
		                         parseInt(obj.ai.info[type+"_end"]))
		this.log("[TAUNT " + critterGetName(obj) + ": " + this.getCombatAIMessage(msgID) + "]")
	}

	findTarget(obj) {
		// todo: find target according to AI rules
		return this.player
	}

	walkUpTo(obj, idx, target, maxDistance, callback) {
		// Walk up to `maxDistance` hexes, adjusting AP to fit
		if(critterWalkTo(obj, target, false, callback, maxDistance) !== false) {
			// OK
			if(obj.AP.subtractMoveAP(obj.path.path.length - 1) === false)
				throw "subtraction issue: has AP: " + obj.AP.getAvailableMoveAP() +
			           " needs AP:"+obj.path.path.length+" and maxDist was:"+maxDistance
			return true
		}

		return false
	}

	doAITurn(obj, idx) {
		var that = this
		var target = this.findTarget(obj)
		var distance = hexDistance(obj.position, target.position)
		var AP = obj.AP
		var messageRoll = rollSkillCheck(obj.ai.info.chance, 0, false)

		if(doLoadScripts === true && obj._script !== undefined) {
			// notify the critter script of a combat event
			if(scriptingEngine.combatEvent(obj, "turnBegin") === true)
				return // end of combat (script override)
		}

		if(AP.getAvailableMoveAP() <= 0) // out of AP
			return this.nextTurn()

		// behaviors

		if(critterGetStat(obj, "HP") <= obj.ai.info.min_hp) { // hp <= min fleeing hp, so flee
			this.log("[AI FLEES]")

			// todo: pick the closest edge of the map
			this.maybeTaunt(obj, "run", messageRoll)
			var targetPos = {x: 128, y: obj.position.y} // left edge
			if(this.walkUpTo(obj, idx, targetPos, AP, function() {
				obj.clearAnim()
				that.doAITurn(obj, idx) // if we can, do another turn
			}) === false)
				return this.nextTurn() // not a valid path, just move on
			
			return
		}

		var weaponObj = critterGetEquippedWeapon(obj)
		if(weaponObj === null) throw "AI has no weapon"
		var weapon = weaponObj.weapon
		var fireDistance = weapon.getMaximumRange(1)
		this.log("DEBUG: weapon: " + weapon + " fireDistance: " + fireDistance +
			     " obj: " + obj.art + " distance: " + distance)

		// are we in firing distance?
		if(distance > fireDistance) {
			this.log("[AI CREEPS]")
			var neighbors = hexNeighbors(target.position)
			var maxDistance = Math.min(AP.getAvailableMoveAP(), distance - fireDistance)
			this.maybeTaunt(obj, "move", messageRoll)

			// todo: check nearest direction first
			var didCreep = false
			for(var i = 0; i < neighbors.length; i++) {
				if(critterWalkTo(obj, neighbors[i], false, function() {
					obj.clearAnim()
					that.doAITurn(obj, idx) // if we can, do another turn
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
				that.doAITurn(obj, idx) // if we can, do another turn
			}
		}
		else if(AP.getAvailableCombatAP() >= 4) { // if we are in range, do we have enough AP to attack?
			this.log("[ATTACKING]")
			AP.subtractCombatAP(4)

			if(critterGetEquippedWeapon(obj) === null)
				throw "combatant has no equipped weapon"

			this.attack(obj, target, "torso", function() {
				obj.clearAnim()
				that.doAITurn(obj, idx) // if we can, do another turn
			})
		}
		else this.nextTurn()
	}

	static start(forceTurn?: boolean): void {
		// begin combat
		inCombat = true
		combat = new Combat(gObjects)
		if(forceTurn !== undefined)
			combat.forceTurn(forceTurn)
		combat.nextTurn()
	}

	end() {
		// TODO: check number of active combatants to see if we can end

		console.log("[end combat]")
		combat = null // todo: invert control
		inCombat = false

		uiEndCombat()
	}

	forceTurn(obj) {
		if(obj === player)
			this.whoseTurn = this.playerIdx - 1
		else {
			var idx = this.combatants.indexOf(obj)
			if(idx === -1) throw "forceTurn: no combatant " + critterGetName(obj)

			this.whoseTurn = idx - 1
		}
	}

	nextTurn() {
		// update range checks
		var numActive = 0
		for(var i = 0; i < this.combatants.length; i++) {
			var obj = this.combatants[i]
			if(obj.dead === true || obj.isPlayer === true) continue
			obj.inRange = hexDistance(obj.position, this.player.position) <= obj.ai.info.max_dist

			if(obj.inRange === true || obj.hostile === true) {
				obj.hostile = true
				numActive++
			}
		}

		if(numActive === 0 && this.turnNum != 1)
			return this.end()

		this.turnNum++
		this.whoseTurn++

		if(this.whoseTurn >= this.combatants.length)
			this.whoseTurn = 0

		if(this.combatants[this.whoseTurn].isPlayer === true) {
			// player turn
			this.inPlayerTurn = true
			this.player.AP.resetAP()
		}
		else {
			this.inPlayerTurn = false
			var critter = this.combatants[this.whoseTurn]
			if(critter.dead === true || critter.hostile !== true)
				return this.nextTurn()

			// todo: convert unused AP into AC
			critter.AP.resetAP()
			this.doAITurn(critter, this.whoseTurn)
		}
		
	}
}