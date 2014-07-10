// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

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

	return !(obj.pro.flags & 0x00000010 /* NoBlock */)
}

function canUseObject(obj, source) {
	if(obj.type === "item" || obj.type === "scenery")
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

function useObject(obj, source) {
	if(canUseObject(obj, source) === false) {
		console.log("can't use object")
		return false
	}

	if(obj._script && obj._script.use_p_proc !== undefined) {
		obj._script.source_obj = (source !== undefined) ? source : player
		obj._script.self_obj = obj
		obj._script.use_p_proc()
	}
	else if(obj.script !== undefined && !obj._script)
		console.log("object used has script but is not loaded: " + obj.script)

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
					drawInventory($("#playerInventory"), player)
					drawInv()
				})
			}
			drawInv()
		}
	}
	else if(objectIsStairs(obj)) {
		if(obj.extra.destinationMap === -1 && obj.extra.destination !== -1) {
			// same map, new destination
			var destTile = fromTileNum(obj.extra.destination & 0xffff)
			var destElev = ((obj.extra.destination >> 28) & 0xf) >> 1

			console.log("stairs: tile: " + destTile.x + ", " + destTile.y + ", elev: " + destElev)

			player.position = destTile
			changeElevation(destElev)
		}
		else {
			console.log("stairs -> " + obj.extra.destinationMap)
		}
	}
}
