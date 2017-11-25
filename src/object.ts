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

function objectGetMoney(obj: Obj): number {
	var MONEY_PID = 41
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].pid === MONEY_PID) {
			return obj.inventory[i].amount
		}
	}

	return 0
}

function objectSingleAnim(obj: Obj, reversed?: boolean, callback?: () => void): void {
	if(reversed) obj.frame = imageInfo[obj.art].numFrames - 1
	else obj.frame = 0
	obj.lastFrameTime = 0
	obj.anim = reversed ? "reverse" : "single"
	obj.animCallback = callback || (() => obj.anim = null)
}

function canUseObject(obj: Obj, source?: Obj): boolean {
	if(obj._script !== undefined && obj._script.use_p_proc !== undefined)
		return true
	else if(obj.type === "item" || obj.type === "scenery")
		if(objectIsDoor(obj) || objectIsStairs(obj) || objectIsLadder(obj))
			return true
		else
			return (obj.pro.extra.actionFlags & 8) != 0
	return false
}

function objectIsDoor(obj: Obj): boolean {
	return (obj.type === "scenery" && obj.pro.extra.subType === 0) // SCENERY_DOOR
}

function objectIsStairs(obj: Obj): boolean {
	return (obj.type === "scenery" && obj.pro.extra.subType === 1) // SCENERY_STAIRS
}

function objectIsLadder(obj: Obj): boolean {
	return (obj.type === "scenery" &&
	       (obj.pro.extra.subType === 3 || // SCENERY_LADDER_BOTTOM
	       	obj.pro.extra.subType === 4)) // SCENERY_LADDER_TOP
}

function objectIsContainer(obj: Obj): boolean {
	return (obj.type === "item" && obj.pro.extra.subType === 1) // SUBTYPE_CONTAINER
}

function objectIsWeapon(obj: any): boolean {
	if(obj === undefined || obj === null)
		return false
	//return obj.type === "item" && obj.pro.extra.subType === 3 // weapon subtype
	return obj.weapon !== undefined
}

function objectIsExplosive(obj: Obj): boolean {
	return (obj.pid === 85 /* Plastic Explosives */ || obj.pid === 51 /* Dynamite */)
}

function objectFindItemIndex(obj: Obj, item: Obj): number {
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].pid === item.pid)
			return i
	}
	return -1
}

function cloneItem(item: Obj): Obj { return $.extend({}, item) }

function objectSwapItem(a: Obj, item: Obj, b: Obj, amount: number) {
	// swap item from a -> b
	if(amount === 0) return

	var idx = objectFindItemIndex(a, item)
	if(idx === -1)
		throw "item (" + item + ") does not exist in a"
	if(amount !== undefined && amount < item.amount) {
		// just deduct amount from a and give amount to b
		item.amount -= amount
		b.addInventoryItem(cloneItem(item), amount)
	}
	else { // just swap them
		a.inventory.splice(idx, 1)
		b.addInventoryItem(item, amount || 1)
	}
}

function objectGetDamageType(obj: any): string { // TODO: any (where does dmgType go? WeaponObj?)
	if(obj.dmgType !== undefined)
		return obj.dmgType
	throw "no damage type for obj: " + obj
}

function objectExplode(obj: Obj, source: Obj, minDmg: number, maxDmg: number): void {
	var damage = maxDmg
	var explosion = createObjectWithPID(makePID(5 /* misc */, 14 /* Explosion */), -1)
	explosion.position.x = obj.position.x
	explosion.position.y = obj.position.y;
	(<any>obj).dmgType = "explosion" // TODO: any (WeaponObj?)

	lazyLoadImage(explosion.art, function() {
		gMap.addObject(explosion)

		console.log("adding explosion")
		objectSingleAnim(explosion, false, function() {
			gMap.destroyObject(explosion)

			// damage critters in a radius
			var hexes = hexesInRadius(obj.position, 8 /* explosion radius */) // TODO: radius
			for(var i = 0; i < hexes.length; i++) {
				var objs = objectsAtPosition(hexes[i])
				for(var j = 0; j < objs.length; j++) {
					if(objs[j].type === "critter")
						console.log("todo: damage", (<Critter>objs[j]).name)

					scriptingEngine.damage(objs[j], obj, obj /*source*/, damage)
				}
			}

			// remove explosive
			gMap.destroyObject(obj)
		})
	})
}

function useExplosive(obj: Obj, source: Critter): void {
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

// Returns whether or not the object was used
function useObject(obj: Obj, source?: Critter, useScript?: boolean): boolean {
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
		// TODO: Door/Container subclasses
		if(obj.locked) {
			uiLog("That object is locked")
			return false
		}

		obj.open = !obj.open

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
			gMap.changeElevation(destElev)
		}
		else {
			console.log("stairs -> " + obj.extra.destinationMap + " @ " + destTile.x +
				        ", " + destTile.y  + ", elev: " + destElev)
			gMap.loadMapByID(obj.extra.destinationMap, destTile, destElev)
		}
	}
	else if(objectIsLadder(obj)) {
		var isTop = (obj.pro.extra.subType === 4)
		var level = isTop ? currentElevation + 1 : currentElevation - 1
		var destTile = fromTileNum(obj.extra.destination & 0xffff)
		// TODO: destination also supposedly contains elevation and map
		console.log("ladder (" + (isTop ? "top" : "bottom") + " -> level " + level + ")")
		player.position = destTile
		gMap.changeElevation(level)
	}
	else
		objectSingleAnim(obj)

	gMap.updateMap()
	return true
}

function objectFindIndex(obj: Obj): number {
	return _.findIndex(gMap.getObjects(), object => object === obj)
}

function objectZCompare(a: Obj, b: Obj): number {
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
	else if(aY < bY) return -1
	else if(aY > bY) return 1

	throw "unreachable"
}

function objectZOrder(obj: Obj, index: number): void {
	var oldIdx = (index !== undefined) ? index : objectFindIndex(obj)
	if(oldIdx === -1) {
		console.log("objectZOrder: no such object...")
		return
	}

	// TOOD: mutable/potentially unsafe usage of getObjects
	var objects = gMap.getObjects()

	objects.splice(oldIdx, 1) // remove the object...

	var inserted = false
	for(var i = 0; i < objects.length; i++) {
		var zc = objectZCompare(obj, objects[i])
		if(zc === -1) {
			objects.splice(i, 0, obj) // insert at new index
			inserted = true
			break
		}
	}

	if(!inserted) // couldn't find a spot, just add it in
		objects.push(obj)
}

function zsort(objects: Obj[]): void {
	objects.sort(objectZCompare)
}

function useElevator(): void {
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

interface SerializedObj {
	pid: number;
	pidID: number;
	type: string;
	pro: any;
	flags: number;
	art: string;
	frmPID: number;
	orientation: number;
	visible: boolean;

	extra: any;

	script: any;
	_script: any;

	name: string;
	subtype: string;
	invArt: string;

	frame: number;

	amount: number;
	position: Point;
	inventory: SerializedObj[];

	lightRadius: number;
	lightIntensity: number;
}

class Obj {
	pid: number; // PID (Prototype IDentifier)
	pidID: number; // ID (not type) part of the PID
	type: string = null; // TODO: enum // Type of object (critter, item, ...)
	pro: any = null; // TODO: pro ref // PRO Object
	flags: number = 0; // Flags from PRO; may be overriden by map objects
	art: string; // TODO: Path // Art path
	frmPID: number = null; // Art FID
	orientation: number = null; // Direction the object is facing
	visible: boolean = true; // Is the object visible?
	open: boolean = false; // Is the object open? (Mainly for doors)
	locked: boolean = false; // Is the object locked? (Mainly for doors)

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

	// Frame shift/offset
	// For static animations, this is just null (effectively just the frame offset as declared in the .FRM),
	// but for walk/run animations it is the sum of frame offsets between the last action frame
	// and the current frame.
	shift: Point = null;

	amount: number = 1; // TODO: Where does this belong? Items and misc seem to have it, or is Money an Item?
	position: Point = {x: -1, y: -1};
	inventory: Obj[] = [];

	// TODO: verify
	lightRadius: number = 0;
	lightIntensity: number = 655;

	static fromPID(pid: number, sid?: number): Obj {
		return Obj.fromPID_(new Obj(), pid, sid)
	}

	static fromPID_<T extends Obj>(obj: T, pid: number, sid?: number): T {
		console.log("fromPID: %d, %d", pid, sid)
		var pidType = (pid >> 24) & 0xff
		var pidID = pid & 0xffff

		var pro: any = loadPRO(pid, pidID) // TODO: any
		obj.type = getPROTypeName(pidType)
		obj.pid = pid
		obj.pro = pro
		obj.flags = obj.pro.flags

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

	static fromMapObject(mobj: any, deserializing: boolean=false): Obj {
		return Obj.fromMapObject_(new Obj(), mobj, deserializing)
	}

	static fromMapObject_<T extends Obj>(obj: T, mobj: any, deserializing: boolean=false): T {
		// Load an Obj from a map object
		//console.log("fromMapObject: %o", mobj)
		obj.pid = mobj.pid
		obj.pidID = mobj.pidID
		obj.frmPID = mobj.frmPID
		obj.orientation = mobj.orientation
		if(obj.type === null)
			obj.type = mobj.type
		obj.art = mobj.art
		obj.position = mobj.position
		obj.lightRadius = mobj.lightRadius
		obj.lightIntensity = mobj.lightIntensity
		obj.subtype = mobj.subtype
		obj.amount = mobj.amount
		obj.inventory = mobj.inventory
		obj.script = mobj.script
		obj.extra = mobj.extra

		obj.pro = mobj.pro || loadPRO(obj.pid, obj.pidID)
		obj.flags = mobj.flags // NOTE: Tested with two objects in Mapper, map object flags seem to inherit PROs already and should thus use them

		// etc? TODO: check this!

		obj.init()
		if(Config.engine.doLoadScripts)
			obj.loadScript()

		if(deserializing) {
			obj.inventory = mobj.inventory.map(obj => deserializeObj(obj))
			obj.script = mobj.script

			if(mobj._script)
				obj._script = scriptingEngine.deserializeScript(mobj._script)
		}
		else
			obj.loadScript()

		return obj
	}

	init() {
		//console.log("init: %o", this)
		if(this.inventory !== undefined) // containers and critters
			this.inventory = this.inventory.map(obj => objFromMapObject(obj))
	}

	loadScript(sid:number=-1): void {
		var scriptName = null

		if(sid >= 0)
			scriptName = lookupScriptName(sid)
		else if(this.script)
			scriptName = this.script
		else if(this.pro) {
			if(this.pro.extra !== undefined && this.pro.extra.scriptID >= 0)
				scriptName = lookupScriptName(this.pro.extra.scriptID & 0xffff)
			else if(this.pro.scriptID >= 0)
				scriptName = lookupScriptName(this.pro.scriptID & 0xffff)
		}

		if(scriptName != null) {
			console.log("loadScript: loading %s (sid=%d)", scriptName, sid)
			var script = scriptingEngine.loadScript(scriptName)
			if(!script) {
				console.log("loadScript: load script failed for %s (sid=%d)", scriptName, sid)
			} else {
				this.script = scriptName
				this._script = script
				scriptingEngine.initScript(this._script, this)
			}
		}
	}

	enterMap(): void {
		// TODO: do we updateMap?
		// TODO: is this correct?
		// TODO: map objects should be a registry, and this should be activated when objects
		// are added in. @important
		
		if(this._script)
			scriptingEngine.objectEnterMap(this, currentElevation, gMap.mapID)
	}

	setAmount(amount: number): Obj {
		this.amount = amount
		return this
	}

	// Moves the object; returns `true` if successfully moved,
	// or `false` if interrupted (such as by an exit grid).
	move(position: Point, curIdx?: number): boolean {
		this.position = position

		// rebuild the lightmap
		if(Config.engine.doFloorLighting)
			Lightmap.rebuildLight()
		
		// give us a new z-order
		if(Config.engine.doZOrder !== false)
			objectZOrder(this, curIdx)

		return true
	}

	updateAnim(): void {
		if(!this.anim) return
		var time = heart.timer.getTime()
		var fps = imageInfo[this.art].fps
		if(fps === 0) fps = 10 // XXX: ?

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
		// NOTE: This may be overloaded in subclasses

		if(this.type === "misc") return false
		if(!this.pro) return true // XXX: ?
		if(this.subtype === "door") return !this.open
		if(this.visible === false) return false

		return !(this.pro.flags & 0x00000010 /* NoBlock */)
	}

	inAnim(): boolean {
		return !!this.animCallback // TODO: find a better way
	}

	// Clear any animation the object has
	clearAnim(): void {
		this.frame = 0
		this.animCallback = null
		this.anim = null
		this.shift = null
	}

	// Are two objects approximately (not necessarily strictly) equal?
	approxEq(obj: Obj) {
		return (this.pid === obj.pid)
	}

	clone(): Obj {
		// TODO: check this and probably fix it

		// If we have a script, temporarily remove it so that we may clone the
		// object without the script, and then re-load it for a new instance.
		if(this._script) {
			console.log("cloning an object with a script: %o", this)
			var _script = this._script
			this._script = null
			var obj = $.extend(true, {}, this)
			this._script = _script
			obj.loadScript() // load new copy of the script
			return obj

		}

		// no script, just deep clone the object
		return $.extend(true, {}, this)
	}

	addInventoryItem(item: Obj, count: number=1): void {
		for(var i = 0; i < this.inventory.length; i++) {
			if(this.inventory[i].approxEq(item)) {
				this.inventory[i].amount += count
				return
			}
		}

		// no existing item, add new inventory object
		this.inventory.push(item.clone().setAmount(count))
	}

	getMessageCategory(): string {
		return {"item": "pro_item",
		        "critter": "pro_crit",
	            "scenery": "pro_scen",
	            "wall": "pro_wall",
	            "misc": "pro_misc"}[this.type]
	}

	getDescription(): string {
		if(!this.pro)
			return null

		return getMessage(this.getMessageCategory(), this.pro.textID + 1) || null
	}

	// TODO: override this for subclasses
	serialize(): SerializedObj {
		return {
			pid: this.pid,
			pidID: this.pidID,
			type: this.type,
			pro: this.pro, // XXX: if pro changes in the future, this should be cloned
			flags: this.flags,
			art: this.art,
			frmPID: this.frmPID,
			orientation: this.orientation,
			visible: this.visible,
			extra: this.extra,
			script: this.script,
			_script: this._script ? this._script._serialize() : null,
			name: this.name,
			subtype: this.subtype,
			invArt: this.invArt,
			frame: this.frame,
			amount: this.amount,
			position: _.clone(this.position),
			inventory: this.inventory.map(obj => obj.serialize()),
			lightRadius: this.lightRadius,
			lightIntensity: this.lightIntensity
		}
	}
}

class Item extends Obj {
	type = "item";

	static fromPID(pid: number, sid?: number): Item { return Obj.fromPID_(new Item(), pid, sid) }

	static fromMapObject(mobj: any, deserializing: boolean=false): Item {
		return Obj.fromMapObject_(new Item(), mobj, deserializing)
	}

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

	static fromMapObject(mobj: any, deserializing: boolean=false): WeaponObj {
		return Obj.fromMapObject_(new WeaponObj(), mobj, deserializing)
	}

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

	static fromMapObject(mobj: any, deserializing: boolean=false): Scenery {
		return Obj.fromMapObject_(new Scenery(), mobj, deserializing)
	}

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
	static fromPID(pid: number, sid?: number): Door { return Obj.fromPID_(new Door(), pid, sid) }

	static fromMapObject(mobj: any, deserializing: boolean=false): Door {
		return Obj.fromMapObject_(new Door(), mobj, deserializing)
	}

	init() {
		super.init()
		//console.log("Door init")
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

function objFromMapObject(mobj: any, deserializing: boolean=false) {
	var pid = mobj.pid
	var pidType = (pid >> 24) & 0xff

	if(pidType == 1) // critter
		return Critter.fromMapObject(mobj, deserializing)
	else if(pidType == 0) { // item
		var pro = mobj.pro || loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 3)
			return WeaponObj.fromMapObject(mobj, deserializing)
		else
			return Item.fromMapObject(mobj, deserializing)
	}
	else if(pidType == 2) { // scenery
		var pro = mobj.pro || loadPRO(pid, pid & 0xffff)
		if(pro && pro.extra && pro.extra.subType == 0)
			return Door.fromMapObject(mobj, deserializing)
		else
			return Scenery.fromMapObject(mobj, deserializing)
	}
	else
		return Obj.fromMapObject(mobj, deserializing)
}

function deserializeObj(mobj: SerializedObj) {
	return objFromMapObject(mobj, true)
}
