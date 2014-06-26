// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license


var ActionPoints = function(obj) {
	var combat = 0;
	var move = 0;
	this.resetAP(obj);
}

ActionPoints.prototype.getMaxAP = function(obj) {
	var bonusCombatAP = 0 //todo: replace with get function
	var bonusMoveAP = 0 //todo: replace with get function
	return {combat: 5 + Math.floor(obj.stats.AGI/2) + bonusCombatAP, move: bonusMoveAP}
}

ActionPoints.prototype.resetAP = function(obj) {
	var AP = getMaxAP(obj);
	this.combat = AP.combat;
	this.move = AP.move;
}

ActionPoints.prototype.getAvailableMoveAP = function() {
	return this.combat + this.move
}

ActionPoints.prototype.substractMoveAP = function(value) {
	if(this.getAvailableMoveAP >= value)
	{
		this.move -= value
		if(move < 0)
		{
			var combatSubstract = -move
			if(this.substractCombatAP(combatSubstract))
			{
				move = 0
				return true
			}else{
				return false
			}
		}else{
			return true
		}
	}else{
		return false
	}
}

ActionPoints.prototype.substractCombatAP = function(value) {
	if(this.combat >= value)
	{
		this.combat -= value
		return true
	}else{
		return false
	}
}


var Combat = function(objects, player) {
	this.critters = []
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter") {
			this.critters.push(objects[i])

			if(objects[i].stats === undefined)
				throw "no stats"; //objects[i].stats = this.getDefaultStats(objects[i])
			objects[i].dead = false
		}
	}

	//player is now just another critter
	this.critters.push(player)
	
	
	this.AP = new Array(this.critters.length)
	
	this.turnNum = 0
	this.whoseTurn = -2
	this.inPlayerTurn = false
}

Combat.prototype.fireDistance = function(obj) {
	return obj.leftHand.attackOne['maxRange'] //todo: implement proper attack selection
}

Combat.prototype.getDefaultStats = function(obj) {
	return {STR: 4, PER: 5, END: 5, CHR: 1, INT: 1, AGI: 1, LUK: 1, HP: 100}
}



Combat.prototype.getRandomInt = function(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

Combat.prototype.getDamageDone = function(obj, target) {
	var wep = obj.leftHand

	var RD = this.getRandomInt(wep.minDmg, wep.maxDmg) // rand damage min..max
	var RB = 0 // ranged bonus (via perk)
	var CM = 2 // critical hit damage multiplier
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

Combat.prototype.attack = function(obj, target, callback) {
	// turn to face the target
	var hex = hexNearestNeighbor(obj.position, target.position)
	if(hex !== null)
		obj.orientation = hex.direction

	// attack!
	critterStaticAnim(obj, "attack", callback)

	var damage = this.getDamageDone(obj, target)
	var who = obj.isPlayer ? "You" : obj.name //Todo: change to NPC name
	console.log(who + " hit the target for " + damage + " damage")
	target.stats.HP -= damage

	if(target.stats.HP <= 0) {
		console.log("...And killed them.")
		target.dead = true

		if(critterHasAnim(target, "death"))
			critterStaticAnim(target, "death", function() {
				// todo: corpse-ify
				target.frame-- // go to last frame
				target.anim = undefined
			})
	}
}

Combat.prototype.doAITurn = function(obj, idx) {
	var that = this
	var distance = hexDistance(obj.position, this.player.position)
	var AP = this.AP[idx]

	if(this.getAvailableMoveAP(AP) <= 0) { // out of AP
		this.nextTurn()
		return
	}

	// behaviors

	var fireDistance = this.fireDistance(obj)
	if(distance > fireDistance) {
		// todo: some sane direction, and also path checking
		console.log("[AI CREEPS]")
		var neighbors = hexNeighbors(this.player.position)
		var maxDistance = Math.min(this.AP[idx], fireDistance)

		for(var i = 0; i < neighbors.length; i++) {
			if(critterWalkTo(obj, neighbors[i], false, function() {
				critterStopWalking(obj)
				that.doAITurn(obj, idx)
			}, maxDistance) !== false) {
				// OK
				this.AP[idx] -= obj.path.path.length
				return
			}
		}

		// no path
		console.log("[NO PATH]")
		that.doAITurn(obj, idx)
	}
	else if(AP >= 4) {
		console.log("[ATTACKING]")
		this.AP[idx] -= 4

		if(!obj.leftHand)
			throw "combatant has no left handed item"

		this.attack(obj, this.player, function() {
			critterStopWalking(obj)
			that.doAITurn(obj, idx)
		})
	}
	else this.nextTurn()
}

Combat.prototype.nextTurn = function() {
	this.whoseTurn++
	if(this.whoseTurn >= this.critters.length) {
		// end of turn
		this.whoseTurn = -1
	}

	if(this.whoseTurn === -1) {
		// player
		this.inPlayerTurn = true
		this.player.AP = this.getMaxAP(this.player)
	}
	else {
		this.inPlayerTurn = false
		var critter = this.critters[this.whoseTurn]
		if(critter.dead === true)
			return this.nextTurn()
		this.AP[this.whoseTurn].resetAP() // reset AP
		this.doAITurn(critter, this.whoseTurn)
	}
}