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
		88: 0, // GVAR_VAULT_RAIDERS
	}
	var scriptIDs = {
		800: "Raiders2",
		14: "GENERIC",
		825: "FCGUNMER",
	}
	var scriptMessages = {}
	var dialogueOptionProcs = []

	function stub(name, args) {
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		console.log("STUB: " + name + ": " + a)
	}

	function log(name, args) {
		var a = ""
		for(var i = 0; i < args.length; i++)
			if(i === args.length-1) a += args[i]
			else a += args[i] + ", "
		//console.log("log: " + name + ": " + a)
	}

	function warn(msg) {
		console.log("WARNING: " + msg)
	}

	function info(msg) {
		console.log("INFO: " + msg)
	}

	// http://stackoverflow.com/a/23304189/1958152
	function seed(s) {
	    Math.random = function() {
	        s = Math.sin(s) * 10000; return s - Math.floor(s)
	    }
	}

	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min
	}

	function isGameObject(obj) {
		if(obj.isPlayer) return true
		for(var i = 0; i < gameObjects.length; i++) {
			if(gameObjects[i] === obj) {
				console.log("is GO: " + obj.toString())
				return true
			}
		}
		console.log("is NOT GO: " + obj.toString())
		return false
	}

	function getScriptMessage(id, msg) {
		if(scriptIDs[id] === undefined) {
			warn("getScriptMessage: no script with ID " + id)
			return null
		}

		if(scriptMessages[scriptIDs[id]] === undefined)
			loadMessageFile(scriptIDs[id])
		if(scriptMessages[scriptIDs[id]] === undefined)
			throw "getScriptMessage: loadMessageFile failed?"
		if(scriptMessages[scriptIDs[id]][msg] === undefined)
			throw "getScriptMessage: no message " + msg + " for script " + id + " (" + scriptIDs[id] + ")"

		return scriptMessages[scriptIDs[id]][msg]
	}

	function dialogueReply(id) {
		dialogueOptionProcs[id]()
	}

	function dialogueExit() {
		$("#dialogue").css("visibility", "hidden") // todo: some sort of transition
		dialogueOptionProcs = []
	}

	var ScriptProto = {
		dude_obj: "<Dude Object>",
		'true': true,
		'false': false,
		set_global_var: function(gvar, value) {
			globalVars[gvar] = value
			info("set_global_var: " + gvar + " = " + value)
		},
		set_local_var: function(lvar, value) { stub("set_local_var", arguments) },
		local_var: function(lvar) { stub("local_var", arguments) },
		map_var: function(mvar) {
			if(mapVars[this.scriptName] !== undefined && mapVars[this.scriptName][mvar] !== undefined)
				return mapVars[this.scriptName][mvar]
			warn("map_var: unknown mvar " + mvar + " on script " + this.scriptName)
		},
		set_map_var: function(mvar, value) {
			if(mapVars[this.scriptName] === undefined)
				mapVars[this.scriptName] = {}
			mapVars[this.scriptName][mvar] = value
		},
		global_var: function(gvar) {
			if(globalVars[gvar] === undefined) {
				warn("global_var: unknown gvar " + gvar)
				return null
			}
			return globalVars[gvar]
		},
		random: function(min, max) { log("random", arguments); return getRandomInt(min, max) },
		debug_msg: function(msg) { console.log("DEBUG MSG: " + msg) },
		display_msg: function(msg) { console.log("DISPLAY MSG: " + msg) },
		message_str: function(msgList, msgNum) { return getScriptMessage(msgList, msgNum) },
		metarule: function(_, _) { stub("metarule", arguments) }, // ???

		// player
		give_exp_points: function(xp) { stub("give_exp_points", arguments) },

		// critters
		get_critter_stat: function(obj, stat) { stub("get_critter_stat", arguments); return 10 },
		has_trait: function(traitType, obj, trait) { stub("has_trait", arguments) },
		critter_add_trait: function(obj, traitType, trait, amount) { stub("critter_add_trait", arguments) },
		item_caps_total: function(obj) { stub("item_caps_total", arguments) },
		item_caps_adjust: function(obj, amount) { stub("item_caps_adjust", arguments) },
		move_obj_inven_to_obj: function(obj, other) { stub("move_obj_inven_to_obj", arguments) },
		elevation: function(obj) { if(isGameObject(obj)) return currentElevation
								   else { warn("elevation: not an object: " + obj.toString()); return -1 } },

		// environment
		set_light_level: function(level) { stub("set_light_level", arguments) },
		override_map_start: function(x, y, elevation, rotation) { stub("override_map_start", arguments) },

		// tiles
		tile_distance_objs: function(a, b) { stub("tile_distance_objs", arguments) },
		tile_distance: function(a, b) { stub("tile_distance", arguments) },
		tile_num: function(obj) { stub("tile_num", arguments) },
		tile_contains_pid_obj: function(tile, elevation, pid) { stub("tile_contains_pid_obj", arguments) },

		// dialogue
		Node999: function() { // exit dialogue
			dialogueExit()
		},
		gdialog_set_barter_mod: function(mod) { stub("gdialog_set_barter_mod", arguments) },
		gdialog_mod_barter: function(mod) { stub("gdialog_mod_barter", arguments) }, // todo: switch to barter mode
		start_gdialog: function(msgFileID, obj, mood, headNum, backgroundID) {
			$("#dialogue").css("visibility", "visible").html("[ DIALOGUE INTENSIFIES ]<br>")
			stub("start_gdialog", arguments)
		},
		gSay_Start: function() { stub("gSay_Start", arguments) },
		//gSay_Option: function(msgList, msgID, target, reaction) { stub("gSay_Option", arguments) },
		gSay_Reply: function(msgList, msgID) {
			var msg = getScriptMessage(msgList, msgID)
			console.log("REPLY: " + msg)
			$("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br>")
			stub("gSay_Reply", arguments)
		},
		gSay_End: function() { stub("gSay_End", arguments) },
		end_dialogue: function() { stub("end_dialogue", arguments) },
		giQ_Option: function(iqTest, msgList, msgID, target, reaction) {
			var msg = getScriptMessage(msgList, msgID)
			console.log("DIALOGUE OPTION: " + msg + " [INT " + ((iqTest >= 0) ? (">="+iqTest) : ("<="+-iqTest)) + "]")
			var that = this
			dialogueOptionProcs.push(function() {
				$("#dialogue").append(msg + "<br>")
				target.call(that)
			})
			$("#dialogue").append("<a href=\"javascript:dialogueReply(" + (dialogueOptionProcs.length-1) + ")\">" + msg + "</a><br>")
			stub("giQ_Option", arguments)
		},

		// animation
		reg_anim_func: function(_, _) { stub("reg_anim_func", arguments) },
		reg_anim_animate_forever: function(obj, anim) {
			if(!isGameObject(obj)) return
			//console.log("ANIM FOREVER: " + obj.art + " / " + anim)
			stub("reg_anim_animate_forever", arguments)
		},

		// party
		party_member_obj: function(pid) { stub("party_member_obj", arguments); return 0 }
	}

	function loadMessageFile(name) {
		console.log("loading message file: " + name)
		$.get("data/text/english/dialog/" + name + ".MSG", function(msg) {
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
				var m = lines[i].match(/\{(\d+)\}\{\}\{(.*)\}/)
				if(m === null)
					throw "message parsing: not a valid line: " + lines[i]
				scriptMessages[name][m[1]] = m[2]
			}
		}, "text").fail(function(err) { console.log("message loading error: "  + err) })
	}

	function loadScript(name) {
		// e.g. "Raiders2"
		var scriptObject = null
		console.log("loading script " + name)
		$.get(name + ".js", function(code) {
			//console.log("code: " + code)
			var f = new Function(code)
			f.prototype = ScriptProto
			var obj = new f()
			obj.scriptName = name
			scriptObject = obj
			console.log('script obj: ' + obj)

			// remove any defined Node999 (exit dialogue) procedures
			// so we can take them over
			if(obj.hasOwnProperty("Node999"))
				delete obj.Node999

		}, "text").fail(function(err) { console.log("script loading error: "  + err) })

		return scriptObject
	}

	function updateMap(mapScript, objects, elevation) {
		gameObjects = objects
		gameElevation = elevation

		mapScript.combat_is_initialized = 0
		if(mapScript.map_update_p_proc !== undefined)
			mapScript.map_update_p_proc()

		var updated = 0
		for(var i = 0; i < gameObjects.length; i++) {
			var script = gameObjects[i]._script
			if(script !== undefined && script.map_update_p_proc !== undefined) {
				script.combat_is_initialized = 0
				script.self_obj = gameObjects[i]
				script.map_update_p_proc()
				updated++
			}
		}

		// info("updated " + updated + " objects")
	}

	function enterMap(mapScript, objects, elevation) {
		gameObjects = objects
		gameElevation = elevation

		if(mapScript.map_enter_p_proc !== undefined) {
			console.log("calling map enter")
			mapScript.map_enter_p_proc()
		}

		var updated = 0
		for(var i = 0; i < gameObjects.length; i++) {
			var script = gameObjects[i]._script
			if(script !== undefined && script.map_enter_p_proc !== undefined) {
				script.combat_is_initialized = 0
				script.self_obj = gameObjects[i]
				script.map_enter_p_proc()
				updated++
			}
		}
	}

	function init(dude) {
		//console.log("hi")
		seed(123)
		dudeObject = dude
		ScriptProto.dude_obj = dudeObject
		/*$.ajaxSetup({error: function(_, status, err) {
			console.log("AJAX error: status: " + status + ", err: " + err)
		}})*/
	}

	return {init: init, enterMap: enterMap, updateMap: updateMap, loadScript: loadScript, dialogueReply: dialogueReply}
})()
