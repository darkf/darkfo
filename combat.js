// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

var ActionPoints = function(obj) {
	this.combat = 0
	this.move = 0
	this.attachedObject = obj
	this.resetAP()
}

ActionPoints.prototype.getMaxAP = function() {
	var bonusCombatAP = 0 //todo: replace with get function
	var bonusMoveAP = 0 //todo: replace with get function
	return {combat: 5 + Math.floor(this.attachedObject.stats.AGI/2) + bonusCombatAP, move: bonusMoveAP}
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
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter") {
			if(objects[i].dead === true) continue
			this.combatants.push(objects[i])
			objects[i].ai = new AI(objects[i])

			if(objects[i].stats === undefined)
				throw "no stats"
			objects[i].dead = false
			objects[i].AP = new ActionPoints(objects[i])
		}
	}

	this.player = player
	if(this.player.stats === undefined)	
		throw "no player stats"			
	this.player.AP = new ActionPoints(player)
	this.turnNum = 0
	this.whoseTurn = -2
	this.inPlayerTurn = false
}

Combat.prototype.log = function(msg) {
	// Combat-related debug log
	console.log(msg)
}

Combat.prototype.getHitChance = function(obj, target, region, critModifer) {
	var WeaponSkill = 70
	var AC = 0
	var baseCrit = 50
	var hitChance = WeaponSkill - AC - CriticalEffects.regionHitChanceDecTable[region]
	var critChance = baseCrit + CriticalEffects.regionHitChanceDecTable[region]
	if(isNaN(hitChance)) throw "something went wrong with hit chance calculation"
	return {hit: hitChance, crit: critChance}
}

Combat.prototype.rollHit = function (obj, target, region) {
	var critModifer = 0
	var hitChance = this.getHitChance(obj, target, region, critModifer)

	if(rollSkillCheck(hitChance.hit, 0, true) === true) {
		if(rollSkillCheck(hitChance.crit, 0, true) === true) {
			var critLevel = Math.floor(Math.max(0, getRandomInt(critModifer,100+critModifer)) / 20)
			this.log("crit level: " + critLevel)
			// todo: find proper table
			var crit = CriticalEffects.getCritical(critterGetKillType(target), region, critLevel)
			var critStatus = crit.doEffectsOn(target)
			return {hit: true, crit: true, DM: critStatus.DM, msgID: critStatus.msgID} // crit
		}

		return {hit: true, crit: false} // hit
	}

	return {hit: false, crit: false} // miss
}

Combat.prototype.getDamageDone = function(obj, target, critModifer) {
	var wep = critterGetEquippedWeapon(obj)

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

	// todo: critical misses

	if(hitRoll.hit === true) {
		var critModifier = hitRoll.crit ? hitRoll.DM : 2
		var damage = this.getDamageDone(obj, target, critModifier)
		var extraMsg = hitRoll.crit === true ? this.getCombatMsg(hitRoll.msgID) : ""
		this.log(who + " hit " + targetName + " for " + damage + " damage" + extraMsg)

		target.stats.HP -= damage
		if(target.stats.HP <= 0)
			combat.perish(target)
	}
	else
		this.log(who + " missed " + targetName)		
}

Combat.prototype.perish = function(obj) {
	this.log("...And killed them.")
	obj.dead = true
	if(critterHasAnim(obj, "death"))
		critterStaticAnim(obj, "death", function() {
			// todo: corpse-ify
			obj.frame-- // go to last frame
			obj.anim = undefined
		})
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
	var messageRoll = rollSkillCheck(obj.ai.info.chance,0,false)

	if(AP.getAvailableMoveAP() <= 0) // out of AP
		return this.nextTurn()

	// behaviors

	if(obj.stats.HP <= obj.ai.info.min_hp) { // hp <= min fleeing hp, so flee
		this.log("[AI FLEES]")
		// todo: pick the closest edge of the map
		this.maybeTaunt(obj, "run", messageRoll)
		var targetPos = {x: 128, y: obj.position.y} // left edge
		this.walkUpTo(obj, idx, targetPos, AP, function() {
			critterStopWalking(obj)
			that.doAITurn(obj, idx) // if we can, do another turn
		})
		return
	}

	var weapon = critterGetEquippedWeapon(obj)
	var fireDistance = weapon.getMaximumRange(1)
	this.log("DEBUG: weapon: " + weapon + " fireDistance: " + fireDistance +
		     " obj: " + obj.art + " distance: " + distance)
	// are we in firing distance?
	if(distance > fireDistance) {
		// todo: some sane direction, and also path checking
		this.log("[AI CREEPS]")
		var neighbors = hexNeighbors(target.position)
		var maxDistance = Math.min(AP.getAvailableMoveAP(), distance - fireDistance)
		this.maybeTaunt(obj, "move", messageRoll)

		for(var i = 0; i < neighbors.length; i++) {
			if(critterWalkTo(obj, neighbors[i], false, function() {
				critterStopWalking(obj)
				that.doAITurn(obj, idx) // if we can, do another turn
			}, maxDistance) !== false) {
				// OK
				if(AP.subtractMoveAP(obj.path.path.length - 1) === false)
					throw "subtraction issue: has AP: " + AP.getAvailableMoveAP() +
				           " needs AP:"+obj.path.path.length+" and maxDist was:"+maxDistance
				return
			}
			else {
				this.log("invalid path -- advancing")
				return this.nextTurn()
			}
		}

		// no path
		this.log("[NO PATH]")
		that.doAITurn(obj, idx) // if we can, do another turn
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

Combat.prototype.numAlive = function() {
	var count = 0
	for(var i = 0; i < this.combatants.length; i++) {
		if(this.combatants[i].dead !== true)
			count++
	}
	return count
}

Combat.prototype.end = function() {
	console.log("[end combat]")
	combat = null // todo: invert control
	inCombat = false
}

Combat.prototype.forceTurn = function(obj) {
	if(obj === player)
		this.whoseTurn = -1 - 1
	else {
		var idx = this.combatants.indexOf(obj)
		if(idx === -1) throw "forceTurn: no combatant " + critterGetName(obj)

		this.whoseTurn = idx - 1
	}
}

Combat.prototype.nextTurn = function() {
	if(this.numAlive() === 0)
		return this.end()

	this.whoseTurn++
	if(this.whoseTurn >= this.combatants.length) {
		// end of turn
		this.whoseTurn = -1
	}

	if(this.whoseTurn === -1) {
		// player
		this.inPlayerTurn = true
		this.player.AP.resetAP()
	}
	else {
		this.inPlayerTurn = false
		var critter = this.combatants[this.whoseTurn]
		if(critter.dead === true)
			return this.nextTurn()
		// todo: convert unused AP into AC
		critter.AP.resetAP()
		this.doAITurn(critter, this.whoseTurn)
	}
}