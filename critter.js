// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

// TODO: Critter should really be a class of its own

var animInfo = {"idle": {type: "static"},
                "attack": {type: "static"},
                "weapon-reload": {type: "static"},
                "walk": {type: "move"},
                "static-idle": {type: "static"},
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
				  
var damageType = {'normal': 0, 'laser': 1, 'fire': 2, 'plasma': 3,
				  'electrical': 4, 'emp': 5, 'explosive': 6,
				  0:'normal', 1: 'laser', 2: 'fire', 3: 'plasma',
				  4: 'electrical', 5: 'emp', 6: 'explosive'}
			
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
		this.type = 'melee'
		this.minDmg = 1
		this.maxDmg = 2
		this.name = 'punch'
		this.weaponType = 'Unarmed'
	} else { // todo: spears, etc
		this.type = 'gun'
		this.minDmg = weapon.pro.extra.minDmg
		this.maxDmg = weapon.pro.extra.maxDmg
		var s = weapon.art.split('/')
		this.name = s[s.length-1]
		
		var attacks = parseAttack(weapon)
		this.attackOne = attacks.first
		this.attackTwo = attacks.second

		this.weaponType = {'uzi': 'Small Guns'}[this.name]
		if(this.weaponType === undefined)
			console.log("unknown weapon type for " + this.name)
	}
}

Weapon.prototype.getMaximumRange = function(attackType) {
	if(this.name === "punch")
		return 1

	if(attackType === 1) return this.weapon.pro.extra.maxRange1
	if(attackType === 2) return this.weapon.pro.extra.maxRange2
	else throw "invalid attack type " + attackType
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

function critterGetBase(obj) {
	return obj.art.slice(0, -2)
}

function critterGetEquippedWeapon(obj) {
	return obj.leftHand || obj.rightHand || null
}

function critterGetAnim(obj, anim) {
	var base = critterGetBase(obj)

	// try weapon animation first
	var hand = obj.leftHand || obj.rightHand || null
	if(hand && doUseWeaponModel) {
		var wepAnim = hand.getAnim(anim)
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
		//case "punch": return base + 'aq'
		case "death": return base + 'bo'
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

function critterWalkTo(obj, target, running, callback, maxLength) {
	// pathfind and set walking to target
	var path = recalcPath(obj.position, target)
	if(path.length === 0) {
		console.log("not a valid path")
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

			if(startingPosition === -1) { // world map
				console.log("exit grid -> worldmap")
			}
			else { // another map
				console.log("exit grid -> map " + exitMapID + " elevation " + startingElevation +
					" @ " + startingPosition.x + ", " + startingPosition.y)
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
				if(critterWalkCallback(obj)) return
				for(var i = 0; i < distMoved-1; i++) {
					h = hexInDirection(h, obj.orientation)
					if(critterWalkCallback(obj)) return
				}
				obj.position = h
				obj.path.distance -= distMoved
			}
		}

		if(obj.position.x === obj.path.target.x && obj.position.y === obj.path.target.y) {
			// reached target
			console.log("target reached")
			if(critterAdvancePath(obj) === false)
				if(obj.animCallback)
					obj.animCallback()
		}
	}
}

function critterGetStat(obj, stat) {
	console.log("STAT: " + stat + " IS: " + obj.stats[stat])
	if(obj.stats[stat] !== undefined)
		return obj.stats[stat]
	if(stat === "MaxHP") // TODO: this
		return 75
	console.log("NO STAT: " + stat)
	return null
}