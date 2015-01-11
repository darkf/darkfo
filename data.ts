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

"use strict";

var mapAreas = null

var proFiles = {}
var lstFiles = {}
var messageFiles = {}
var mapInfo = null
var elevatorInfo = null

function getElevator(type) {
	if(elevatorInfo === null) {
		console.log("loading elevator info")
		elevatorInfo = getFileJSON("elevators.json")
	}

	return elevatorInfo.elevators[type]
}

function parseAreas(data) {
	var areas = parseIni(data)
	var out = {}
	//console.log("areas:")
	console.log(areas)

	for(var _area in areas) {
		var area = areas[_area]
		var areaID = _area.match(/Area (\d+)/)
		if(areaID === null) throw "CITY.TXT: invalid area name: " + area.area_name
		areaID = parseInt(areaID[1])
		var worldPos = area.world_pos.split(",").map(function(x) { return parseInt(x) })

		var newArea: any = {name: area.area_name,
			           id: areaID,
			           size: area.size.toLowerCase(),
			           state: area.start_state.toLowerCase() === "on",
			       	   worldPosition: {x: worldPos[0], y: worldPos[1]}}

	    // map/label art
		var mapArtIdx = parseInt(area.townmap_art_idx)
		var labelArtIdx = parseInt(area.townmap_label_art_idx)

		//console.log(mapArtIdx + " - " + labelArtIdx)

		if(mapArtIdx !== -1)
			newArea.mapArt = lookupInterfaceArt(mapArtIdx)
		if(labelArtIdx !== -1)
			newArea.labelArt = lookupInterfaceArt(labelArtIdx)

		// entrances
		newArea.entrances = []
		for(var _key in area) {
			// entrance_N
			// e.g.: entrance_0=On,345,230,Destroyed Arroyo Bridge,-1,26719,0

			var s = _key.split("_")
			if(s[0] === "entrance") {
				var entranceString = area[_key]
				s = entranceString.split(",")

				var entrance = {
					startState: s[0],
					x: parseInt(s[1]),
					y: parseInt(s[2]),
					mapLookupName: s[3],
					elevation: parseInt(s[4]),
					tileNum: parseInt(s[5]),
					orientation: parseInt(s[6])
				}
				newArea.entrances.push(entrance)
			}
		}

		out[areaID] = newArea
	}

	console.log("areas:")
	console.log(out)

	return out
}

function loadAreas() {
	return parseAreas(getFileText("data/data/CITY.TXT"))
}

function allAreas() {
	if(mapAreas === null)
		mapAreas = loadAreas()
	var areas = []
	for(var area in mapAreas)
		areas.push(mapAreas[area])
	return areas
}

function loadMessage(name) {
	var msg = getFileText("data/text/english/game/" + name + ".msg")
	if(messageFiles[name] === undefined)
		messageFiles[name] = {}

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
		messageFiles[name][m[1]] = m[2].replace(/\ufffd/g, "'")
	}
}


function loadLst(lst) {
	return getFileText("data/" + lst + ".lst").split('\n')
}

function getLstId(lst, id) {
	if(lstFiles[lst] === undefined)
		lstFiles[lst] = loadLst(lst)
	if(lstFiles[lst] === undefined)
		return null

	return lstFiles[lst][id]
}