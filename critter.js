// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

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
				  
var DamageType = {'normal': 0, 'laser': 1, 'fire': 2, 'plasma': 3,
				  'electrical': 4, 'emp': 5, 'explosive': 6,
				  0:'normal', 1: 'laser', 2: 'fire', 3: 'plasma',
				  4: 'electrical', 5: 'emp', 6: 'explosive'}

var modeNumber = {1: 0x00FF, 2: 0xFF00}


			
function ParseAttack(weapon)
{
	var attackModes = weapon.extra['attackMode']
	var modeOne = attackModes & modeNumber[1]
	var modeTwo = (attackModes & modeNumber[2]) >> 8
	
	var att1 = {}
	att1['mode'] = modeOne
	if(modeOne !== attackMode['none'])
	{
		att1['APCost'] = weapon.extra['APCost1']
		att1['maxRange'] = weapon.extra['maxRange1']
	}
	var att2 = {}
	att2['mode'] = modeTwo
	if(modeOne !== attackMode['none'])
	{
		att2['APCost'] = weapon.extra['APCost2']
		att2['maxRange'] = weapon.extra['maxRange2']
	}
	return {1:att1,2:att2}
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
		
		var tempAttacks = ParseAttack(weapon)
		this.attackOne = tempAttacks[1]
		this.attackTwo = tempAttacks[2]

		this.weaponType = {'uzi': 'Small Guns'}[this.name]
		if(this.weaponType === undefined)
			console.log("unknown weapon type for " + this.name)
	}
}

Weapon.prototype.getAnim = function(anim) {
	if(weaponAnims[this.name] && weaponAnims[this.name][anim])
		return weaponAnims[this.name][anim]

	var wep = weaponSkins[this.name] || 'a'
	switch(anim) {
		case 'idle': return wep + 'a'
		case 'walk': return wep + 'b'
		case 'attack': return wep + 'j' // assumes guns
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
	return obj.leftHand || obj.rightHand
}

function critterGetAnim(obj, anim) {
	var base = critterGetBase(obj)

	// try weapon animation first
	var hand = obj.leftHand || obj.rightHand || null
	if(hand) {
		var wepAnim = hand.getAnim(anim)
		if(wepAnim !== false)
			return base + wepAnim
	}

	var wep = 'a'
	switch(anim) {
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
		path = path.slice(0, maxLength)
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
			// todo: some sort of callback or action when completed?
			if(obj.animCallback)
				obj.animCallback()
		}
	}
}

function critterUpdateAnimation(obj) {
	if(obj.anim === undefined || obj.anim === "idle") return
	if(animInfo[obj.anim].type === "static") return critterUpdateStaticAnimation(obj)

	var time = heart.timer.getTime()
	var fps = 10 // todo: get FPS from image info
	var targetScreen = hexToScreen(obj.path.target.x, obj.path.target.y)
	var moveDistance = getAnimDistance(obj.art)
	var tilePerFrame = Math.floor(imageInfo[obj.art].numFrames / moveDistance)

	if(time - obj.lastFrameTime >= 1000/fps) {
		// advance frame
		obj.frame++
		obj.lastFrameTime = time

		if(obj.frame === tilePerFrame && obj.path.distance === 1) { // half walk, one tile
			obj.frame = 0
			var h = hexInDirection(obj.position, obj.orientation)
			obj.position = h
			obj.path.distance -= 1
		}
		else if(obj.frame === tilePerFrame /* *2 */) { // full walk, 2+ tiles
			obj.frame = 0
			var h = hexInDirection(obj.position, obj.orientation)
			var h2 = hexInDirection(h, obj.orientation)
			obj.position = h2
			obj.path.distance -= 2
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