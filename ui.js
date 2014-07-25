// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

// TODO: reduce code duplication, circular references,
//       and general badness/unmaintainability.
// TODO: console UI on main bar
// TODO: combat UI on main bar
// TODO: stats/info view in inventory screen
// TODO: fix inventory image size
// TODO: fix style for inventory image amount
// TODO: use the grid area for replies on dialogue screen
// TODO: center the camera around the target while on the dialogue screen
// TODO: loot UI
// TODO: option for scaling the UI

function initUI() {
	makeDropTarget($("#inventoryBoxList"), function(data) { uiMoveSlot(data, "inventory") })
	makeDropTarget($("#inventoryBoxItem1"), function(data) { uiMoveSlot(data, "leftHand") })
	makeDropTarget($("#inventoryBoxItem2"), function(data) { uiMoveSlot(data, "rightHand") })

	$("#inventoryButton").click(uiInventoryScreen)
	$("#inventoryDoneButton").click(function() {
		uiMode = UI_MODE_NONE
		$("#inventoryBox").css("visibility", "hidden")
	})

	$("#lootBoxDoneButton").click(uiEndLoot)

	function makeScrollable($el) {
		$el.bind("mousewheel DOMMouseScroll", function(e) {
			var delta = (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) ? -1 : 1
	        $el.scrollTop($el.scrollTop() + 60*delta)
		})
	}

	makeScrollable($("#inventoryBoxList"))

	makeScrollable($("#barterBoxInventoryLeft"))
	makeScrollable($("#barterBoxInventoryRight"))
	makeScrollable($("#barterBoxLeft"))
	makeScrollable($("#barterBoxRight"))
	makeScrollable($("#lootBoxLeft"))
	makeScrollable($("#lootBoxRight"))

	drawHP(critterGetStat(player, "HP"))
}

function uiMoveSlot(data, target) {
	var obj = null
	if(data[0] === "i") {
		if(target === "inventory")
			return // disallow inventory -> inventory

		var idx = parseInt(data.slice(1))
		console.log("idx: " + idx)
		obj = player.inventory[idx]
		player.inventory.splice(idx, 1) // remove object from inventory
	}
	else {
		obj = player[data]
		player[data] = null // remove object from slot
	}

	console.log("obj: " + obj + " (data: " + data + ", target: " + target + ")")

	if(target === "inventory")
		player.inventory.push(obj)
	else {
		if(player[target] !== undefined && player[target] !== null) {
			// perform a swap
			if(data[0] === "i")
				player.inventory.push(player[target]) // inventory -> slot
			else
				player[data] = player[target] // slot -> slot
		}

		player[target] = obj // move the object over
	}

	uiInventoryScreen()
}

function makeDropTarget($el, dropCallback) {
	$el.on("drop", function(e) {
		var data = e.originalEvent.dataTransfer.getData("text/plain")
		dropCallback(data, e)
		return false
	}).on("dragenter", function() { return false }).
	   on("dragover",  function() { return false })
}

function makeDraggable($el, data, endCallback) {
	$el.attr("draggable", "true").on("dragstart", function(e) {
		e.originalEvent.dataTransfer.setData('text/plain', data)
		console.log("start drag")
	}).on("dragend", function(e) {
		if(e.originalEvent.dataTransfer.dropEffect !== 'none') {
			//$(this).remove()
			if(endCallback !== undefined)
				endCallback($(this))
		}
	})
}

function uiInventoryScreen() {
	uiMode = UI_MODE_INVENTORY

	$("#inventoryBox").css("visibility", "visible")
	drawInventory($("#inventoryBoxList"), player.inventory, function(obj, e) {
		makeItemContextMenu(e, obj, "inventory")
	})

	function drawInventory($el, objects, clickCallback) {
		$el.html("")
		$("#inventoryBoxItem1").html("")
		$("#inventoryBoxItem2").html("")

		for(var i = 0; i < objects.length; i++) {
			var inventoryImage = objects[i].invArt
			var img = $("<img>").attr("src", inventoryImage+'.png').
			          attr("width", 72).attr("height", 60) // 90x60 // 70x40
			img.attr("title", objects[i].name)
			if(clickCallback !== undefined)
				(function(invObj) {
					img.click(function(e) { clickCallback(invObj, e) })
				})(objects[i])
			$el.append(img).append("x" + objects[i].amount)
			makeDraggable(img, "i" + i, function() { uiInventoryScreen() })
		}
	}

	function itemAction(obj, slot, action) {
		switch(action) {
			case "cancel": break
			case "use":
				console.log("using object: " + obj.art)
				useObject(obj, player)
				break
			case "drop":
			    //console.log("todo: drop " + obj.art); break
			    console.log("dropping: " + obj.art + " with pid " + obj.pid)
			    if(slot !== "inventory") {
				    // add into inventory to drop
				    console.log("moving into inventory first")
				    player.inventory.push(obj)
				    player[slot] = null
				}

			    dropObject(player, obj)
			    uiInventoryScreen()
			    break
		}
	}

	function makeContextButton(obj, slot, action) {
		return $("<img>").attr("id", "context_" + action).
						  addClass("itemContextMenuButton").
						  click(function() {
						  	  itemAction(obj, slot, action)
						      $("#itemContextMenu").css("visibility", "hidden")
        })
	}

	function makeItemContextMenu(e, obj, slot) {
		var $menu = $("#itemContextMenu").css("visibility", "visible").html("").
		                                  css({left: e.clientX,
		                                  	   top: e.clientY})
        var cancelBtn = makeContextButton(obj, slot, "cancel")
        var useBtn = makeContextButton(obj, slot, "use")
        var dropBtn = makeContextButton(obj, slot, "drop")

		$menu.append(cancelBtn)
		if(canUseObject(obj))
			$menu.append(useBtn)
		$menu.append(dropBtn)
	}

	function drawSlot(slot, slotID) {
		var art = player[slot].invArt
		var img = $("<img>").attr("src", art+'.png').
		          attr("width", 72).attr("height", 60) // 90x60 // 70x40
		img.attr("title", player[slot].name)
		img.click(function(e) {
			var offset = img.offset()
			makeItemContextMenu(e, player[slot], slot)
		})
		makeDraggable(img, slot)
		$(slotID).html("").append(img)
	}

	if(player.leftHand)
		drawSlot("leftHand", "#inventoryBoxItem1")
	if(player.rightHand)
		drawSlot("rightHand", "#inventoryBoxItem2")
}

function drawHP(hp) {
	drawDigits("#hpDigit", hp)
}

function drawDigits(idPrefix, amount) {
	var CHAR_W = 9, CHAR_NEG = 12
	var sign = (amount < 0) ? CHAR_NEG : 0
	if(amount < 0) amount = -amount
	var digits = amount.toString()
	$(idPrefix+"1").css("background-position", 0 - CHAR_W*sign) // sign
	for(var i = 2; i <= 4-digits.length; i++) // left-fill with zeroes
		$(idPrefix + i).css("background-position", 0)
	for(var i = 0; i < digits.length; i++) {
		var idx = digits.length - 1 - i
		var digit = parseInt(digits[idx])
		$(idPrefix + (4-i)).css("background-position", 0 - CHAR_W*digit)
	}
}

function drawInventory($el, obj, clickCallback) {
	$el.html("")
	for(var i = 0; i < obj.inventory.length; i++) {
		if(obj.inventory[i].invArt === undefined) { // make a guess
			var s = obj.inventory[i].art.split('/')
			var inventoryImage = 'art/inven/' + s[s.length-1]
		} else
			var inventoryImage = obj.inventory[i].invArt

		//console.log("inv img: " + inventoryImage)
		if(images[inventoryImage] === undefined)
			lazyLoadImage(inventoryImage, null, false)
		var img = $("<img>").attr("src", inventoryImage+'.png').
		          attr("width", 72).attr("height", 60) // 90x60 // 70x40
		img.attr("title", obj.inventory[i].name)
		if(clickCallback !== undefined)
			(function(invObj) {
				img.click(function(e) { clickCallback(invObj, obj, e) })
			})(obj.inventory[i])
		$el.append(img).append("x" + obj.inventory[i].amount)
	}
}

function drawPlayerInventory() {
	// draw the player inventory with click handlers for
	// using or dropping items

	drawInventory($("#inventoryBoxList"), player, function(item, _, event) {
		if(event.shiftKey) { // shift+click -> drop item
			dropObject(player, item)
			drawPlayerInventory()
		}
		else { // click -> use item
			useObject(item, player)
		}
	})
}

function uiStartDialogue(force, target) {
	if(uiMode === UI_MODE_BARTER && force !== true)
		return

	uiMode = UI_MODE_DIALOGUE
	$("#dialogueContainer").css("visibility", "visible")
	$("#dialogueBox").css("visibility", "visible").css("top", 480).animate({top: 290}, 1000)

	// center around the dialogue target
	var bbox = objectBoundingBox(target)
	if(bbox !== null) {
		var dc = $("#dialogueContainer")
		// alternatively: dc.offset().left - $(heart.canvas).offset().left
		var dx = dc.width() / 2 + dc[0].offsetLeft
		var dy = dc.height() / 4 + dc[0].offsetTop - (bbox.h / 2)
		cameraX = bbox.x - dx
		cameraY = bbox.y - dy
	}
}

function uiEndDialogue() {
	uiMode = UI_MODE_NONE
	$("#dialogueContainer").css("visibility", "hidden")
	$("#dialogueBox").css("visibility", "hidden")
	$("#dialogueBoxReply").html("")
}

function uiSetDialogueReply(reply) {
	$("#dialogueBoxReply").html(reply)
	$("#dialogueBoxTextArea").html("")
}

function uiAddDialogueOption(msg, optionID) {
	$("#dialogueBoxTextArea").append(
		"<li><a href=\"javascript:dialogueReply(" + optionID + ")\">" + msg + "</a></li>")
}

function uiGetAmount(item) {
	while(true) {
		var amount = prompt("How many?")
		if(amount === null)
			return 0
		else if(amount === "")
			return item.amount // all of it!
		else amount = parseInt(amount)

		if(isNaN(amount) || item.amount < amount)
			alert("Invalid amount")
		else return amount
	}
}

function uiSwapItem(a, item, b, amount) {
	objectSwapItem({inventory: a}, item, {inventory: b}, amount)
}

function uiEndBarterMode() {
	$("#barterBox").animate({top: 480}, 1000, function() {
		$("#barterBox").css("visibility", "hidden")
		$("#barterBoxLeft").off("drop dragenter dragover")
		$("#barterBoxRight").off("drop dragenter dragover")
		$("#barterBoxInventoryLeft").off("drop dragenter dragover")
		$("#barterBoxInventoryRight").off("drop dragenter dragover")
		$("#barterTalkButton").off("click")
		$("#barterOfferButton").off("click")
		$("#barterBox").css("visibility", "hidden")
		
		uiStartDialogue(true) // force dialogue mode
	})
}

function uiBarterMode(merchant) {
	uiMode = UI_MODE_BARTER

	// hide dialogue screen for now
	$("#dialogueBox").animate({top: 480}, 1000, function() {
		$("#dialogueBox").css("visibility", "hidden")
		console.log("going to pop up")
		// pop up the bartering screen
		$("#barterBox").css("visibility", "visible").css("top", 480).animate({top: 290}, 1000)
	})

	// logic + UI for bartering
	// TODO: would it be better if we dropped the "working" copies?

	// a copy of inventories for both parties
	var workingPlayerInventory = player.inventory.map(cloneItem)
	var workingMerchantInventory = merchant.inventory.map(cloneItem)

	// and our working barter tables
	var playerBarterTable = []
	var merchantBarterTable = []

	function totalAmount(objects) {
		var total = 0
		for(var i = 0; i < objects.length; i++) {
			total += objects[i].pro.extra.cost * objects[i].amount
		}
		return total
	}

	// TODO: checkOffer() or some-such
	function offer() {
		console.log("[OFFER]")

		var merchantOffered = totalAmount(merchantBarterTable)
		var playerOffered = totalAmount(playerBarterTable)
		var diffOffered = playerOffered - merchantOffered

		if(diffOffered >= 0) {
			// OK, player offered equal to more more than the value
			console.log("[OFFER OK]")

			// finalize and apply the deal

			// swap to working inventories
			merchant.inventory = workingMerchantInventory
			player.inventory = workingPlayerInventory

			// add in the table items
			for(var i = 0; i < merchantBarterTable.length; i++)
				objectAddItem(player, merchantBarterTable[i], merchantBarterTable[i].amount)
			for(var i = 0; i < playerBarterTable.length; i++)
				objectAddItem(merchant, playerBarterTable[i], playerBarterTable[i].amount)

			// re-clone so we can continue bartering if necessary
			workingPlayerInventory = player.inventory.map(cloneItem)
			workingMerchantInventory = merchant.inventory.map(cloneItem)

			playerBarterTable = []
			merchantBarterTable = []

			redrawBarterInventory()
		}
		else {
			console.log("[OFFER REFUSED]")
		}
	}

	function drawInventory($el, who, objects) {
		$el.html("")

		for(var i = 0; i < objects.length; i++) {
			var inventoryImage = objects[i].invArt
			var img = $("<img>").attr("src", inventoryImage+'.png').
			          attr("width", 72).attr("height", 60) // 90x60 // 70x40
			img.attr("title", objects[i].name)
			$el.append(img).append("x" + objects[i].amount)
			makeDraggable(img, who + i)
		}
	}

	function uiBarterMove(data, where) {
		console.log("barter: move " + data + " to " + where)

		var from = {"p": workingPlayerInventory,
	                "m": workingMerchantInventory,
	                "l": playerBarterTable,
	                "r": merchantBarterTable}[data[0]]

		if(from === undefined) throw "uiBarterMove: wrong data: " + data

		var idx = parseInt(data.slice(1))
		var obj = from[idx]
		if(obj === undefined) throw "uiBarterMove: obj not found in list (" + idx + ")"

		// player inventory -> left table or player inventory
		if(data[0] === "p" && where !== "left" && where !== "leftInv")
			return

		// merchant inventory -> right table or merchant inventory
		if(data[0] === "m" && where !== "right" && where !== "rightInv")
			return

		var to = {"left": playerBarterTable,
		          "right": merchantBarterTable,
		          "leftInv": workingPlayerInventory,
		          "rightInv": workingMerchantInventory}[where]

		if(to === undefined)
			throw "uiBarterMove: invalid location: " + where
		else if(to === from) // table -> same table
			return
		else if(obj.amount > 1)
			uiSwapItem(from, obj, to, uiGetAmount(obj))
		else uiSwapItem(from, obj, to)

		redrawBarterInventory()
	}

	// bartering drop targets
	makeDropTarget($("#barterBoxLeft"), function(data) { uiBarterMove(data, "left") })
	makeDropTarget($("#barterBoxRight"), function(data) { uiBarterMove(data, "right") })
	makeDropTarget($("#barterBoxInventoryLeft"), function(data) { uiBarterMove(data, "leftInv") })
	makeDropTarget($("#barterBoxInventoryRight"), function(data) { uiBarterMove(data, "rightInv") })

	$("#barterTalkButton").click(uiEndBarterMode)
	$("#barterOfferButton").click(offer)

	function redrawBarterInventory() {
		drawInventory($("#barterBoxInventoryLeft"), "p", workingPlayerInventory)
		drawInventory($("#barterBoxInventoryRight"), "m", workingMerchantInventory)
		drawInventory($("#barterBoxLeft"), "l", playerBarterTable)
		drawInventory($("#barterBoxRight"), "r", merchantBarterTable)

		var moneyLeft = totalAmount(playerBarterTable)
		var moneyRight = totalAmount(merchantBarterTable)

		$("#barterBoxLeftAmount").html("$" + moneyLeft)
		$("#barterBoxRightAmount").html("$" + moneyRight)
	}

	redrawBarterInventory()
}

function uiEndLoot() {
	ui = UI_MODE_NONE
	$("#lootBox").css("visibility", "hidden")
	$("#lootBoxLeft").off("drop dragenter dragover")
	$("#lootBoxRight").off("drop dragenter dragover")
	$("#lootBoxTakeAllButton").off("click")
}

function uiLoot(object) {
	uiMode = UI_MODE_LOOT

	function uiLootMove(data, where) {
		console.log("loot: move " + data + " to " + where)

		var from = {"l": player.inventory,
	                "r": object.inventory}[data[0]]

		if(from === undefined) throw "uiLootMove: wrong data: " + data

		var idx = parseInt(data.slice(1))
		var obj = from[idx]
		if(obj === undefined) throw "uiLootMove: obj not found in list (" + idx + ")"

		var to = {"left": player.inventory,
		          "right": object.inventory}[where]

		if(to === undefined)
			throw "uiLootMove: invalid location: " + where
		else if(to === from) // object -> same location
			return
		else if(obj.amount > 1)
			uiSwapItem(from, obj, to, uiGetAmount(obj))
		else uiSwapItem(from, obj, to)

		drawLoot()
	}

	function drawInventory($el, who, objects) {
		$el.html("")

		for(var i = 0; i < objects.length; i++) {
			var inventoryImage = objects[i].invArt
			var img = $("<img>").attr("src", inventoryImage+'.png').
			          attr("width", 72).attr("height", 60) // 90x60 // 70x40
			img.attr("title", objects[i].name)
			$el.append(img).append("x" + objects[i].amount)
			makeDraggable(img, who + i)
		}
	}

	console.log("looting...")

	$("#lootBox").css("visibility", "visible")

	// loot drop targets
	makeDropTarget($("#lootBoxLeft"), function(data) { uiLootMove(data, "left") })
	makeDropTarget($("#lootBoxRight"), function(data) { uiLootMove(data, "right") })

	$("#lootBoxTakeAllButton").click(function() {
		console.log("take all...")
		var inv = object.inventory.slice(0) // clone inventory
		for(var i = 0; i < inv.length; i++)
			uiSwapItem(object.inventory, inv[i], player.inventory, inv[i].amount)
		drawLoot()
	})

	function drawLoot() {
		drawInventory($("#lootBoxLeft"), "l", player.inventory)
		drawInventory($("#lootBoxRight"), "r", object.inventory)
	}

	drawLoot()
}

function uiLog(msg) {
	$("#displayLog").append(msg + "<br>")
}