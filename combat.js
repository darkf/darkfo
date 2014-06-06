var Combat = function(objects, player) {
	this.critters = []
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter") {
			this.critters.push(objects[i])
		}
	}

	this.AP = new Array(this.critters.length)
	this.player = player
	this.turnNum = 0
	this.whoseTurn = -2
	this.inPlayerTurn = false
}

Combat.prototype.fireDistance = function(obj) {
	return 3; // todo: get some distance before firing
}

Combat.prototype.shoot = function(obj, target, callback) {
	if(obj.isPlayer) {
		critterStaticAnim(player, "shoot", function() {
			critterStaticAnim(player, "weapon-reload", callback)
		})
	}
	else {
		// if we have a punch animation, use that, otherwise default to idling
		if(critterHasAnim(obj, "shoot"))
			critterStaticAnim(obj, "shoot", callback)
		else if(critterHasAnim(obj, "punch"))
			critterStaticAnim(obj, "punch", callback)
		else critterStaticAnim(obj, "static-idle", callback)
	}
}

Combat.prototype.doAITurn = function(obj, idx) {
	var that = this
	var distance = hexDistance(obj.position, this.player.position)
	var AP = this.AP[idx]

	if(AP <= 0) { // out of AP
		this.nextTurn()
		return
	}

	// behaviors

	if(distance > this.fireDistance(obj)) {
		// todo: some sane direction, and also path checking
		console.log("[AI CREEPS]")
		this.AP[idx] -= 2
		var neighbors = hexNeighbors(this.player.position)
		for(var i = 0; i < neighbors.length; i++) {
			if(critterWalkTo(obj, neighbors[i], false, function() {
				critterStopWalking(obj)
				that.doAITurn(obj, idx)
			}) !== false) {
				// OK
				return
			}
		}

		// no path
		console.log("[NO PATH]")
		that.doAITurn(obj, idx)
	}
	else if(AP >= 4) {
		console.log("[SHOOTING]")
		this.AP[idx] -= 4
		// turn towards player
		obj.orientation = 5 - this.player.orientation
		this.shoot(obj, this.player, function() {
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
		this.player.AP = 4
	}
	else {
		this.inPlayerTurn = false
		this.AP[this.whoseTurn] = 4 // reset AP
		this.doAITurn(this.critters[this.whoseTurn], this.whoseTurn)
	}
}