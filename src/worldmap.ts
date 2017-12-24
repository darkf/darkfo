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

// World Map system

"use strict";

module Worldmap {
	let worldmap: Worldmap = null
	let worldmapPlayer: WorldmapPlayer = null
	let $worldmap: HTMLElement|null = null
	let $worldmapPlayer: HTMLElement|null = null
	let $worldmapTarget: HTMLElement|null = null
	let worldmapTimer: number = -1
	let lastEncounterCheck = 0

	const WORLDMAP_UNDISCOVERED = 0
	const WORLDMAP_DISCOVERED = 1
	const WORLDMAP_SEEN = 2

	const NUM_SQUARES_X = 4*7
	const NUM_SQUARES_Y = 5*6
	const SQUARE_SIZE = 51

	const WORLDMAP_SPEED = 2 // speed scalar
	const WORLDMAP_ENCOUNTER_CHECK_RATE = 800 // ms (TODO: find right value)

	interface Square {
		terrainType: string, //"mountain" | "ocean" | "desert" | "city" | "ocean"
		fillType: string, //"no_fill" | "fill_w"
		// note: there are frequencies for certain times of day (Morning, Afternoon, Night)
		// but as noted on http://falloutmods.wikia.com/wiki/Worldmap.txt_File_Format
		// they don't appear to be used
		frequency: string, //"forced" | "frequent" | "uncommon" | "common" | "rare" | "none"
		encounterType: string,
		difficulty: number,
		state: number // WORLDMAP_UNDISCOVERED etc (TODO: make an enum)
	}

	interface WorldmapPlayer {
		x: number;
		y: number;
		target: Point;
	}

	interface Worldmap {
		squares: Square[][];
		encounterTables: { [encounterType: string]: EncounterTable };
		encounterGroups: { [groupName: string]: EncounterGroup };
		encounterRates: { [frequency: string]: number };
		terrainSpeed: { [terrainType: string]: number };
	}

	export interface EncounterTable {
		maps: string[];
		encounters: Encounter[];
	}

	export interface Encounter {
		chance: number;
		scenery: any; // TODO: scenery type (string?)
		enc: EncounterRef; //enc.enc ? parseEncounterReference(enc.enc) : enc.enc,
		cond: any; // TODO: condition type
		condOrig: string|null; // Original condition string
		special: string|null;
	}

	export interface EncounterRef {
		type: "ambush" | "fighting";
		target?: "player";
		party: EncounterParty;
		firstParty?: EncounterParty;
		secondParty?: EncounterParty;
	}

	interface EncounterParty {
		start: number;
		end: number;
		name: string;
	}

	export interface EncounterGroup {
		critters: EncounterCritter[];
		position: EncounterPosition;
		target?: "player" | number;
	}

	interface Range {
		start: number;
		end: number;
	}

	interface EncounterItem {
		range?: Range;
		amount?: number;

		pid: number;
		wielded: boolean;
	}

	export interface EncounterCritter {
		position?: Point;
		cond?: Encounters.Node[];
		ratio?: number;

		items: EncounterItem[];
		pid: number;
		script: number;
		dead: boolean;
	}

	export interface EncounterPosition {
		type: string; // Formation
		spacing: number;
	}

	function parseWorldmap(data: string): Worldmap {
		// 20 tiles, 7x6 squares each
		// each tile is 350x300
		// 4 tiles horizontally, 5 vertically

		function parseSquare(data: string): Square {
			const props = data.split(",").map(x => x.toLowerCase())

			return {terrainType: props[0],
			        fillType: props[1],
			        frequency: props[2],
			        encounterType: props[5],
			        difficulty: null,
			        state: null
			       }
		}

		function parseEncounterReference(data: string): any {
			// "(4-8) ncr_masters_army ambush player" 
			if(data === "special1")
				return {type: "special"}

			const party = "(?:\\((\\d+)-(\\d+)\\) ([a-z0-9_]+))"
			const re = party + " ?(?:(ambush player)|(fighting) " + party + ")?"
			const m = data.match(new RegExp(re))
			//console.log("%o %o", re, data)

			const firstParty = {start: parseInt(m[1]),
			                    end: parseInt(m[2]),
			                    name: m[3]
			                   }

			if(m[4] === "ambush player") {
				return {type: "ambush", target: "player", party: firstParty}
			}
			else {
				return {type: "fighting",
				        firstParty: firstParty,
				        secondParty: {
				        	start: parseInt(m[6]),
				        	end: parseInt(m[7]),
				        	name: m[8]
				        }}
			}
		}

		function parseEncounter(data: string): Encounter {
			const s = data.trim().split(",")
			const enc: any = {}
			let isSpecial = false
			let i = 0

			for(; i < s.length; i++) {
				const kv = s[i].split(":")
				if(kv.length === 2)
					enc[kv[0].toLowerCase()] = kv[1].toLowerCase()
				if(s[i].toLowerCase().trim() === "special")
					isSpecial = true
			}

			let cond = s[i-1].toLowerCase().trim()
			if(cond.indexOf('if') !== 0) // conditions start with "if"
				cond = null

			return {chance: parseInt(enc.chance), // integeral percentage
				    scenery: enc.scenery,
				    enc: enc.enc ? parseEncounterReference(enc.enc) : enc.enc,
				    cond: cond ? Encounters.parseConds(cond) : null,
				    special: isSpecial ? enc.map : null,
				    condOrig: cond
			       }
		}

		function parseEncounterItem(data: string) {
			// an item, e.g. Item:7(wielded), Item:(0-10)41
			const m = data.match(/(?:\((\d+)-(\d+)\))?(\d+)(?:\((wielded)\))?/)

			let range = null
			if(m[1] !== undefined)
				range = {start: parseInt(m[1]),
					     end: parseInt(m[2])}

			const item = {range: range,
				          pid: parseInt(m[3]),
				          wielded: (m[4] !== undefined)}

			return item
		}

		function parseEncounterCritter(data: string) {
			const s = data.trim().split(",")
			const enc: any = {}
			const items: EncounterItem[] = []
			let i = 0

			for(; i < s.length; i++) {
				const kv = s[i].split(":").map(x => x.toLowerCase().trim())
				if(kv[0] === "item") {
					items.push(parseEncounterItem(kv[1]))
				}
				else if(kv.length === 2)
					enc[kv[0]] = kv[1]
			}

			const isDead = s[0] === "dead"

			let cond = s[i-1].toLowerCase().trim()
			if(cond.indexOf('if') !== 0) // conditions start with "if"
				cond = null

			return {ratio: enc.ratio ? parseInt(enc.ratio) : null,
				    pid: enc.pid ? parseInt(enc.pid) : null,
				    script: enc.script ? parseInt(enc.script) : null,
				    items: items,
				    dead: isDead,
				    cond: cond ? Encounters.parseConds(cond) : null}
		}

		// Parse a "key:value, key:value" format
		function parseKeyed(data: string) {
			const items = data.split(",").map(x => x.trim())
			const out: { [key: string]: string|number } = {}
			for(let i = 0; i < items.length; i++) {
				const s: any = items[i].split(":")
				if($.isNumeric(s[1]))
					s[1] = parseFloat(s[1])
				out[s[0].toLowerCase()] = s[1]
			}
			return out
		}

		const ini: any = parseIni(data)
		const encounterTables: { [name: string]: EncounterTable } = {}
		const encounterGroups: { [groupName: string]: EncounterGroup } = {}

		const squares: Square[][] = new Array(NUM_SQUARES_X) // (4*7) x (5*6) array (i.e., number of tiles -- 840)
		for(let i = 0; i < NUM_SQUARES_X; i++)
			squares[i] = new Array(NUM_SQUARES_Y)

		// console.log(ini)

		for(const key in ini) {
			const m = key.match(/Tile (\d+)/)
			if(m !== null) {
				const tileNum = parseInt(m[1])
				const tileX = tileNum % 4
				const tileY = Math.floor(tileNum / 4)
				const difficulty = parseInt(ini[key].encounter_difficulty)

				for(const position in ini[key]) {
					const pos = position.match(/(\d)_(\d)/)
					if(pos === null) continue

					const x = tileX * 7 + parseInt(pos[1])
					const y = tileY * 6 + parseInt(pos[2])
					//console.log(tileX + "/" + tileY + " | " + pos[1] + ", " + pos[2] + " -> " + x + ", " + y)

					squares[x][y] = parseSquare(ini[key][position])
					squares[x][y].difficulty = difficulty
					squares[x][y].state = WORLDMAP_UNDISCOVERED
				}
			}
			else if(key.indexOf("Encounter Table") === 0) {
				const name = ini[key].lookup_name.toLowerCase()
				const maps = ini[key].maps.split(",").map((x: string) => x.trim())
				const encounter: EncounterTable = {maps: maps, encounters: []}

				for(const prop in ini[key]) {
					if(prop.indexOf("enc_") === 0) {
						encounter.encounters.push(parseEncounter(ini[key][prop]))
					}
				}
				encounterTables[name] = encounter
			}
			else if(key.indexOf("Encounter:") === 0) {
				const groupName = key.slice("Encounter: ".length).toLowerCase()
				let position = null

				if(ini[key].position !== undefined) {
					const position_ = ini[key].position.split(",").map((x: string) => x.trim().toLowerCase())
					position = {type: position_[0], spacing: 3} // TODO: verify defaults (3 spacing?)
				}
				else { // default
					position = {type: "surrounding", spacing: 5} // TODO: What is distance: "Player(Perception)" ?
				}

				const group: EncounterGroup = {critters: [], position: position}
				for(const prop in ini[key]) {
					if(prop.indexOf("type_") === 0) {
						group.critters.push(parseEncounterCritter(ini[key][prop]))
					}
				}
				encounterGroups[groupName] = group
			}
		}

		const encounterRates: { [frequency: string]: number } = {}
		for(const key in ini.Data) {
			encounterRates[key.toLowerCase()] = parseInt(ini.Data[key])
		}

		// console.log(squares)
		// console.log(encounterTables)
		// console.log(encounterGroups)

		return { squares, encounterTables, encounterGroups, encounterRates,
			     terrainSpeed: parseKeyed(ini.Data.terrain_types) as { [terrainType: string]: number } }
	}

	export function getEncounterGroup(groupName: string): EncounterGroup {
		return worldmap.encounterGroups[groupName]
	}

	function positionToSquare(pos: Point): Point {
		return {x: Math.floor(pos.x / SQUARE_SIZE),
			    y: Math.floor(pos.y / SQUARE_SIZE)}
	}

	function setSquareStateAt(squarePos: Point, newState: number, seeAdjacent: boolean=true): void {
		if(squarePos.x < 0 || squarePos.x >= NUM_SQUARES_X ||
		   squarePos.y < 0 || squarePos.y >= NUM_SQUARES_Y)
			return

		const oldState = worldmap.squares[squarePos.x][squarePos.y].state
		worldmap.squares[squarePos.x][squarePos.y].state = newState

		if(oldState === WORLDMAP_DISCOVERED && newState === WORLDMAP_SEEN)
			return

		// console.log( worldmap.squares[squarePos.x][squarePos.y].fillType )

		// the square element at squarePos
		const stateName: { [state: number]: string } = {}
		stateName[WORLDMAP_UNDISCOVERED] = "undiscovered"
		stateName[WORLDMAP_DISCOVERED] = "discovered"
		stateName[WORLDMAP_SEEN] = "seen"

		//console.log("square: " + squarePos.x + ", " + squarePos.y + " | " + stateName[oldState] + " | " + stateName[newState])

		const $square = document.querySelector(`div.worldmapSquare[square-x='${squarePos.x}'][square-y='${squarePos.y}']`);
		$square.classList.remove("worldmapSquare-" + stateName[oldState]);
		$square.classList.add("worldmapSquare-" + stateName[newState]);

		if(seeAdjacent === true) {
			setSquareStateAt({x: squarePos.x-1, y: squarePos.y}, WORLDMAP_SEEN, false)
			if(worldmap.squares[squarePos.x][squarePos.y].fillType === "fill_w")
				return // only fill the left tile
			setSquareStateAt({x: squarePos.x+1, y: squarePos.y}, WORLDMAP_SEEN, false)

			setSquareStateAt({x: squarePos.x, y: squarePos.y-1}, WORLDMAP_SEEN, false)
			setSquareStateAt({x: squarePos.x, y: squarePos.y+1}, WORLDMAP_SEEN, false)

			// diagonals
			setSquareStateAt({x: squarePos.x-1, y: squarePos.y-1}, WORLDMAP_SEEN, false)
			setSquareStateAt({x: squarePos.x+1, y: squarePos.y-1}, WORLDMAP_SEEN, false)
			setSquareStateAt({x: squarePos.x-1, y: squarePos.y+1}, WORLDMAP_SEEN, false)
			setSquareStateAt({x: squarePos.x+1, y: squarePos.y+1}, WORLDMAP_SEEN, false)
		}
	}

	function execEncounter(encTable: EncounterTable): void {
		const enc = Encounters.evalEncounter(encTable)
		console.log("final: map %s, groups %o", enc.mapName, enc.groups)

		// load map
		gMap.loadMap(enc.mapName, undefined, undefined, function() {
			// set up critters' positions in their formations
			Encounters.positionCritters(enc.groups, player.position, lookupMapFromLookup(enc.mapLookupName))

			enc.groups.forEach(function(group) {
				group.critters.forEach(function(critter) {
					//console.log("critter: %o", critter)
					const obj = createObjectWithPID(critter.pid, critter.script ? critter.script : undefined)
					//console.log("obj: %o", obj)

					// TODO: items & equipping
					gMap.addObject(obj)
					obj.move(critter.position)
				})
			})

			// player was ambushed, so begin combat
			if(enc.encounterType === "ambush" && Config.engine.doCombat === true)
				Combat.start()
		})
	}

	export function doEncounter(): void {
		const squarePos = positionToSquare(worldmapPlayer)
		const square = worldmap.squares[squarePos.x][squarePos.y]
		const encTable = worldmap.encounterTables[square.encounterType]

		console.log("enc table: %s -> %o", square.encounterType, encTable)
		execEncounter(encTable)
	}

	export function didEncounter(): boolean {
		const squarePos = positionToSquare(worldmapPlayer)
		const square = worldmap.squares[squarePos.x][squarePos.y]
		const encRate = worldmap.encounterRates[square.frequency]

		//console.log("square: %o, worldmap: %o, encRate: %d", square, worldmap, encRate)

		if(encRate === 0) // 0% encounter rate (none)
			return false
		else if(encRate === 100) // 100% encounter rate (forced)
			return true
		else { // roll for it
			// TODO: adjust for difficulty:
			// If easy difficulty, encRate -= encRate / 15
			// If hard difficulty, encRate += encRate / 15

			const roll = getRandomInt(0, 100)
			console.log("encounter: rolled %d vs %d", roll, encRate)

			if(roll < encRate) {
				// We rolled an encounter!
				return true
			}
		}

		return false
	}

	function centerWorldmapTarget(x: number, y: number): void {
		$worldmapTarget.style.left = (x - $worldmapTarget.offsetWidth/2|0) + "px";
		$worldmapTarget.style.top = (y - $worldmapTarget.offsetHeight/2|0) + "px";
	}

	export function init(): void {
		/*$("#worldmap").mousemove(function(e) {
			var offset = $(this).offset()
			var x = e.pageX - parseInt(offset.left)
			var y = e.pageY - parseInt(offset.top)

			var scrollLeft = $(this).scrollLeft()
			var scrollTop = $(this).scrollTop()

			console.log(scrollLeft + " | " +  $(this).width())

			if(x <= 15) $(this).scrollLeft(scrollLeft - 15)
			if(x >= $(this).width() - 15) { console.log("y"); $(this).scrollLeft(scrollLeft + 15) }

			console.log(x + ", " + y)
		})*/

		$worldmapPlayer = $id("worldmapPlayer")
		$worldmapTarget = $id("worldmapTarget")
		$worldmap = $id("worldmap")

		worldmap = parseWorldmap(getFileText("data/data/worldmap.txt"))

		if(!mapAreas)
			mapAreas = loadAreas()

		$worldmap.onclick = function(this: HTMLElement, e: MouseEvent) {
			// Calculate viewport-relative offset
			const box = this.getBoundingClientRect();
			const offsetLeft = box.left|0 + window.pageXOffset;
			const offsetTop = box.top|0 + window.pageYOffset;

			const x = e.pageX - offsetLeft
			const y = e.pageY - offsetTop

			const ax = x + this.scrollLeft
			const ay = y + this.scrollTop

			worldmapPlayer.target = {x: ax, y: ay}
			showv($worldmapPlayer);
			Object.assign($worldmapTarget.style, { backgroundImage: "url('art/intrface/wmaptarg.png')",
				                 left: ax + "px", top: ay + "px"});
			console.log("targeting: " + ax + ", " + ay)
		};

		$worldmapTarget.onclick = function(e: MouseEvent) {
			const area = withinArea(worldmapPlayer)
			if(area !== null) {
				// we're on a hotspot, visit the area map
				e.stopPropagation()
				uiWorldMapShowArea(area)
			}
			else {
				// we're in an open area, do nothing
			}
		};

		for(const key in mapAreas) {
			const area = mapAreas[key]
			if(area.state !== true) continue

			const $area = makeEl("div", { classes: ["area"] });
			$worldmap.appendChild($area);

			//console.log("adding one @ " + area.worldPosition.x + ", " + area.worldPosition.y)
			const $el = makeEl("div", { classes: ["areaCircle", "areaSize-" + area.size] });
			$area.appendChild($el);

			// transform the circle since (0,0) is the top-left instead of center
			const x = area.worldPosition.x - $el.offsetWidth / 2
			const y = area.worldPosition.y - $el.offsetHeight / 2
			//console.log("adding one @ " + x + ", " + y + " | " + $el.width() + ", " + $el.height())
			//console.log("size = " + area.size)
			$area.style.left = x + "px";
			$area.style.top = y + "px";

			//if(area.name==="Arroyo")console.log("ARROYO IS " + key)

			const $label = makeEl("div", { classes: ["areaLabel"], style: { left: "0px", top: (2 + $el.offsetHeight) + "px" } });
			$area.appendChild($label);
			$label.textContent = area.name;
		}

		for(let x = 0; x < NUM_SQUARES_X; x++) {
			for(let y = 0; y < NUM_SQUARES_Y; y++) {
				let state: string|number = worldmap.squares[x][y].state
				if(state === WORLDMAP_UNDISCOVERED) state = "undiscovered"
				else if(state === WORLDMAP_DISCOVERED) state = "discovered"
				else if(state === WORLDMAP_SEEN) state = "seen"

				const $el = makeEl("div", { classes: ["worldmapSquare", "worldmapSquare-" + state],
											style: {
												left: (x*SQUARE_SIZE) + "px",
												top: (y*SQUARE_SIZE) + "px"
											},
											attrs: {
												"square-x": x + "",
												"square-y": y + ""
											}
				});
				$worldmap.appendChild($el);
			}
		}

		worldmapPlayer = {x: mapAreas[0].worldPosition.x, y: mapAreas[0].worldPosition.y, target: null}
		$worldmapTarget.style.left = worldmapPlayer.x + "px";
		$worldmapTarget.style.top = worldmapPlayer.y + "px";

		setSquareStateAt(positionToSquare(worldmapPlayer), WORLDMAP_DISCOVERED)

		if(withinArea(worldmapPlayer) !== null) {
			hidev($worldmapPlayer);
			$worldmapTarget.style.backgroundImage = "url('art/intrface/hotspot1.png')";
		}

		// updateWorldmapPlayer()
	}

	export function start() {
		updateWorldmapPlayer()
	}

	export function stop() {
		clearTimeout(worldmapTimer)
	}

	// check if we're inside an area
	function withinArea(position: Point) {
		for(const areaNum in mapAreas) {
			const area = mapAreas[areaNum]
			const radius = (area.size === "large" ? 32 : 16) // guessing for now

			if(pointIntersectsCircle(area.worldPosition, radius, position)) {
				console.log("intersects " + area.name)
				return area
			}
		}

		return null
	}

	function updateWorldmapPlayer() {
		$worldmapPlayer.style.left = worldmapPlayer.x + "px";
		$worldmapPlayer.style.top = worldmapPlayer.y + "px";

		if(worldmapPlayer.target) {
			let dx = worldmapPlayer.target.x - worldmapPlayer.x
		    let dy = worldmapPlayer.target.y - worldmapPlayer.y
		    const len = Math.sqrt(dx*dx + dy*dy)

		    const squarePos = positionToSquare(worldmapPlayer)
		    const currentSquare = worldmap.squares[squarePos.x][squarePos.y]
		    const speed = WORLDMAP_SPEED / worldmap.terrainSpeed[currentSquare.terrainType]

		    if(len < speed) {
		    	worldmapPlayer.x = worldmapPlayer.target.x
		    	worldmapPlayer.y = worldmapPlayer.target.y
		    	worldmapPlayer.target = null

		    	hidev($worldmapPlayer);
		    	$worldmapTarget.style.backgroundImage = "url('art/intrface/hotspot1.png')";
    			centerWorldmapTarget(worldmapPlayer.x, worldmapPlayer.y)
		    }
		    else {
		    	// normalize direction
			    dx /= len
			    dy /= len

			    // head towards it
			    worldmapPlayer.x += dx * speed
			    worldmapPlayer.y += dy * speed
			}


			// center the worldmap to the player
			const width = $worldmap.offsetWidth
			const height = $worldmap.offsetHeight
			const sx = clamp(0, width, Math.floor(worldmapPlayer.x - width/2))
			const sy = clamp(0, height, Math.floor(worldmapPlayer.y - height/2))

			$worldmap.scrollLeft = sx;
			$worldmap.scrollTop = sy;

		    
		    if(currentSquare.state !== WORLDMAP_DISCOVERED)
		    	setSquareStateAt(squarePos, WORLDMAP_DISCOVERED)

		    // check for encounters
		    const time = heart.timer.getTime()
		    if(Config.engine.doEncounters === true && (time >= lastEncounterCheck + WORLDMAP_ENCOUNTER_CHECK_RATE)) {
		    	lastEncounterCheck = time

			    const hadEncounter = didEncounter()
			    if(hadEncounter === true) {
			    	$worldmapPlayer.style.backgroundImage = "url('art/intrface/wmapfgt0.png')";

			    	// TODO: Disable Worldmap UI while waiting on this!

			    	setTimeout(function() {
				    	doEncounter()
				    	uiCloseWorldMap()
				    	$worldmapPlayer.style.backgroundImage = "url('art/intrface/wmaploc.png')";
				    }, 1000)

			    	clearTimeout(worldmapTimer)
			    	return
			    }
			}
		}

		worldmapTimer = setTimeout(updateWorldmapPlayer, 75)
	}
}
