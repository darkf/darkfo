// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

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

	this.aiInfo = AI.aiTxt[this.combatant.pro.extra.AI]
	if(this.aiInfo === undefined)
		throw "no AI packet for " + combatant.toString() +
			  " (packet " + this.combatant.pro.extra.AI + ")"
}

AI.aiTxt = null // AI.TXT: packet num -> key/value

var Combat = function(objects, player) {
	this.combatants = []
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter") {
			this.combatants.push(objects[i])
			objects[i].ai = new AI(objects[i])

			if(objects[i].stats === undefined)
				throw "no stats"
			objects[i].dead = false
		}
	}

	this.AP = new Array(this.combatants.length)
	this.player = player
	this.turnNum = 0
	this.whoseTurn = -2
	this.inPlayerTurn = false
}

Combat.prototype.getMaxAP = function(obj) {
	return 5 + Math.floor(obj.stats.AGI/2)
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
	var who = obj.isPlayer ? "You" : critterGetName(obj)
	var targetName = target.isPlayer ? "you" : critterGetName(target)
	console.log(who + " hit " + targetName + " for " + damage + " damage")
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

Combat.prototype.findTarget = function(obj) {
	// todo: find target according to AI rules
	return this.player
}

Combat.prototype.doAITurn = function(obj, idx) {
	var that = this
	var target = this.findTarget(obj)
	var distance = hexDistance(obj.position, target.position)
	var AP = this.AP[idx]

	if(AP <= 0) // out of AP
		return this.nextTurn()

	// behaviors

	var weapon = critterGetEquippedWeapon(obj)
	var fireDistance = weapon.getMaximumRange(1)

	// are we in firing distance?
	if(distance > fireDistance) {
		// todo: some sane direction, and also path checking
		console.log("[AI CREEPS]")
		var neighbors = hexNeighbors(target.position)
		var maxDistance = Math.min(AP, fireDistance)

		for(var i = 0; i < neighbors.length; i++) {
			if(critterWalkTo(obj, neighbors[i], false, function() {
				critterStopWalking(obj)
				that.doAITurn(obj, idx) // if we can, do another turn
			}, maxDistance) !== false) {
				// OK
				this.AP[idx] -= obj.path.path.length
				return
			}
		}

		// no path
		console.log("[NO PATH]")
		that.doAITurn(obj, idx) // if we can, do another turn
	}
	else if(AP >= 4) { // if we are in range, do we have enough AP to attack?
		console.log("[ATTACKING]")
		this.AP[idx] -= 4

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
		this.player.AP = this.getMaxAP(this.player)
	}
	else {
		this.inPlayerTurn = false
		var critter = this.combatants[this.whoseTurn]
		if(critter.dead === true)
			return this.nextTurn()
		this.AP[this.whoseTurn] = this.getMaxAP(critter) // reset AP
		this.doAITurn(critter, this.whoseTurn)
	}
}