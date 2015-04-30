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

interface AttackInfo {
	mode: number;
	APCost: number;
	maxRange: number;
}

function parseAttack(weapon: WeaponObj): {first: AttackInfo; second: AttackInfo} {
	var attackModes = weapon.pro.extra['attackMode']
	var modeOne: number = attackMode[attackModes & 0xf]
	var modeTwo: number = attackMode[(attackModes >> 4) & 0xf]
	var attackOne: AttackInfo = {mode: modeOne, APCost: 0, maxRange: 0}
	var attackTwo: AttackInfo = {mode: modeTwo, APCost: 0, maxRange: 0}
	
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

// TODO: improve handling of melee
class Weapon {
	weapon: any; // TODO: any (because of melee)
	name: string;
	modes: string[];
	mode: string; // current mode
	type: string;
	minDmg: number;
	maxDmg: number;
	weaponSkillType: string;

	attackOne: {mode: number; APCost: number; maxRange: number};
	attackTwo: {mode: number; APCost: number; maxRange: number};

	constructor(weapon: WeaponObj) {
		this.weapon = weapon
		this.modes = ['single', 'called']

		if(weapon === null) { // default punch
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

	cycleMode(): void {
		this.mode = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length]
	}

	isCalled(): boolean {
		return this.mode === "called"
	}

	getProjectilePID(): number {
		if(this.type === "melee")
			return -1
		return this.weapon.pro.extra.projPID
	}

	// TODO: enum
	getMaximumRange(attackType: number): number {

		if(attackType === 1) return this.weapon.pro.extra.maxRange1
		if(attackType === 2) return this.weapon.pro.extra.maxRange2
		else throw "invalid attack type " + attackType
	}

	getAPCost(attackMode: number): number {
		return this.weapon.pro.extra["APCost" + attackMode]
	}

	getSkin(): string {
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

	getAttackSkin(): string {
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
		if(this.attackOne.mode !== attackMode.none) {
			return modeSkinMap[this.attackOne.mode]
		}
	}

	getAnim(anim: string): string {
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

	canEquip(obj: Critter): boolean {
		return imageInfo[critterGetBase(obj) + this.getAnim('attack')] !== undefined
	}

	getDamageType(): string {
		return this.weapon.pro.extra.dmgType
	}

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
	if(weaponObj !== null && Config.engine.doUseWeaponModel === true) {
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
	return gMap.getSpatials().filter(spatial => hexDistance(position, spatial.position) <= spatial.range)
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
	AP: ActionPoints = null;

	aiNum: number = -1; // AI packet number
	teamNum: number = -1; // AI team number (TODO: implement this)
	ai: AI = null; // AI packet
	hostile: boolean = false; // Currently engaging an enemy?

	isPlayer: boolean = false; // Is this critter the player character?
	dead: boolean = false; // Is this critter dead?

	static fromPID(pid: number, sid?: number): Critter {
		return Obj.fromPID_(new Critter(), pid, sid)
	}

	static fromMapObject(mobj: any, deserializing: boolean=false): Critter {
		return Obj.fromMapObject_(new Critter(), mobj, deserializing)
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
			this.leftHand = <WeaponObj>{type: "item", subtype: "weapon", weapon: new Weapon(null)}
		if(!this.rightHand)
			this.rightHand = <WeaponObj>{type: "item", subtype: "weapon", weapon: new Weapon(null)}

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
		var currentPartial = partials.actions[this.path.partial]

		if(time - this.lastFrameTime >= 1000/fps) {
			// advance frame
			this.lastFrameTime = time

			if(this.frame === currentPartial.endFrame || this.frame+1 >= imageInfo[this.art].numFrames) {
				// completed an action frame (partial action)

				// do we have another partial action?
				if(this.path.partial+1 < partials.actions.length) {
					// then proceed to next partial action
					this.path.partial++
				} else {
					// otherwise we're done animating this, loop
					this.path.partial = 0
				}
				
				// move to the start of the next partial action
				this.frame = partials.actions[this.path.partial].startFrame

				// reset shift
				this.shift = {x: 0, y: 0}

				// move to new path hex
				var pos = this.path.path[this.path.index++]
				var hex = {x: pos[0], y: pos[1]}

				if(!this.move(hex))
					return

				// set orientation towards new path hex
				pos = this.path.path[this.path.index]
				if(pos)
					this.orientation = directionOfDelta(this.position.x, this.position.y, pos[0], pos[1])
			}
			else {
				// advance frame
				this.frame++

				var info = imageInfo[this.art]
				if(info === undefined)
					throw "No image map info for: " + this.art

				// add the new frame's offset to our shift
				var frameInfo = info.frameOffsets[this.orientation][this.frame]
				this.shift.x += frameInfo.x
				this.shift.y += frameInfo.y
			}

			if(this.position.x === this.path.target.x && this.position.y === this.path.target.y) {
				// reached target position
				// TODO: better logging system
				//console.log("target reached")

				var callback = this.animCallback				
				this.clearAnim()

				if(callback)
					callback()
			}
		}
	}

	inAnim(): boolean {
		return !!(this.path || this.animCallback)
	}

	move(position: Point, curIdx?: number): boolean {
		if(!super.move(position, curIdx))
			return false

		if(Config.engine.doSpatials !== false) {
			var hitSpatials = hitSpatialTrigger(position)
			for(var i = 0; i < hitSpatials.length; i++) {
				var spatial = hitSpatials[i]
				console.log("triggered spatial " + spatial.script + " (" + spatial.range + ") @ " +
					        spatial.position.x + ", " + spatial.position.y)
				scriptingEngine.spatial(spatial, this)
			}
		}

		return true
	}

	canRun(): boolean {
		return critterHasAnim(this, "run")
	}

	clearAnim(): void {
		super.clearAnim()
		this.path = null

		// reset to idle pose
		this.anim = "idle"
		this.art = critterGetAnim(this, "idle")
	}

	walkTo(target: Point, running?: boolean, callback?: () => void, maxLength?: number, path?: any): boolean {
		// pathfind and set walking to target
		if(this.position.x === target.x && this.position.y === target.y) {
			// can't walk to the same tile
			return false
		}

		if(path === undefined)
			path = recalcPath(this.position, target)

		if(path.length === 0) {
			// no path
			//console.log("not a valid path")
			return false
		}

		if(maxLength !== undefined && path.length > maxLength) {
			console.log("truncating path (to length " + maxLength + ")")
			path = path.slice(0, maxLength + 1)
		}

		// some critters can't run
		if(running && !this.canRun())
			running = false

		// set up animation properties
		var actualTarget = {x: path[path.length-1][0], y: path[path.length-1][1]}
		this.path = {path: path, index: 1, target: actualTarget, partial: 0}
		this.anim = running ? "run" : "walk"
		this.art = critterGetAnim(this, this.anim)
		this.animCallback = callback || (() => this.clearAnim())
		this.frame = 0
		this.lastFrameTime = 0
		this.shift = {x: 0, y: 0}
		this.orientation = directionOfDelta(this.position.x, this.position.y, path[1][0], path[1][1])
		//console.log("start dir: %o", this.orientation)

		return true
	}

	walkInFrontOf(targetPos: Point, callback?: () => void): boolean {
		var path = recalcPath(this.position, targetPos, false)
		if(path.length === 0) // invalid path
			return false
		else if(path.length <= 2) { // we're already infront of or on it
			if(callback)
				callback()
			return true
		}
		path.pop() // we don't want targetPos in the path

		var target = path[path.length - 1]
		targetPos = {x: target[0], y: target[1]}

		var running = Config.engine.doAlwaysRun
		if(hexDistance(this.position, targetPos) > 5)
			running = true

		//console.log("path: %o, callback %o", path, callback)
		return this.walkTo(targetPos, running, callback, undefined, path)
	}
}