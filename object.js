// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

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

function objectSingleAnim(obj, reversed, callback) {
	if(reversed) obj.frame = imageInfo[obj.art].numFrames - 1
	else obj.frame = 0
	obj.lastFrameTime = 0
	obj.anim = reversed ? "reverse" : "single"
	obj.animCallback = (callback !== undefined) ? callback : (function() { obj.anim = null  })
}

function objectInAnim(obj) {
	return !!(obj.path || obj.animCallback)
}

function objectUpdateAnimation(obj) {
	var time = heart.timer.getTime()
	var fps = imageInfo[obj.art].fps
	if(fps === 0) fps = 10 // ?

	if(time - obj.lastFrameTime >= 1000/fps) {
		if(obj.anim === "reverse") obj.frame--
		else obj.frame++
		obj.lastFrameTime = time

		if(obj.frame === -1 || obj.frame === imageInfo[obj.art].numFrames) {
			// animation is done
			if(obj.anim === "reverse") obj.frame++
			else obj.frame--
			if(obj.animCallback)
				obj.animCallback()
		}
	}
}

function objectBlocks(obj) {
	if(obj.type === "misc") return false
	if(!obj.pro) return true
	if(obj.open !== undefined) return !obj.open
	if(obj.visible === false) return false

	return !(obj.pro.flags & 0x00000010 /* NoBlock */)
}

function canUseObject(obj, source) {
	if(obj._script !== undefined && obj._script.use_p_proc !== undefined)
		return true
	else if(obj.type === "item" || obj.type === "scenery")
		if(objectIsDoor(obj) || objectIsStairs(obj))
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

function objectIsContainer(obj) {
	return (obj.type === "item" && obj.pro.extra.subType === 1) // SUBTYPE_CONTAINER
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

	// TODO: better object equality testing
	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].pid === obj.pid && gObjects[i].amount === obj.amount) {
			console.log("objectRemove: destroying index " + i + " (" + obj.art + ")")
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
	var explosion = createObjectWithPID(makePID(5 /* misc */, 14 /* Explosion */), -1)
	explosion.position.x = obj.position.x
	explosion.position.y = obj.position.y
	obj.dmgType = "explosion"

	if(images[explosion.art] === undefined) {
		lazyLoadImage(explosion.art, function() {
			gObjects.push(explosion)
			var idx = gObjects.length - 1

			console.log("adding explosion")
			objectSingleAnim(explosion, false, function() {
				gObjects.splice(idx, 1) // remove the explosion after it's finished

				// damage critters in a radius
				var hexes = hexesInRadius(obj.position, 8 /* explosion radius */) // TODO: radius
				for(var i = 0; i < hexes.length; i++) {
					var objs = objectsAtPosition(hexes[i])
					for(var j = 0; j < objs.length; j++) {
						if(objs[j].type === "critter")
							console.log("todo: damage " + critterGetName(objs[j]))

						scriptingEngine.damage(objs[j], obj, source, damage)
					}
				}

				// remove explosive
				objectDestroy(obj)
			})
		})
	}
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

function useObject(obj, source, useScript) {
	if(canUseObject(obj, source) === false) {
		console.log("can't use object")
		return false
	}

	if(useScript !== false && obj._script && obj._script.use_p_proc !== undefined) {
		if(source === undefined)
			source = player
		if(scriptingEngine.use(obj, source) === true) {
			console.log("useObject: overriden")
			return // script overrided us
		}
	}
	else if(obj.script !== undefined && !obj._script)
		console.log("object used has script but is not loaded: " + obj.script)

	if(obj.pid === 85 /* Plastic Explosives */ || obj.pid === 51 /* Dynamite */)
		return useExplosive(obj, source)

	// todo: check script overrides
	// also check object type
	objectSingleAnim(obj)

	if(objectIsDoor(obj) || objectIsContainer(obj)) {
		// open/closable doors/containers
		// todo: check lock status
		if(!obj.open) obj.open = true
		else obj.open = false
		objectSingleAnim(obj, !obj.open)

		if(objectIsContainer(obj) && obj.open === true) {
			// show locker contents
			var drawInv = function() {
				drawInventory($("#inventory"), obj, function(selected) {
					objectSwapItem(obj, selected, player, 1)
					drawPlayerInventory()
					drawInv()
				})
			}
			drawInv()
		}
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

function objectMove(obj, position) {
	obj.position = position
	objectZOrder(obj)
}