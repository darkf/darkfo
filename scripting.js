// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

var scriptingEngine = (function() {
	var gameObjects = []
	var gameElevation = 0
	var dudeObject = null
	var mapVars = {
		"Raiders2": {
			0: 0, // MVAR_Been_Here_1
			1: 0, // MVAR_Been_Here_2
			2: 0, // MVAR_Been_Here_1
		}
	}
	var globalVars = {
		0: 50, // GVAR_PLAYER_REPUTATION
		10: 1, // GVAR_START_ARROYO_TRIAL (1 = TRIAL_FIGHT)
		531: 1, // GVAR_TALKED_TO_ELDER
		452: 2, // GVAR_DEN_VIC_KNOWN
		88: 0, // GVAR_VAULT_RAIDERS
		83: 2, // GVAR_VAULT_PLANT_STATUS (9 = PLANT_REPAIRED, 2 = PLANT_ACCEPTED_QUEST)
		616: 0, // GVAR_GECKO_FIND_WOODY (0 = WOODY_UNKNOWN)
		345: 16, // GVAR_NEW_RENO_FLAG_2 (16 = know_mordino_bit)
		357: 2, // GVAR_NEW_RENO_LIL_JESUS_REFERS (lil_jesus_refers_yes)
	}
	var currentMapID = null
	var currentMapObject = null
	var mapFirstRun = true
	var scriptMessages = {}
	var dialogueOptionProcs = []
	var currentDialogueObject = null
	var timeEventList = []

	var debugLogShowType = {
		stub: true,
		log: false,
		timer: false,
		load: true,
		debugMessage: true,
		displayMessage: true,
		floatMessage: false,
		gvars: true,
		lvars: true,
		tiles: true,
		animation: false,
		movement: true,
		inventory: true,
		party: false,
	}

	var statMap = {
		0: "STR", 1: "PER", 2: "END", 3: "CHR", 4: "INT",
		5: "AGI", 6: "LUK",
		35: "HP", 7: "MaxHP"
	}

	function stub(name, args, type) {
		if(debugLogShowType.stub === false || debugLogShowType[type] === false) return
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		console.log("STUB: " + name + ": " + a)
	}

	function log(name, args, type) {
		if(debugLogShowType.log === false || debugLogShowType[type] === false) return
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		console.log("log: " + name + ": " + a)
	}

	function warn(msg, type) {
		if(type !== undefined && debugLogShowType[type] === false) return
		console.log("WARNING: " + msg)
	}

	function info(msg, type) {
		if(type !== undefined && debugLogShowType[type] === false) return
		console.log("INFO: " + msg)
	}

	// http://stackoverflow.com/a/23304189/1958152
	function seed(s) {
	    Math.random = function() {
	        s = Math.sin(s) * 10000; return s - Math.floor(s)
	    }
	}

	function isGameObject(obj) {
		if(obj === undefined || obj === null) return false
		if(obj.isPlayer === true) return true
		if(obj.type === "item" || obj.type === "critter" || obj.type === "scenery" ||
		   obj.type == "wall" || obj.type === "tile" || obj.type === "misc")
			return true
		/*for(var i = 0; i < gameObjects.length; i++) {
			if(gameObjects[i] === obj) {
				//console.log("is GO: " + obj.toString())
				return true
			}
		}*/
		warn("is NOT GO: " + obj.toString())
		return false
	}

	function getScriptName(id) {
		return getLstId("scripts/scripts", id - 1).split(".")[0]
	}

	function getScriptMessage(id, msg) {
		var name = getScriptName(id)
		if(name === null) {
			warn("getScriptMessage: no script with ID " + id)
			return null
		}

		if(typeof msg === "string") // passed in a string message
			return msg

		if(scriptMessages[name] === undefined)
			loadMessageFile(name)
		if(scriptMessages[name] === undefined)
			throw "getScriptMessage: loadMessageFile failed?"
		if(scriptMessages[name][msg] === undefined)
			throw "getScriptMessage: no message " + msg + " for script " + id + " (" + name + ")"

		return scriptMessages[name][msg]
	}

	function dialogueReply(id) {
		var f = dialogueOptionProcs[id]
		dialogueOptionProcs = []
		f()
		// by this point we may have already exited dialogue
		if(currentDialogueObject !== null && dialogueOptionProcs.length === 0) {
			// after running the option procedure we have no options...
			// so close the dialogue
			dialogueExit()
		}
	}

	function dialogueExit() {
		$("#dialogue").css("visibility", "hidden") // todo: some sort of transition
		info("[dialogue exit]")

		if(currentDialogueObject !== null && currentDialogueObject._script.yieldedFn !== undefined) {
			info("[calling yielded fn]")
			currentDialogueObject._script.yieldedFn()
			currentDialogueObject._script.yieldedFn = undefined
		}

		currentDialogueObject = null
	}

	function endBarter() {
		// End barter mode -- back to dialogue mode
		$("#dialogue").css("visibility", "visible")
		$("#barterLeft, #barterRight").css("visibility", "hidden")

		drawPlayerInventory()
		$("#inventory").html("")
	}

	var ScriptProto = {
		dude_obj: "<Dude Object>",
		'true': true,
		'false': false,

		floor: function(x) { return Math.floor(x) }, // TODO: does the language have floats? Are we handling division incorrectly?

		set_global_var: function(gvar, value) {
			globalVars[gvar] = value
			info("set_global_var: " + gvar + " = " + value)
			log("set_global_var", arguments, "gvars")
		},
		set_local_var: function(lvar, value) {
			this.lvars[lvar] = value
			info("set_local_var: " + lvar + " = " + value + " [" + this.scriptName + "]", "lvars")
			log("set_local_var", arguments, "lvars")
		},
		local_var: function(lvar) {
			log("local_var", arguments, "lvars");
			if(this.lvars[lvar] === undefined) {
				warn("local_var: setting default value (0) for LVAR " + lvar)
				this.lvars[lvar] = 0
			}
			return this.lvars[lvar] },
		map_var: function(mvar) {
			if(this._mapScript === undefined) {
				warn("map_var: no map script")
				return
			}
			var scriptName = this._mapScript.scriptName
			if(scriptName === undefined) {
				warn("map_var: map script has no name")
				return
			}
			else if(mapVars[scriptName] === undefined)
				mapVars[scriptName] = {}
			else if(mapVars[scriptName][mvar] === undefined) {
				warn("map_var: setting default value (0) for MVAR " + mvar)
				mapVars[scriptName][mvar] = 0
			}
			return mapVars[scriptName][mvar]
		},
		set_map_var: function(mvar, value) {
			if(mapVars[this.scriptName] === undefined)
				mapVars[this.scriptName] = {}
			mapVars[this.scriptName][mvar] = value
		},
		global_var: function(gvar) {
			if(globalVars[gvar] === undefined) {
				warn("global_var: unknown gvar " + gvar + ", using default (0)", "gvars")
				globalVars[gvar] = 0
			}
			return globalVars[gvar]
		},
		random: function(min, max) { log("random", arguments); return getRandomInt(min, max) },
		debug_msg: function(msg) { log("debug_msg", arguments); info("DEBUG MSG: " + msg, "debugMessage") },
		display_msg: function(msg) { log("display_msg", arguments); info("DISPLAY MSG: " + msg, "displayMessage") },
		message_str: function(msgList, msgNum) { return getScriptMessage(msgList, msgNum) },
		metarule: function(id, target) {
			switch(id) {
				case 14: return mapFirstRun // map_first_run
				case 17: stub("metarule", arguments); return 0  // is area known? (TODO)
				case 18: return 0 // is the critter under the influence of drugs? (TODO)
				case 22: return 0 // is_game_loading
				case 49: // METARULE_W_DAMAGE_TYPE
					switch(objectGetDamageType(target)) {
						case "explosion": return 6 // DMG_explosion
						default: throw "unknown damage type"
					}
				default: stub("metarule", arguments)
			}
		},
		metarule3: function(id, obj, userdata, radius) {
			if(id === 100) { // METARULE3_CLR_FIXED_TIMED_EVENTS
				for(var i = 0; i < timeEventList.length; i++) {
					if(timeEventList[i].obj === obj && 
					   timeEventList[i].userdata === userdata) { // todo: game object equals
					   	info("removing timed event (userdata " + userdata + ")", "timer")
					   	timeEventList.splice(i, 1)
					    return
					}
				}
			}

			stub("metarule3", arguments)
		},
		script_overrides: function() {
			warn("[SCRIPT OVERRIDES]")
			stub("script_overrides", arguments)
		},

		// player
		give_exp_points: function(xp) { stub("give_exp_points", arguments) },

		// critters
		get_critter_stat: function(obj, stat) {
			if(stat === 34) // STAT_gender
				return obj.gender === "female" ? 1 : 0
			var namedStat = statMap[stat]
			if(namedStat !== undefined)
				return critterGetStat(obj, namedStat)
			stub("get_critter_stat", arguments)
			return 5
		},
		has_trait: function(traitType, obj, trait) {
			if(!isGameObject(obj)) {
				warn("has_trait: not game object: " + obj)
				return
			}

			if(trait === 666) // OBJECT_VISIBILITY
				return 1 // visible
			else if(trait === 10) // OBJECT_CUR_ROT
				return obj.orientation

			stub("has_trait", arguments)
			return 0
		},
		critter_add_trait: function(obj, traitType, trait, amount) { stub("critter_add_trait", arguments) },
		item_caps_total: function(obj) {
			if(!isGameObject(obj)) throw "item_caps_total: not game object"
			return objectGetMoney(obj)
		},
		item_caps_adjust: function(obj, amount) { stub("item_caps_adjust", arguments) },
		move_obj_inven_to_obj: function(obj, other) {
			if(obj === null || other === null) {
				warn("move_obj_inven_to_obj: null pointer passed in")
				return
			}

			if(!isGameObject(obj) || !isGameObject(other)) {
				warn("move_obj_inven_to_obj: not game object")
				return
			}

			info("move_obj_inven_to_obj: " + obj.inventory.length + " to " + other.inventory.length, "inventory")
			other.inventory = obj.inventory
			obj.inventory = []
			drawPlayerInventory()
		},
		obj_is_carrying_obj_pid: function(obj, pid) { // Number of inventory items with matching PID
			if(!isGameObject(obj)) {
				warn("obj_is_carrying_obj_pid: not a game object")
				return 0
			} else if(obj.inventory === undefined) {
				warn("obj_is_carrying_obj_pid: object has no inventory!")
				return 0
			}

			info("obj_is_carrying_obj_pid: " + pid, "inventory")
			var count = 0
			for(var i = 0; i < obj.inventory.length; i++) {
				if(obj.inventory[i].pid === pid) count++
			}
			return count
		},
		add_mult_objs_to_inven: function(obj, item, count) { // Add count copies of item to obj's inventory
			if(!isGameObject(obj)) {
				warn("add_mult_objs_to_inven: not a game object")
				return
			} else if(!isGameObject(item)) {
				warn("add_mult_objs_to_inven: item not a game object: " + item)
				return
			} else if(obj.inventory === undefined) {
				warn("add_mult_objs_to_inven: object has no inventory!")
				return
			}

			info("add_mult_objs_to_inven: " + count + " counts of " + item.toString(), "inventory")
			objectAddItem(obj, item, count)
			drawPlayerInventory()
		},
		rm_mult_objs_from_inven: function(obj, item, count) { // Remove count copies of item from obj's inventory
			stub("rm_mult_objs_from_inven", arguments)
		},
		obj_carrying_pid_obj: function(obj, pid) { stub("obj_carrying_pid_obj", arguments); return 0 },
		elevation: function(obj) { if(isGameObject(obj)) return currentElevation
								   else { warn("elevation: not an object: " + obj.toString()); return -1 } },
		obj_can_see_obj: function(a, b) { /*stub("obj_can_see_obj", arguments);*/ return 0 },
		has_skill: function(obj, skill) { stub("has_skill", arguments); return 100 },
		roll_vs_skill: function(obj, skill, bonus) { stub("roll_vs_skill", arguments); return 1 },
		is_success: function(roll) { stub("is_success", arguments); return 0 },
		critter_inven_obj: function(obj, where) {
			if(!isGameObject(obj)) throw "critter_inven_obj: not game object"
			if(where === 0) {} // INVEN_TYPE_WORN
			else if(where === 1) {} // INVEN_TYPE_RIGHT_HAND
			else if(where === 2) {} // INVEN_TYPE_LEFT_HAND
			else if(where === -2) throw "INVEN_TYPE_INV_COUNT"
			stub("critter_inven_obj", arguments)
			return undefined
		},
		critter_attempt_placement: function(obj, tile, elevation) { stub("critter_attempt_placement", arguments) },
		critter_state: function(obj) { stub("critter_state", arguments); return 0 },
		kill_critter: function(obj, deathFrame) { stub("kill_critter", arguments) },
		get_poison: function(obj) { stub("get_poison", arguments); return 0 },
		get_pc_stat: function(pcstat) {
			switch(pcstat) {
				case 0: // PCSTAT_unspent_skill_points
				case 1: // PCSTAT_level
				case 2: // PCSTAT_experience
				case 3: // PCSTAT_reputation
				case 4: // PCSTAT_karma
				case 5: // PCSTAT_max_pc_stat
					stub("get_pc_stat", arguments)
					return 0
			}
		},
		critter_injure: function(obj, how) { stub("critter_injure", arguments) },

		// combat
		attack_complex: function(obj, calledShot, numAttacks, bonus, minDmg, maxDmg, attackerResults, targetResults) {
			info("[enter combat via attack_complex]")
			//stub("attack_complex", arguments)
			// since this isn't actually used beyond its basic form, we're not going to bother
			// implementing all of it

			inCombat = true
			combat = new Combat([this.self_obj], dudeObject) //gameObjects, dudeObject)
			combat.forceTurn(this.self_obj)
			combat.nextTurn()
		},
		terminate_combat: function() {
			info("[terminate_combat]")
			combat.end()
		},

		// objects
		obj_is_locked: function(obj) { stub("obj_is_locked", arguments); return 0 },
		obj_lock: function(obj) { stub("obj_lock", arguments) },
		obj_unlock: function(obj) { stub("obj_unlock", arguments) },
		obj_is_open: function(obj) { stub("obj_is_open", arguments); return 0 },
		obj_close: function(obj) { stub("obj_close", arguments) },
		obj_open: function(obj) {
			info("obj_open")
			useObject(obj, this.self_obj)
			stub("obj_open", arguments)
		},
		create_object_sid: function(pid, tile, elevation, sid) { // Create object of pid and possibly script
			info("create_object_sid: " + pid + " / " + tile + " / " + sid)

			var obj = createObjectWithPID(pid, sid)
			if(obj === null) {
				warn("create_object_sid: couldn't create object")
				return null
			}
			//info("OBJ: " + repr(obj))
			//stub("create_object_sid", arguments)

			// TODO: if tile is valid...
			if(elevation !== currentElevation)
				throw "create_object_sid: want to create object on another elevation"
			obj.position = fromTileNum(tile)
			gObjects.push(obj)

			return obj
		},
		obj_name: function(obj) { return obj.name },
		obj_item_subtype: function(obj) {
			if(!isGameObject(obj)) {
				warn("obj_item_subtype: not game object: " + obj)
				return null
			}

			if(obj.type === "item" && obj.pro !== undefined)
				return obj.pro.extra.subtype
			stub("obj_item_subtype", arguments)
			return null
		},
		anim_busy: function(obj) {
			info("anim_busy", arguments)
			if(!isGameObject(obj)) {
				warn("anim_busy: not game object: " + obj)
				return false
			}
			return objectInAnim(obj)
		},
		obj_art_fid: function(obj) { stub("obj_art_fid", arguments); return 0 },
		set_obj_visibility: function(obj, visibility) {
			if(!isGameObject(obj)) {
				warn("set_obj_visibility: not a game object: " + obj)
				return
			}

			obj.visible = !visibility
		},
		use_obj_on_obj: function(obj, who) { stub("use_obj_on_obj", arguments) },
		anim: function(obj, anim, direction) { stub("anim", arguments) },

		// environment
		set_light_level: function(level) { stub("set_light_level", arguments) },
		override_map_start: function(x, y, elevation, rotation) {
			if(elevation !== currentElevation)
				throw "override_map_start: not on current elevation"
			dudeObject.position = {x: x, y: y}
			dudeObject.orientation = rotation
			centerCamera(dudeObject.position)
		},
		obj_pid: function(obj) { stub("obj_pid", arguments) },
		obj_on_screen: function(obj) { stub("obj_on_screen", arguments); return 0 },
		obj_type: function(obj) {
			if(!isGameObject(obj)) { warn("obj_type: not game object: " + obj); return }
			if(obj.pid === undefined) { warn("obj_type: no PID"); return }
			return (obj.pid >> 24) & 0xff
		},
		destroy_object: function(obj) { // destroy object from world
			log("destroy_object", arguments)
			objectDestroy(obj)
		},

		// tiles
		tile_distance_objs: function(a, b) {
			if(!isGameObject(a) || !isGameObject(b)) {
				warn("tile_distance_objs: " + a + " or " + b + " are not game objects")
				return
			}
			return hexDistance(a.position, b.position)
		},
		tile_distance: function(a, b) { return hexDistance(fromTileNum(a), fromTileNum(b)) }, // TODO: should we use floor?
		tile_num: function(obj) {
			if(!isGameObject(obj)) { warn("tile_num: not game object"); return }
			return toTileNum(obj.position)
		},
		tile_contains_pid_obj: function(tile, elevation, pid) {
			stub("tile_contains_pid_obj", arguments, "tiles")
			var pos = fromTileNum(tile)
			if(elevation !== currentElevation)
				throw "tile_contains_pid_obj: not on current elevation"
			for(var i = 0; i < gameObjects.length; i++) {
				if(gameObjects[i].position.x === pos.x && gameObjects[i].position.y === pos.y &&
				   gameObjects[i].pid === pid) {
					return gameObjects[i]
				}
			}
			return null
		},
		tile_num_in_direction: function(tile, direction) { return toTileNum(hexInDirection(fromTileNum(tile), direction)) },
		tile_in_tile_rect: function(_, _, _, _, t) { stub("tile_in_tile_rect", arguments, "tiles"); return 0 },
		tile_contains_obj_pid: function(tile, elevation, pid) { stub("tile_contains_obj_pid", arguments); return 0 },
		rotation_to_tile: function(srcTile, destTile) {
			var src = fromTileNum(srcTile), dest = fromTileNum(destTile)
			var hex = hexNearestNeighbor(src, dest)
			if(hex !== null)
				return hex.direction
			warn("rotation_to_tile: invalid hex: " + srcTile + " / " + destTile)
		},
		move_to: function(obj, tileNum, elevation) {
			if(!isGameObject(obj)) {
				warn("move_to: not a game object: " + obj)
				return
			}
			if(elevation !== currentElevation)
				throw "move_to: elevation != current"
			obj.position = fromTileNum(tileNum)
		},

		// combat
		node998: function() { // enter combat
			console.log("[enter combat]")
		},

		// dialogue
		node999: function() { // exit dialogue
			info("DIALOGUE EXIT (Node999)")
			dialogueExit()
		},
		gdialog_set_barter_mod: function(mod) { stub("gdialog_set_barter_mod", arguments) },
		gdialog_mod_barter: function(mod) { // switch to barter mode
			console.log("--> barter mode")
			if(!this.self_obj) throw "need self_obj"

			// hide dialogue screen for now
			$("#dialogue").css("visibility", "hidden")

			// pop up the bartering areas
			$("#barterLeft, #barterRight").css("visibility", "visible")

			function findItem(obj, item) {
				for(var i = 0; i < obj.inventory.length; i++) {
					if(obj.inventory[i].pid === item.pid)
						return i
				}
				return -1
			}

			function cloneItem(item) { return $.extend({}, item) }
			function swapItem(a, item, b, amount) {
				// swap item from a -> b
				if(amount === 0) return

				var idx = findItem(a, item)
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

			var merchant = this.self_obj

			// a copy of inventories for both parties
			var workingPlayerInventory = {inventory: dudeObject.inventory.map(cloneItem)}
			var workingMerchantInventory = {inventory: merchant.inventory.map(cloneItem)}

			// and our working barter tables
			var playerBarterTable = {inventory: []}
			var merchantBarterTable = {inventory: []}

			function totalAmount(obj) {
				var total = 0
				for(var i = 0; i < obj.inventory.length; i++) {
					total += obj.inventory[i].pro.extra.cost * obj.inventory[i].amount
				}
				return total
			}

			function offer() {
				info("[OFFER]")

				var merchantOffered = totalAmount(merchantBarterTable)
				var playerOffered = totalAmount(playerBarterTable)
				var diffOffered = playerOffered - merchantOffered

				if(diffOffered >= 0) {
					// OK, player offered equal to more more than the value
					info("[OFFER OK]")

					// finalize and apply the deal

					// swap to working inventories
					merchant.inventory = workingMerchantInventory.inventory
					player.inventory = workingPlayerInventory.inventory

					// add in the table items
					for(var i = 0; i < merchantBarterTable.inventory.length; i++)
						objectAddItem(dudeObject, merchantBarterTable.inventory[i], merchantBarterTable.inventory[i].amount)
					for(var i = 0; i < playerBarterTable.inventory.length; i++)
						objectAddItem(merchant, playerBarterTable.inventory[i], playerBarterTable.inventory[i].amount)

					// re-clone so we can continue bartering if necessary
					workingPlayerInventory = {inventory: dudeObject.inventory.map(cloneItem)}
					workingMerchantInventory = {inventory: merchant.inventory.map(cloneItem)}

					playerBarterTable.inventory = []
					merchantBarterTable.inventory = []

					redrawBarterInventory()
				}
				else {
					info("[OFFER REFUSED]")
				}

			}

			function getAmount(item) {
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

			function redrawBarterInventory() {
				//  merchant -> table
				drawInventory($("#inventory"), workingMerchantInventory, function(obj) {
					// var money = objectGetMoney(merchant)
					if(obj.amount > 1)
						 swapItem(workingMerchantInventory, obj, merchantBarterTable, getAmount(obj))
					else swapItem(workingMerchantInventory, obj, merchantBarterTable)
					redrawBarterInventory()
				})

				// player -> table
				drawInventory($("#playerInventory"), workingPlayerInventory, function(obj) {
					if(obj.amount > 1)
						swapItem(workingPlayerInventory, obj, playerBarterTable, getAmount(obj))
					else swapItem(workingPlayerInventory, obj, playerBarterTable)
					redrawBarterInventory()
				})

				// table -> merchant
				drawInventory($("#barterLeft"), merchantBarterTable, function(obj) {
					if(obj.amount > 1)
						swapItem(merchantBarterTable, obj, workingMerchantInventory, getAmount(obj))
					else swapItem(merchantBarterTable, obj, workingMerchantInventory)
					redrawBarterInventory()
				})
				var moneyLeft = totalAmount(merchantBarterTable)
				$("#barterLeft").append($("<span>").css(
					{position: 'absolute', 'left':0, 'bottom': 0}).text(moneyLeft))

				// table -> player
				drawInventory($("#barterRight"), playerBarterTable, function(obj) {
					if(obj.amount > 1)
						swapItem(playerBarterTable, obj, workingPlayerInventory, getAmount(obj))
					else swapItem(playerBarterTable, obj, workingPlayerInventory)
					redrawBarterInventory()
				})
				var moneyRight = totalAmount(playerBarterTable)
				$("#barterRight").append($("<span>").css(
					{position: 'absolute', 'left':0, 'bottom': 0}).text(moneyRight))
				$("#barterRight").append($("<button>").css(
					{position: 'absolute', 'right':0, 'bottom': 0}).text("Offer").click(offer))
				$("#barterRight").append($("<button>").css(
					{position: 'absolute', 'right':0, 'bottom': 25}).text("Talk").click(endBarter))

			}

			redrawBarterInventory()

			stub("gdialog_mod_barter", arguments)
		},
		start_gdialog: function(msgFileID, obj, mood, headNum, backgroundID) {
			log("start_gdialog", arguments)
			info("DIALOGUE START", "dialogue")
			$("#dialogue").css("visibility", "visible").html("[ DIALOGUE INTENSIFIES ]<br>")
			if(!this.self_obj) throw "no self_obj for start_gdialog"
			currentDialogueObject = this.self_obj
			//stub("start_gdialog", arguments)
		},
		gsay_start: function() { stub("gSay_Start", arguments) },
		//gSay_Option: function(msgList, msgID, target, reaction) { stub("gSay_Option", arguments) },
		gsay_reply: function(msgList, msgID) {
			var msg = getScriptMessage(msgList, msgID)
			info("REPLY: " + msg, "dialogue")
			$("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br>")
			//stub("gSay_Reply", arguments)
		},
		gsay_message: function(msgList, msgID, reaction) {
			// message with [Done] option
			if(typeof msgID === "string") { // TODO: is this _really_ allowed? GCPercy uses a string, docs say int
				console.log("MSG: " + msgID + " [DONE] (s)")
				$("#dialogue").append("&nbsp;&nbsp;\"" + msgID + "\"<br>[Done]<br>")
			}
			else {
				var msg = getScriptMessage(msgList, msgID)
				console.log("MSG: " + msg + " [DONE]")
				$("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br>[Done]<br>")
			}
		},
		gsay_end: function() { stub("gSay_End", arguments) },
		end_dialogue: function() { stub("end_dialogue", arguments) },
		giq_option: function(iqTest, msgList, msgID, target, reaction) {
			var msg = getScriptMessage(msgList, msgID)
			console.log("DIALOGUE OPTION: " + msg + " [INT " + ((iqTest >= 0) ? (">="+iqTest) : ("<="+-iqTest)) + "]")
			var that = this
			dialogueOptionProcs.push(function() {
				$("#dialogue").append(msg + "<br>")
				target.call(that)
			})
			$("#dialogue").append("<a href=\"javascript:dialogueReply(" + (dialogueOptionProcs.length-1) + ")\">" + msg + "</a><br>")
			//stub("giQ_Option", arguments)
		},
		dialogue_system_enter: function() {
			log("dialogue_system_enter", arguments)
			if(!this.self_obj) {
				warn("dialogue_system_enter: no self_obj")
				return
			}
			talk(this.self_obj._script, this.self_obj)
		},
		float_msg: function(obj, msg, type) {			
			info("FLOAT MSG: " + msg, "floatMessage")
			var colorMap = {
				// todo: take the exact values from some palette. also, yellow is ugly.
				0: "white", //0: "yellow",
				1: "black",
				2: "red",
				3: "green",
				4: "blue",
				5: "purple",
				6: "white",
				7: "red",
				8: "white",//8: "yellow",
				9: "white",
				10: "dark gray",
				11: "dark gray",
				12: "light gray"
			}
			var color = colorMap[type]
			if(type === -2 /* FLOAT_MSG_WARNING */ || type === -1 /* FLOAT_MSG_SEQUENTIAL */)
				color = colorMap[9]
			floatMessages.push({msg: msg, obj: this.self_obj, startTime: heart.timer.getTime(),
			                    color: color})
		},

		// animation
		reg_anim_func: function(_, _) { stub("reg_anim_func", arguments, "animation") },
		reg_anim_animate: function(obj, anim, delay) { stub("reg_anim_animate", arguments, "animation") },
		reg_anim_animate_forever: function(obj, anim) {
			log("reg_anim_animate_forever", arguments, "animation")
			if(!isGameObject(obj)) {
				warn("reg_anim_animate_forever: not a game object")
				return
			}
			//console.log("ANIM FOREVER: " + obj.art + " / " + anim)
			if(anim !== 0)
				warn("reg_anim_animate_forever: anim = " + anim)
			function animate() { objectSingleAnim(obj, false, animate) }
			animate()
		},
		animate_move_obj_to_tile: function(obj, tile, isRun) {
			log("animate_move_obj_to_tile", arguments, "movement")
			if(!isGameObject(obj)) {
				warn("animate_move_obj_to_tile: not a game object")
				return
			}

			tile = fromTileNum(tile)
			if(critterWalkTo(obj, tile, !!isRun) === false) {
				warn("animate_move_obj_to_tile: no path")
				return
			}
		},

		gfade_out: function(time) { stub("gfade_out", arguments) },
		gfade_in: function(time) { stub("gfade_in", arguments) },

		// timing
		add_timer_event: function(obj, ticks, userdata) {
			if(!isGameObject(obj)) { warn("add_timer_event: not game object: " + obj); return }
			info("timer event added in " + ticks + " ticks (userdata " + userdata + ")", "timer")
			// trigger timedEvent in `ticks` game ticks
			timeEventList.push({ticks: ticks, obj: obj, userdata: userdata, fn: function() {
				timedEvent(obj._script, userdata)
			}.bind(this)})
		},
		rm_timer_event: function(obj) {
		   	log("rm_timer_event", arguments)
		   	info("rm_timer_event: " + obj + ", " + obj.pid)
			for(var i = 0; i < timeEventList.length; i++) {
				if(timeEventList[i].obj.pid === obj.pid) { // TODO: better object equality
					info("removing timed event for obj")
				   	timedEvents.splice(i--, 1)
				    break
				}
			}
		},
		game_ticks: function(seconds) { return seconds*10 },
		game_time_advance: function(ticks) {
			info("advancing time " + ticks + " ticks " + "(" + ticks/10 + " seconds)")
			gameTickTime += ticks
		},

		// game
		load_map: function(map, startLocation) {
			stub("load_map", arguments)
			info("load_map: " + map)
			if(typeof map === "string")
				loadMap(map)
			else
				loadMapID(map)
		},
		play_gmovie: function(movieID) { stub("play_gmovie", arguments) },
		mark_area_known: function(areaType, area, markState) {
			if(areaType === 0) { // MARK_TYPE_TOWN
				switch(markState) {
					case 0: break // MARK_STATE_UNKNOWN
					case 1: // MARK_STATE_KNOWN
						info("TODO: Mark area " + area + " on map")
						return
					case 2: break // MARK_STATE_VISITED
					case -66: break // MARK_STATE_INVISIBLE
				}

				stub("mark_area_known", arguments)
			}
			else if(areaType === 1) { // MARK_TYPE_MAP
				stub("mark_area_known", arguments)
			}
			else throw "mark_area_known: invalid area type " + areaType
		},

		// party
		party_member_obj: function(pid) { stub("party_member_obj", arguments, "party"); return 0 },
		party_add: function(obj) { stub("party_add", arguments) }
	}

	function loadMessageFile(name) {
		info("loading message file: " + name, "load")
		var msg = getFileText("data/text/english/dialog/" + name + ".MSG")
		if(scriptMessages[name] === undefined)
			scriptMessages[name] = {}

		// parse message file
		var lines = msg.split(/\r|\n/)

		// preprocess and merge lines
		for(var i = 0; i < lines.length; i++) {
			// comments/blanks
			if(lines[i][0] === '#' || lines[i].trim() === '') {
				lines.splice(i--, 1)
				continue
			}

			// probably a continuation -- merge it with the last line
			if(lines[i][0] !== '{') {
				lines[i-1] += lines[i]
				lines.splice(i--, 1)
				continue
			}
		}

		for(var i = 0; i < lines.length; i++) {
			// e.g. {100}{}{You have entered a dark cave in the side of a mountain.}
			var m = lines[i].match(/\{(\d+)\}\{.*\}\{(.*)\}/)
			if(m === null)
				throw "message parsing: not a valid line: " + lines[i]
			// HACK: replace unicode replacement character with an apostrophe (because the Web sucks at character encodings)
			scriptMessages[name][m[1]] = m[2].replace(/\ufffd/g, "'")
		}
	}

	function loadScript(name) {
		// e.g. "Raiders2"
		var scriptObject = null
		info("loading script " + name, "load")
		var code = getFileText("scripts/" + name + ".js",
			function() { console.log("script loading error (" + name + ")") })

		//console.log("code: " + code)
		var f = new Function(code)
		f.prototype = ScriptProto
		var obj = new f()
		obj.scriptName = name
		obj.lvars = {}
		scriptObject = obj

		// remove any defined Node999 (exit dialogue) procedures
		// so we can take them over
		if(obj.hasOwnProperty("node999"))
			delete obj.node999

		// same for node998 (combat); some scripts also use this
		// so it would be a good idea to wrap it instead.
		if(obj.hasOwnProperty("node998"))
			delete obj.node998

		if(currentMapObject !== null)
			obj._mapScript = currentMapObject
		else currentMapObject = obj // this is likely our map script loaded first

		return scriptObject
	}

	function initScript(script, obj) {
		obj._script.self_obj = obj
		obj._script.cur_map_index = currentMapID
		if(obj._script.start !== undefined)
			obj._script.start()
	}

	function timedEvent(script, userdata) {
		info("timedEvent: " + script.scriptName + ": " + userdata, "timer")
		if(script.timed_event_p_proc === undefined)
			throw "timedEvent called on script without a timed_event_p_proc!"

		script.fixed_param = userdata
		script.timed_event_p_proc()
	}

	function talk(script, obj) {
		script.self_obj = obj
		script.game_time = Math.max(1, gameTickTime)
		script.cur_map_index = currentMapID

		var r = script.talk_p_proc()
		if(r !== undefined && r._yield !== undefined) {
			// procedure yielded
			info("[procedure yielded]")
			if(script.yieldedFn !== undefined)
				throw "unused yielded fn already exists"
			script.yieldedFn = r._yield
		}
	}

	function updateCritter(script) {
		// critter heartbeat (critter_p_proc)
		if(script.critter_p_proc === undefined)
			return

		script.game_time = gameTickTime
		script.cur_map_index = currentMapID
		script.critter_p_proc()
	}

	function damage(obj, target, source, damage) {
		if(!obj._script) return

		obj._script.self_obj = obj
		obj._script.target_obj = target
		obj._script.source_obj = source
		obj._script.game_time = Math.max(1, gameTickTime)
		obj._script.cur_map_index = currentMapID
		obj._script.damage_p_proc()
	}

	function combatEvent(obj, event) {
		var fixed_param = null
		switch(event) {
			case "turnBegin": fixed_param = 4; break // COMBAT_SUBTYPE_TURN
			default: throw "combatEvent: unknown event " + event
		}

		if(obj._script.combat_p_proc === undefined)
			return

		info("[COMBAT EVENT " + event + "]")

		obj._script.combat_is_initialized = 1
		obj._script.fixed_param = fixed_param
		obj._script.self_obj = obj
		obj._script.game_time = Math.max(1, gameTickTime)
		obj._script.cur_map_index = currentMapID

		// hack so that the procedure is allowed to finish before
		// we actually terminate combat
		var doTerminate = false // did combat_p_proc terminate combat?
		obj._script.terminate_combat = function() { doTerminate = true }
		obj._script.combat_p_proc()

		if(doTerminate === true) {
			console.log("DUH DUH TERMINATE!")
			ScriptProto.terminate_combat.call(obj._script) // call original
		}

		return doTerminate
	}

	function updateMap(mapScript, objects, elevation) {
		gameObjects = objects
		gameElevation = elevation
		mapFirstRun = false

		mapScript.combat_is_initialized = 0
		if(mapScript.map_update_p_proc !== undefined) {
			mapScript.self_obj = {_script: mapScript}
			mapScript.map_update_p_proc()
		}

		var updated = 0
		for(var i = 0; i < gameObjects.length; i++) {
			var script = gameObjects[i]._script
			if(script !== undefined && script.map_update_p_proc !== undefined) {
				script.combat_is_initialized = 0
				script.self_obj = gameObjects[i]
				script.game_time = Math.max(1, gameTickTime)
				script.cur_map_index = currentMapID
				script.map_update_p_proc()
				updated++
			}
		}

		// info("updated " + updated + " objects")
	}

	function enterMap(mapScript, objects, elevation, mapID, isFirstRun) {
		gameObjects = objects
		gameElevation = elevation
		currentMapID = mapID
		mapFirstRun = isFirstRun

		if(mapScript.map_enter_p_proc !== undefined) {
			info("calling map enter")
			mapScript.map_enter_p_proc()
		}

		var updated = 0
		for(var i = 0; i < gameObjects.length; i++) {
			var script = gameObjects[i]._script
			if(script !== undefined && script.map_enter_p_proc !== undefined) {
				script.combat_is_initialized = 0
				script.self_obj = gameObjects[i]
				script.game_time = Math.max(1, gameTickTime)
				script.cur_map_index = currentMapID
				script.map_enter_p_proc()
				updated++
			}
		}
	}

	function reset(dude, mapName) {
		timeEventList.length = 0 // clear timed events
		dialogueOptionProcs.length = 0
		gameObjects = null
		currentMapObject = null
		currentMapID = null

		dudeObject = dude
		ScriptProto.dude_obj = dudeObject
	}

	function init(dude, mapName, mapID) {
		seed(123)
		reset(dude, mapName, mapID)
	}

	return {init: init, enterMap: enterMap, updateMap: updateMap, loadScript: loadScript,
		    dialogueReply: dialogueReply, timedEvent: timedEvent, updateCritter: updateCritter,
		    timeEventList: timeEventList, info: info, reset: reset, talk: talk, damage: damage,
		    globalVars: globalVars, combatEvent: combatEvent, initScript: initScript}
})()
