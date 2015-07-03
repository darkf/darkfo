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

Scripting system/engine for DarkFO
*/

"use strict";

module scriptingEngine {
	var gameObjects: any = null
	var dudeObject: any = null
	var mapVars: any = null
	var globalVars: any = {
		0: 50, // GVAR_PLAYER_REPUTATION
		//10: 1, // GVAR_START_ARROYO_TRIAL (1 = TRIAL_FIGHT)
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
	export var timeEventList = []

	var statMap = {
		0: "STR", 1: "PER", 2: "END", 3: "CHA", 4: "INT",
		5: "AGI", 6: "LUK",
		35: "HP", 7: "Max HP"
	}

	function stub(name, args, type?) {
		if(Config.scripting.debugLogShowType.stub === false || Config.scripting.debugLogShowType[type] === false) return
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		console.log("STUB: " + name + ": " + a)
	}

	function log(name, args, type?) {
		if(Config.scripting.debugLogShowType.log === false || Config.scripting.debugLogShowType[type] === false) return
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		console.log("log: " + name + ": " + a)
	}

	function warn(msg, type?) {
		if(type !== undefined && Config.scripting.debugLogShowType[type] === false) return
		console.log("WARNING: " + msg)
	}

	export function info(msg, type?) {
		if(type !== undefined && Config.scripting.debugLogShowType[type] === false) return
		console.log("INFO: " + msg)
	}

	// http://stackoverflow.com/a/23304189/1958152
	function seed(s) {
	    Math.random = function() {
	        s = Math.sin(s) * 10000; return s - Math.floor(s)
	    }
	}

	export function getGlobalVar(gvar: number): any {
		return (globalVars[gvar] !== undefined) ? globalVars[gvar] : 0
	}

	function isGameObject(obj) {
		// TODO: just use isinstance Obj?
		if(obj === undefined || obj === null) return false
		if(obj.isPlayer === true) return true
		if(obj.type === "item" || obj.type === "critter" || obj.type === "scenery" ||
		   obj.type === "wall" || obj.type === "tile" || obj.type === "misc")
			return true

		//warn("is NOT GO: " + obj.toString())
		console.log("is NOT GO: %o", obj)
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

	export function dialogueReply(id) {
		var f = dialogueOptionProcs[id]
		dialogueOptionProcs = []
		f()
		// by this point we may have already exited dialogue
		if(currentDialogueObject !== null && dialogueOptionProcs.length === 0) {
			// after running the option procedure we have no options...
			// so close the dialogue
			console.log("[dialogue exit via dialogueReply (no replies)]")
			dialogueExit()
		}
	}

	export function dialogueEnd() {
		// dialogue exited from [Done] or the UI
		console.log("[dialogue exit via dialogueExit]")
		dialogueExit()
	}

	function dialogueExit() {
		//$("#dialogue").css("visibility", "hidden") // todo: some sort of transition
		uiEndDialogue()
		info("[dialogue exit]")

		if(currentDialogueObject !== null && currentDialogueObject._script.yieldedFn !== undefined) {
			info("[calling yielded fn]")
			var f = currentDialogueObject._script.yieldedFn
			currentDialogueObject._script.yieldedFn = undefined
			f()
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

	export var ScriptProto = {
		dude_obj: "<Dude Object>",
		'true': true,
		'false': false,
		_didOverride: false,

		floor: function(x) { return Math.floor(x) }, // TODO: does the language have floats? Are we handling division incorrectly?

		set_global_var: function(gvar, value) {
			globalVars[gvar] = value
			info("set_global_var: " + gvar + " = " + value, "gvars")
			log("set_global_var", arguments, "gvars")
		},
		set_local_var: function(lvar, value) {
			this.lvars[lvar] = value
			info("set_local_var: " + lvar + " = " + value + " [" + this.scriptName + "]", "lvars")
			log("set_local_var", arguments, "lvars")
		},
		local_var: function(lvar) {
			log("local_var", arguments, "lvars")
			if(this.lvars[lvar] === undefined) {
				warn("local_var: setting default value (0) for LVAR " + lvar, "lvars")
				this.lvars[lvar] = 0
			}
			return this.lvars[lvar]
		},
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
				warn("map_var: setting default value (0) for MVAR " + mvar, "mvars")
				mapVars[scriptName][mvar] = 0
			}
			return mapVars[scriptName][mvar]
		},
		set_map_var: function(mvar, value) {
			var scriptName = this._mapScript.scriptName
			if(scriptName === undefined) {
				warn("map_var: map script has no name")
				return
			}
			info("set_map_var: " + mvar + " = " + value, "mvars")
			if(mapVars[scriptName] === undefined)
				mapVars[scriptName] = {}
			mapVars[scriptName][mvar] = value
		},
		global_var: function(gvar) {
			if(globalVars[gvar] === undefined) {
				warn("global_var: unknown gvar " + gvar + ", using default (0)", "gvars")
				globalVars[gvar] = 0
			}
			return globalVars[gvar]
		},
		random: function(min, max) { log("random", arguments); return getRandomInt(min, max) },
		debug_msg: function(msg) { log("debug_msg", arguments); info("DEBUG MSG: [" + this.scriptName + "]: " + msg, "debugMessage") },
		display_msg: function(msg) { log("display_msg", arguments); info("DISPLAY MSG: " + msg, "displayMessage"); uiLog(msg) },
		message_str: function(msgList, msgNum) { return getScriptMessage(msgList, msgNum) },
		metarule: function(id, target): any {
			switch(id) {
				case 14: return mapFirstRun // map_first_run
				case 15: // elevator
					if(target !== -1)
						throw "elevator given explicit type"
					useElevator()
					break
				case 17: stub("metarule", arguments); return 0  // is area known? (TODO)
				case 18: return 0 // is the critter under the influence of drugs? (TODO)
				case 22: return 0 // is_game_loading
				case 48: return 2 // METARULE_VIOLENCE_FILTER (2 = VLNCLVL_NORMAL)
				case 49: // METARULE_W_DAMAGE_TYPE
					switch(objectGetDamageType(target)) {
						case "explosion": return 6 // DMG_explosion
						default: throw "unknown damage type"
					}
				default: stub("metarule", arguments)
			}
		},
		metarule3: function(id, obj, userdata, radius): any {
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
			else if(id === 106) { // METARULE3_TILE_GET_NEXT_CRITTER
				// As far as I know, with lastCritter == 0, it just grabs the critter that is not the player at the tile. TODO: Test this!
				var tile = obj, elevation = userdata, lastCritter = radius
				var objs = objectsAtPosition(fromTileNum(tile))
				log("metarule3 106 (tile_get_next_critter)", arguments)
				for(var i = 0; i < objs.length; i++) {
					if(objs[i].type === "critter" && !(<Critter>objs[i]).isPlayer)
						return objs[i]
				}
				return 0 // no critter found at that position (TODO: test)
			}

			stub("metarule3", arguments)
		},
		script_overrides: function() {
			log("script_overrides", arguments)
			info("[SCRIPT OVERRIDES]")
			this._didOverride = true
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

			if(traitType === 1) {
				switch(trait) {
					case 5: break // OBJECT_AI_PACKET (TODO)
					case 6: break // OBJECT_TEAM_NUM (TODO)
					case 10: return obj.orientation // OBJECT_CUR_ROT
					case 666: // OBJECT_VISIBILITY
						return (obj.visible === false) ? 0 : 1 // 1 = visible, 0 = invisible
					case 669: break // OBJECT_CUR_WEIGHT (TODO)
				}
			}

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
			log("obj_is_carrying_obj_pid", arguments)
			if(!isGameObject(obj)) {
				warn("obj_is_carrying_obj_pid: not a game object")
				return 0
			} else if(obj.inventory === undefined) {
				warn("obj_is_carrying_obj_pid: object has no inventory!")
				return 0
			}

			//info("obj_is_carrying_obj_pid: " + pid, "inventory")
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

			//info("add_mult_objs_to_inven: " + count + " counts of " + item.toString(), "inventory")
			console.log("add_mult_objs_to_inven: %d counts of %o to %o", count, item, obj)
			obj.addInventoryItem(item, count)
			drawPlayerInventory()
		},
		rm_mult_objs_from_inven: function(obj, item, count) { // Remove count copies of item from obj's inventory
			stub("rm_mult_objs_from_inven", arguments)
		},
		add_obj_to_inven: function(obj, item) {
			this.add_mult_objs_to_inven(obj, item, 1)
		},
		rm_obj_from_inven: function(obj, item) {
			this.rm_mult_objs_from_inven(obj, item, 1)
		},
		obj_carrying_pid_obj: function(obj, pid) {
			log("obj_carrying_pid_obj", arguments)
			if(!isGameObject(obj)) {
				warn("obj_carrying_pid_obj: not a game object: " + obj)
				return 0
			}

			for(var i = 0; i < obj.inventory.length; i++) {
				if(obj.inventory[i].pid === pid)
					return 1
			}	
			return 0
		},
		elevation: function(obj) { if(isGameObject(obj) || (obj && obj.isSpatial)) return currentElevation
								   else { warn("elevation: not an object: " + obj); return -1 } },
		obj_can_see_obj: function(a, b) { /*stub("obj_can_see_obj", arguments);*/ return 0 },
		obj_can_hear_obj: function(a, b) { /*stub("obj_can_hear_obj", arguments);*/ return 0 },
		has_skill: function(obj, skill) { stub("has_skill", arguments); return 100 },
		roll_vs_skill: function(obj, skill, bonus) { stub("roll_vs_skill", arguments); return 1 },
		do_check: function(obj, check, modifier) { stub("do_check", arguments); return 1 },
		is_success: function(roll) { stub("is_success", arguments); return 1 },
		is_critical: function(roll) { stub("is_critical", arguments); return 0 },
		critter_inven_obj: function(obj, where) {
			if(!isGameObject(obj)) throw "critter_inven_obj: not game object"
			if(where === 0) {} // INVEN_TYPE_WORN
			else if(where === 1) return obj.rightHand // INVEN_TYPE_RIGHT_HAND
			else if(where === 2) return obj.leftHand // INVEN_TYPE_LEFT_HAND
			else if(where === -2) throw "INVEN_TYPE_INV_COUNT"
			stub("critter_inven_obj", arguments)
			return undefined
		},
		critter_attempt_placement: function(obj, tile, elevation) { stub("critter_attempt_placement", arguments) },
		critter_state: function(obj) {
			/*stub("critter_state", arguments);*/
			if(!isGameObject(obj)) {
				warn("critter_state: not game object: " + obj)
				return 0
			}

			var state = 0
			if(obj.dead === true)
				state |= 1
			// TODO: if obj is prone, state |= 2

			return state
		},
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
		critter_is_fleeing: function(obj) { stub("critter_is_fleeing", arguments); return 0 },
		wield_obj_critter: function(obj, item) { stub("wield_obj_critter", arguments) },
		critter_dmg: function(obj, damage, damageType) {
			if(!isGameObject(obj)) {
				warn("critter_dmg: not game object: " + obj)
				return
			}
			critterDamage(obj, damage, this.self_obj, true, true, damageType)
		},
		poison: function(obj, amount) { stub("poison", arguments) },
		radiation_dec: function(obj, amount) { stub("radiation_dec", arguments) },

		// combat
		attack_complex: function(obj, calledShot, numAttacks, bonus, minDmg, maxDmg, attackerResults, targetResults) {
			info("[enter combat via attack_complex]")
			//stub("attack_complex", arguments)
			// since this isn't actually used beyond its basic form, we're not going to bother
			// implementing all of it

			// begin combat, turn starting with us
			Combat.start(this.self_obj)
		},
		terminate_combat: function() {
			info("[terminate_combat]")
			combat.end()
		},
		critter_set_flee_state: function(obj, isFleeing) { stub("critter_set_flee_state", arguments) },

		// objects
		obj_is_locked: function(obj: Obj) { log("obj_is_locked", arguments); return obj.locked ? 1 : 0 },
		obj_lock: function(obj: Obj) { log("obj_lock", arguments); obj.locked = true },
		obj_unlock: function(obj: Obj) { log("obj_unlock", arguments); obj.locked = false },
		obj_is_open: function(obj) {
			info("obj_is_open")
			if(!isGameObject(obj)) {
				warn("obj_is_open: not game object: " + obj)
				return 0
			}
			return obj.open ? 1 : 0
		},
		obj_close: function(obj: Obj) {
			if(!isGameObject(obj)) {
				warn("obj_close: not game object: " + obj)
				return 0
			}
			info("obj_close")
			if(!obj.open) return
			useObject(obj, this.self_obj, false)
			//stub("obj_close", arguments)
		},
		obj_open: function(obj: Obj) {
			if(!isGameObject(obj)) {
				warn("obj_open: not game object: " + obj)
				return 0
			}
			info("obj_open")
			if(obj.open) return
			useObject(obj, this.self_obj, false)
			//stub("obj_open", arguments)
		},
		proto_data: function(pid:number, data_member:number) { stub("proto_data", arguments); return null },
		create_object_sid: function(pid, tile, elev, sid) { // Create object of pid and possibly script
			info("create_object_sid: pid=" + pid + " tile=" + tile + " elev=" + elev + " sid=" + sid)

			if(elev < 0 || elev > 2)
				throw "create_object_sid: elev out of range: elev=" + elev

			var obj = createObjectWithPID(pid, sid)
			if(!obj) {
				warn("create_object_sid: couldn't create object")
				return null
			}
			obj.position = fromTileNum(tile)

			//stub("create_object_sid", arguments)

			// TODO: if tile is valid...
			/*if(elevation !== currentElevation) {
				warn("create_object_sid: want to create object on another elevation (current=" + currentElevation + ", elev=" + elevation + ")")
				return
			}*/


			// add it to the map
			gMap.addObject(obj, elev)

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
			log("anim_busy", arguments)
			if(!isGameObject(obj)) {
				warn("anim_busy: not game object: " + obj)
				return false
			}
			return obj.inAnim()
		},
		obj_art_fid: function(obj) { stub("obj_art_fid", arguments); return 0 },
		art_anim: function(fid:number):number { stub("art_anim", arguments); return 0 },
		set_obj_visibility: function(obj, visibility) {
			if(!isGameObject(obj)) {
				warn("set_obj_visibility: not a game object: " + obj)
				return
			}

			obj.visible = !visibility
		},
		use_obj_on_obj: function(obj, who) { stub("use_obj_on_obj", arguments) },
		use_obj: function(obj) { stub("use_obj", arguments) },
		anim: function(obj, anim, direction) {
			if(!isGameObject(obj)) {
				warn("anim: not a game object: " + obj)
				return
			}
			stub("anim", arguments)
			if(anim === 1000) // set rotation
				obj.orientation = direction
		},

		// environment
		set_light_level: function(level) { stub("set_light_level", arguments) },
		obj_set_light_level: function(obj, intensity, distance) { stub("obj_set_light_level", arguments) },
		override_map_start: function(x, y, elevation, rotation) {
			stub("override_map_start", arguments)
			if(elevation !== currentElevation)
				gMap.changeElevation(elevation, true)
			dudeObject.position = {x: x, y: y}
			dudeObject.orientation = rotation
			centerCamera(dudeObject.position)
		},
		obj_pid: function(obj) {
			if(!isGameObject(obj)) {
				warn("obj_pid: not game object: " + obj)
				return null
			}
			return obj.pid
		},
		obj_on_screen: function(obj) {
			log("obj_on_screen", arguments)
			if(!isGameObject(obj)) {
				warn("obj_on_screen: not a game object: " + obj)
				return 0
			}
			return objectOnScreen(obj) ? 1 : 0
		},
		obj_type: function(obj) {
			if(!isGameObject(obj)) { warn("obj_type: not game object: " + obj); return }
			else if(obj.isPlayer) return 1 // critter
			else if(obj.pid === undefined) { warn("obj_type: no PID"); return }
			return (obj.pid >> 24) & 0xff
		},
		destroy_object: function(obj) { // destroy object from world
			log("destroy_object", arguments)
			gMap.destroyObject(obj)
		},
		set_exit_grids: function(onElev, mapID, elevation, tileNum, rotation) {
			stub("set_exit_grids", arguments)
			for(var i = 0; i < gameObjects.length; i++) {
				var obj = gameObjects[i]
				if(obj.type === "misc" && obj.extra && obj.extra.exitMapID !== undefined) {
					obj.extra.exitMapID = mapID
					obj.extra.startingPosition = tileNum
					obj.extra.startingElevation = elevation
				}
			}
		},

		// tiles
		tile_distance_objs: function(a, b) {
			if((!isGameObject(a) || !isGameObject(b)) && (a && !a.isSpatial && b && !b.isSpatial)) {
				warn("tile_distance_objs: " + a + " or " + b + " are not game objects")
				return
			}
			return hexDistance(a.position, b.position)
		},
		tile_distance: function(a, b) {
			if(a === -1 || b === -1)
				return 9999
			return hexDistance(fromTileNum(a), fromTileNum(b))
		},
		tile_num: function(obj) {
			if(!isGameObject(obj) || (!obj || obj.isSpatial)) {
				warn("tile_num: not a game object: " + obj)
				return null
			}
			return toTileNum(obj.position)
		},
		tile_contains_pid_obj: function(tile, elevation, pid): any {
			stub("tile_contains_pid_obj", arguments, "tiles")
			var pos = fromTileNum(tile)
			var objects = gMap.getObjects(elevation)
			for(var i = 0; i < objects.length; i++) {
				if(objects[i].position.x === pos.x && objects[i].position.y === pos.y &&
				   objects[i].pid === pid) {
					return objects[i]
				}
			}
			return 0 // it's not there
		},
		tile_num_in_direction: function(tile, direction, distance) {
			if(distance === 0) {
				//warn("tile_num_in_direction: distance=" + distance)
				return -1
			}
			tile = hexInDirection(fromTileNum(tile), direction)
			for(var i = 0; i < distance-1; i++) // repeat for each further distance
				tile = hexInDirection(tile, direction)
			return toTileNum(tile)
		},
		tile_in_tile_rect: function(ul, ur, ll, lr, t) {
			//stub("tile_in_tile_rect", arguments, "tiles")
			ul = fromTileNum(ul); ur = fromTileNum(ur)
			ll = fromTileNum(ll); lr = fromTileNum(lr)
			t = fromTileNum(t)
			return (tile_in_tile_rect(t, ur, lr, ll, ul) ? 1 : 0)
		},
		tile_contains_obj_pid: function(tile, elevation, pid) {
			if(elevation !== currentElevation) {
				warn("tile_contains_obj_pid: not same elevation")
				return 0
			}
			var objs = objectsAtPosition(fromTileNum(tile))
			for(var i = 0; i < objs.length; i++) {
				if(objs[i].pid === pid)
					return 1
			}
			return 0
		},
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
			if(elevation !== currentElevation) {
				info("move_to: moving to elevation " + elevation)
				gMap.removeObject(obj)
				gMap.addObject(obj, elevation)
			}
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
			log("gdialog_mod_barter", arguments)
			console.log("--> barter mode")
			if(!this.self_obj) throw "need self_obj"
			uiBarterMode(this.self_obj)
		},
		start_gdialog: function(msgFileID, obj, mood, headNum, backgroundID) {
			log("start_gdialog", arguments)
			info("DIALOGUE START", "dialogue")
			//$("#dialogue").css("visibility", "visible").html("[ DIALOGUE INTENSIFIES ]<br>")
			if(!this.self_obj) throw "no self_obj for start_gdialog"
			currentDialogueObject = this.self_obj
		    uiStartDialogue(false, this.self_obj)
			//stub("start_gdialog", arguments)
		},
		gsay_start: function() { stub("gSay_Start", arguments) },
		//gSay_Option: function(msgList, msgID, target, reaction) { stub("gSay_Option", arguments) },
		gsay_reply: function(msgList, msgID) {
			log("gSay_Reply", arguments)
			var msg = getScriptMessage(msgList, msgID)
			info("REPLY: " + msg, "dialogue")
			//$("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br>")
			uiSetDialogueReply(msg)
		},
		gsay_message: function(msgList, msgID, reaction) {
			// TODO: update this for ui
			log("gsay_message", arguments)
			// message with [Done] option
			var msg = msgID
			if(typeof msgID !== "string")
				msg = getScriptMessage(msgList, msgID)
			$("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br><a href=\"javascript:dialogueEnd()\">[Done]</a><br>")
		},
		gsay_end: function() { stub("gSay_End", arguments) },
		end_dialogue: function() { stub("end_dialogue", arguments) },
		giq_option: function(iqTest, msgList, msgID, target, reaction) {
			log("giQ_Option", arguments)
			var msg = getScriptMessage(msgList, msgID)
			info("DIALOGUE OPTION: " + msg +
				 " [INT " + ((iqTest >= 0) ? (">="+iqTest) : ("<="+-iqTest)) + "]", "dialogue")

			var INT = critterGetStat(dudeObject, "INT")
			if((iqTest > 0 && INT < iqTest) || (iqTest < 0 && INT > -iqTest))
				return // not enough intelligence for this option

			dialogueOptionProcs.push(target.bind(this))
			uiAddDialogueOption(msg, dialogueOptionProcs.length - 1)
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
			log("float_msg", arguments)
			//info("FLOAT MSG: " + msg, "floatMessage")
			if(!isGameObject(obj)) {
				warn("float_msg: not game object: " + obj)
				return
			}
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
		reg_anim_func: function(_1, _2) { stub("reg_anim_func", arguments, "animation") },
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
		animate_move_obj_to_tile: function(obj, tileNum, isRun) {
			log("animate_move_obj_to_tile", arguments, "movement")
			if(!isGameObject(obj)) {
				warn("animate_move_obj_to_tile: not a game object")
				return
			}
			// XXX: is this correct? FCMALPNK passes a procedure name
			// but is it a call (wouldn't make sense for NOption) or
			// a procedure reference that this should call?
			if(typeof(tileNum) === "function")
				tileNum = tileNum.call(this)
			if(isNaN(tileNum)) {
				warn("animate_move_obj_to_tile: invalid tile num")
				return
			}

			var tile = fromTileNum(tileNum)
			if(tile.x < 0 || tile.x >= 200 || tile.y < 0 || tile.y >= 200) {
				warn("animate_move_obj_to_tile: invalid tile: " + tile.x +
				      ", " + tile.y + " (" + tileNum + ")")
				console.trace()
				return
			}
			if(!obj.walkTo(tile, !!isRun)) {
				warn("animate_move_obj_to_tile: no path", "movement")
				return
			}
		},
		reg_anim_obj_move_to_tile: function(obj, tileNum, delay) { stub("reg_anim_obj_move_to_tile", arguments, "movement") },
		explosion: function(tile, elevation, damage) { stub("explosion", arguments) },

		gfade_out: function(time) { stub("gfade_out", arguments) },
		gfade_in: function(time) { stub("gfade_in", arguments) },

		// timing
		add_timer_event: function(obj, ticks, userdata) {
			log("add_timer_event", arguments)
			if(!obj || !obj._script) {
				warn("add_timer_event: not a scriptable object: " + obj)
				return
			}
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
				   	timeEventList.splice(i--, 1)
				    break
				}
			}
		},
		game_ticks: function(seconds) { return seconds*10 },
		game_time_advance: function(ticks) {
			log("game_time_advance", arguments)
			info("advancing time " + ticks + " ticks " + "(" + ticks/10 + " seconds)")
			gameTickTime += ticks
		},

		// game
		load_map: function(map, startLocation) {
			log("load_map", arguments)
			info("load_map: " + map)
			if(typeof map === "string")
				gMap.loadMap(map.split(".")[0].toLowerCase())
			else
				gMap.loadMapByID(map)
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
		game_ui_disable: function() { stub("game_ui_disable", arguments) },
		game_ui_enable: function() { stub("game_ui_enable", arguments) },

		// sound
		play_sfx: function(sfx) { stub("play_sfx", arguments) },

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

	export function loadScript(name: string) {
		var obj = null

		info("loading script " + name, "load")

		var path = "data/scripts/" + name.toLowerCase() + ".int"
		var data: DataView = getFileBinarySync(path)
		var reader = new BinaryReader(data)
		console.log("[%s] loaded %d bytes", name, reader.length)
		var intfile = parseIntFile(reader)

		console.log("%s int file: %o", name, intfile)
		
		reader.seek(0)
		var vm = new ScriptVMBridge.GameScriptVM(reader, intfile, obj)
		vm.run()

		vm.scriptObj.scriptName = name
		vm.scriptObj.lvars = {}

		// return the scriptObj, which is a clone of ScriptProto
		// which will be patched by the GameScriptVM to allow
		// transparent procedure calls
		return vm.scriptObj
	}

	/*export function loadScript(name) {
		// e.g. "Raiders2"
		var scriptObject = null
		info("loading script " + name, "load")
		var code = getFileText("scripts/" + name + ".js",
			function() { console.log("script loading error (" + name + ")") })

		//console.log("code: " + code)
		var f: any = new Function(code)
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
		else {
			// this is likely our map script loaded first
			currentMapObject = obj
			obj._mapScript = obj
		}

		return scriptObject
	}*/

	export function initScript(script, obj) {
		obj._script.self_obj = obj
		obj._script.cur_map_index = currentMapID
		if(obj._script.start !== undefined)
			obj._script.start()
	}

	export function timedEvent(script, userdata) {
		info("timedEvent: " + script.scriptName + ": " + userdata, "timer")
		if(script.timed_event_p_proc === undefined)
			throw "timedEvent called on script without a timed_event_p_proc!"

		script.fixed_param = userdata
		script._didOverride = false
		script.timed_event_p_proc()
		return script._didOverride
	}

	export function use(obj, source) {
		if(!obj._script || obj._script.use_p_proc === undefined)
			return null

		obj._script.source_obj = source
		obj._script.self_obj = obj
		obj._script._didOverride = false
		obj._script.use_p_proc()
		return obj._script._didOverride
	}

	export function talk(script, obj) {
		script.self_obj = obj
		script.game_time = Math.max(1, gameTickTime)
		script.cur_map_index = currentMapID
		script._didOverride = false

		var r = script.talk_p_proc()
		if(r !== undefined && r._yield !== undefined) {
			// procedure yielded
			info("[procedure yielded]")
			if(script.yieldedFn !== undefined)
				throw "unused yielded fn already exists"
			script.yieldedFn = r._yield
		}

		return script._didOverride
	}

	export function updateCritter(script, obj) {
		// critter heartbeat (critter_p_proc)
		if(script.critter_p_proc === undefined)
			return

		script.game_time = gameTickTime
		script.cur_map_index = currentMapID
		script._didOverride = false
		script.self_obj = obj
		script.self_tile = toTileNum(obj.position)
		script.critter_p_proc()
		return script._didOverride
	}

	export function spatial(spatialObj, source) {
		var script = spatialObj._script
		if(script.spatial_p_proc === undefined)
			throw "spatial script without a spatial_p_proc triggered"

		script.game_time = gameTickTime
		script.cur_map_index = currentMapID
		script.source_obj = source
		script.self_obj = spatialObj
		script.spatial_p_proc()
	}

	export function destroy(obj, source) {
		if(!obj._script || obj._script.destroy_p_proc === undefined)
			return null

		obj._script.self_obj = obj
		obj._script.source_obj = source
		obj._script.game_time = Math.max(1, gameTickTime)
		obj._script.cur_map_index = currentMapID
		obj._script._didOverride = false
		obj._script.destroy_p_proc()
		return obj._script._didOverride
	}

	export function damage(obj, target, source, damage) {
		if(!obj._script || obj._script.damage_p_proc === undefined)
			return null

		obj._script.self_obj = obj
		obj._script.target_obj = target
		obj._script.source_obj = source
		obj._script.game_time = Math.max(1, gameTickTime)
		obj._script.cur_map_index = currentMapID
		obj._script._didOverride = false
		obj._script.damage_p_proc()
		return obj._script._didOverride
	}

	export function useSkillOn(who: Critter, skillId: number, obj: Obj): boolean {
		obj._script.self_obj = obj
		obj._script.source_obj = who
		obj._script.cur_map_index = currentMapID
		obj._script._didOverride = false
		obj._script.action_being_used = skillId
		obj._script.use_skill_on_p_proc()
		return obj._script._didOverride
	}

	export function combatEvent(obj, event) {
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
		obj._script._didOverride = false

		// TODO: script_overrides

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

	export function updateMap(mapScript, objects, elevation) {
		gameObjects = objects
		mapFirstRun = false

		mapScript.combat_is_initialized = inCombat ? 1 : 0
		if(mapScript.map_update_p_proc !== undefined) {
			mapScript.self_obj = {_script: mapScript}
			mapScript.map_update_p_proc()
		}

		var updated = 0
		for(var i = 0; i < gameObjects.length; i++) {
			var script = gameObjects[i]._script
			if(script !== undefined && script.map_update_p_proc !== undefined) {
				script.combat_is_initialized = inCombat ? 1 : 0
				script.self_obj = gameObjects[i]
				script.game_time = Math.max(1, gameTickTime)
				script.game_time_hour = 1200 // hour of the day
				script.cur_map_index = currentMapID
				script.map_update_p_proc()
				updated++
			}
		}

		// info("updated " + updated + " objects")
	}

	export function enterMap(mapScript, objects, elevation, mapID, isFirstRun) {
		gameObjects = objects
		currentMapID = mapID
		mapFirstRun = isFirstRun

		if(mapScript.map_enter_p_proc !== undefined) {
			info("calling map enter")
			mapScript.self_obj = {_script: mapScript}
			mapScript.map_enter_p_proc()
		}

		// XXX: caller should do this for all objects, which is better?
		/*for(var i = 0; i < gameObjects.length; i++) {
			objectEnterMap(gameObjects[i], elevation, mapID)			
		}*/
	}

	export function objectEnterMap(obj: Obj, elevation: number, mapID: number) {
		var script = obj._script
		if(script !== undefined && script.map_enter_p_proc !== undefined) {
			script.combat_is_initialized = 0
			script.self_obj = obj
			script.game_time = Math.max(1, gameTickTime)
			script.game_time_hour = 1200 // hour of the day
			script.cur_map_index = currentMapID
			script.map_enter_p_proc()
		}
	}

	export function reset(dude, mapName, mapID?: number) {
		timeEventList.length = 0 // clear timed events
		dialogueOptionProcs.length = 0
		gameObjects = null
		currentMapObject = null
		currentMapID = (mapID !== undefined) ? mapID : null
		mapVars = {}

		dudeObject = dude
		ScriptProto.dude_obj = dudeObject
	}

	export function init(dude: any, mapName: string, mapID?: number) {
		seed(123)
		reset(dude, mapName, mapID)
	}
}
