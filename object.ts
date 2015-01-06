/*
Copyright 2014-2015 darkf

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

// Collection of functions for working with game objects

"use strict";

function objectAddItem(obj, item, count) {
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].pidID === item.pidID) { // todo: pidID or pid?
			obj.inventory[i].amount += count
			return
		}
	}

	// add new inventory object
	var item_ = $.extend(true, {}, item) // clone the item (deep copy)
	item_.amount = count // set the amount
	obj.inventory.push(item_)
}

function objectGetMoney(obj) {
	var MONEY_PID = 41
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].pid === MONEY_PID) {
			return obj.inventory[i].amount
		}
	}

	return 0
}

function objectSingleAnim(obj: any, reversed?: boolean, callback?: any) { // TODO: any
	if(reversed) obj.frame = imageInfo[obj.art].numFrames - 1
	else obj.frame = 0
	obj.lastFrameTime = 0
	obj.anim = reversed ? "reverse" : "single"
	obj.animCallback = (callback !== undefined) ? callback : (function() { obj.anim = null  })
}

function objectInAnim(obj) {
	return !!(obj.path || obj.animCallback)
}

function canUseObject(obj: any, source?: any) {
	if(obj._script !== undefined && obj._script.use_p_proc !== undefined)
		return true
	else if(obj.type === "item" || obj.type === "scenery")
		if(objectIsDoor(obj) || objectIsStairs(obj) || objectIsLadder(obj))
			return true
		else
			return (obj.pro.extra.actionFlags & 8) != 0
	return false
}

function objectIsDoor(obj) {
	return (obj.type === "scenery" && obj.pro.extra.subType === 0) // SCENERY_DOOR
}

function objectIsStairs(obj) {
	return (obj.type === "scenery" && obj.pro.extra.subType === 1) // SCENERY_STAIRS
}

function objectIsLadder(obj) {
	return (obj.type === "scenery" &&
	       (obj.pro.extra.subType === 3 || // SCENERY_LADDER_BOTTOM
	       	obj.pro.extra.subType === 4)) // SCENERY_LADDER_TOP
}

function objectIsContainer(obj) {
	return (obj.type === "item" && obj.pro.extra.subType === 1) // SUBTYPE_CONTAINER
}

function objectIsWeapon(obj) {
	if(obj === undefined || obj === null)
		return false
	//return obj.type === "item" && obj.pro.extra.subType === 3 // weapon subtype
	return obj.weapon !== undefined
}

function objectIsExplosive(obj) {
	return (obj.pid === 85 /* Plastic Explosives */ || obj.pid === 51 /* Dynamite */)
}

function objectFindItemIndex(obj, item) {
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].pid === item.pid)
			return i
	}
	return -1
}

function cloneItem(item) { return $.extend({}, item) }

function objectSwapItem(a, item, b, amount) {
	// swap item from a -> b
	if(amount === 0) return

	var idx = objectFindItemIndex(a, item)
	if(idx === -1)
		throw "item (" + item + ") does not exist in a"
	if(amount !== undefined && amount < item.amount) {
		// just deduct amount from a and give amount to b
		item.amount -= amount
		objectAddItem(b, cloneItem(item), amount)
	}
	else { // just swap them
		a.inventory.splice(idx, 1)
		objectAddItem(b, item, amount || 1)
	}
}

function objectRemove(obj) {
	// remove `obj` from the world
	// it would be pretty hard to remove it anywhere else without either
	// a walk of the object graph or a `parent` reference.
	//
	// so we're only going to remove it from the global object list, if present.

	// TODO: use a removal queue instead of removing directory (indexing problems)

	// TODO: better object equality testing
	for(var i = 0; i < gObjects.length; i++) {
		//if(gObjects[i].pid === obj.pid && gObjects[i].amount === obj.amount) {
		if(gObjects[i] === obj) {
			console.log("objectRemove: destroying index " + i + " (" + obj.art + ") @ " +
				        gObjects[i].position.x + ", " + gObjects[i].position.y + " vs " +
				        obj.position.x + ", " + obj.position.y)
			gObjects.splice(i, 1)
			return
		}
	}

	console.log("objectRemove: couldn't find object in global list")
}

function objectDestroy(obj) {
	objectRemove(obj)
	
	// TODO: notify scripts with destroy_p_proc
}

function objectGetDamageType(obj) {
	if(obj.dmgType !== undefined)
		return obj.dmgType
	throw "no damage type for obj: " + obj
}

function objectExplode(obj, source, minDmg, maxDmg) {
	var damage = maxDmg
	var explosion: any = createObjectWithPID(makePID(5 /* misc */, 14 /* Explosion */), -1) // TODO: any
	explosion.position.x = obj.position.x
	explosion.position.y = obj.position.y
	obj.dmgType = "explosion"

	lazyLoadImage(explosion.art, function() {
		gObjects.push(explosion)

		console.log("adding explosion")
		objectSingleAnim(explosion, false, function() {
			objectDestroy(explosion)

			// damage critters in a radius
			var hexes = hexesInRadius(obj.position, 8 /* explosion radius */) // TODO: radius
			for(var i = 0; i < hexes.length; i++) {
				var objs = objectsAtPosition(hexes[i])
				for(var j = 0; j < objs.length; j++) {
					if(objs[j].type === "critter")
						console.log("todo: damage " + critterGetName(objs[j]))

					scriptingEngine.damage(objs[j], obj, obj /*source*/, damage)
				}
			}

			// remove explosive
			objectDestroy(obj)
		})
	})
}

function useExplosive(obj, source) {
	if(source.isPlayer !== true) return // ?
	var mins, secs

	while(true) {
		var time = prompt("Time to detonate?", "1:00")
		if(time === null) return // cancel
		var s = time.split(':')
		if(s.length !== 2) continue

		mins = parseInt(s[0])
		secs = parseInt(s[1])

		if(isNaN(mins) || isNaN(secs)) continue
		break
	}

	// TODO: skill rolls

	var ticks = (mins*60*10) + secs*10 // game ticks until detonation

	console.log("arming explosive for " + ticks + " ticks")

	scriptingEngine.timeEventList.push({ticks: ticks, obj: null, userdata: null, fn: function() {
		// explode!
		// TODO: explosion damage calculations
		objectExplode(obj, source, 10 /* min dmg */, 25 /* max dmg */)
	}})
}

function useObject(obj: any, source?: any, useScript?: boolean): boolean {
	if(canUseObject(obj, source) === false) {
		console.log("can't use object")
		return false
	}

	if(useScript !== false && obj._script && obj._script.use_p_proc !== undefined) {
		if(source === undefined)
			source = player
		if(scriptingEngine.use(obj, source) === true) {
			console.log("useObject: overriden")
			return true // script overrided us
		}
	}
	else if(obj.script !== undefined && !obj._script)
		console.log("object used has script but is not loaded: " + obj.script)

	if(objectIsExplosive(obj)) {
		useExplosive(obj, source)
		return true
	}

	if(objectIsDoor(obj) || objectIsContainer(obj)) {
		// open/closable doors/containers
		// todo: check lock status
		if(!obj.open) obj.open = true
		else obj.open = false
		objectSingleAnim(obj, !obj.open, function() {
			obj.anim = null
			if(objectIsContainer(obj) && obj.open === true) {
				// loot a container
				uiLoot(obj)
			}
		})
	}
	else if(objectIsStairs(obj)) {
		var destTile = fromTileNum(obj.extra.destination & 0xffff)
		var destElev = ((obj.extra.destination >> 28) & 0xf) >> 1

		if(obj.extra.destinationMap === -1 && obj.extra.destination !== -1) {
			// same map, new destination
			console.log("stairs: tile: " + destTile.x + ", " + destTile.y + ", elev: " + destElev)

			player.position = destTile
			changeElevation(destElev)
		}
		else {
			console.log("stairs -> " + obj.extra.destinationMap + " @ " + destTile.x +
				        ", " + destTile.y  + ", elev: " + destElev)
			loadMapID(obj.extra.destinationMap, destTile, destElev)
		}
	}
	else if(objectIsLadder(obj)) {
		var isTop = (obj.pro.extra.subType === 4)
		var level = isTop ? currentElevation + 1 : currentElevation - 1
		var destTile = fromTileNum(obj.extra.destination & 0xffff)
		// TODO: destination also supposedly contains elevation and map
		console.log("ladder (" + (isTop ? "top" : "bottom") + " -> level " + level + ")")
		player.position = destTile
		changeElevation(level)
	}
	else
		objectSingleAnim(obj)

	return true
}

function objectFindIndex(obj) {
	for(var i = 0; i < gObjects.length; i++)
		if(gObjects[i] === obj)
			return i
	return -1
}

function objectZCompare(a, b) {
	var aY = a.position.y
	var bY = b.position.y

	var aX = a.position.x
	var bX = b.position.x

	if(aY === bY) {
		if(aX < bX) return -1
		else if(aX > bX) return 1
		else if(aX === bX) {
			if(a.type === "wall") return -1
			else if(b.type === "wall") return 1
			else return 0
		}
	}

	if(aY < bY) return -1
	else if(aY > bY) return 1
}

function objectZOrder(obj, index) {
	var oldIdx = (index !== undefined) ? index : objectFindIndex(obj)
	if(oldIdx === -1) {
		console.log("objectZOrder: no such object...")
		return
	}

	gObjects.splice(oldIdx, 1) // remove the object...

	for(var i = 0; i < gObjects.length; i++) {
		var zc = objectZCompare(obj, gObjects[i])
		if(zc === -1) {
			gObjects.splice(i, 0, obj) // insert at new index
			break
		}
	}
}

function zsort(objects) {
	objects.sort(objectZCompare)
}

function objectMove(obj: Obj, position: any, curIdx?: number) {
	return obj.move(position, curIdx)
}

function useElevator() {
	// Player walked into an elevator
	//
	// We search for the Elevator Stub (Scenery PID 1293)
	// in the range of 11. The original engine uses a square
	// of size 11x11, but we don't do that.

	console.log("[elevator]")

	var center = player.position
	var hexes = hexesInRadius(center, 11)
	var elevatorStub = null
	for(var i = 0; i < hexes.length; i++) {
		var objs = objectsAtPosition(hexes[i])
		for(var j = 0; j < objs.length; j++) {
			var obj = objs[j]
			if(obj.type === "scenery" && obj.pidID === 1293) {
				console.log("elevator stub @ " + hexes[i].x +
					        ", " + hexes[i].y)
				elevatorStub = obj
				break
			}
		}
	}

	if(elevatorStub === null)
		throw "couldn't find elevator stub near " + center.x + ", " + center.y

	console.log("elevator type: " + elevatorStub.extra.type + ", " +
		        "level: " + elevatorStub.extra.level)

	var elevator = getElevator(elevatorStub.extra.type)
	if(!elevator)
		throw "no elevator: " + elevatorStub.extra.type
	
	uiElevator(elevator)
}

// TODO: find a better place for this

interface Point {
	x: number;
	y: number;
}

class Obj {
	pid: number; // PID (Prototype IDentifier)
	pidID: number; // ID (not type) part of the PID
	type: string = null; // TODO: enum // Type of object (critter, item, ...)
	pro: any = null; // TODO: pro ref // PRO Object
	art: string; // TODO: Path // Art path
	frmPID: number = null; // Art FID
	orientation: number = null; // Direction the object is facing
	visible: boolean = true; // Is the object visible?

	extra: any; // TODO

	script: any; // Script name
	_script: any; // TODO: Script? // Live script object

	// TOOD: unify these
	name: string; // = "<unnamed obj>"; // Only for some critters at the moment.
	subtype: string; // Some objects, like items and scenery, have subtypes
	invArt: string; // Art path used for in-inventory image

	anim: any = null; // Current animation (TODO: Is this only a string? It should probably be an enum.)
	animCallback: any = null; // Callback when current animation is finished playing
	frame: number = 0; // Animation frame index
	lastFrameTime: number = 0; // Time since last animation frame played

	amount: number = 1; // TODO: Where does this belong? Items and misc seem to have it, or is Money an Item?
	position: Point = {x: -1, y: -1};
	inventory: Obj[] = [];

	static fromPID(pid: number, sid?: number): Obj {
		return Obj.fromPID_(new Obj(), pid, sid)
	}

	static fromPID_<T extends Obj>(obj: T, pid: number, sid?: number): T {
		console.log("fromPID: %d, %d", pid, sid)
		var pidType = (pid >> 24) & 0xff
		var pidID = pid & 0xffff

		var pro: any = loadPRO(pid, pidID) // TODO: any
		obj.type = getPROTypeName(pidType)
		obj.pro = pro

		// TODO: Subclasses
		if(pidType == 0) { // item
			obj.subtype = getPROSubTypeName(pro.extra.subtype)
			obj.name = getMessage("pro_item", pro.textID)

			var invPID = pro.extra.invFRM & 0xffff
			console.log("invPID: " + invPID + ", also: " + pid)
			if(invPID !== 0xffff)
				obj.invArt = "art/inven/" + getLstId("art/inven/inven", invPID).split('.')[0]
		}

		if(obj.pro !== undefined)
			obj.art = lookupArt(makePID(obj.pro.frmType, obj.pro.frmPID))
		else
			obj.art = "art/items/RESERVED"

		obj.init()
		obj.loadScript(sid)
		return obj
	}

	static fromMapObject(mobj: any): Obj {
		return Obj.fromMapObject_(new Obj(), mobj)
	}

	static fromMapObject_<T extends Obj>(obj: T, mobj: any): T {
		// Load an Obj from a map object
		//console.log("fromMapObject: %o", mobj)
		obj.pid = mobj.pid
		obj.pidID = mobj.pidID
		obj.frmPID = mobj.frmPID
		obj.orientation = mobj.orientation
		if(obj.type == null)
			obj.type = mobj.type
		obj.art = mobj.art
		obj.position = mobj.position
		obj.subtype = mobj.subtype
		obj.amount = mobj.amount
		obj.inventory = mobj.inventory
		obj.script = mobj.script
		obj.extra = mobj.extra

		obj.pro = mobj.pro || loadPRO(obj.pid, obj.pidID)

		// etc? TODO: check this!

		obj.init()
		obj.loadScript()
		return obj
	}

	init() {
		//console.log("init: %o", this)
		if(this.inventory !== undefined) // containers and critters
			this.inventory = this.inventory.map(objFromMapObject)
	}

	loadScript(sid?:number) {
		var scriptName = null

		if(sid && sid >= 0)
			scriptName = lookupScriptName(sid)
		else if(this.script)
			scriptName = this.script
		else if(this.pro) {
			if(this.pro.extra !== undefined && this.pro.extra.scriptID >= 0)
				scriptName = lookupScriptName(this.pro.extra.scriptID)
			else if(this.pro.scriptID >= 0)
				scriptName = lookupScriptName(this.pro.scriptID)
		}

		if(scriptName != null) {
			console.log("loadScript: loading " + scriptName + " (" + sid + ")")
			var script = scriptingEngine.loadScript(scriptName)
			if(!script) {
				console.log("loadScript: load script failed for " + scriptName + " ( " + sid + ")")
			} else {
				this._script = script
				scriptingEngine.initScript(this._script, this)
				// TODO: do we enterMap/etc?
			}
		}
	}

	setAmount(amount: number): Obj {
		this.amount = amount
		return this
	}

	move(position: any, curIdx?: number): void { // TODO: Point
		this.position = position
		
		if(doZOrder !== false)
			objectZOrder(this, curIdx)
	}

	updateAnim(): void {
		var time = heart.timer.getTime()
		var fps = imageInfo[this.art].fps
		if(fps === 0) fps = 10 // ?

		if(time - this.lastFrameTime >= 1000/fps) {
			if(this.anim === "reverse") this.frame--
			else this.frame++
			this.lastFrameTime = time

			if(this.frame === -1 || this.frame === imageInfo[this.art].numFrames) {
				// animation is done
				if(this.anim === "reverse") this.frame++
				else this.frame--
				if(this.animCallback)
					this.animCallback()
			}
		}
	}

	blocks(): boolean {
		// TODO: We could make use of subclass polymorphism to reduce the cases here

		if(this.type === "misc") return false
		if(this.type === "critter")
			return ((<Critter>this).dead !== true) && (this.visible !== false)
		if(!this.pro) return true
		if(this.subtype == "door") return !(<Door>this).open
		if(this.visible === false) return false

		return !(this.pro.flags & 0x00000010 /* NoBlock */)
	}
}

class Item extends Obj {
	type = "item";

	static fromPID(pid: number, sid?: number): Item { return Obj.fromPID_(new Item(), pid, sid) }

	static fromMapObject(mobj: any): Item { return Obj.fromMapObject_(new Item(), mobj) }

	init() {
		super.init()

		// load item inventory art
		if(this.pro === null)
			return
		this.name = getMessage("pro_item", this.pro.textID)

		var invPID = this.pro.extra.invFRM & 0xffff
		if(invPID !== 0xffff)
			this.invArt = "art/inven/" + getLstId("art/inven/inven", invPID).split('.')[0]
	}
}

class WeaponObj extends Item {
	weapon: any = null;

	static fromPID(pid: number, sid?: number): WeaponObj { return Obj.fromPID_(new WeaponObj(), pid, sid) }

	static fromMapObject(mobj: any): WeaponObj { return Obj.fromMapObject_(new WeaponObj(), mobj) }

	init() {
		super.init()
		// TODO: Weapon initialization
		//console.log("Weapon init")
		this.weapon = new Weapon(this)
	}
}

class Scenery extends Obj {
	type = "scenery";

	static fromPID(pid: number, sid?: number): Scenery { return Obj.fromPID_(new Scenery(), pid, sid) }

	static fromMapObject(mobj: any): Scenery { return Obj.fromMapObject_(new Scenery(), mobj) }

	init() {
		super.init()
		//console.log("Scenery init")

		if(this.pro === null)
			return
		var subtypeMap = {0: "door", 1: "stairs", 2: "elevator", 3: "ladder",
						  4: "ladder", 5: "generic"}
		this.subtype = subtypeMap[this.pro.extra.subType]
	}
}

class Door extends Scenery {
	open: boolean;

	static fromPID(pid: number, sid?: number): Door { return Obj.fromPID_(new Door(), pid, sid) }

	static fromMapObject(mobj: any): Door { return Obj.fromMapObject_(new Door(), mobj) }

	init() {
		super.init()
		//console.log("Door init")
		this.open = false
	}
}


// Creates an object of a relevant type from a Prototype ID and an optional Script ID
function createObjectWithPID(pid: number, sid?: number) {
	var pidType = (pid >> 24) & 0xff
	if(pidType == 1) // critter
		return Critter.fromPID(pid, sid)
	else if(pidType == 0) { // item
		var pro = loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 3)
			return WeaponObj.fromPID(pid, sid)
		else
			return Item.fromPID(pid, sid)
	}
	else if(pidType == 2) { // scenery
		var pro = loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 0)
			return Door.fromPID(pid, sid)
		else
			return Scenery.fromPID(pid, sid)
	}
	else
		return Obj.fromPID(pid, sid)
}

function objFromMapObject(mobj: any) {
	var pid = mobj.pid
	var pidType = (pid >> 24) & 0xff

	if(pidType == 1) // critter
		return Critter.fromMapObject(mobj)
	else if(pidType == 0) { // item
		var pro = mobj.pro || loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 3)
			return WeaponObj.fromMapObject(mobj)
		else
			return Item.fromMapObject(mobj)
	}
	else if(pidType == 2) { // scenery
		var pro = mobj.pro || loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 0)
			return Door.fromMapObject(mobj)
		else
			return Scenery.fromMapObject(mobj)
	}
	else
		return Obj.fromMapObject(mobj)
}
