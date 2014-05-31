var scriptingEngine = (function() {
	var scriptObjects = {}
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

	var ScriptProto = {
		dude_obj: "<Dude Object>",
		'true': true,
		'false': false,
		set_global_var: function(gvar, value) { stub("set_global_var", arguments) },
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
		global_var: function(gvar) { stub("global_var", arguments) },
		random: function(min, max) { log("random", arguments); return getRandomInt(min, max) },
		debug_msg: function(msg) { console.log("DEBUG MSG: " + msg) },
		display_msg: function(msg) { stub("display_msg", arguments); console.log("DISPLAY MSG: " + msg) },
		message_str: function(msgList, msgNum) { stub("message_str", arguments) },
		metarule: function(_, _) { stub("metarule", arguments) }, // ???

		// critters
		get_critter_stat: function(obj, stat) { stub("get_critter_stat", arguments); return 10 },
		critter_add_trait: function(obj, traitType, trait, amount) { stub("critter_add_trait", arguments) },
		elevation: function(obj) { if(isGameObject(obj)) return currentElevation
								   else { warn("elevation: not an object: " + obj.toString()); return -1 } },

		// environment
		set_light_level: function(level) { stub("set_light_level", arguments) },
		override_map_start: function(x, y, elevation, rotation) { stub("override_map_start", arguments) },

		// tiles
		tile_distance_objs: function(a, b) { stub("tile_distance_objs", arguments) },
		tile_distance: function(a, b) { stub("tile_distance", arguments) },
		tile_num: function(obj) { stub("tile_num", arguments) },

		// party
		party_member_obj: function(pid) { stub("party_member_obj", arguments); return 0 }
	}

	function loadScript(name) {
		// e.g. "Raiders2"
		console.log("loading script " + name)
		$.get(name + ".js", function(code) {
			//console.log("code: " + code)
			var f = new Function(code)
			f.prototype = ScriptProto
			var obj = new f()
			obj.scriptName = name
			console.log('script obj: ' + obj)
			scriptObjects[name] = obj
		}, "text").fail(function(err) { console.log("script loading error: "  + err) })
	}

	function updateMap(mapName, objects, elevation) {
		var script = scriptObjects[mapName];
		if(script === undefined)
			return;

		gameObjects = objects
		gameElevation = elevation

		if(script.map_update_p_proc !== undefined) {
			console.log("calling map update")
			script.map_update_p_proc()
		}
	}

	function enterMap(mapName, objects, elevation) {
		var script = scriptObjects[mapName];
		if(script === undefined)
			return;

		gameObjects = objects
		gameElevation = elevation

		if(script.map_enter_p_proc !== undefined) {
			console.log("calling map enter")
			script.map_enter_p_proc()
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

	return {init: init, enterMap: enterMap, updateMap: updateMap, loadScript: loadScript}
})()