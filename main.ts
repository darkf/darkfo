"use strict";

// make TypeScript happy about external libraries (TODO: use .d.ts files)
declare var $;
declare var heart;
declare var PF;

var MAP_NAME = "ctest" // name of the current map
var DEBUG = false // debug mode

var gMapScript = null
var floorMap = null
var roofMap = null
var images = {}
var imageInfo = null
var gObjects = []
var gMap = null
var gSpatials = null
var currentElevation = 0 // current map elevation
var hexOverlay = null
var tempCanvas = null // temporary canvas used for detecting single pixels
var tempCanvasCtx = null // and the context for it
//var cursor = {x: 10, y: 10}

// position of viewport camera (will be overriden by map starts or scripts)
var cameraX = 3580
var cameraY = 1020

// geometry constants
var TILE_WIDTH = 80
var TILE_HEIGHT = 36
var HEX_GRID_SIZE = 200 // hex grid is 200x200
var SCREEN_WIDTH = 800, SCREEN_HEIGHT = 600
var SCROLL_PADDING = 20 // how far the mouse has to be from an edge to scroll
var FLOAT_MSG_DURATION = 3 // in seconds

var showHexOverlay = false // show hex grid?
var showCoordinates = false // show coordinates on hex grid?
var showPath = true // show player's path?
var showFloor = true // show floor tiles?
var showRoof = true // show roof tiles?
var showObjects = true // show objects?
var showWalls = true // show walls?
var showBoundingBox = false // show bounding boxes around objects?
var showSpatials = true // show spatial script triggers?

var doLoadScripts = true // should we load scripts?
var doUpdateCritters = false // should we give critters heartbeats?
var doTimedEvents = false // should we handle registered timed events?
var doSpatials = true // should we handle spatial triggers?
var doCombat = true // allow combat?
var doUseWeaponModel = true // use weapon model for NPC models?
var doLoadItemInfo = true // load item information (such as inventory images)?
var doAlwaysRun = true // always run instead of walk?
var doZOrder = true // Z-order objects?

var gameTickTime = 0 // in Fallout 2 ticks (elapsed seconds * 10)
var lastGameTick = 0 // real time of the last game tick
var combat = null // combat object
var inCombat = false // are we currently in combat?
var gameHasFocus = false // do we have input focus?
var lastMousePickTime = 0 // time when we last checked what's under the mouse cursor
var UI_MODE_NONE = 0, UI_MODE_DIALOGUE = 1, UI_MODE_BARTER = 2, UI_MODE_LOOT = 3,
    UI_MODE_INVENTORY = 4, UI_MODE_WORLDMAP = 5, UI_MODE_ELEVATOR = 6
var uiMode = UI_MODE_NONE

var isLoading = true // are we currently loading a map?
var loadingAssetsLoaded = 0 // how many images we've loaded
var loadingAssetsTotal = 0 // out of this total
var lazyAssetLoadingQueue = {} // set of lazily-loaded assets being loaded

var floatMessages = []

var cameraDownKey = "down"
var cameraUpKey = "up"
var cameraLeftKey = "left"
var cameraRightKey = "right"
var elevationDownKey = "q"
var elevationUpKey = "e"
var showRoofKey = "r"
var showFloorKey = "f"
var showObjectsKey = "o"
var showWallsKey = "w"
var talkToKey = "t"
var inspectKey = "i"
var moveToKey = "m"
var runToKey = "j"
var attackKey = "g"
var combatKey = "c"
var playerToTargetRaycastKey = "y"
var showTargetInventoryKey = "v"
var useKey = "u"
var killKey = "k"
var worldmapKey = "p"

// the player object
// todo: just load this from the PRO or something
var playerWeapon: any = {art: "art/items/uzi", frmPID: 44, pid: 9, pidID: 9, position: {x: -1, y: -1},
  subtype: "weapon", amount: 1, inventory: [], type: "item", pro: {
    lightRadius: 0, frmPID: 44, extra: {
      animCode: 6, weight: 5,  materialID: 1, subType: 3, flagsExt: "'\\x00\\x00\\x00'",
      cost: 1000, APCost2: 6, APCost1: 5, rounds: 10, minDmg: 1, size: 3,
      dmgType: 0, minST: 4, soundID: "D", maxAmmo: 30, attackMode: 118, maxRange2: 20,
      maxRange1: 25, invFRM: 117440514, maxDmg: 12, ammoPID: 29, critFail: 2, scriptID: -1,
      projPID: -1, caliber: 8},
    textID: 900, pid: 9, frmType: 0, flags: 8, lightIntensity: 0, type: 0},
  name: "10mm SMG",
  invArt: "art/inven/uzi"}
playerWeapon.weapon = new Weapon(playerWeapon)

var player = new Player()
			/*{position: {x: 94, y: 109}, orientation: 2, frame: 0,
              art: "art/critters/hmjmpsaa", isPlayer: true, anim: "idle", lastFrameTime: 0,
              path: null, animCallback: null, type: "critter",
          	  baseStats: {STR: 8, PER: 5, END: 5, CHR: 6, INT: 5, AGI: 6, LUK: 5, HP: 100},
          	  bonusStats: {STR: 0, PER: 0, END: 0, CHR: 0, INT: 0, AGI: 0, LUK: 0, HP: 0},
          	  leftHand: playerWeapon, rightHand: null, weapon: null, armor: null,
          	  dead: false, name: "Player", gender: "male",
          	  skills: {"Repair": 25, "Big Guns": 25, "Outdoorsman": 25, "Traps": 25, "Barter": 25,
          	  		   "Melee": 25, "Throwing": 25, "Steal": 25, "Doctor": 25, "Sneak": 25,
          	  		   "Unarmed": 25, "Speech": 25, "First Aid": 25, "Lockpick": 25, "Science": 25,
          	  		   "Gambling": 25, "Small Guns": 50, "Energy Weapons": 50},
          	  inventory: [
          	  	{type: "misc", name: "Money", pid: 41, pidID: 41, amount: 1337, pro: {textID: 4100, extra: {cost: 1}, invFRM: 117440552}, invArt: 'art/inven/cap2'}
          	  ]}*/

function repr(obj) { return JSON.stringify(obj, null, 2) }

function lazyLoadImage(art: string, callback?: (x:any) => void, isHeartImg?: boolean) {
	if(images[art] !== undefined) {
		if(callback)
			callback(isHeartImg ? images[art] : images[art].img)
		return
	}
	
	if(lazyAssetLoadingQueue[art] !== undefined) {
		if(callback)
			lazyAssetLoadingQueue[art].push(callback)
		return
	}

	console.log("lazy loading " + art + "...")

	lazyAssetLoadingQueue[art] = (callback ? [callback] : [])

	var img = new Image()
	img.src = art + '.png'
	img.onload = function() {
		images[art] = new heart.HeartImage(img)
		var callbacks = lazyAssetLoadingQueue[art]
		if(callbacks !== undefined) {
			for(var i = 0; i < callbacks.length; i++)
				callbacks[i](images[art])
			lazyAssetLoadingQueue[art] = undefined
		}
	}
}

function getPROType(pid) {
	var map = {0: 'items', 1: 'critters', 2: 'scenery', 3: 'walls', 4: 'tiles', 5: 'misc'}
	return map[(pid >> 24) & 0xff]
}

function loadPRO(pid, pidID) {
	if(proFiles[pid] !== undefined)
		return proFiles[pid] // todo: clone?

	// use the proto/ .lst files to look up proto
	var type = getPROType(pid)
	var lsts = {"items": "proto/items/items", "critters": "proto/critters/critters",
                "scenery": "proto/scenery/scenery", "misc": "proto/misc/misc",
                "walls": "proto/walls/walls"}
	var id = lsts[type] ? getLstId(lsts[type], pidID - 1) : pidID
	var path = lsts[type] ? id : (pad(id, 8) + '.pro')

	var pro = getFileJSON('proto/' + type + '/' + path + '.json')
	proFiles[pid] = pro
	return pro
}

function getPROTypeName(type) {
	// singular
	var map = {0: 'item', 1: 'critter', 2: 'scenery', 3: 'wall', 4: 'tile', 5: 'misc'}
	return map[type]
}

function getPROSubTypeName(type: number): string {
	var map = {0: 'armor', 1: 'container', 2: 'drug', 3: 'weapon', 4: 'ammo', 5: 'misc', 6: 'key'}
	return map[type]
}

function makePID(type, pid) {
	return (type << 24) | pid
}

function getCritterArtPath(frmPID) {
	console.log("FRM PID: " + frmPID)
	var idx = (frmPID & 0x00000fff)
	var id1 = (frmPID & 0x0000f000) >> 12
	var id2 = (frmPID & 0x00ff0000) >> 16
	var id3 = (frmPID & 0x70000000) >> 28

	if (id2 == 0x1b || id2 == 0x1d ||
			id2 == 0x1e || id2 == 0x37 ||
			id2 == 0x39 || id2 == 0x3a ||
			id2 == 0x21 || id2 == 0x40) {
		throw "reindex(?)"
	}

	var path = "art/critters/" + getLstId("art/critters/critters", idx).split(',')[0].toLowerCase()

	if(id1 >= 0x0b)
		throw "?"

	if(id2 >= 0x26 && id2 <= 0x2f)
		throw ("0x26 and 0x2f")
	else if(id2 === 0x24)
		path += "ch"
	else if(id2 === 0x25)
		path += "cj"
	else if(id2 >= 0x30)
		path += 'r' + String.fromCharCode(id2 + 0x31)
	else if(id2 >= 0x14)
		throw "0x14"
	else if (id2 === 0x12) {
		throw "0x12"
		if(id1 === 0x01)
			path += "dm"
		else if(id1 === 0x04)
			path += "gm"
		else
			path += "as"
	}
	else if(id2 === 0x0d)
		throw "0x0d"
	else {
		if(id2 <= 1 && id1 > 0) {
			console.log("ID1: " + id1)
			path += String.fromCharCode(id1 + 'c'.charCodeAt(0))
		}
		else
			path += 'a'
		path += String.fromCharCode(id2 + 'a'.charCodeAt(0))
	}

	return path
}

function lookupInterfaceArt(idx) {
	return "art/intrface/" + getLstId("art/intrface/intrface", idx).split('.')[0].toLowerCase()
}

function lookupArt(frmPID) {
	var type = getPROType(frmPID)
	var pidID = frmPID & 0xffff

    if(type === "critters")
    	return getCritterArtPath(frmPID)

	var lsts = {"items": "art/items/items",
                "scenery": "art/scenery/scenery", "misc": "art/misc/misc"}
	var path = "art/" + type + "/" + getLstId(lsts[type], pidID).split('.')[0]

	console.log("LOOKUP ART: " + path)
	return path.toLowerCase()
}

function lookupScriptName(scriptID) {
	console.log("SID: " + scriptID)
	return getLstId("scripts/scripts", scriptID - 1).split('.')[0].toLowerCase()
}

function dropObject(source, obj) {
	// drop inventory object obj from source
	var removed = false
	for(var i = 0; i < source.inventory.length; i++) {
		if(source.inventory[i].pid === obj.pid) {
			removed = true
			source.inventory.splice(i, 1) // remove from source
			break
		}
	}
	if(!removed) throw "dropObject: couldn't find object"

	gObjects.push(obj) // add to objects
	var idx = gObjects.length - 1 // our new index
	objectMove(obj, {x: source.position.x, y: source.position.y}, idx)
}

// Draws a line between a and b, returning the first object hit
function hexLinecast(a, b) {
	var line = hexLine(a, b)
	if(line === null)
		return null
	for(var i = 0; i < line.length; i++) {
		// todo: we could optimize this by only
		// checking in a certain radius of `a`
		var obj = objectsAtPosition(line[i])
		if(obj.length !== 0)
			return obj[0]
	}
	return null
}

function objectsAtPosition(position) {
	var ret = []
	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].position.x === position.x && gObjects[i].position.y === position.y) {
			ret.push(gObjects[i])
		}
	}
	return ret
}

function critterAtPosition(position) {
	var objects = objectsAtPosition(position)
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter")
			return objects[i]
	}
	return null
}

function changeElevation(level: number, updateScripts?: boolean) {
	currentElevation = level
	floorMap = gMap.levels[level]["tiles"]["floor"]
	roofMap  = gMap.levels[level]["tiles"]["roof"]
	gObjects = gMap.levels[level]["objects"]
	gSpatials = gMap.levels[level]["spatials"]

	critterStopWalking(player)

	// TODO: remove this from the old gObjects if necessary
	gObjects.push(player)

	if(updateScripts !== false) {
		var objectsAndSpatials = gObjects.concat(gSpatials)
		// TODO: we need some kind of active/inactive flag on scripts to toggle here,
		// since scripts should already be loaded
		//loadObjectScripts(gObjects)
		scriptingEngine.updateMap(gMapScript, objectsAndSpatials, currentElevation)
	}

	centerCamera(player.position)
}

function centerCamera(around) {
	var scr = hexToScreen(around.x, around.y)
	cameraX = Math.max(0, scr.x - SCREEN_WIDTH/2)
	cameraY = Math.max(0, scr.y - SCREEN_HEIGHT/2)
}

function loadMap(mapName: string, startingPosition?: any, startingElevation?: any) {
	function load(file: string, callback?: (x:any) => void) {
		if(images[file] !== undefined) return // don't load more than once
		loadingAssetsTotal++
		heart.graphics.newImage(file+".png", function(r) {
			images[file] = r
			loadingAssetsLoaded++
			if(callback) callback(r)
		})
	}

	isLoading = true
	loadingAssetsTotal = 1 // this will remain +1 until we load the map, preventing it from exiting early
	loadingAssetsLoaded = 0

	// clear any previous objects/events
	gMap = null
	gObjects = null
	gMapScript = null
	scriptingEngine.reset(player, mapName)

	// reset player animation status
	player.path = null
	player.frame = 0
	player.anim = "idle"

	if(doUseWeaponModel)
		player.art = critterGetAnim(player, "idle")

	console.log("loading map " + mapName)

	var mapImages = getFileJSON("maps/" + mapName + ".images.json")
	for(var i = 0; i < mapImages.length; i++)
		load(mapImages[i])
	console.log("loading " + mapImages.length + " images")

	if(imageInfo === null)
		imageInfo = getFileJSON("art/imageMap.json")

	var map = getFileJSON("maps/"+mapName+".json")
	MAP_NAME = mapName
	gMap = map
	var elevation = (startingElevation !== undefined) ? startingElevation : 0

	for(var level = 0; level < gMap.levels.length; level++) {
		if(doLoadItemInfo !== false)
			gMap.levels[level]["objects"] = gMap.levels[level]["objects"].map(objFromMapObject)
	}

	if(doLoadScripts === true) {
		scriptingEngine.init(player, mapName)
		gMapScript = scriptingEngine.loadScript(mapName)

		// warp to the default position (may be overridden by map script)
		player.position = startingPosition || gMap.startPosition
		player.orientation = gMap.startOrientation

		// load spatial scripts
		if(doSpatials !== false) {
			for(var level = 0; level < gMap.levels.length; level++) {
				var spatials = gMap.levels[level]["spatials"]
				for(var i = 0; i < spatials.length; i++) {
					var spatial = spatials[i]
					var script = scriptingEngine.loadScript(spatial.script)
					if(script === null)
						console.log("load script failed for spatial " + spatial.script)
					else {
						spatial._script = script
						// no need to initialize here because spatials only use spatial_p_proc
					}

					spatial.isSpatial = true
					spatial.position = fromTileNum(spatial.tileNum)
				}
			}
		}

		changeElevation(elevation, false)
		// TODO:
		//loadObjectScripts(gObjects)
		var objectsAndSpatials = gObjects.concat(gSpatials)
		scriptingEngine.enterMap(gMapScript, objectsAndSpatials, elevation, gMap.mapID, true)
		scriptingEngine.updateMap(gMapScript, objectsAndSpatials, elevation)
	}
	else changeElevation(elevation, false)

	// todo: is map_enter_p_proc called on elevation change?
	console.log("loaded (" + map.levels.length + " levels, level 0: " + floorMap.length + " tiles, " + gObjects.length + " objects on elevation)")

	// load some testing art
	load("art/critters/hmjmpsat")

	load("hex_outline", function(r) { hexOverlay = r })
	loadingAssetsTotal-- // we should know all of the assets we need by now
}

function parseMapInfo() {
	if(mapInfo !== null)
		return
	
	// parse map info from data/data/MAPS.TXT
	mapInfo = {}
	var text = getFileText("data/data/MAPS.TXT")
	var ini = parseIni(text)
	for(var category in ini) {
		var id = category.match(/Map (\d+)/)[1]
		if(id === null) throw "MAPS.TXT: invalid category: " + category
		id = parseInt(id)
		mapInfo[id] = {name: ini[category].map_name,
			           lookupName: ini[category].lookup_name}
	}
}

function lookupMapNameFromLookup(lookupName) {
	if(mapInfo === null)
		parseMapInfo()

	for(var mapID in mapInfo) {
		if(mapInfo[mapID].lookupName === lookupName)
			return mapInfo[mapID].name
	}
	return null
}

function lookupMapName(mapID) {
	if(mapInfo === null)
		parseMapInfo()

	return mapInfo[mapID].name || null
}

function loadMapID(mapID: number, startingPosition?: any, startingElevation?: any) { // TODO: any
	var mapName = lookupMapName(mapID)
	if(mapName !== null)
		loadMap(mapName, startingPosition, startingElevation)
	else
		console.log("couldn't lookup map name for map ID " + mapID)
}

heart.load = function() {
	heart.attach("cnv")

	uiLog("Welcome to DarkFO")

	if(location.search !== "") {
		// load map from query string (e.g. URL ending in ?modmain)
		loadMap(location.search.slice(1))
	}
	else
		loadMap(MAP_NAME) // load initial map

	if(doCombat === true)
		CriticalEffects.loadTable()

	$("#cnv").mouseenter(function() { gameHasFocus = true }).
	          mouseleave(function() { gameHasFocus = false })

	tempCanvas = $("<canvas>")[0]
	tempCanvasCtx = tempCanvas.getContext("2d")

	initUI()
}

function isSelectableObject(obj: any) {
	return obj.visible !== false && (canUseObject(obj) || obj.type === "critter")
}

heart.mousepressed = function(x, y, btn) {
	if(isLoading === true) return
	if(btn !== "l") return

	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

	// if there's an object under the cursor, use it
	var obj = getObjectUnderCursor(isSelectableObject)
	if(obj !== null) {
		if(obj.type === "critter") {
			if(obj === player) return

			if(inCombat === true && obj.dead !== true) {
				// attack a critter
				if(!combat.inPlayerTurn || objectInAnim(player)) {
					console.log("You can't do that yet.")
					return
				}

				if(player.AP.getAvailableCombatAP() < 4) {
					uiLog(getProtoMsg(700))
					return
				}

				player.AP.subtractCombatAP(4)
				console.log("Attacking...")
				combat.attack(player, obj)
			}
			else if(obj.dead !== true && inCombat !== true &&
				obj._script && obj._script.talk_p_proc !== undefined) {
				// talk to a critter
				console.log("Talking to " + critterGetName(obj))
				scriptingEngine.talk(obj._script, obj)
			}
			else if(obj.dead === true) {
				// loot a dead body
				uiLoot(obj)
			}
			else console.log("Cannot talk to/loot that critter")
		}
		else
			useObject(obj, player)
	}
	else // otherwise walk to the destination
		if(critterWalkTo(player, mouseHex, doAlwaysRun) === false)
			console.log("Cannot walk there")
}

heart.keydown = function(k) {
	if(isLoading === true) return
	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

	if(k == cameraDownKey) cameraY += 15
	if(k == cameraRightKey) cameraX += 15
	if(k == cameraLeftKey) cameraX -= 15
	if(k == cameraUpKey) cameraY -= 15
	if(k == elevationDownKey) { if(currentElevation-1 >= 0) changeElevation(currentElevation-1) }
	if(k == elevationUpKey) { if(currentElevation+1 < gMap.levels.length) changeElevation(currentElevation+1) }
	if(k == showRoofKey) { showRoof = !showRoof }
	if(k == showFloorKey) { showFloor = !showFloor }
	if(k == showObjectsKey) { showObjects = !showObjects }
	if(k == showWallsKey) showWalls = !showWalls
	if(k == talkToKey) {
		for(var i = 0; i < gObjects.length; i++) {
			if(gObjects[i].position.x === mouseHex.x && gObjects[i].position.y === mouseHex.y) {
				console.log("object at index " + i)
				if(gObjects[i]._script && gObjects[i]._script.talk_p_proc !== undefined) {
					console.log("talking to " + gObjects[i].name)
					scriptingEngine.talk(gObjects[i]._script, gObjects[i])
					break
				}
			}
		}
	}
	if(k == inspectKey) {
		for(var i = 0; i < gObjects.length; i++) {
			if(gObjects[i].position.x === mouseHex.x && gObjects[i].position.y === mouseHex.y) {
				var hasScripts = (gObjects[i].script !== undefined ? ("yes (" + gObjects[i].script + ")") : "no") + " " + (gObjects[i]._script === undefined ? "and is NOT loaded" : "and is loaded")
				console.log("object is at index " + i + ", of type " + gObjects[i].type + ", has art " + gObjects[i].art + ", and has scripts? " + hasScripts + " -> %o", gObjects[i])
			}
		}
	}
	if(k == moveToKey) {
		critterWalkTo(player, mouseHex)
	}
	if(k == runToKey) {
		critterWalkTo(player, mouseHex, true)
	}
	if(k == attackKey) {
		if(!inCombat || !combat.inPlayerTurn || player.anim !== "idle") {
			console.log("You can't do that yet.")
			return
		}

		if(player.AP.getAvailableCombatAP() < 4) {
			uiLog(getProtoMsg(700))
			return
		}

		for(var i = 0; i < combat.combatants.length; i++) {
			if(combat.combatants[i].position.x === mouseHex.x && combat.combatants[i].position.y === mouseHex.y && !combat.combatants[i].dead) {
				player.AP.subtractCombatAP(4)
				console.log("Attacking...")
				combat.attack(player, combat.combatants[i])
				break
			}
		}
	}

	if(k == combatKey) {
		if(!doCombat) return
		if(inCombat === true && combat.inPlayerTurn === true) {
			console.log("[TURN]")
			combat.nextTurn()
		}
		else if(inCombat === true) {
			console.log("Wait your turn...")
		}
		else {
			console.log("[COMBAT BEGIN]")
			inCombat = true
			combat = new Combat(gObjects)
			combat.nextTurn()
		}
	}

	if(k == playerToTargetRaycastKey) {
		var obj = objectsAtPosition(mouseHex)[0]
		if(obj !== undefined) {
			var hit = hexLinecast(player.position, obj.position)
			console.log("hit obj: " + hit.art)
		}
	}

	if(k == showTargetInventoryKey) {
		var obj = objectsAtPosition(mouseHex)[0]
		if(obj !== undefined) {
			console.log("PID: " + obj.pid)
			console.log("inventory: " + JSON.stringify(obj.inventory))
			uiLoot(obj)
		}
	}

	if(k == useKey) {
		var objs = objectsAtPosition(mouseHex)
		for(var i = 0; i < objs.length; i++) {
			useObject(objs[i])
		}
	}

	if(k == 'h')
		critterMove(player, mouseHex)

	if(k == killKey) {
		var objs = objectsAtPosition(mouseHex)
		for(var i = 0; i < objs.length; i++) {
			if(objs[i].type === "critter") {
				critterKill(objs[i], player)
				break
			}
		}
	}

	if(k == worldmapKey)
		uiWorldMap()
}

function recalcPath(start, goal) {
	var matrix = new Array(HEX_GRID_SIZE)

	for(var y = 0; y < HEX_GRID_SIZE; y++)
		matrix[y] = new Array(HEX_GRID_SIZE)

	for(var i = 0; i < gObjects.length; i++) {
		// if there are multiple, any blocking one will block
		var obj = gObjects[i]
		matrix[obj.position.y][obj.position.x] |= <any>objectBlocks(obj)
	}

	var grid = new PF.Grid(HEX_GRID_SIZE, HEX_GRID_SIZE, matrix)
	var finder = new PF.BestFirstFinder()
	var path = finder.findPath(start.x, start.y, goal.x, goal.y, grid)
	return path
}

function changeCursor(image) {
	$("#cnv").css("cursor", image)
}

function objectTransparentAt(obj, position, bbox) {
	var frame = obj.frame !== undefined ? obj.frame : 0
	var sx = imageInfo[obj.art].frameOffsets[obj.orientation][frame].sx

	tempCanvasCtx.clearRect(0, 0, 1, 1) // clear previous color
	tempCanvasCtx.drawImage(images[obj.art].img, sx+position.x, position.y, 1, 1, 0, 0, 1, 1)
	var pixelAlpha = tempCanvasCtx.getImageData(0, 0, 1, 1).data[3]

	return (pixelAlpha === 0)
}

function getObjectUnderCursor(p) {
	var mouse = heart.mouse.getPosition()
	mouse = {x: mouse[0] + cameraX, y: mouse[1] + cameraY}

	// reverse z-ordered search
	for(var i = gObjects.length - 1; i > 0; i--) {
		var bbox = objectBoundingBox(gObjects[i])
		if(bbox === null) continue
		if(pointInBoundingBox(mouse, bbox))
			if(p === undefined || p(gObjects[i]) === true) {
				var mouseRel = {x: mouse.x - bbox.x, y: mouse.y - bbox.y}
				if(!objectTransparentAt(gObjects[i], mouseRel, bbox))
					return gObjects[i]
			}
	}

	return null
}

heart.update = function() {
	if(isLoading === true) {
		if(loadingAssetsLoaded === loadingAssetsTotal) isLoading = false
		else return
	}
	if(uiMode !== UI_MODE_NONE)
		return
	var time = heart.timer.getTime()

	if(gameHasFocus) {
		var mousePos = heart.mouse.getPosition()
		if(mousePos[0] <= SCROLL_PADDING) cameraX -= 15
		if(mousePos[0] >= SCREEN_WIDTH-SCROLL_PADDING) cameraX += 15

		if(mousePos[1] <= SCROLL_PADDING) cameraY -= 15
		if(mousePos[1] >= SCREEN_HEIGHT-SCROLL_PADDING) cameraY += 15

		if(time >= lastMousePickTime + 750) { // every .75 seconds, check the object under the cursor
			lastMousePickTime = time

			var obj = getObjectUnderCursor(isSelectableObject)
			if(obj !== null)
				changeCursor("pointer")
			else changeCursor("auto")
		}

		for(var i = 0; i < floatMessages.length; i++) {
			if(time >= floatMessages[i].startTime + 1000*FLOAT_MSG_DURATION) {
				floatMessages.splice(i--, 1)
				continue
			}
		}
	}

	var didTick = (time - lastGameTick >= 1000/10) // 10 Hz game tick
	if(didTick) {
		lastGameTick = time
		gameTickTime++

		if(doTimedEvents === true && inCombat !== true) {
			// check and update timed events
			var timedEvents = scriptingEngine.timeEventList
			var numEvents = timedEvents.length
			for(var i = 0; i < numEvents; i++) {
				if(timedEvents[i].obj &&
				   timedEvents[i].obj.dead === true) { // remove events for dead objects
				   	console.log("removing timed event for dead object")
				   	timedEvents.splice(i--, 1)
				   	numEvents--
				    continue
				}

				timedEvents[i].ticks--
				if(timedEvents[i].ticks <= 0) {
					scriptingEngine.info("timed event triggered", "timer")
					timedEvents[i].fn()
					timedEvents.splice(i--, 1)
					numEvents--
				}
			}
		}
	}

	critterUpdateAnimation(player)

	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].type === "critter") {
			if(didTick && doUpdateCritters && inCombat !== true && !gObjects[i].dead &&
				objectInAnim(gObjects[i]) === false && gObjects[i]._script)
				scriptingEngine.updateCritter(gObjects[i]._script, gObjects[i])
			critterUpdateAnimation(gObjects[i])
		}
		else if(gObjects[i].anim === "single" || gObjects[i].anim === "reverse")
			objectUpdateAnimation(gObjects[i])
	}
}

function drawTileMap(matrix, offsetY) {
	for(var i = 0; i < matrix.length; i++) {
		for(var j = 0; j < matrix[0].length; j++) {
			var tile = matrix[j][i]
			if(tile === "grid000") continue
			var img = "art/tiles/" + tile

			if(images[img] !== undefined) {
				var scr = tileToScreen(i, j)
				scr.y += offsetY
				if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
				   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
					continue
				heart.graphics.draw(images[img], scr.x - cameraX, scr.y - cameraY)
			}
		}
	}
}

// get an object's bounding box in screen-space (note: not camera-space)
function objectBoundingBox(obj) {
	var scr = hexToScreen(obj.position.x, obj.position.y)

	if(images[obj.art] === undefined) // no art
		return null

	var info = imageInfo[obj.art]
	if(info === undefined)
		throw "No image map info for: " + obj.art

	var frameIdx = 0
	if(obj.frame !== undefined)
		frameIdx += obj.frame

	if(!(obj.orientation in info.frameOffsets))
		obj.orientation = 0 // ...
	var frameInfo = info.frameOffsets[obj.orientation][frameIdx]
	var dirOffset = info.directionOffsets[obj.orientation]
	var offsetX = Math.floor(frameInfo.w / 2) - dirOffset.x - frameInfo.ox
	var offsetY = frameInfo.h - dirOffset.y - frameInfo.oy

	return {x: scr.x - offsetX, y: scr.y - offsetY, w: frameInfo.w, h: frameInfo.h}
}

function objectOnScreen(obj) {
	var bbox = objectBoundingBox(obj)
	if(bbox === null)
		return false

	if(bbox.x + bbox.w < cameraX || bbox.y + bbox.h < cameraY ||
	   bbox.x >= cameraX+SCREEN_WIDTH || bbox.y >= cameraY+SCREEN_HEIGHT)
		return false
	return true
}

function drawObject(obj) {
	var scr = hexToScreen(obj.position.x, obj.position.y)

	if(images[obj.art] === undefined) {
		lazyLoadImage(obj.art) // try to load it in
		return
	}

	var info = imageInfo[obj.art]
	if(info === undefined)
		throw "No image map info for: " + obj.art

	var frameIdx = 0
	if(obj.frame !== undefined)
		frameIdx += obj.frame

	if(!(obj.orientation in info.frameOffsets))
		obj.orientation = 0 // ...
	var frameInfo = info.frameOffsets[obj.orientation][frameIdx]
	var dirOffset = info.directionOffsets[obj.orientation]
	var offsetX = Math.floor(frameInfo.w / 2) - dirOffset.x - frameInfo.ox
	var offsetY = frameInfo.h - dirOffset.y - frameInfo.oy
	var scrX = scr.x - offsetX, scrY = scr.y - offsetY

	if(scrX + frameInfo.w < cameraX || scrY + frameInfo.h < cameraY ||
	   scrX >= cameraX+SCREEN_WIDTH || scrY >= cameraY+SCREEN_HEIGHT)
		return // out of screen bounds, no need to draw

	heart.ctx.drawImage(images[obj.art].img,
		frameInfo.sx, 0, frameInfo.w, frameInfo.h,
		scrX - cameraX,
		scrY - cameraY,
		frameInfo.w, frameInfo.h
	)
}

heart.draw = function() {
	if(isLoading === true) {
		heart.graphics.setColor(0, 0, 0)
		var w = 256, h = 40
		var w2 = (loadingAssetsLoaded / loadingAssetsTotal) * w
		// draw a loading progress bar
		heart.graphics.rectangle("stroke", SCREEN_WIDTH/2 - w/2, SCREEN_HEIGHT/2,
				w, h)
		heart.graphics.rectangle("fill", SCREEN_WIDTH/2 - w/2 + 2, SCREEN_HEIGHT/2 + 2,
				w2 - 4, h - 4)
		return
	}
	heart.graphics.setColor(255, 255, 255)

	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)
	//var mouseTile = tileFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

	// draw tile grids
	if(showFloor === true && floorMap !== null)
		drawTileMap(floorMap, 0);

	// draw hex grid overlay
	if(showHexOverlay === true || showCoordinates === true) {
		for(var y = 0; y < HEX_GRID_SIZE; y++) {
			for(var x = 0; x < HEX_GRID_SIZE; x++) {
				var scr = hexToScreen(x, y)
				heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
				if(showCoordinates === true) {
					heart.graphics.print(x + "," + y, scr.x - 3 - cameraX, scr.y - 3 - cameraY)
				}
				if(showCoordinates === false && (x === mouseHex.x && y === mouseHex.y)) {
					heart.graphics.print("m", scr.x - 3 - cameraX, scr.y - 3 - cameraY)
				}
			}
		}
	} else {
		var scr = hexToScreen(mouseHex.x, mouseHex.y)
		heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)

		if(showPath === true && player.path !== null) {
			for(var i = 0; i < player.path.path.length; i++) {
				var scr = hexToScreen(player.path.path[i][0], player.path.path[i][1])
				heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
			}
		} 
	}

	// draw objects and player
	if(showObjects === true) {
		for(var i = 0; i < gObjects.length; i++)
			if(gObjects[i].visible !== false && (gObjects[i].type !== "wall" || showWalls)) {
				drawObject(gObjects[i])

				if(showBoundingBox === true) {
					var bbox = objectBoundingBox(gObjects[i])
					if(bbox === null) continue
					heart.graphics.setColor(255, 0, 0)
					heart.graphics.rectangle("stroke", bbox.x - cameraX, bbox.y - cameraY,
						                     bbox.w, bbox.h)
				}
			}
	}

	if(showRoof === true && roofMap !== null)
		drawTileMap(roofMap, -96);

	/*if(floorMap[mouseTile.y] !== undefined) {
		var tileImg = floorMap[mouseTile.y][mouseTile.x]
		heart.graphics.print("tile: " + tileImg, 5, 60)
	}*/

	if(inCombat === true) {
		var whose = combat.inPlayerTurn ? "player" : critterGetName(combat.combatants[combat.whoseTurn])
		var AP = combat.inPlayerTurn ? player.AP : combat.combatants[combat.whoseTurn].AP
		heart.graphics.print("[turn " + combat.turnNum + " of " + whose + " AP: " + AP.getAvailableMoveAP() + "]", SCREEN_WIDTH - 200, 15)
	}

	if(showSpatials === true && doSpatials !== false) {
		for(var i = 0; i < gSpatials.length; i++) {
			var spatial = gSpatials[i]
			var scr = hexToScreen(spatial.position.x, spatial.position.y)
			heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
			heart.graphics.print(spatial.script, scr.x - 10 - cameraX, scr.y - 3 - cameraY)
		}
	}

	heart.graphics.print("mh: " + mouseHex.x + "," + mouseHex.y, 5, 15)
	//heart.graphics.print("mt: " + mouseTile.x + "," + mouseTile.y, 100, 15)
	heart.graphics.print("m: " + mousePos[0] + ", " + mousePos[1], 175, 15)

	for(var i = 0; i < floatMessages.length; i++) {
		var bbox = objectBoundingBox(floatMessages[i].obj)
		if(bbox === null) continue
		heart.ctx.fillStyle = floatMessages[i].color
		var centerX = bbox.x - bbox.w/2 - cameraX
		heart.graphics.print(floatMessages[i].msg, centerX, bbox.y - cameraY - 16)
	}

	if(player.dead === true) {
		heart.graphics.setColor(255, 0, 0, 50)
		heart.graphics.rectangle("fill", 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
	}
}

function dialogueReply(id) { scriptingEngine.dialogueReply(id) }
function dialogueEnd() { scriptingEngine.dialogueEnd() }
