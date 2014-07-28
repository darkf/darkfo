/*
Copyright 2014 darkf, Stratege

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

var AI = function(combatant) {
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

	this.info = AI.aiTxt[this.combatant.pro.extra.AI]
	if(this.info === undefined)
		throw "no AI packet for " + combatant.toString() +
			  " (packet " + this.combatant.pro.extra.AI + ")"
}

AI.aiTxt = null // AI.TXT: packet num -> key/value

var Combat = function(objects, player) {
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

	this.player = player
	this.turnNum = 1
	this.whoseTurn = this.playerIdx - 1
	this.inPlayerTurn = true

	// TODO: Combat.start()?
	uiStartCombat()
}

Combat.prototype.log = function(msg) {
	// Combat-related debug log
	console.log(msg)
}

Combat.prototype.getHitChance = function(obj, target, region, critModifer) {
	// TODO: visibility and distance
	var weaponObj = critterGetEquippedWeapon(obj)
	if(weaponObj === null)
		return {hit: -1, crit: -1}
	var weapon = weaponObj.weapon

	if(weapon.weaponSkillType === undefined) {
		this.log("weaponSkillType is undefined")
		var weaponSkill = 0
	}
	else
		var weaponSkill = critterGetSkill(obj, weapon.weaponSkillType)
	var bonusAC = 0 // TODO: AP at end of turn bonus
	var AC = critterGetStat(target, "AC") + bonusAC
	var bonusCrit = 0 // TODO: perk bonuses, other crit influencing things
	var baseCrit = critterGetStat(obj, "Critical Chance") + bonusCrit
	var hitChance = weaponSkill - AC - CriticalEffects.regionHitChanceDecTable[region]
	var critChance = baseCrit + CriticalEffects.regionHitChanceDecTable[region]
	if(isNaN(hitChance)) throw "something went wrong with hit chance calculation"
	return {hit: hitChance, crit: critChance}
}

Combat.prototype.rollHit = function (obj, target, region) {
	var critModifer = critterGetStat(obj, "Better Criticals")
	var hitChance = this.getHitChance(obj, target, region, critModifer)

	if(rollSkillCheck(hitChance.hit, 0, true) === true) {
		if(rollSkillCheck(hitChance.crit, 0, true) === true) {
			var critLevel = Math.floor(Math.max(0, getRandomInt(critModifer,100+critModifer)) / 20)
			this.log("crit level: " + critLevel)
			var crit = CriticalEffects.getCritical(critterGetKillType(target), region, critLevel)
			var critStatus = crit.doEffectsOn(target)
			return {hit: true, crit: true, DM: critStatus.DM, msgID: critStatus.msgID} // crit
		}

		return {hit: true, crit: false} // hit
	}

	return {hit: false, crit: false} // miss
}

Combat.prototype.getDamageDone = function(obj, target, critModifer) {
	var wep = critterGetEquippedWeapon(obj).weapon

	var RD = getRandomInt(wep.minDmg, wep.maxDmg) // rand damage min..max
	var RB = 0 // ranged bonus (via perk)
	var CM = critModifer // critical hit damage multiplier
	var ADR = 0 // damage resistance (TODO: armor)
	var ADT = 0 // damage threshold (TODO: armor)
	var X = 2 // ammo dividend
	var Y = 1 // ammo divisor
	var RM = 0 // ammo resistance modifier
	var CD = 100 // combat difficulty modifier (easy = 75%, normal = 100%, hard = 125%)
	
	var ammoDamageMult = X / Y
	
	var baseDamage = (CM/2) * ammoDamageMult * (RD+RB) * (CD / 100)
	var adjustedDamage = Math.max(0, baseDamage - ADT)

	return Math.ceil(adjustedDamage * (1 - (ADR+RM)/100))
}

Combat.prototype.getCombatMsg = function(id) {
	return getMessage("combat", id)
}

Combat.prototype.attack = function(obj, target, callback) {
	// turn to face the target
	var hex = hexNearestNeighbor(obj.position, target.position)
	if(hex !== null)
		obj.orientation = hex.direction

	// attack!
	critterStaticAnim(obj, "attack", callback)

	var who = obj.isPlayer ? "You" : critterGetName(obj)
	var targetName = target.isPlayer ? "you" : critterGetName(target)
	var hitRoll = this.rollHit(obj, target, "torso")
	this.log("hit% is " + this.getHitChance(obj, target, "torso", 2).hit)

	// todo: critical misses

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
		this.log(who + " missed " + targetName)		
}

Combat.prototype.perish = function(obj) {
	this.log("...And killed them.")
}

Combat.prototype.getCombatAIMessage = function(id) {
	return getMessage("combatai", id)
}

Combat.prototype.maybeTaunt = function(obj, type, roll) {
	if(roll === false) return
	var msgID = getRandomInt(parseInt(obj.ai.info[type+"_start"]),
	                         parseInt(obj.ai.info[type+"_end"]))
	this.log("[TAUNT " + critterGetName(obj) + ": " + this.getCombatAIMessage(msgID) + "]")
}

Combat.prototype.findTarget = function(obj) {
	// todo: find target according to AI rules
	return this.player
}

Combat.prototype.walkUpTo = function(obj, idx, target, maxDistance, callback) {
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

Combat.prototype.doAITurn = function(obj, idx) {
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
			critterStopWalking(obj)
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
				critterStopWalking(obj)
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

		this.attack(obj, target, function() {
			critterStopWalking(obj)
			that.doAITurn(obj, idx) // if we can, do another turn
		})
	}
	else this.nextTurn()
}

Combat.prototype.end = function() {
	// TODO: check number of active combatants to see if we can end

	console.log("[end combat]")
	combat = null // todo: invert control
	inCombat = false

	uiEndCombat()
}

Combat.prototype.forceTurn = function(obj) {
	if(obj === player)
		this.whoseTurn = this.playerIdx - 1
	else {
		var idx = this.combatants.indexOf(obj)
		if(idx === -1) throw "forceTurn: no combatant " + critterGetName(obj)

		this.whoseTurn = idx - 1
	}
}

Combat.prototype.nextTurn = function() {
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