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

// Functions handling FO2 prototypes and lookups performed on them

function getPROType(pid: number) {
	var map = {0: 'items', 1: 'critters', 2: 'scenery', 3: 'walls', 4: 'tiles', 5: 'misc'}
	return map[(pid >> 24) & 0xff]
}

function loadPRO(pid: number, pidID: number) {
	if(!proMap)
		return null

	// use the proto/ .lst files to look up type/pid
	const type = getPROType(pid)
	const lsts = {"items": "proto/items/items", "critters": "proto/critters/critters",
                "scenery": "proto/scenery/scenery", "misc": "proto/misc/misc",
                "walls": "proto/walls/walls"}
	const id = lsts[type] ? parseInt(getLstId(lsts[type], pidID - 1).split(".")[0], 10) : pidID

	return proMap[type][id]
}

function getPROTypeName(type: number) {
	// singular
	var map = {0: 'item', 1: 'critter', 2: 'scenery', 3: 'wall', 4: 'tile', 5: 'misc'}
	return map[type]
}

function getPROSubTypeName(type: number): string {
	var map = {0: 'armor', 1: 'container', 2: 'drug', 3: 'weapon', 4: 'ammo', 5: 'misc', 6: 'key'}
	return map[type]
}

function makePID(type: number, pid: number) {
	return (type << 24) | pid
}

function getCritterArtPath(frmPID: number) {
	console.log("FRM PID: " + frmPID)
	var idx = (frmPID & 0x00000fff)
	var id1 = (frmPID & 0x0000f000) >> 12
	var id2 = (frmPID & 0x00ff0000) >> 16
	//var id3 = (frmPID & 0x70000000) >> 28

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
		/*if(id1 === 0x01)
			path += "dm"
		else if(id1 === 0x04)
			path += "gm"
		else
			path += "as"*/
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

function lookupInterfaceArt(idx: number) {
	return "art/intrface/" + getLstId("art/intrface/intrface", idx).split('.')[0].toLowerCase()
}

function lookupArt(frmPID: number) {
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
