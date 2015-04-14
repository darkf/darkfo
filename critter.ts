/*
Copyright 2014 darkf, Stratege
Copyright 2015 darkf

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

"use strict";

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
                      'spear': 'Melee Weapons',
                      'knife': 'Melee Weapons',
                      'flamethr': 'Big Guns',
                     }

function parseAttack(weapon: WeaponObj) {
	var attackModes = weapon.pro.extra['attackMode']
	var modeOne = attackMode[attackModes & 0xf]
	var modeTwo = attackMode[(attackModes >> 4) & 0xf]
	var attackOne: any = {mode: modeOne}
	var attackTwo: any = {mode: modeTwo}
	
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
	this.modes = ['single', 'called']

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

	this.mode = this.modes[0]
}

Weapon.prototype.cycleMode = function() {
	this.mode = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length]
}

Weapon.prototype.isCalled = function() {
	return this.mode === "called"
}

Weapon.prototype.getProjectilePID = function() {
	if(this.type === "melee")
		return -1
	return this.weapon.pro.extra.projPID
}

// TODO: enum
Weapon.prototype.getMaximumRange = function(attackType: number): number {

	if(attackType === 1) return this.weapon.pro.extra.maxRange1
	if(attackType === 2) return this.weapon.pro.extra.maxRange2
	else throw "invalid attack type " + attackType
}

Weapon.prototype.getAPCost = function(attackMode: number): number {
	return this.weapon.pro.extra["APCost" + attackMode]
}

Weapon.prototype.getSkin = function(): string {
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

Weapon.prototype.getAttackSkin = function(): string {
	if(this.weapon.pro === undefined || this.weapon.pro.extra === undefined)
		return null
	if(this.weapon === 'punch') return 'q'

	var modeSkinMap = {
		'punch': 'q',
		'kick': 'r',
		'swing': 'g',
		'thrust': 'f',
		'throw': 's',
		'fire single': 'j',
		'fire burst': 'k',
		'flame': 'l'
	}

	// todo: mode equipped
	if(this.attackOne.mode !== 'none') {
		return modeSkinMap[this.attackOne.mode]
	}
}

Weapon.prototype.getAnim = function(anim: string): string {
	if(weaponAnims[this.name] && weaponAnims[this.name][anim])
		return weaponAnims[this.name][anim]

	var wep = this.getSkin() || 'a'
	switch(anim) {
		case 'idle': return wep + 'a'
		case 'walk': return wep + 'b'
		case 'attack':
			var attackSkin = this.getAttackSkin()
			return wep + attackSkin
		default: return null // let something else handle it
	}
}

Weapon.prototype.canEquip = function(obj: Critter): boolean {
	return imageInfo[critterGetBase(obj) + this.getAnim('attack')] !== undefined
}

Weapon.prototype.getDamageType = function(): string {
	return this.weapon.pro.extra.dmgType
}

function critterGetBase(obj: Critter): string {
	return obj.art.slice(0, -2)
}

function critterGetEquippedWeapon(obj: Critter): WeaponObj {
	//todo: get actual selection
	if(objectIsWeapon(obj.leftHand)) return obj.leftHand
	if(objectIsWeapon(obj.rightHand)) return obj.rightHand
	return null
}

function critterGetAnim(obj: Critter, anim: string): string {
	var base = critterGetBase(obj)

	// try weapon animation first
	var weaponObj = critterGetEquippedWeapon(obj)
	if(weaponObj !== null && doUseWeaponModel === true) {
		var wepAnim = weaponObj.weapon.getAnim(anim)
		if(wepAnim)
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
		case "called-shot": return base + 'na'	
		case "death":
			if(obj.pro && obj.pro.extra.killType === 18) { // Boss is special-cased
				console.log("Boss death...")
				return base + 'bl'
			}
			return base + 'bo' // TODO: choose death animation better
		default: throw "Unknown animation: " + anim
	}
}

function critterHasAnim(obj: Critter, anim: string): boolean {
	return imageInfo[critterGetAnim(obj, anim)] !== undefined
}

function critterGetName(obj: Critter): string {
	if(obj.name !== undefined)
		return obj.name
	return "<unnamed>"
}

function critterGetKillType(obj: Critter): number {
	if(obj.isPlayer) return 19 // last type
	if(!obj.pro || !obj.pro.extra) return null
	return obj.pro.extra.killType
}

function getAnimDistance(art: string): number {
	var info = imageInfo[art]
	if(info === undefined)
		throw "no image info for " + art

	var firstShift = info.frameOffsets[0][0].ox
	var lastShift = info.frameOffsets[1][info.numFrames-1].ox

	// distance = (shift x of last frame) - (shift x of first frame(?) + 16) / 32
	return Math.floor((lastShift - firstShift + 16) / 32)
}

function longestSequenceWithoutTurning(start: Point, path, index: number) {
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

function critterWalkTo(obj: Critter, target: Point, running?: boolean, callback?: () => void, maxLength?: number, path?: any): boolean {
	// pathfind and set walking to target
	if(obj.position.x === target.x && obj.position.y === target.y) {
		// can't walk to the same tile
		return false
	}

	if(path === undefined)
		path = recalcPath(obj.position, target)
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
	obj.animCallback = callback || (() => obj.clearAnim())
	obj.frame = 0
	obj.lastFrameTime = 0
	critterAdvancePath(obj)
	return true
}

function critterStaticAnim(obj: Critter, anim: string, callback: () => void, waitForLoad: boolean=true): void {
	obj.art = critterGetAnim(obj, anim)
	obj.frame = 0
	obj.lastFrameTime = 0

	if(waitForLoad) {
		lazyLoadImage(obj.art, function() {
			obj.anim = anim
			obj.animCallback = callback || (() => obj.clearAnim())		
		})
	}
	else {
		obj.anim = anim
		obj.animCallback = callback || (() => obj.clearAnim())
	}
}

function getDirectionalOffset(obj: Critter): Point {
	var info = imageInfo[obj.art]
	if(info === undefined)
		throw "No image map info for: " + obj.art
	return info.directionOffsets[obj.orientation]
}

function critterAdvancePath(obj: Critter): boolean {
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
	obj.shift = {x: 0, y: 0}

	return true
}

// This checks if a critter (such as the player) entered an exit grid
// It could also check if a trap is ran into
function critterWalkCallback(obj: Critter): boolean {
	if(obj.isPlayer !== true) return
	var objs = objectsAtPosition(obj.position)
	for(var i = 0; i < objs.length; i++) {
		if(objs[i].type === "misc" && objs[i].extra && objs[i].extra.exitMapID !== undefined) {
			// walking on an exit grid
			// todo: exit grids are likely multi-hex (maybe have a set?)
			var exitMapID = objs[i].extra.exitMapID
			var startingPosition = fromTileNum(objs[i].extra.startingPosition)
			var startingElevation = objs[i].extra.startingElevation
			obj.clearAnim()

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
					player.move(startingPosition)
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

	//console.log("partials: %o", partialActions)
	return partialActions
}

function hitSpatialTrigger(position: Point): any { // TODO: return type (SpatialTrigger)
	if(gSpatials === null) return null
	var hit = []
	for(var i = 0; i < gSpatials.length; i++) {
		var spatial = gSpatials[i]
		if(hexDistance(position, spatial.position) <= spatial.range)
			hit.push(spatial)
	}
	return hit
}

function critterKill(obj: Critter, source: Critter, useScript?: boolean, useAnim?: boolean, callback?: () => void) {
	obj.dead = true

	if(useScript === undefined || useScript === true) {
		scriptingEngine.destroy(obj, source)
	}

	if((useAnim === undefined || useAnim === true) && critterHasAnim(obj, "death")) {
		critterStaticAnim(obj, "death", function() {
			// todo: corpse-ify
			obj.frame-- // go to last frame
			obj.anim = undefined
			if(callback) callback()
		}, true)
	}
}

function critterDamage(obj: Critter, damage: number, source: Critter, useScript?: boolean, useAnim?: boolean, damageType?: string, callback?: () => void) {
	decreaseStat(obj, 'HP', damage, false, false, true)
	if(critterGetStat(obj, 'HP') <= 0)
		return critterKill(obj, source, useScript)

	if(useScript === undefined || useScript === true) {
		// todo
	}

	// todo: other hit animations
	if((useAnim === undefined || useAnim === true) && critterHasAnim(obj, "hitFront")) {
		critterStaticAnim(obj, "hitFront", function() {
			obj.clearAnim()
			if(callback !== undefined) callback()
		})
	}
}

function cloneStats(stats) { return $.extend({}, stats) }
function addStats(a, b) {
	var w = cloneStats(a)
	if(w["HP"] !== undefined)
		w["Max HP"] = w["HP"]
	for(var prop in b)
		w[prop] += b[prop]
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

function critterGetStat(obj: Critter, stat: string) {
	var rawStat = critterGetRawStat(obj, stat)
	if(rawStat !== undefined) {
		var retval = clamp(statDependencies[stat].min, statDependencies[stat].max, rawStat + calculateStatValueAddition(obj, stat))
		//console.log("With derived bonuses " + stat + " is: " + retval)
		return retval
	}
	return null
}

function critterGetRawStat(obj: Critter, stat: string) {
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

function critterSetRawStat(obj: Critter, stat: string, amount: number) {
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

function critterGetRawSkill(obj: Critter, skill: string) {
	//console.log("SKILL: " + skill + " IS: " + obj.skills[skill])
	if(obj.skills[skill] === undefined) {
		console.log("NO SKILL: " + skill + " - adding it")
		obj.skills[skill] = 0
	}
	return obj.skills[skill]
}

function critterSetRawSkill(obj: Critter, skill: string, amount: number) {
	obj.skills[skill] = amount
	console.log(skill + " changed to: " + obj.skills[skill])
}

class Critter extends Obj {
	// TODO: any
	stats: any;
	skills: any;

	leftHand: WeaponObj; // Left-hand object slot (TODO: Obj?)
	rightHand: WeaponObj; // Right-hand object slot

	type = "critter";
	anim = "idle";
	path: any = null; // Holds pathfinding objects
	AP: any = null; // TODO: AP class

	aiNum: number = -1; // AI packet number
	teamNum: number = -1; // AI team number (TODO: implement this)
	ai: AI = null; // AI packet
	hostile: boolean = false; // Currently engaging an enemy?

	isPlayer: boolean = false; // Is this critter the player character?
	dead: boolean = false; // Is this critter dead?

	static fromPID(pid: number, sid?: number): Critter {
		return Obj.fromPID_(new Critter(), pid, sid)

	}

	static fromMapObject(mobj: any): Critter {
		//console.log("MAPOBJ")
		return Obj.fromMapObject_(new Critter(), mobj);
	}

	init() {
		super.init()

		this.stats = calcStats(this, this.pro)
		this.skills = this.pro.extra.skills
		this.name = getMessage("pro_crit", this.pro.textID)

		// initialize AI packet / team number
		this.aiNum = this.pro.extra.AI
		this.teamNum = this.pro.extra.team

		// initialize weapons
		this.inventory.forEach(inv => {
			if(inv.subtype === "weapon") {
				var w = <WeaponObj>inv
				if(this.leftHand === undefined) {
					if(w.weapon.canEquip(this))
						this.leftHand = w
				}
				else if(this.rightHand === undefined) {
					if(w.weapon.canEquip(this))
						this.rightHand = w
				}
				//console.log("left: " + this.leftHand + " | right: " + this.rightHand)
			}
		})

		// default to punches
		if(!this.leftHand)
			this.leftHand = <WeaponObj>{type: "item", subtype: "weapon", weapon: new Weapon("punch")}
		if(!this.rightHand)
			this.rightHand = <WeaponObj>{type: "item", subtype: "weapon", weapon: new Weapon("punch")}

		// set them in their proper idle state for the weapon
		this.art = critterGetAnim(this, "idle")
	}

	updateStaticAnim(): void {
		var time = heart.timer.getTime()
		var fps = 8 // todo: get FPS from image info

		if(time - this.lastFrameTime >= 1000/fps) {
			this.frame++
			this.lastFrameTime = time

			if(this.frame === imageInfo[this.art].numFrames) {
				// animation is done
				if(this.animCallback)
					this.animCallback()
			}
		}
	}

	updateAnim(): void {
		if(!this.anim || this.anim === "idle") return
		if(animInfo[this.anim].type === "static") return this.updateStaticAnim()

		var time = heart.timer.getTime()
		var fps = imageInfo[this.art].fps
		var targetScreen = hexToScreen(this.path.target.x, this.path.target.y)
		var moveDistance = getAnimDistance(this.art)

		var partials = getAnimPartialActions(this.art, this.anim)
		if(this.path.partial === undefined)
			this.path.partial = 0
		var currentPartial = partials.actions[this.path.partial]

		if(time - this.lastFrameTime >= 1000/fps) {
			// advance frame
			this.lastFrameTime = time

			if(this.frame === currentPartial.endFrame || this.frame+1 >= imageInfo[this.art].numFrames) {
				// completed an action frame (partial action)

				// Do we have another partial action?
				if(partials.actions[this.path.partial+1] !== undefined) {
					// proceed to next partial
					this.path.partial++
				} else {
					// we're done animating this, loop
					this.path.partial = 0
					this.frame = 0
				}
				
				this.frame = partials.actions[this.path.partial].startFrame

				// reset shift
				this.shift = {x: 0, y: 0}

				if(this.path.foo === undefined)
					this.path.foo = 0
				var pos = this.path.path[this.path.index + this.path.foo]
				this.path.foo++
				//var pos = this.path.path[this.path.foo++]
				var h = {x: pos[0], y: pos[1]}
				//console.log("h: %o", h)
				if(critterWalkCallback(this)) return
				this.move(h)
			}
			else {
				this.frame++
				var info = imageInfo[this.art]
				if(info === undefined)
					throw "No image map info for: " + this.art;
				var frameInfo = info.frameOffsets[this.orientation][this.frame]
				//console.log("frameInfo: %o", frameInfo)
				this.shift.x += frameInfo.x
				this.shift.y += frameInfo.y
				//console.log("sx: %o, sy: %o", this.shift.x, this.shift.y);
			}

			if(this.position.x === this.path.target.x && this.position.y === this.path.target.y) {
				// reached target
				this.path.foo = 0
				this.path.partial = 0
				this.frame = 0
				if(DEBUG) console.log("target reached")
				if(critterAdvancePath(this) === false)
					if(this.animCallback)
						this.animCallback()
			}
		}
	}

	inAnim(): boolean {
		return !!(this.path || this.animCallback)
	}

	move(position: Point, curIdx?: number): void {
		super.move(position, curIdx)

		if(doSpatials !== false) {
			var hitSpatials = hitSpatialTrigger(position)
			for(var i = 0; i < hitSpatials.length; i++) {
				var spatial = hitSpatials[i]
				console.log("triggered spatial " + spatial.script + " (" + spatial.range + ") @ " +
					        spatial.position.x + ", " + spatial.position.y)
				scriptingEngine.spatial(spatial, this)
			}
		}
	}

	clearAnim(): void {
		super.clearAnim()
		this.path = null

		// reset to idle pose
		this.anim = "idle"
		this.art = critterGetAnim(this, "idle")
	}
}