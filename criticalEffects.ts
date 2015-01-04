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

// Critical Effects system

module CriticalEffects {
	var generalRegionName = {0: "head", 1: "leftArm",2: "rightArm",3: "torso",4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
	//todo: make this table account for different weapon types. It appears melee weapons use a second one
	//though it appears to only be a /2 for melee
	export var regionHitChanceDecTable = {"torso": 0, "leftLeg": 20, "rightLeg": 20, "groin": 30, "leftArm": 30, "rightArm": 30, "head": 40, "eyes": 60}
	var critterTable = []

	var critFailEffects = {
		damageSelf: function(target) {
			console.log(critterGetName(target) + " has damaged themselves. This does not do anything yet")
		},

		crippleRandomAppendage: function(target) {
			console.log(critterGetName(target) + " has crippled a random appendage. This does not do anything yet")
		},

		hitRandomly: function(target) {
			console.log(critterGetName(target) + " has hit randomly. This does not do anything yet")
		},

		hitSelf: function(target) {
			console.log(critterGetName(target) + " has hit themselves. This does not do anything yet")
		},

		loseAmmo: function(target) {
			console.log(critterGetName(target) + " has lost their ammo. This does not do anything yet")
		},

		destroyWeapon: function(target) {
			console.log(critterGetName(target) + " has had their weapon blow up in their face. Ouch. This does not do anything yet")
		},
	}

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

	class StatCheck {
		stat: any; modifier: any; effects: any; failEffectMessageID: any; // TODO

		constructor(stat, modifier, effects, failEffectMessage) {
			this.stat = stat
			this.modifier = modifier
			this.effects = effects
			this.failEffectMessageID = failEffectMessage
		}

		doEffectsOn(target: any): any
		{
			if(this.stat === -1)
				return false

			var statToRollAgainst = critterGetStat(target,this.stat)
			statToRollAgainst += this.modifier

			if(!rollSkillCheck(statToRollAgainst*10,0,false)) {
				this.effects.doEffectsOn(target)
				return {success: true, msgID: this.failEffectMessageID}
			}

			return {success: false}
		}
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

	export function getCritical(critterType, region, critLevel) {
		var actualLevel = Math.min(critLevel, critterTable[critterType][region].length-1)
		return critterTable[critterType][region][actualLevel]
	}

	export function loadTable() {
		// read in the global table
		//console.log("loading critical table...")
		var table = getFileJSON("criticalTables.json")
		for(var i = 0; i < table.length; i++) {
			critterTable[i] = table[i]
			for(var region in critterTable[i]) {
				for(var critLevel = 0; critLevel < critterTable[i][region].length; critLevel++)
					critterTable[i][region][critLevel] = parseCritLevel(critterTable[i][region][critLevel])
			}
		}
		//console.log("parsed critical table with " + critterTable.length + " entries")
		//critterTable[number] = critTableJsonToJsObjectParser(table)
	}

	export var criticalFailTable = {
		unarmed: {
			1: [],
			2: [critterEffects.loseNextTurn],
			3: [critterEffects.loseNextTurn],
			4: [critFailEffects.damageSelf, critterEffects.knockdown],
			5: [critFailEffects.crippleRandomAppendage]
		},
		melee: {
			1: [],
			2: [critterEffects.loseNextTurn],
			3: [critterEffects.droppedWeapon],
			4: [critFailEffects.hitRandomly],
			5: [critFailEffects.hitSelf]
		},
		firearms: {
			1: [],
			2: [critFailEffects.loseAmmo],
			3: [critterEffects.droppedWeapon],
			4: [critFailEffects.hitRandomly],
			5: [critFailEffects.destroyWeapon]
		},
		energy: {
			1: [critterEffects.loseNextTurn],
			2: [critFailEffects.loseAmmo, critterEffects.loseNextTurn],
			3: [critterEffects.droppedWeapon, critterEffects.loseNextTurn],
			4: [critFailEffects.hitRandomly],
			5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn]
		},
		grenades: {
			1: [],
			2: [critterEffects.droppedWeapon],
			3: [critFailEffects.damageSelf, critterEffects.droppedWeapon],
			4: [critFailEffects.hitRandomly],
			5: [critFailEffects.destroyWeapon]
		},
		rocketlauncher: {
			1: [critterEffects.loseNextTurn],
			2: [], //yes that appears backwards but seems to be the case in FO
			3: [critFailEffects.destroyWeapon],
			4: [critFailEffects.hitRandomly],
			5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn, critterEffects.knockdown]
		},
		flamers: {
			1: [],
			2: [critterEffects.loseNextTurn],
			3: [critFailEffects.hitRandomly],
			4: [critFailEffects.destroyWeapon],
			5: [critFailEffects.destroyWeapon, critterEffects.loseNextTurn, critterEffects.onFire]
		}
	}

	export function temporaryDoCritFail(critFail, target) {
		for (var i = 0; i < critFail.length; i++) {
			critFail[i](target)
		}
	}

/*	return {generalRegionName: generalRegionName,
			regionHitChanceDecTable: regionHitChanceDecTable,
			critterTable: critterTable,
			getCritical: getCritical,
			loadTable: loadTable,
			criticalFailTable: criticalFailTable,
			temporaryDoCritFail: temporaryDoCritFail}
*/
}