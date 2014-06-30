var CriticalEffects = (function() {
	var generalRegionName = {0: "head", 1: "leftArm",2: "rightArm",3: "torso",4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
	var regionHitChanceDecTable = {"head":40,"torso":0}
	var critterTable = {}

	var critterEffects = {
		knockout: function(target) {
			console.log(critterGetName(target) + " has been knocked out. This does not do anything yet")
		},

		knockdown: function(target) {
			console.log(critterGetName(target) + " has been knocked down. This does not do anything yet")
		},

		crippledLeftLeg: function(target) {
			console.log(critterGetName(target) + " has been crippled in the left leg. This does not do anything yet")
		},

		crippledRightLeg: function(target) {
			console.log(critterGetName(target) + " has been crippled in the right leg. This does not do anything yet")
		},

		crippledLeftArm: function(target) {
			console.log(critterGetName(target) + " has been crippled in the left arm. This does not do anything yet")
		},

		crippledRightArm: function(target) {
			console.log(critterGetName(target) + " has been crippled in the right arm. This does not do anything yet")
		},

		blinded: function(target) {
			console.log(critterGetName(target) + " has been blinded by delight. This does not do anything yet")
		},

		death: function(target) {
			console.log(critterGetName(target) + " has met the reaperpony. This does not do anything yet")
		},

		onFire: function(target) {
			console.log(critterGetName(target) + " just got a flame lit in their heart. This does not do anything yet")
		},

		bypassArmor: function(target) {
			console.log(critterGetName(target) + " is being hit by an armor bypassing bullet, blame the Zebras. This does not do anything yet")
		},

		droppedWeapon: function(target) {
			console.log(critterGetName(target) + " needs to drop their weapon like it's hot. The documentation claims this is broken. This does not do anything yet")
		},

		loseNextTurn: function(target) {
			console.log(critterGetName(target) + " lost their next turn. This does not do anything yet")
		},

		random: function(target) {
			console.log(critterGetName(target) + " is affected by a random effect. How random! This does not do anything yet")
		}
	}

	var Effects = function(effectCallbackList) {
		this.effects = effectCallbackList
	}

	Effects.prototype.doEffectsOn = function(target) {
		for(var i = 0; i < this.effects.length; i++)
			this.effects[i](target)
	}

	var StatCheck = function(stat, modifier, effects, failEffectMessage) {
		this.stat = stat
		this.modifier = modifier
		this.effects = effects
		this.failEffectMessageID = failEffectMessage
	}

	StatCheck.prototype.doEffectsOn = function(target)
	{
		if(this.stat === -1)
			return false
		var statToRollAgainst = target.stats[this.stat]
		statToRollAgainst += modifier

		//todo: rolling
		var failedRoll = true

		if(failedRoll === true) {
			this.effects.doEffectsOn(target)
			return {success: true, msgID: this.failEffectMessageID}
		}

		return {success: false}
	}

	var CritType = function(damageMultiplier, effects, statCheck, effectMsg) {
		this.DM = damageMultiplier
		this.effects = effects
		this.statCheck = statCheck
		this.msgID = effectMsg
	}

	CritType.prototype.doEffectsOn = function(target) {
		var statCheckResults = this.statCheck.doEffectsOn(target)
		var returnMsgID = this.msgID
		this.effects.doEffectsOn(target)

		//did statCheck do its effects as well?
		if(statCheckResults[0] === true)
			returnMsgID = statCheckResults[1]

		return {DM: this.DM, msgID: returnMsgID}
	}

	function getTable(number) {
		// todo: other types than than 1
		$.get("critTables/critterTable1.json", function(table) {
			critterTable[number] = critTableJsonToJsObjectParser(table)
		}, "json")
	}

	function critTableJsonToJsObjectParser(table) {	
		var retTable = {}
		for(var i = 0; i < 9; i++) {
			var curGeneralRegionName = generalRegionName[i]
			retTable[curGeneralRegionName] = parseRegion(table[curGeneralRegionName])
		}
		return retTable
	}

	function parseRegion(jsonRegion) {
		var retRegion = {}
		for(var i = 0; i < 6; i++)
			retRegion[i] = parseCritLevel(jsonRegion["critLevel"+i])
		return retRegion
	}

	function parseCritLevel(jsonCritLevel) {
		var jsonStat = jsonCritLevel.statCheck
		var tempStatCheck = new StatCheck(jsonStat.stat,jsonStat.checkModifier,parseEffects(jsonStat.failureEffect),jsonStat.fmsg)
		var retCritLevel = new CritType(jsonCritLevel.dmgMultiplier,parseEffects(jsonCritLevel.critEffect),tempStatCheck,jsonCritLevel.msg)
		return retCritLevel
	}

	function parseEffects(jsonEffects) {
		var tempEffects = {}
		for(var i = 0; i < jsonEffects.length; i++)
			tempEffects[i] = critterEffects[jsonEffects[i]]
		return new Effects(tempEffects)
	}


	//todo: better than that. Probably with a lazy approach.
	for(var i = 0; i < 20; i++)
		getTable(i)

	return {generalRegionName: generalRegionName,
			regionHitChanceDecTable: regionHitChanceDecTable,
			critterTable: critterTable}
})()