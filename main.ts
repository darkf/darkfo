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

// Main file with a lot of ugly global singletons

"use strict";

// make TypeScript happy about external libraries (TODO: use .d.ts files)
declare var $;
declare var _;
declare var heart;
declare var PF;

var gMap: GameMap = null
var images = {} // Image cache
var imageInfo = null // Metadata about images (Number of frames, FPS, etc)
var gObjects: Obj[] = null // Map objects on current level
var currentElevation = 0 // current map elevation
var hexOverlay = null
var tempCanvas = null // temporary canvas used for detecting single pixels
var tempCanvasCtx = null // and the context for it

// position of viewport camera (will be overriden by map starts or scripts)
var cameraX = 3580
var cameraY = 1020

var SCREEN_WIDTH = Config.ui.screenWidth
var SCREEN_HEIGHT = Config.ui.screenHeight

var gameTickTime = 0 // in Fallout 2 ticks (elapsed seconds * 10)
var lastGameTick = 0 // real time of the last game tick
var combat = null // combat object
var inCombat = false // are we currently in combat?
var gameHasFocus = false // do we have input focus?
var lastMousePickTime = 0 // time when we last checked what's under the mouse cursor
var UI_MODE_NONE = 0, UI_MODE_DIALOGUE = 1, UI_MODE_BARTER = 2, UI_MODE_LOOT = 3,
    UI_MODE_INVENTORY = 4, UI_MODE_WORLDMAP = 5, UI_MODE_ELEVATOR = 6,
    UI_MODE_CALLED_SHOT = 7
var uiMode = UI_MODE_NONE

var isLoading = true // are we currently loading a map?
var loadingAssetsLoaded = 0 // how many images we've loaded
var loadingAssetsTotal = 0 // out of this total
var loadingLoadedCallback = null // loaded callback
var lazyAssetLoadingQueue = {} // set of lazily-loaded assets being loaded

var floatMessages = []

// the global player object
var player = new Player()

var renderer: Renderer = null
var audioEngine: AudioEngine = null

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
	img.onload = function() {
		images[art] = new heart.HeartImage(img)
		var callbacks = lazyAssetLoadingQueue[art]
		if(callbacks !== undefined) {
			for(var i = 0; i < callbacks.length; i++)
				callbacks[i](images[art])
			lazyAssetLoadingQueue[art] = undefined
		}
	}
	img.src = art + '.png'
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
	obj.move({x: source.position.x, y: source.position.y}, idx)
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

function objectsAtPosition(position: Point) {
	var ret = []
	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].position.x === position.x && gObjects[i].position.y === position.y) {
			ret.push(gObjects[i])
		}
	}
	return ret
}

function critterAtPosition(position: Point) {
	var objects = objectsAtPosition(position)
	for(var i = 0; i < objects.length; i++) {
		if(objects[i].type === "critter")
			return objects[i]
	}
	return null
}

function centerCamera(around) {
	var scr = hexToScreen(around.x, around.y)
	cameraX = Math.max(0, scr.x - SCREEN_WIDTH/2 | 0)
	cameraY = Math.max(0, scr.y - SCREEN_HEIGHT/2 | 0)
}

class GameMap {
	name: string;
	startingPosition: Point;
	startingElevation: number;
	numLevels: number;

	currentElevation: number = 0 // current map elevation

	floorMap: string[][] = null // Floor tilemap
	roofMap: string[][] = null // Roof tilemap

	mapScript: any = null; // Current map script object
	objects: Obj[][] = null; // Map objects on all levels
	spatials: any[][] = null; // Spatials on all levels

	mapObj: any = null;
	mapID: number;

	getObjects(level?: number): Obj[] {
		return this.objects[level === undefined ? this.currentElevation : level]
	}

	getSpatials(level?: number): any[] {
		return this.spatials[level === undefined ? this.currentElevation : level]
	}

	getObjectsAndSpatials(level?: number): Obj[] {
		return this.getObjects().concat(this.getSpatials())
	}

	changeElevation(level: number, updateScripts?: boolean) {
		var oldElevation = this.currentElevation
		this.currentElevation = level
		this.floorMap = this.mapObj.levels[level].tiles.floor
		this.roofMap  = this.mapObj.levels[level].tiles.roof
		//this.spatials = this.mapObj.levels[level]["spatials"]

		// temporary
		gObjects = this.getObjects(level)
		currentElevation = this.currentElevation

		player.clearAnim()

		// remove the player from the old objects
		_.pull(this.objects[oldElevation], player)

		// and add the player to the new one
		this.objects[level].push(player)

		// set up renderer data
		renderer.initData(this.roofMap, this.floorMap, this.getObjects())

		if(updateScripts) {
			// TODO: we need some kind of active/inactive flag on scripts to toggle here,
			// since scripts should already be loaded
			//loadObjectScripts(gObjects)
			scriptingEngine.updateMap(this.mapScript, this.getObjectsAndSpatials(), currentElevation)
		}

		// rebuild the lightmap
		if(Config.engine.doFloorLighting) {
			Lightmap.resetLight()
			Lightmap.rebuildLight()
		}

		centerCamera(player.position)
	}

	loadMap(mapName: string, startingPosition?: Point, startingElevation?: number, loadedCallback?: () => void) {
		function load(file: string, callback?: (x:any) => void) {
			if(images[file] !== undefined) return // don't load more than once
			loadingAssetsTotal++
			heart.graphics.newImage(file+".png", function(r) {
				images[file] = r
				loadingAssetsLoaded++
				if(callback) callback(r)
			})
		}

		this.name = mapName.toLowerCase()

		isLoading = true
		loadingAssetsTotal = 1 // this will remain +1 until we load the map, preventing it from exiting early
		loadingAssetsLoaded = 0
		loadingLoadedCallback = loadedCallback || null

		// clear any previous objects/events
		this.objects = null
		this.mapScript = null
		scriptingEngine.reset(player, this.name)

		// reset player animation status (to idle)
		player.clearAnim()

		console.log("loading map " + mapName)

		var mapImages = getFileJSON("maps/" + mapName + ".images.json")
		for(var i = 0; i < mapImages.length; i++)
			load(mapImages[i])
		console.log("loading " + mapImages.length + " images")

		var map = getFileJSON("maps/"+mapName+".json")
		this.mapObj = map
		this.mapID = map.mapID
		this.numLevels = map.levels.length

		var elevation = (startingElevation !== undefined) ? startingElevation : 0

		// load map objects
		this.objects = new Array(map.levels.length)
		for(var level = 0; level < map.levels.length; level++) {
			this.objects[level] = map.levels[level].objects.map(objFromMapObject)
		}

		if(Config.engine.doLoadScripts) {
			scriptingEngine.init(player, mapName)
			this.mapScript = scriptingEngine.loadScript(mapName)

			// warp to the default position (may be overridden by map script)
			player.position = startingPosition || map.startPosition
			player.orientation = map.startOrientation

			if(Config.engine.doSpatials) {
				this.spatials = map.levels.map(level => level.spatials)

				// initialize spatial scripts
				this.spatials.forEach(level => level.forEach(spatial => {
					var script = scriptingEngine.loadScript(spatial.script)
					if(script === null)
						console.log("load script failed for spatial " + spatial.script)
					else {
						spatial._script = script
						// no need to initialize here because spatials only use spatial_p_proc
					}

					spatial.isSpatial = true
					spatial.position = fromTileNum(spatial.tileNum)
				}))

			}
			else
				this.spatials = map.levels.map(_ => [])

			this.changeElevation(elevation, false)

			// TODO: when exactly are these called?
			// TODO: when objectsAndSpatials is updated, the scripting engine won't know
			var objectsAndSpatials = this.getObjectsAndSpatials()
			scriptingEngine.enterMap(this.mapScript, objectsAndSpatials, this.currentElevation, this.mapID, true)

			// tell objects that they're now on the map
			this.objects.forEach(level => level.forEach(obj => obj.enterMap()))
			this.spatials.forEach(level => level.forEach(spatial => scriptingEngine.objectEnterMap(spatial, this.currentElevation, this.mapID)))

			scriptingEngine.updateMap(this.mapScript, objectsAndSpatials, elevation)
		}
		else
			this.changeElevation(elevation, false)

		// change elevation with script updates
		this.changeElevation(elevation, true)

		// TODO: is map_enter_p_proc called on elevation change?
		console.log("loaded (" + map.levels.length + " levels, " +this.getObjects().length + " objects on elevation " + elevation + ")")

		// load some testing art
		load("art/critters/hmjmpsat")
		load("hex_outline", r => { hexOverlay = r })

		loadingAssetsTotal-- // we should know all of the assets we need by now

		// clear audio and use the map music
		var curMapInfo = getCurrentMapInfo()
		audioEngine.stopAll()
		if(curMapInfo && curMapInfo.music)
			audioEngine.playMusic(curMapInfo.music)
	}
}

// temporary
function changeElevation(level: number, updateScripts?: boolean) {
	gMap.changeElevation(level, updateScripts)
}

function loadMap(mapName: string, startingPosition?: Point, startingElevation?: number, loadedCallback?: () => void) {
	gMap.loadMap(mapName, startingPosition, startingElevation, loadedCallback)
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

		var randomStartPoints = []
		for(var key in ini[category]) {
			if(key.indexOf("random_start_point_") === 0) {
				var startPoint = ini[category][key].match(/elev:(\d), tile_num:(\d+)/)
				if(startPoint === null)
					throw "invalid random_start_point: " + ini[category][key]
				randomStartPoints.push({elevation: parseInt(startPoint[1]),
					                    tileNum: parseInt(startPoint[2])})
			}
		}

		// parse ambient sfx list
		var ambientSfx = []
		var ambient_sfx = ini[category].ambient_sfx
		if(ambient_sfx) {
			var s = ambient_sfx.split(",")
			for(var i = 0; i < s.length; i++) {
				var kv = s[i].trim().split(":")
				ambientSfx.push([kv[0].toLowerCase(), parseInt(kv[1].toLowerCase())])
			}
		}

		mapInfo[id] = {name: ini[category].map_name,
			           lookupName: ini[category].lookup_name,
			           ambientSfx: ambientSfx,
			           music: (ini[category].music || "").trim().toLowerCase(),
			           randomStartPoints: randomStartPoints}
	}
}

function lookupMapFromLookup(lookupName) {
	if(mapInfo === null)
		parseMapInfo()

	for(var mapID in mapInfo) {
		if(mapInfo[mapID].lookupName === lookupName)
			return mapInfo[mapID]
	}
	return null
}

function lookupMapNameFromLookup(lookupName) {
	if(mapInfo === null)
		parseMapInfo()

	for(var mapID in mapInfo) {
		if(mapInfo[mapID].lookupName.toLowerCase() === lookupName.toLowerCase())
			return mapInfo[mapID].name
	}
	return null
}

function lookupMapName(mapID) {
	if(mapInfo === null)
		parseMapInfo()

	return mapInfo[mapID].name || null
}

function getMapInfo(mapName: string) {
	if(mapInfo === null)
		parseMapInfo()

	for(var mapID in mapInfo) {
		if(mapInfo[mapID].name.toLowerCase() === mapName.toLowerCase())
			return mapInfo[mapID]
	}
	return null
}

function getCurrentMapInfo() {
	return getMapInfo(gMap.name)
}

function loadMapID(mapID: number, startingPosition?: Point, startingElevation?: number) {
	var mapName = lookupMapName(mapID)
	if(mapName !== null)
		gMap.loadMap(mapName, startingPosition, startingElevation)
	else
		console.log("couldn't lookup map name for map ID " + mapID)
}

heart.load = function() {
	// load image map
	imageInfo = getFileJSON("art/imageMap.json")

	// initialize renderer
	renderer = new CanvasRenderer()
	renderer.init()

	// initialize audio engine
	if(Config.engine.doAudio)
		audioEngine = new HTMLAudioEngine()
	else
		audioEngine = new NullAudioEngine()

	// initialize map
	gMap = new GameMap()

	uiLog("Welcome to DarkFO")

	if(location.search !== "") {
		// load map from query string (e.g. URL ending in ?modmain)
		gMap.loadMap(location.search.slice(1))
	}
	else // load starting map
		gMap.loadMap("artemple")

	if(Config.engine.doCombat === true)
		CriticalEffects.loadTable()

	$("#cnv").mouseenter(function() { gameHasFocus = true }).
	          mouseleave(function() { gameHasFocus = false })

	tempCanvas = $("<canvas>")[0]
	tempCanvasCtx = tempCanvas.getContext("2d")

	initUI()
}

function critterMoveInFrontOf(obj, targetPos, callback) {
	var path = recalcPath(obj.position, targetPos, false)
	if(path.length === 0) // invalid path
		return false
	else if(path.length <= 2) { // we're already infront of or on it
		if(callback !== undefined)
			callback()
		return true
	}
	path.pop() // we don't want targetPos in the path

	var target = path[path.length - 1]
	targetPos = {x: target[0], y: target[1]}

	var running = Config.engine.doAlwaysRun
	if(hexDistance(obj.position, targetPos) > 5)
		running = true

	//console.log("path: %o, callback %o", path, callback)
	return critterWalkTo(obj, targetPos, running, callback, undefined, path)
}
function isSelectableObject(obj: any) {
	return obj.visible !== false && (canUseObject(obj) || obj.type === "critter")
}

function playerUse() {
	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)
	var obj = getObjectUnderCursor(isSelectableObject)
	var who = <Critter>obj

	if(obj === null) { // walk to the destination if there is no usable object
		if(critterWalkTo(player, mouseHex, Config.engine.doAlwaysRun) === false)
			console.log("Cannot walk there")
		return
	}

	if(obj.type === "critter") {
		if(obj === player) return // can't use yourself

		if(inCombat === true && who.dead !== true) {
			// attack a critter
			if(!combat.inPlayerTurn || player.inAnim()) {
				console.log("You can't do that yet.")
				return
			}

			if(player.AP.getAvailableCombatAP() < 4) {
				uiLog(getProtoMsg(700))
				return
			}

			// TODO: move within range of target

			var weapon = critterGetEquippedWeapon(player)
			if(weapon === null) {
				console.log("You have no weapon equipped!")
				return
			}

			if(weapon.weapon.isCalled()) {
				var art = "art/critters/hmjmpsna" // default art
				if(critterHasAnim(who, "called-shot"))
					art = critterGetAnim(who, "called-shot")

				console.log("art: %s", art)

				uiCalledShot(art, who, function(region) {
					player.AP.subtractCombatAP(4)
					console.log("Attacking %s...", region)
					combat.attack(player, obj, region)
					uiCloseCalledShot()
				})
			}
			else {
				player.AP.subtractCombatAP(4)
				console.log("Attacking the torso...")
				combat.attack(player, obj, "torso")
			}

			return
		}
	}

	var callback = function() {
		player.clearAnim()

		// if there's an object under the cursor, use it
		if(obj.type === "critter") {
			if(who.dead !== true && inCombat !== true &&
			   obj._script && obj._script.talk_p_proc !== undefined) {
				// talk to a critter
				console.log("Talking to " + critterGetName(who))
				scriptingEngine.talk(who._script, who)
			}
			else if(who.dead === true) {
				// loot a dead body
				uiLoot(obj)
			}
			else console.log("Cannot talk to/loot that critter")
		}
		else
			useObject(obj, player)
	}

	if(Config.engine.doInfiniteUse === true)
		callback()
	else
		critterMoveInFrontOf(player, obj.position, callback)
}

heart.mousepressed = function(x, y, btn) {
	if(isLoading === true) return
	if(btn !== "l") return
	playerUse()
}

heart.keydown = function(k) {
	if(isLoading === true) return
	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

	if(k === Config.controls.cameraDown) cameraY += 15
	if(k === Config.controls.cameraRight) cameraX += 15
	if(k === Config.controls.cameraLeft) cameraX -= 15
	if(k === Config.controls.cameraUp) cameraY -= 15
	if(k === Config.controls.elevationDown) { if(currentElevation-1 >= 0) gMap.changeElevation(currentElevation-1) }
	if(k === Config.controls.elevationUp) { if(currentElevation+1 < gMap.numLevels) gMap.changeElevation(currentElevation+1) }
	if(k === Config.controls.showRoof) { Config.ui.showRoof = !Config.ui.showRoof }
	if(k === Config.controls.showFloor) { Config.ui.showFloor = !Config.ui.showFloor }
	if(k === Config.controls.showObjects) { Config.ui.showObjects = !Config.ui.showObjects }
	if(k === Config.controls.showWalls) Config.ui.showWalls = !Config.ui.showWalls
	if(k === Config.controls.talkTo) {
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
	if(k === Config.controls.inspect) {
		for(var i = 0; i < gObjects.length; i++) {
			if(gObjects[i].position.x === mouseHex.x && gObjects[i].position.y === mouseHex.y) {
				var hasScripts = (gObjects[i].script !== undefined ? ("yes (" + gObjects[i].script + ")") : "no") + " " + (gObjects[i]._script === undefined ? "and is NOT loaded" : "and is loaded")
				console.log("object is at index " + i + ", of type " + gObjects[i].type + ", has art " + gObjects[i].art + ", and has scripts? " + hasScripts + " -> %o", gObjects[i])
			}
		}
	}
	if(k === Config.controls.moveTo) {
		critterWalkTo(player, mouseHex)
	}
	if(k === Config.controls.runTo) {
		critterWalkTo(player, mouseHex, true)
	}
	if(k === Config.controls.attack) {
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

	if(k === Config.controls.combat) {
		if(!Config.engine.doCombat) return
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

	if(k === Config.controls.playerToTargetRaycast) {
		var obj = objectsAtPosition(mouseHex)[0]
		if(obj !== undefined) {
			var hit = hexLinecast(player.position, obj.position)
			console.log("hit obj: " + hit.art)
		}
	}

	if(k === Config.controls.showTargetInventory) {
		var obj = objectsAtPosition(mouseHex)[0]
		if(obj !== undefined) {
			console.log("PID: " + obj.pid)
			console.log("inventory: " + JSON.stringify(obj.inventory))
			uiLoot(obj)
		}
	}

	if(k === Config.controls.use) {
		var objs = objectsAtPosition(mouseHex)
		for(var i = 0; i < objs.length; i++) {
			useObject(objs[i])
		}
	}

	if(k === 'h')
		player.move(mouseHex)

	if(k === Config.controls.kill) {
		var objs = objectsAtPosition(mouseHex)
		for(var i = 0; i < objs.length; i++) {
			if(objs[i].type === "critter") {
				critterKill(objs[i], player)
				break
			}
		}
	}

	if(k === Config.controls.worldmap)
		uiWorldMap()

	//if(k == calledShotKey)
	//	uiCalledShot()

	//if(k == 'a')
	//	Worldmap.checkEncounters()
}

function recalcPath(start: Point, goal: Point, isGoalBlocking?: boolean) {
	var matrix = new Array(HEX_GRID_SIZE)

	for(var y = 0; y < HEX_GRID_SIZE; y++)
		matrix[y] = new Array(HEX_GRID_SIZE)

	for(var i = 0; i < gObjects.length; i++) {
		// if there are multiple, any blocking one will block
		var obj = gObjects[i]
		matrix[obj.position.y][obj.position.x] |= <any>obj.blocks()
	}

	if(isGoalBlocking === false)
		matrix[goal.y][goal.x] = 0

	var grid = new PF.Grid(HEX_GRID_SIZE, HEX_GRID_SIZE, matrix)
	var finder = new PF.BestFirstFinder()
	return finder.findPath(start.x, start.y, goal.x, goal.y, grid)
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
		if(loadingAssetsLoaded === loadingAssetsTotal) {
			isLoading = false
			if(loadingLoadedCallback) loadingLoadedCallback()
		}
		else return
	}
	if(uiMode !== UI_MODE_NONE)
		return
	var time = heart.timer.getTime()

	$("#fpsOverlay").text("fps: " + heart.timer.getFPS())

	if(gameHasFocus) {
		var mousePos = heart.mouse.getPosition()
		if(mousePos[0] <= Config.ui.scrollPadding) cameraX -= 15
		if(mousePos[0] >= SCREEN_WIDTH-Config.ui.scrollPadding) cameraX += 15

		if(mousePos[1] <= Config.ui.scrollPadding) cameraY -= 15
		if(mousePos[1] >= SCREEN_HEIGHT-Config.ui.scrollPadding) cameraY += 15

		if(time >= lastMousePickTime + 750) { // every .75 seconds, check the object under the cursor
			lastMousePickTime = time

			var obj = getObjectUnderCursor(isSelectableObject)
			if(obj !== null)
				changeCursor("pointer")
			else changeCursor("auto")
		}

		for(var i = 0; i < floatMessages.length; i++) {
			if(time >= floatMessages[i].startTime + 1000*Config.ui.floatMessageDuration) {
				floatMessages.splice(i--, 1)
				continue
			}
		}
	}

	var didTick = (time - lastGameTick >= 1000/10) // 10 Hz game tick
	if(didTick) {
		lastGameTick = time
		gameTickTime++

		if(Config.engine.doTimedEvents && !inCombat) {
			// check and update timed events
			var timedEvents = scriptingEngine.timeEventList
			var numEvents = timedEvents.length
			for(var i = 0; i < numEvents; i++) {
				// remove events for dead objects
				if(timedEvents[i].obj && timedEvents[i].obj.dead) {
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

		audioEngine.tick()
	}

	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].type == "critter") {
			if(didTick && Config.engine.doUpdateCritters && inCombat !== true && !(<Critter>gObjects[i]).dead &&
				!gObjects[i].inAnim() && gObjects[i]._script)
				scriptingEngine.updateCritter(gObjects[i]._script, gObjects[i])
		}

		gObjects[i].updateAnim()
	}
}

function getPixelIndex(x, y, imageData) {
	return (x + y * imageData.width) * 4
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

heart.draw = function() {
	return renderer.render()
}

function dialogueReply(id) { scriptingEngine.dialogueReply(id) }
function dialogueEnd() { scriptingEngine.dialogueEnd() }
