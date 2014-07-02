// DarkFO
// Copyright (c) 2014 darkf, Stratege
// Licensed under the terms of the zlib license

var CriticalEffects = (function() {
	var generalRegionName = {0: "head", 1: "leftArm",2: "rightArm",3: "torso",4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
	var regionHitChanceDecTable = {"head":40,"torso":0}
	var critterTable = []

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
		statToRollAgainst += this.modifier

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

	function parseCritLevel(critLevel) {
		var stat = critLevel.statCheck
		var tempStatCheck = new StatCheck(stat.stat, stat.checkModifier,
			parseEffects(stat.failureEffect), stat.failureMessage)
		var retCritLevel = new CritType(critLevel.dmgMultiplier,
			parseEffects(critLevel.critEffect), tempStatCheck, critLevel.msg)
		return retCritLevel
	}

	function parseEffects(effects) {
		var tempEffects = []
		for(var i = 0; i < effects.length; i++)
			tempEffects[i] = critterEffects[effects[i]]
		return new Effects(tempEffects)
	}

	function getCritical(critterType, region, critLevel) {
		return critterTable[critterType][region][critLevel]
	}

	function loadTable() {
		// read in the global table
		console.log("loading critical table...")
		$.get("criticalTables.json", function(table) {
			for(var i = 0; i < table.length; i++) {
				critterTable[i] = table[i]
				for(var region in critterTable[i]) {
					for(var critLevel = 0; critLevel < critterTable[i][region].length; critLevel++)
						critterTable[i][region][critLevel] = parseCritLevel(critterTable[i][region][critLevel])
				}
			}
			console.log("parsed critical table with " + critterTable.length + " entries")
			//critterTable[number] = critTableJsonToJsObjectParser(table)
		}, "json")
	}

	return {generalRegionName: generalRegionName,
			regionHitChanceDecTable: regionHitChanceDecTable,
			critterTable: critterTable,
			getCritical: getCritical,
			loadTable: loadTable}
})()