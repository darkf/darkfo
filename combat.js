var Combat = function(objects, player) {
	this.critters = []
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter")
			this.critters.push(objects[i])
	}

	this.player = player
	this.turnNum = 0
	this.whoseTurn = -2
	this.inPlayerTurn = false
}

Combat.prototype.doTurn = function(obj) {
	// behaviors
	var that = this
	critterStaticAnim(obj, "static-idle", function() {
		critterStopWalking(obj)
		that.nextTurn()
	})
}

Combat.prototype.nextTurn = function() {
	this.whoseTurn++
	if(this.whoseTurn >= this.critters.length) {
		// end of turn
		this.whoseTurn = -1
		return
	}

	if(this.whoseTurn === -1) {
		// player
		this.inPlayerTurn = true
	}
	else
		this.doTurn(this.critters[this.whoseTurn])
}