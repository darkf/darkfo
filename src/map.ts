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

// Representation of game map and its serialized forms

"use strict";

// TODO: Spatial type
type Spatial = any;

interface SerializedMap {
	name: string;
	mapID: number;
	numLevels: number;

	mapScript: /* SerializedScript */ any;
	objects: /* SerializedObj */ any[][];
	spatials: /* SerializedSpatial */ any[][];

	floorMap: string[][];
	roofMap: string[][];

	mapObj: any; // required?
}

class GameMap {
	name: string = null;
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

	addObject(obj: Obj, level?: number): void {
		this.objects[level === undefined ? this.currentElevation : level].push(obj)
	}

	removeObject(obj: Obj): void {
		// remove `obj` from the map
		// it would be pretty hard to remove it anywhere else without either
		// a walk of the object graph or a `parent` reference.
		//
		// so we're only going to remove it from the global object list, if present.

		// TODO: use a removal queue instead of removing directory (indexing problems)

		// TODO: better object equality testing
		for(var level = 0; level < this.numLevels; level++) {
			var objects = this.objects[level]
			for(var i = 0; i < objects.length; i++) {
				if(objects[i] === obj) {
					console.log("removeObject: destroying index %d (%o/%o)", i, obj, objects[i])
					this.objects[level].splice(i, 1)
					return
				}
			}
		}

		console.log("removeObject: couldn't find object on map")
		console.trace()
	}

	destroyObject(obj: Obj): void {
		this.removeObject(obj)

		// TODO: notify scripts with destroy_p_proc
	}

	updateMap(): void {
		scriptingEngine.updateMap(this.mapScript, this.getObjectsAndSpatials(), this.currentElevation)
	}

	changeElevation(level: number, updateScripts: boolean=false, isMapLoading: boolean=false) {
		var oldElevation = this.currentElevation
		this.currentElevation = level
		this.floorMap = this.mapObj.levels[level].tiles.floor
		this.roofMap  = this.mapObj.levels[level].tiles.roof
		//this.spatials = this.mapObj.levels[level]["spatials"]

		// If we're in combat, end it since we're moving off of that elevation
		inCombat && combat.end();

		player.clearAnim()

		// remove the player/party from the old objects list
		// and add the them to the new one
		var party = gParty.getPartyMembersAndPlayer()
		party.forEach((obj: Critter) => {
			_.pull(this.objects[oldElevation], obj)
			this.objects[level].push(obj)
		})

		this.placeParty()

		// set up renderer data
		renderer.initData(this.roofMap, this.floorMap, this.getObjects())

		if(updateScripts) {
			// TODO: we need some kind of active/inactive flag on scripts to toggle here,
			// since scripts should already be loaded
			//loadObjectScripts(gObjects)
			scriptingEngine.updateMap(this.mapScript, this.getObjectsAndSpatials(), level)
		}

		// rebuild the lightmap
		if(Config.engine.doFloorLighting) {
			Lightmap.resetLight()
			Lightmap.rebuildLight()
		}

		centerCamera(player.position)

		Events.emit("elevationChanged", { oldElevation, isMapLoading })
	}

	placeParty() {
		// set up party members' positions
		gParty.getPartyMembers().forEach((obj: Critter) => {
			// attempt party member placement around player
			var placed = false
			for(var dist = 1; dist < 3; dist++) {
				for(var dir = 0; dir < 6; dir++) {
					var pos = hexInDirectionDistance(player.position, dir, dist)
					if(objectsAtPosition(pos).length === 0) {
						obj.position = pos
						console.log("placed %o @ %o", obj, pos)
						placed = true
						break
					}
				}

				if(placed)
					break
			}

			if(!placed)
				console.log("couldn't place %o (player position: %o)", obj, player.position)
		})
	}

	loadMap(mapName: string, startingPosition?: Point, startingElevation?: number, loadedCallback?: () => void): void {
		if(Config.engine.doSaveDirtyMaps && this.name !== null) { // if a map is already loaded, save it to the dirty map cache before loading
			console.log(`[Main] Serializing map ${this.name} and committing to dirty map cache`);
			dirtyMapCache[this.name] = this.serialize();
		}


		if(mapName in dirtyMapCache) { // previously loaded; load from dirty map cache
			console.log(`[Main] Loading map ${mapName} from dirty map cache`);

			Events.emit("loadMapPre");
			
			const map = dirtyMapCache[mapName];
			this.deserialize(map);

			// set position and orientation
			if(startingPosition !== undefined)
				player.position = startingPosition;
			else // use default map starting position
				player.position = map.mapObj.startPosition;

			player.orientation = map.mapObj.startOrientation;

			// set elevation
			if(startingElevation !== undefined)
				this.changeElevation(startingElevation, true, true);
			else // use default map elevation (0)
				this.changeElevation(0, true, true);

			console.log(`[Main] Loaded from dirty map cache`);
			loadedCallback && loadedCallback();

			Events.emit("loadMapPost");
		}
		else {
			console.log(`[Main] Loading map ${mapName} from clean load`);
			this.loadNewMap(mapName, startingPosition, startingElevation, loadedCallback);
		}
	}

	loadNewMap(mapName: string, startingPosition?: Point, startingElevation?: number, loadedCallback?: () => void) {
		function load(file: string, callback?: (x:any) => void) {
			if(images[file] !== undefined) return // don't load more than once
			loadingAssetsTotal++
			heart.graphics.newImage(file+".png", (r: HeartImage) => {
				images[file] = r
				loadingAssetsLoaded++
				if(callback) callback(r)
			})
		}

		this.name = mapName.toLowerCase()

		Events.emit("loadMapPre");

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
			this.objects[level] = map.levels[level].objects.map((obj: any) => objFromMapObject(obj))
		}

		if(Config.engine.doLoadScripts) {
			scriptingEngine.init(player, mapName)
			try {
				this.mapScript = scriptingEngine.loadScript(mapName)
				scriptingEngine.setMapScript(this.mapScript)
			}
			catch(e) {
				this.mapScript = null
				console.log("ERROR LOADING MAP SCRIPT:", e.message)
			}
		}
		else
			this.mapScript = null

		// warp to the default position (may be overridden by map script)
		player.position = startingPosition || map.startPosition
		player.orientation = map.startOrientation

		if(Config.engine.doSpatials) {
			this.spatials = map.levels.map((level: any) => level.spatials)

			if(Config.engine.doLoadScripts) {
				// initialize spatial scripts
				this.spatials.forEach((level: any) => level.forEach((spatial: Spatial) => {
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
		}
		else // TODO: Spatial type
			this.spatials = map.levels.map((_: any) => [] as Spatial[])

		// TODO: Is here or above better? Are the map/spatial scripts loaded before or after object scripts?
		// load map objects
		// this.objects = new Array(map.levels.length)
		// for(var level = 0; level < map.levels.length; level++) {
		// 	this.objects[level] = map.levels[level].objects.map(obj => objFromMapObject(obj))
		// }

		// change to our new elevation (sets up map state)
		this.changeElevation(elevation, false, true)

		// TODO: when exactly are these called?
		// TODO: when objectsAndSpatials is updated, the scripting engine won't know
		var objectsAndSpatials = this.getObjectsAndSpatials()

		if(Config.engine.doLoadScripts) {
			// party member NPCs get the new map script
			gParty.getPartyMembers().forEach((obj: Critter) => {
				obj._script._mapScript = this.mapScript
			})

			scriptingEngine.enterMap(this.mapScript, objectsAndSpatials, this.currentElevation, this.mapID, true)

			// place party again, so if the map script overrided the start position we're in the right place
			this.placeParty()
	
			// tell objects that they're now on the map
			this.objects.forEach(level => level.forEach(obj => obj.enterMap()))
			this.spatials.forEach(level => level.forEach(spatial => scriptingEngine.objectEnterMap(spatial, this.currentElevation, this.mapID)))

			scriptingEngine.updateMap(this.mapScript, objectsAndSpatials, elevation)

			// change elevation with script updates
			this.changeElevation(elevation, true, true)
		}

		// TODO: is map_enter_p_proc called on elevation change?
		console.log("loaded (" + map.levels.length + " levels, " +this.getObjects().length + " objects on elevation " + elevation + ")")

		// load some testing art
		load("art/critters/hmjmpsat")
		load("hex_outline", (r: any) => { hexOverlay = r })

		loadingAssetsTotal-- // we should know all of the assets we need by now

		// clear audio and use the map music
		var curMapInfo = getCurrentMapInfo()
		audioEngine.stopAll()
		if(curMapInfo && curMapInfo.music)
			audioEngine.playMusic(curMapInfo.music)

		Events.emit("loadMapPost");
	}

	loadMapByID(mapID: number, startingPosition?: Point, startingElevation?: number): void {
		var mapName = lookupMapName(mapID)
		if(mapName !== null)
			this.loadMap(mapName, startingPosition, startingElevation)
		else
			console.log("couldn't lookup map name for map ID " + mapID)
	}

	serialize(): SerializedMap {
		return {
			name: this.name,
			mapID: this.mapID,
			numLevels: this.numLevels,
			mapObj: { levels: this.mapObj.levels.map((level: any) => ({tiles: level.tiles}))
			        , startPosition: this.mapObj.startPosition
			        , startOrientation: this.mapObj.startOrientation
		            },

			// roof/floor maps
			roofMap: this.roofMap,
			floorMap: this.floorMap,

			mapScript: this.mapScript ? this.mapScript._serialize() : null,
			objects: this.objects.map((level: Obj[]) =>
				_.without(level, player).map((obj: Obj) => obj.serialize())), // TODO: Should be without entire party?
			spatials: null //this.spatials.map(level => level.map(spatial:> spatial.serialize()))
		}
	}

	deserialize(obj: SerializedMap): void {
		this.name = obj.name
		this.mapID = obj.mapID
		this.numLevels = obj.numLevels
		this.mapObj = obj.mapObj
		this.mapScript = obj.mapScript ? scriptingEngine.deserializeScript(obj.mapScript) : null
		this.objects = obj.objects.map(level => level.map(obj => deserializeObj(obj)))
		this.spatials = [[],[],[]] //obj.spatials // TODO: deserialize
		this.roofMap = obj.roofMap
		this.floorMap = obj.floorMap
		this.currentElevation = 0 // TODO

		//this.mapObj = {levels: [{tiles: {floor: this.floorMap, roof: this.roofMap}}]} // TODO: add dimension to roofMap

		// TODO: reset scriptingEngine?
	}
}
