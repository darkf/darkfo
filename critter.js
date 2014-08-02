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

// Collection of functions for dealing with critters

// TODO: Critter should really be a class of its own

var animInfo = {"idle": {type: "static"},
                "attack": {type: "static"},
                "weapon-reload": {type: "static"},
                "walk": {type: "move"},
                "static-idle": {type: "static"},
                "static": {type: "static"},
                "hitFront": {type: "static"},
                "death": {type: "static"},
                "run": {type: "move"}}

var weaponSkins = {"uzi": 'i', "rifle": 'j'}

var weaponAnims = {'punch': {'idle': 'aa', 'attack': 'aq'}}

var attackMode = {'none': 0, 'punch': 1, 'kick': 2, 'swing': 3,
				  'thrust': 4, 'throw': 5, 'fire single': 6,
				  'fire burst': 7, 'flame': 8,
				  0 : 'none', 1: 'punch', 2: 'kick', 3: 'swing',
				  4: 'thrust', 5: 'throw', 6: 'fire single',
				  7: 'fire burst', 8: 'flame'}
				  

var damageType = {'Normal': 0, 'Laser': 1, 'Fire': 2, 'Plasma': 3,
				  'Electrical': 4, 'EMP': 5, 'Explosive': 6,
				  0:'Normal', 1: 'Laser', 2: 'Fire', 3: 'Plasma',
				  4: 'Electrical', 5: 'EMP', 6: 'Explosive'}

var weaponSkillMap = {'uzi': 'Small Guns',
                      'rifle': 'Small Guns',
                      'spear': 'Melee Weapons'}
			
function parseAttack(weapon) {
	var attackModes = weapon.pro.extra['attackMode']
	var modeOne = attackMode[attackModes & 0xf]
	var modeTwo = attackMode[(attackModes >> 4) & 0xf]
	var attackOne = {mode: modeOne}
	var attackTwo = {mode: modeTwo}
	
	if(modeOne !== attackMode.none) {
		attackOne.APCost = weapon.pro.extra.APCost1
		attackOne.maxRange = weapon.pro.extra.maxRange1
	}

	if(modeTwo !== attackMode.none) {
		attackTwo.APCost = weapon.pro.extra.APCost2
		attackTwo.maxRange = weapon.pro.extra.maxRange2
	}

	return {first: attackOne, second: attackTwo}
}
			
var Weapon = function(weapon) {
	this.weapon = weapon

	if(weapon === 'punch') { // default punch
		// todo: use character stats...
		// todo: fully turn this into a real weapon
		this.type = 'melee'
		this.minDmg = 1
		this.maxDmg = 2
		this.name = 'punch'
		this.weaponSkillType = 'Unarmed'
		this.weapon = {}
		this.weapon.pro = {extra: {}}
		this.weapon.pro.extra.maxRange1 = 1
		this.weapon.pro.extra.maxRange2 = 1
		this.weapon.pro.extra.APCost1 = 4
		this.weapon.pro.extra.APCost2 = 4
	} else { // todo: spears, etc
		this.type = 'gun'
		this.minDmg = weapon.pro.extra.minDmg
		this.maxDmg = weapon.pro.extra.maxDmg
		var s = weapon.art.split('/')
		this.name = s[s.length-1]
		
		var attacks = parseAttack(weapon)
		this.attackOne = attacks.first
		this.attackTwo = attacks.second

		this.weaponSkillType = weaponSkillMap[this.name]
		if(this.weaponSkillType === undefined)
			console.log("unknown weapon type for " + this.name)
	}
}

Weapon.prototype.getMaximumRange = function(attackType) {
	if(attackType === 1) return this.weapon.pro.extra.maxRange1
	if(attackType === 2) return this.weapon.pro.extra.maxRange2
	else throw "invalid attack type " + attackType
}

Weapon.prototype.getAPCost = function(attackMode) {
	return this.weapon.pro.extra["APCost" + attackMode]
}

Weapon.prototype.getSkin = function() {
	if(this.weapon.pro === undefined || this.weapon.pro.extra === undefined)
		return null
	var animCodeMap = {0: 'a',// None
					   1: 'd', // Knife
					   2: 'e', // Club
					   3: 'f', // Sledgehammer
					   4: 'g', // Spear
					   5: 'h', // Pistol
					   6: 'i', // SMG
					   7: 'j', // Rifle
					   8: 'k', // Big Gun
					   9: 'l', // Minigun
					   10: 'm'} // Rocket Launcher
	return animCodeMap[this.weapon.pro.extra.animCode]
}

Weapon.prototype.getAttackSkin = function() {
	if(this.weapon.pro === undefined || this.weapon.pro.extra === undefined)
		return null
	if(this.weapon === 'punch') return 'q'

	var modeSkinMap = {
		'punch': 'q',
		'kick': 'r',
		'swing': 'g',
		'thrust': 'f',
		'throw': 'm',
		'fire single': 'j',
		'fire burst': 'k',
		'flame': 'l'
	}

	// todo: mode equipped
	if(this.attackOne.mode !== 'none') {
		return modeSkinMap[this.attackOne.mode]
	}
}

Weapon.prototype.getAnim = function(anim) {
	if(weaponAnims[this.name] && weaponAnims[this.name][anim])
		return weaponAnims[this.name][anim]

	var wep = this.getSkin() || 'a'
	switch(anim) {
		case 'idle': return wep + 'a'
		case 'walk': return wep + 'b'
		case 'attack':
			var attackSkin = this.getAttackSkin()
			return wep + attackSkin
		default: return false // let something else handle it
	}
}

Weapon.prototype.canEquip = function(obj) {
	return imageInfo[critterGetBase(obj) + this.getAnim('attack')] !== undefined
}

Weapon.prototype.getDamageType = function() {
	return this.weapon.pro.extra.dmgType
}

function critterGetBase(obj) {
	return obj.art.slice(0, -2)
}

function critterGetEquippedWeapon(obj) {
	//todo: get actual selection
	if(objectIsWeapon(obj.leftHand)) return obj.leftHand
	if(objectIsWeapon(obj.rightHand)) return obj.rightHand
	return null
}

function critterGetAnim(obj, anim) {
	var base = critterGetBase(obj)

	// try weapon animation first
	var weaponObj = critterGetEquippedWeapon(obj)
	if(weaponObj !== null && doUseWeaponModel === true) {
		var wepAnim = weaponObj.weapon.getAnim(anim)
		if(wepAnim !== false)
			return base + wepAnim
	}

	var wep = 'a'
	switch(anim) {
		case "attack": console.log("default attack animation instead of weapon animation.")
		case "idle": return base + wep + 'a'
		case "walk": return base + wep + 'b'
		case "run":  return base + wep + 't'
		case "shoot": return base + wep + 'j'
		case "weapon-reload": return base + wep + 'a'
		case "static-idle": return base + wep + 'a'
		case "static": return obj.art
		case "hitFront": return base + 'ao'
		//case "punch": return base + 'aq'
		case "death":
			if(obj.pro !== undefined && obj.pro.extra.killType === 18) { // Boss is special-cased
				console.log("Boss death...")
				return base + 'bl'
			}
			return base + 'bo' // TODO: choose death animation better
		default: throw "Unknown animation: " + anim
	}
}

function critterHasAnim(obj, anim) {
	return imageInfo[critterGetAnim(obj, anim)] !== undefined
}

function critterGetName(obj) {
	if(obj.name !== undefined)
		return obj.name
	return "<unnamed>"
}

function critterGetKillType(obj) {
	if(obj.isPlayer) return 19 // last type
	if(!obj.pro || !obj.pro.extra) return null
	return obj.pro.extra.killType
}

function getAnimDistance(art) {
	var info = imageInfo[art]
	if(info === undefined)
		throw "no image info for " + art

	var firstShift = info.frameOffsets[0][0].ox
	var lastShift = info.frameOffsets[1][info.numFrames-1].ox

	// distance = (shift x of last frame) - (shift x of first frame(?) + 16) / 32
	return Math.floor((lastShift - firstShift + 16) / 32)
}

function longestSequenceWithoutTurning(start, path, index) {
	// todo: make logic less complex
	var firstDir = directionOfDelta(start.x, start.y, path[index][0], path[index][1])
	if(index+1 >= path.length)
		return {seq: 1, lastPosition: {x: path[index][0], y: path[index][1]}, firstDirection: firstDir}

	var pos = path[index]
	var dir = firstDir
	var n = 1
	for(var i = index+1; i < path.length; i++) {
		//console.log("i " + i)
		var deltaDir = directionOfDelta(pos[0], pos[1], path[i][0], path[i][1])
		//console.log("deltaDir: " + deltaDir)
			         
		if(deltaDir !== dir) {
			//console.log("bad deltaDir: " + deltaDir)
			return {seq: n, lastPosition: {x: path[i-1][0], y: path[i-1][1]}, firstDirection: firstDir}
		}
		n++
		pos = path[i]
	}

	return {seq: n, lastPosition: {x: pos[0], y: pos[1]}, firstDirection: firstDir}
}

function critterWalkTo(obj, target, running, callback, maxLength) {
	// pathfind and set walking to target
	if(obj.position.x === target.x && obj.position.y === target.y) {
		// can't walk to the same tile
		return false
	}

	var path = recalcPath(obj.position, target)
	if(path.length === 0) {
		// no path
		//console.log("not a valid path")
		return false
	}
	if(maxLength !== undefined && path.length > maxLength) {
		console.log("truncating path (to length " + maxLength + ")")
		path = path.slice(0, maxLength + 1)
	}

	obj.path = {path: path, index: 0, target: null, seqLength: null, distance: null}
	obj.anim = (running === true) ? "run" : "walk"
	obj.art = critterGetAnim(obj, obj.anim)
	obj.animCallback = (callback !== undefined) ? callback : (function() { critterStopWalking(obj) })
	obj.frame = 0
	obj.lastFrameTime = 0
	critterAdvancePath(obj)
	return true
}

function critterStaticAnim(obj, anim, callback) {
	obj.art = critterGetAnim(obj, anim)
	obj.frame = 0
	obj.lastFrameTime = 0
	obj.anim = anim
	obj.animCallback = (callback !== undefined) ? callback : (function() { critterStopWalking(obj) })
}

function critterStopWalking(obj) {
	obj.path = null
	obj.anim = "idle"
	obj.frame = 0
	obj.art = critterGetAnim(obj, "idle")
	obj.animCallback = null
}

function critterAdvancePath(obj) {
	if(obj.path.seqLength !== undefined && obj.path.seqLength !== null)
		obj.path.index += obj.path.seqLength
	else
		obj.path.index++

	if(obj.path.index >= obj.path.path.length)
		return false
	//console.log("advancing to path index " + obj.path.index)
	var seq = longestSequenceWithoutTurning(obj.position, obj.path.path, obj.path.index)
	//console.log("longest seq: " + JSON.stringify(seq))

	obj.orientation = seq.firstDirection
	obj.path.target = seq.lastPosition
	obj.path.seqLength = seq.seq
	obj.path.distance = seq.seq
	return true
}

function critterUpdateStaticAnimation(obj) {
	var time = heart.timer.getTime()
	var fps = 8 // todo: get FPS from image info

	if(time - obj.lastFrameTime >= 1000/fps) {
		obj.frame++
		obj.lastFrameTime = time

		if(obj.frame === imageInfo[obj.art].numFrames) {
			// animation is done
			if(obj.animCallback)
				obj.animCallback()
		}
	}
}

// This checks if a critter (such as the player) entered an exit grid
// It could also check if a trap is ran into

function critterWalkCallback(obj) {
	if(obj.isPlayer !== true) return
	var objs = objectsAtPosition(obj.position)
	for(var i = 0; i < objs.length; i++) {
		if(objs[i].type === "misc" && objs[i].extra && objs[i].extra.exitMapID !== undefined) {
			// walking on an exit grid
			// todo: exit grids are likely multi-hex (maybe have a set?)
			var exitMapID = objs[i].extra.exitMapID
			var startingPosition = fromTileNum(objs[i].extra.startingPosition)
			var startingElevation = objs[i].extra.startingElevation
			critterStopWalking(obj)

			if(startingPosition.x === -1 || startingPosition.y === -1 ||
			   exitMapID < 0) { // world map
				console.log("exit grid -> worldmap")
				uiWorldMap()
			}
			else { // another map
				console.log("exit grid -> map " + exitMapID + " elevation " + startingElevation +
					" @ " + startingPosition.x + ", " + startingPosition.y)
				if(exitMapID === gMap.mapID) {
					// same map, different elevation
					critterMove(player, startingPosition)
					changeElevation(startingElevation, true)
				}
				else
					loadMapID(exitMapID, startingPosition, startingElevation)
			}

			return true
		}
	}

	return false
}

function getAnimPartialActions(art, anim) {
	var partialActions = {movement: null, actions: []}
	var numPartials = 1

	if(anim === "walk" || anim === "run") {
		numPartials = getAnimDistance(art)
		partialActions.movement = numPartials
	}

	if(numPartials === 0)
		numPartials = 1

	var delta = Math.floor(imageInfo[art].numFrames / numPartials)
	var startFrame = 0
	var endFrame = delta
	var nextActionId = 0
	for(var i = 0; i < numPartials; i++) {
		var nextNumber = (i+1) % numPartials
		partialActions.actions.push({startFrame: startFrame,
									 endFrame: endFrame,
									 step: i})
		startFrame += delta
		endFrame += delta // ?
	}

	// extend last partial action to the last frame
	partialActions.actions[partialActions.actions.length-1].endFrame = imageInfo[art].numFrames

	return partialActions
}

function critterUpdateAnimation(obj) {
	if(obj.anim === undefined || obj.anim === "idle") return
	if(animInfo[obj.anim].type === "static") return critterUpdateStaticAnimation(obj)

	var time = heart.timer.getTime()
	var fps = imageInfo[obj.art].fps
	var targetScreen = hexToScreen(obj.path.target.x, obj.path.target.y)
	var moveDistance = getAnimDistance(obj.art)
	var tilePerFrame = Math.floor(imageInfo[obj.art].numFrames / moveDistance)

	var partials = getAnimPartialActions(obj.art, obj.anim)
	if(obj.path.partial === undefined)
		obj.path.partial = 0
	//console.log("partial: " + obj.path.partial + " | distance: " + obj.path.distance +
	//	" | frame: " + obj.frame)
	var currentPartial = partials.actions[obj.path.partial]

	if(time - obj.lastFrameTime >= 1000/fps) {
		// advance frame
		obj.frame++
		obj.lastFrameTime = time

		if(obj.frame === currentPartial.endFrame) {
			var partialsLeft = obj.path.distance - obj.path.partial - 1

			if(partialsLeft > 0 && partials.actions[obj.path.partial+1] !== undefined) {
				// proceed to next partial
				obj.path.partial++
				obj.frame = partials.actions[obj.path.partial].startFrame
			} else {
				// we're done animating this, loop
				obj.path.partial = 0
				obj.frame = partials.actions[obj.path.partial].startFrame

				var distMoved = Math.min(moveDistance, obj.path.distance)
				//console.log("end partial, moved " + distMoved + " hexes, " + (obj.path.distance-distMoved) + " hexes left")
				var h = hexInDirection(obj.position, obj.orientation)
				obj.position = h
				if(critterWalkCallback(obj)) return
				for(var i = 0; i < distMoved-1; i++) {
					h = hexInDirection(h, obj.orientation)
					obj.position = h
					if(critterWalkCallback(obj)) return
				}
				critterMove(obj, h)
				obj.path.distance -= distMoved
			}
		}

		if(obj.position.x === obj.path.target.x && obj.position.y === obj.path.target.y) {
			// reached target
			if(DEBUG) console.log("target reached")
			if(critterAdvancePath(obj) === false)
				if(obj.animCallback)
					obj.animCallback()
		}
	}
}

function hitSpatialTrigger(position) {
	if(gSpatials === null) return null
	var hit = []
	for(var i = 0; i < gSpatials.length; i++) {
		var spatial = gSpatials[i]
		if(hexDistance(position, spatial.position) <= spatial.range)
			hit.push(spatial)
	}
	return hit
}

function critterMove(obj, position) {
	objectMove(obj, position)

	if(doSpatials !== false) {
		var hitSpatials = hitSpatialTrigger(position)
		for(var i = 0; i < hitSpatials.length; i++) {
			var spatial = hitSpatials[i]
			console.log("triggered spatial " + spatial.script + " (" + spatial.range + ") @ " +
				        spatial.position.x + ", " + spatial.position.y)
			scriptingEngine.spatial(spatial, obj)
		}
	}
}

function critterKill(obj, source, useScript, useAnim, callback) {
	obj.dead = true

	if(useScript === undefined || useScript === true) {
		scriptingEngine.destroy(obj, source)
	}

	if((useAnim === undefined || useAnim === true) && critterHasAnim(obj, "death")) {
		critterStaticAnim(obj, "death", function() {
			// todo: corpse-ify
			obj.frame-- // go to last frame
			obj.anim = undefined
			if(callback !== undefined) callback()
		})
	}
}

function critterDamage(obj, damage, source, useScript, useAnim, damageType, callback) {
	decreaseStat(obj, 'HP', damage, false, false, true)
	if(critterGetStat(obj, 'HP') <= 0)
		return critterKill(obj, source, useScript)

	if(useScript === undefined || useScript === true) {
		// todo
	}

	// todo: other hit animations
	if((useAnim === undefined || useAnim === true) && critterHasAnim(obj, "hitFront")) {
		critterStaticAnim(obj, "hitFront", function() {
			critterStopWalking(obj)
			if(callback !== undefined) callback()
		})
	}
}

function cloneStats(stats) { return $.extend({}, stats) }
function addStats(a, b) {
	var w = cloneStats(a)
	if(w["HP"] !== undefined)
	{
		w["Max HP"] = w["HP"]
	}
	for(var prop in b) {
		w[prop] += b[prop]
	}
	return w
}
function calcStats(obj, pro) {
	var stats = addStats(pro.extra.baseStats, pro.extra.bonusStats)
	// todo: armor, appears to be hardwired into the proto?
	return stats
}
function reprStats(stats) {
	return JSON.stringify(stats) // todo
}

// todo: bring Unity to how stats and skills are calculated

function critterGetStat(obj, stat) {

	var rawStat = critterGetRawStat(obj, stat)
	if(rawStat !== undefined) {
		var retval = clamp(statDependencies[stat].min, statDependencies[stat].max, rawStat + calculateStatValueAddition(obj, stat))
		//console.log("With derived bonuses " + stat + " is: " + retval)
		return retval
	}
	return null
}

function critterGetRawStat(obj, stat) {
	//console.log("STAT: " + stat + " IS: " + obj.stats[stat])
	if(obj.stats[stat] === undefined) {
		//console.log("NO STAT: " + stat + " - attempting to add it")
		if(statDependencies[stat] !== undefined)
			obj.stats[stat] = statDependencies[stat].defaultVal
		else
			console.log('FAILED TO ADD STAT: ' + stat)

		// special case for HP
		if(stat === "HP")
			obj.stats[stat] = critterGetStat(obj, "Max HP")
	}
	return obj.stats[stat]
}

function critterSetRawStat(obj, stat, amount) {
	obj.stats[stat] = amount
	//console.log(stat + " changed to: " + obj.stats[stat])
}

function critterGetSkill(obj, skill) {
	var rawSkill = critterGetRawSkill(obj,skill)
	var skillDep = skillDependencies[skill]
	if(skillDep !== undefined)
		rawSkill += skillDep.calculateValue(obj)
	return rawSkill
}

function critterGetRawSkill(obj, skill) {
	//console.log("SKILL: " + skill + " IS: " + obj.skills[skill])
	if(obj.skills[skill] === undefined) {
		console.log("NO SKILL: " + skill + " - adding it")
		obj.skills[skill] = 0
	}
	return obj.skills[skill]
}

function critterSetRawSkill(obj, skill, amount) {
	obj.skills[skill] = amount
	console.log(skill + " changed to: " + obj.skills[skill])
}