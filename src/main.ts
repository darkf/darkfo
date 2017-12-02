/*
Copyright 2014-2017 darkf

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
declare var $: any;
declare var _: any;
declare var heart: any;
declare var PF: any;
declare var pako: any;

interface HeartImage {
	img: HTMLImageElement;
	getWidth(): number;
	getHeight(): number;
}

var gMap: GameMap|null = null
const images: { [name: string]: HeartImage } = {} // Image cache
var imageInfo: any = null // Metadata about images (Number of frames, FPS, etc)
var currentElevation = 0 // current map elevation
var hexOverlay: HeartImage|null = null
var tempCanvas: HTMLCanvasElement|null = null // temporary canvas used for detecting single pixels
var tempCanvasCtx: CanvasRenderingContext2D|null = null // and the context for it

// position of viewport camera (will be overriden by map starts or scripts)
var cameraX: number = 3580
var cameraY: number = 1020

const SCREEN_WIDTH: number = Config.ui.screenWidth
const SCREEN_HEIGHT: number = Config.ui.screenHeight

var gameTickTime: number = 0 // in Fallout 2 ticks (elapsed seconds * 10)
var lastGameTick: number = 0 // real time of the last game tick
var combat: Combat|null = null // combat object
var inCombat: boolean = false // are we currently in combat?
var gameHasFocus: boolean = false // do we have input focus?
var lastMousePickTime: number = 0 // time when we last checked what's under the mouse cursor
var _lastFPSTime: number = 0 // Time since FPS counter was last updated

enum Skills {
	None = 0,
	Lockpick,
	Repair
}
var skillMode: Skills = Skills.None

var isLoading: boolean = true // are we currently loading a map?
var isWaitingOnRemote: boolean = false; // are we waiting on the remote server to send critical info?
var isInitializing: boolean = true // are we initializing the engine?
var loadingAssetsLoaded: number = 0 // how many images we've loaded
var loadingAssetsTotal: number = 0 // out of this total
var loadingLoadedCallback: (() => void)|null = null // loaded callback
var lazyAssetLoadingQueue: { [name: string]: ((img: any) => void)[] } = {} // set of lazily-loaded assets being loaded

interface FloatMessage {
	msg: string;
	obj: Obj;
	startTime: number;
	color: string;
}

const floatMessages: FloatMessage[] = []

// the global player object
var player: Player|null = null

var renderer: Renderer|null = null
var audioEngine: AudioEngine|null = null

function repr(obj: any) { return JSON.stringify(obj, null, 2) }

function lazyLoadImage(art: string, callback?: (x: any) => void, isHeartImg?: boolean) {
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

function lookupScriptName(scriptID: number) {
	console.log("SID: " + scriptID)
	return getLstId("scripts/scripts", scriptID - 1).split('.')[0].toLowerCase()
}

function dropObject(source: Obj, obj: Obj) {
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

	gMap.addObject(obj) // add to objects
	var idx = gMap.getObjects().length - 1 // our new index
	obj.move({x: source.position.x, y: source.position.y}, idx)
}

function pickupObject(obj: Obj, source: Critter) {
	if(obj._script) {
		console.log("picking up %o", obj)
		scriptingEngine.pickup(obj, source)
	}
}

// Draws a line between a and b, returning the first object hit
function hexLinecast(a: Point, b: Point): Obj|null {
	var line = hexLine(a, b).slice(1, -1)
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

function objectsAtPosition(position: Point): Obj[] {
	return gMap.getObjects().filter((obj: Obj) => obj.position.x === position.x && obj.position.y === position.y)
}

function critterAtPosition(position: Point): Critter|null {
	return _.find(objectsAtPosition(position), (obj: Obj) => obj.type === "critter") || null
}

function centerCamera(around: Point) {
	var scr = hexToScreen(around.x, around.y)
	cameraX = Math.max(0, scr.x - SCREEN_WIDTH/2 | 0)
	cameraY = Math.max(0, scr.y - SCREEN_HEIGHT/2 | 0)
}

function initGame() {
	// initialize player
	player = new Player()

	// initialize map
	gMap = new GameMap()

	uiLog("Welcome to DarkFO")

	if(location.search !== "") {
		// load map from query string (e.g. URL ending in ?modmain)
		// also check if it's trying to connect to a remote server

		const query = location.search.slice(1);

		if(query.indexOf("host=") === 0) { // host a multiplayer map
			const mapName = query.split("host=")[1]
			console.log("MP host map", mapName);

			// Disallow combat, for now, since it breaks things with guest players.
			Config.engine.doCombat = false;

			gMap.loadMap(mapName);

			Netcode.connect("ws://localhost:8090", () => {
				console.log("connected");

				Netcode.identify("Host Player");
				Netcode.host();
				Netcode.changeMap();
			});
		}
		else if(query.indexOf("join=") === 0) { // join a multiplayer host
			const host = query.split("join=")[1];
			console.log("MP server host: %s", host);

			// Disable scripts on the client as they'd differ from the remote host and muck up the simulation
			Config.engine.doLoadScripts = false;
			Config.engine.doUpdateCritters = false;
			Config.engine.doTimedEvents = false;
			Config.engine.doSaveDirtyMaps = false;

			Config.engine.doSpatials = false;
			Config.engine.doEncounters = false;

			// Also disallow things such as combat, for now.
			Config.engine.doCombat = false;

			isWaitingOnRemote = true;

			Netcode.connect(`ws://${host}:8090`, () => {
				console.log("connected");

				Netcode.identify("Guest Player");
				Netcode.join();
			});
		}
		else // single-player map
			gMap.loadMap(location.search.slice(1))
	}
	else // load starting map
		gMap.loadMap("artemple")

	if(Config.engine.doCombat === true)
		CriticalEffects.loadTable()

    document.oncontextmenu = function() { return false }
	$("#cnv").mouseenter(function() { gameHasFocus = true }).
	          mouseleave(function() { gameHasFocus = false })

	tempCanvas = $("<canvas>")[0]
	tempCanvasCtx = tempCanvas.getContext("2d")

	SaveLoad.init()

	Worldmap.init()
	
	initUI()
}

heart.load = function() {
	isInitializing = true;

	// initialize renderer
	if(Config.engine.renderer === "canvas")
		renderer = new CanvasRenderer()
	else if(Config.engine.renderer === "webgl")
		renderer = new WebGLRenderer()
	else {
		console.error("No renderer backend named '%s'", Config.engine.renderer)
		throw new Error("Invalid renderer backend");
	}

	renderer.init()

	// initialize audio engine
	if(Config.engine.doAudio)
		audioEngine = new HTMLAudioEngine()
	else
		audioEngine = new NullAudioEngine()

	// initialize cached data

	function cachedJSON(key: string, path: string, callback: (value: any) => void): void {
		// load data from cache if possible, else load and cache it
		IDBCache.get(key, value => {
			if(value) {
				console.log("[Main] %s loaded from cache DB", key);
				callback(value);
			}
			else {
				value = getFileJSON(path);
				IDBCache.add(key, value);
				console.log("[Main] %s loaded and cached", key);
				callback(value);
			}
		});
	}

	IDBCache.init(() => {
		cachedJSON("imageMap", "art/imageMap.json", value => {
			imageInfo = value;

			cachedJSON("proMap", "proto/pro.json", value => {
				proMap = value;

				// continue initialization
				initGame();
				isInitializing = false;
			});
		});
	});
}

function isSelectableObject(obj: any) {
	return obj.visible !== false && (canUseObject(obj) || obj.type === "critter")
}

// Is the skill passive, or does it require a targeted object to use?
function isPassiveSkill(skill: Skills): boolean {
	switch(skill) {
		case Skills.Lockpick: return false
		case Skills.Repair: return false
		default: throw `TODO: is passive skill ${skill}`
	}
}

// Return the skill ID used by the Fallout 2 engine
function getSkillID(skill: Skills): number {
	switch(skill) {
		case Skills.Lockpick: return 9
		case Skills.Repair: return 13
	}

	console.log("unimplemented skill %d", skill)
	return -1
}

function playerUseSkill(skill: Skills, obj: Obj): void {
	console.log("use skill %o on %o", skill, obj)

	if(!obj && !isPassiveSkill(skill))
		throw "trying to use non-passive skill without a target"

	if(!isPassiveSkill(skill)) {
		// use the skill on the object
		scriptingEngine.useSkillOn(player, getSkillID(skill), obj)
	}
	else
		console.log("passive skills are not implemented")
}

function playerUse() {
	// TODO: playerUse should take an object
	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)
	var obj = getObjectUnderCursor(isSelectableObject)
	var who = <Critter>obj

	if(uiMode === UI_MODE_USE_SKILL) { // using a skill on object
		obj = getObjectUnderCursor((_: Obj) => true) // obj might not be usable, so select non-usable ones too
		if(!obj)
			return
		try { playerUseSkill(skillMode, obj) }
		finally {
			skillMode = Skills.None
			uiMode = UI_MODE_NONE
		}
		
		return
	}

	if(obj === null) { // walk to the destination if there is no usable object
		if(!player.walkTo(mouseHex, Config.engine.doAlwaysRun))
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

				uiCalledShot(art, who, (region: string) => {
					player.AP.subtractCombatAP(4)
					console.log("Attacking %s...", region)
					combat.attack(player, <Critter>obj, region)
					uiCloseCalledShot()
				})
			}
			else {
				player.AP.subtractCombatAP(4)
				console.log("Attacking the torso...")
				combat.attack(player, <Critter>obj, "torso")
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
				console.log("Talking to " + who.name)
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
		player.walkInFrontOf(obj.position, callback)
}

heart.mousepressed = (x: number, y: number, btn: string) => {
	if(isInitializing || isLoading || isWaitingOnRemote)
		return
	else if(btn === "l")
		playerUse()
	else if(btn === "r") {
		// item context menu
		var obj = getObjectUnderCursor(isSelectableObject)
		if(obj)
			uiContextMenu(obj, {clientX: x, clientY: y})
	}
}

heart.keydown = (k: string) => {
	if(isLoading === true) return
	var mousePos = heart.mouse.getPosition()
	var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

	if(k === Config.controls.cameraDown) cameraY += 15
	if(k === Config.controls.cameraRight) cameraX += 15
	if(k === Config.controls.cameraLeft) cameraX -= 15
	if(k === Config.controls.cameraUp) cameraY -= 15
	if(k === Config.controls.elevationDown) { if(currentElevation-1 >= 0) gMap.changeElevation(currentElevation-1, true) }
	if(k === Config.controls.elevationUp) { if(currentElevation+1 < gMap.numLevels) gMap.changeElevation(currentElevation+1, true) }
	if(k === Config.controls.showRoof) { Config.ui.showRoof = !Config.ui.showRoof }
	if(k === Config.controls.showFloor) { Config.ui.showFloor = !Config.ui.showFloor }
	if(k === Config.controls.showObjects) { Config.ui.showObjects = !Config.ui.showObjects }
	if(k === Config.controls.showWalls) Config.ui.showWalls = !Config.ui.showWalls
	if(k === Config.controls.talkTo) {
		var critter = critterAtPosition(mouseHex)
		if(critter) {
			if(critter._script && critter._script.talk_p_proc !== undefined) {
				console.log("talking to " + critter.name)
				scriptingEngine.talk(critter._script, critter)
			}
		}
	}
	if(k === Config.controls.inspect) {
		gMap.getObjects().forEach((obj, idx) => {
			if(obj.position.x === mouseHex.x && obj.position.y === mouseHex.y) {
				var hasScripts = (obj.script !== undefined ? ("yes (" + obj.script + ")") : "no") + " " + (obj._script === undefined ? "and is NOT loaded" : "and is loaded")
				console.log("object is at index " + idx + ", of type " + obj.type + ", has art " + obj.art + ", and has scripts? " + hasScripts + " -> %o", obj)
			}
		})
	}
	if(k === Config.controls.moveTo) {
		player.walkTo(mouseHex)
	}
	if(k === Config.controls.runTo) {
		player.walkTo(mouseHex, true)
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
			combat = new Combat(gMap.getObjects())
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
		var critter = critterAtPosition(mouseHex)
		critterKill(critter, player)
	}

	if(k === Config.controls.worldmap)
		uiWorldMap()

	if(k === Config.controls.saveKey)
		uiSaveLoad(true)

	if(k === Config.controls.loadKey)
		uiSaveLoad(false)

	//if(k == calledShotKey)
	//	uiCalledShot()

	//if(k == 'a')
	//	Worldmap.checkEncounters()
}

function recalcPath(start: Point, goal: Point, isGoalBlocking?: boolean) {
	var matrix = new Array(HEX_GRID_SIZE)

	for(var y = 0; y < HEX_GRID_SIZE; y++)
		matrix[y] = new Array(HEX_GRID_SIZE)

	gMap.getObjects().forEach(obj => {
			// if there are multiple, any blocking one will block
			matrix[obj.position.y][obj.position.x] |= <any>obj.blocks()
	})

	if(isGoalBlocking === false)
		matrix[goal.y][goal.x] = 0

	var grid = new PF.Grid(HEX_GRID_SIZE, HEX_GRID_SIZE, matrix)
	var finder = new PF.BestFirstFinder()
	return finder.findPath(start.x, start.y, goal.x, goal.y, grid)
}

function changeCursor(image: string) {
	$("#cnv").css("cursor", image)
}

function objectTransparentAt(obj: Obj, position: Point) {
	var frame = obj.frame !== undefined ? obj.frame : 0
	var sx = imageInfo[obj.art].frameOffsets[obj.orientation][frame].sx

	tempCanvasCtx.clearRect(0, 0, 1, 1) // clear previous color
	tempCanvasCtx.drawImage(images[obj.art].img, sx+position.x, position.y, 1, 1, 0, 0, 1, 1)
	var pixelAlpha = tempCanvasCtx.getImageData(0, 0, 1, 1).data[3]

	return (pixelAlpha === 0)
}

function getObjectUnderCursor(p: (obj: Obj) => boolean) {
	var mouse = heart.mouse.getPosition()
	mouse = {x: mouse[0] + cameraX, y: mouse[1] + cameraY}

	// reverse z-ordered search
	var objects = gMap.getObjects()
	for(var i = objects.length - 1; i > 0; i--) {
		var bbox = objectBoundingBox(objects[i])
		if(bbox === null) continue
		if(pointInBoundingBox(mouse, bbox))
			if(p === undefined || p(objects[i]) === true) {
				var mouseRel = {x: mouse.x - bbox.x, y: mouse.y - bbox.y}
				if(!objectTransparentAt(objects[i], mouseRel))
					return objects[i]
			}
	}

	return null
}

heart.update = function() {
	if(isInitializing || isWaitingOnRemote)
		return;
	else if(isLoading) {
		if(loadingAssetsLoaded === loadingAssetsTotal) {
			isLoading = false
			if(loadingLoadedCallback) loadingLoadedCallback()
		}
		else return
	}
	
	if(uiMode !== UI_MODE_NONE)
		return
	var time = heart.timer.getTime()

	if(time - _lastFPSTime >= 500) {
		$("#fpsOverlay").text("fps: " + heart.timer.getFPS())
		_lastFPSTime = time
	}

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
				const event = timedEvents[i];
				const obj = event.obj;

				// remove events for dead objects
				if(obj && obj instanceof Critter && obj.dead) {
				   	console.log("removing timed event for dead object")
				   	timedEvents.splice(i--, 1)
				   	numEvents--
				    continue
				}

				event.ticks--
				if(event.ticks <= 0) {
					scriptingEngine.info("timed event triggered", "timer")
					event.fn()
					timedEvents.splice(i--, 1)
					numEvents--
				}
			}
		}

		audioEngine.tick()
	}

	gMap.getObjects().forEach(obj => {
		if(obj.type === "critter") {
			if(didTick && Config.engine.doUpdateCritters && inCombat !== true && !(<Critter>obj).dead &&
				!obj.inAnim() && obj._script)
				scriptingEngine.updateCritter(obj._script, obj as Critter)
		}

		obj.updateAnim()
	})
}

// Hopefully this gets inlined!
function getPixelIndex(x: number, y: number, w: number) {
	return (x + y * w) * 4
}

// get an object's bounding box in screen-space (note: not camera-space)
function objectBoundingBox(obj: Obj): BoundingBox {
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

function objectOnScreen(obj: Obj): boolean {
	var bbox = objectBoundingBox(obj)
	if(bbox === null)
		return false

	if(bbox.x + bbox.w < cameraX || bbox.y + bbox.h < cameraY ||
	   bbox.x >= cameraX+SCREEN_WIDTH || bbox.y >= cameraY+SCREEN_HEIGHT)
		return false
	return true
}

heart.draw = () => {
	if(isWaitingOnRemote)
		return;
	return renderer.render()
}

// some utility functions for use in the console
function allCritters() { return gMap.getObjects().filter(obj => obj instanceof Critter) }

// global callbacks for dialogue UI
function dialogueReply(id: number) { scriptingEngine.dialogueReply(id) }
function dialogueEnd() { scriptingEngine.dialogueEnd() }
