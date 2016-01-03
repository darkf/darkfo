/*
Copyright 2015 darkf

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

// Generates a lightmap for floor lighting

// You should call obj_light_table_init whenever the tilemap
// changes (such as through elevation change, or map load.)
//
// obj_rebuild_all_light should be called whenever an object
// moves or the tilemap changes.

module Lightmap {
	function light_reset(): void {
		for(var i = 0; i < tile_intensity.length; i++)
			tile_intensity[i] = 655
	}

	// Tile lightmap
	export var tile_intensity = new Array(40000)
	light_reset()

	var light_offsets = new Array(532)
	zeroArray(light_offsets)

	// length 36
	var light_distance = [1, 2, 3, 4, 5, 6, 7, 8, 2, 3, 4, 5, 6, 7, 8, 3, 4, 5,
	                      6, 7, 8, 4, 5, 6, 7, 8, 5, 6, 7, 8, 6, 7, 8, 7, 8, 8]

	var isInit = false

	function light_subtract_from_tile(tileNum: number, intensity: number) {
		tile_intensity[tileNum] -= intensity
	}

	function light_add_to_tile(tileNum: number, intensity: number) {
		tile_intensity[tileNum] += intensity
	}

	function zeroArray(arr: any[]) {
		for(var i = 0; i < arr.length; i++)
			arr[i] = 0
	}

	function objectAt(pos: Point) {
		return _.find(gMap.getObjects(), obj => obj.position.x === pos.x && obj.position.y === pos.y) || null
	}

	// obj_adjust_light(eax=obj_ptr, ebx=0, edx=0)
	// edx controls whether light is added or subtracted

	function obj_adjust_light(obj: Obj, isSub: boolean=false) {
		var pos = obj.position
		var lightModifier = isSub ? light_subtract_from_tile : light_add_to_tile

		lightModifier(toTileNum(obj.position), obj.lightIntensity)

		obj.lightIntensity = Math.min(obj.lightIntensity, 65536)

		if(!isInit) {
			// init
			console.log("initializing light tables")
			obj_light_table_init()
			isInit = true
		}

		var edx: any, eax
		edx = (pos.x%2)*3 * 32
		eax = edx*9
		//var lightOffsetsStart = light_offsets + eax // so &light_offsets[eax/4|0], we'd use an index here
		var lightOffsetsStart = eax // starting offset into light_offsets

		var light_per_dist = /* obj.lightIntensity - */ (((obj.lightIntensity - 655) / (obj.lightRadius+1)) | 0)

		//console.log("light per dist: %d", light_per_dist)

		var stackArray = new Array(36)
		var idx = 0
		var light = obj.lightIntensity

		light -= light_per_dist
		stackArray[0] = light

		light -= light_per_dist
		stackArray[4/4|0] = light
		stackArray[32/4|0] = light

		light -= light_per_dist
		stackArray[8/4|0] = light
		stackArray[36/4|0] = light
		stackArray[60/4|0] = light

		light -= light_per_dist
		stackArray[12/4|0] = light
		stackArray[40/4|0] = light
		stackArray[64/4|0] = light
		stackArray[84/4|0] = light

		light -= light_per_dist
		stackArray[16/4|0] = light
		stackArray[44/4|0] = light
		stackArray[68/4|0] = light
		stackArray[88/4|0] = light
		stackArray[104/4|0] = light

		light -= light_per_dist
		stackArray[20/4|0] = light
		stackArray[48/4|0] = light
		stackArray[72/4|0] = light
		stackArray[92/4|0] = light
		stackArray[108/4|0] = light
		stackArray[120/4|0] = light

		light -= light_per_dist
		stackArray[24/4|0] = light
		stackArray[52/4|0] = light
		stackArray[76/4|0] = light
		stackArray[96/4|0] = light
		stackArray[112/4|0] = light
		stackArray[124/4|0] = light
		stackArray[132/4|0] = light

		light -= light_per_dist
		stackArray[28/4|0] = light
		stackArray[56/4|0] = light
		stackArray[80/4|0] = light
		stackArray[100/4|0] = light
		stackArray[116/4|0] = light
		stackArray[128/4|0] = light
		stackArray[136/4|0] = light
		stackArray[140/4|0] = light

		var _light_blocked = new Array(36*6)

		// zero arrays
		zeroArray(_light_blocked)

		var ebx, esi, v14
		var isLightBlocked // var_C

		function light_blocked(index) {
			return _light_blocked[index];
		}

		for(var i = 0; i < 36; i++) {
			if(obj.lightRadius >= light_distance[i]) {
				var v26, v27, v28, v29, v30, v31, v32, v33, v34 // temporaries

				for(var ecx = 0; ecx < 6; ecx++) {
					edx = (ecx + 1) % 6

					switch(i) {
			            case 0:
			              isLightBlocked = 0;
			              break;
			            case 1:
			              isLightBlocked = light_blocked(36 * ecx);
			              break
			            case 2:
			              isLightBlocked = light_blocked(36 * ecx + 1);
			              break
			            case 3:
			              isLightBlocked = light_blocked(36 * ecx + 2);
			              break
			            case 4:
			              isLightBlocked = light_blocked(36 * ecx + 3);
			              break
			            case 5:
			              isLightBlocked = light_blocked(36 * ecx + 4);
			              break
			            case 6:
			              isLightBlocked = light_blocked(36 * ecx + 5);
			              break
			            case 7:
			              isLightBlocked = light_blocked(36 * ecx + 6);
			              break
			            case 8:
			              isLightBlocked = light_blocked(36 * edx) & light_blocked(36 * ecx);
			              break
			            case 9:
			              isLightBlocked = light_blocked(36 * ecx + 1) & light_blocked(36 * ecx + 8);
			              break
			            case 10:
			              isLightBlocked = light_blocked(36 * ecx + 2) & light_blocked(36 * ecx + 9);
			              break
			            case 11:
			              isLightBlocked = light_blocked(36 * ecx + 3) & light_blocked(36 * ecx + 10);
			              break
			            case 12:
			              isLightBlocked = light_blocked(36 * ecx + 4) & light_blocked(36 * ecx + 11);
			              break
			            case 13:
			              isLightBlocked = light_blocked(36 * ecx + 5) & light_blocked(36 * ecx + 12);
			              break
			            case 14:
			              isLightBlocked = light_blocked(36 * ecx + 6) & light_blocked(36 * ecx + 13);
			              break
			            case 15:
			              isLightBlocked = light_blocked(36 * edx + 1) & light_blocked(36 * ecx + 8);
			              break
			            case 16:
			              isLightBlocked = light_blocked(36 * ecx + 15) & light_blocked(36 * ecx + 9) | light_blocked(36 * ecx + 8);
			              break;
			            case 17:
			              v26 = light_blocked(36 * ecx + 10) | light_blocked(36 * ecx + 9);
			              isLightBlocked = light_blocked(36 * ecx + 9) & (light_blocked(36 * ecx + 15) | light_blocked(36 * ecx + 10)) | light_blocked(36 * ecx + 16) & v26 | v26 & light_blocked(36 * ecx + 8);
			              break;
			            case 18:
			              isLightBlocked = (light_blocked(36 * ecx + 11) | light_blocked(36 * ecx + 10) | light_blocked(36 * ecx + 9) | light_blocked(36 * ecx)) & light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 9) | light_blocked(36 * ecx + 16) & light_blocked(36 * ecx + 10);
			              break;
			            case 19:
			              isLightBlocked = light_blocked(36 * ecx + 18) & light_blocked(36 * ecx + 12) | light_blocked(36 * ecx + 10) | light_blocked(36 * ecx + 9) | (light_blocked(36 * ecx + 18) | light_blocked(36 * ecx + 17)) & light_blocked(36 * ecx + 11);
			              break;
			            case 20:
			              v27 = light_blocked(36 * ecx + 12) | light_blocked(36 * ecx + 11) | light_blocked(36 * ecx + 2);
			              isLightBlocked = (light_blocked(36 * ecx + 19) | light_blocked(36 * ecx + 18) | light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 16)) & light_blocked(36 * ecx + 11) | v27 & light_blocked(36 * ecx + 8) | light_blocked(36 * ecx + 9) & v27 | light_blocked(36 * ecx + 10);
			              break;
			            case 21:
			              isLightBlocked = light_blocked(36 * edx + 2) & light_blocked(36 * ecx + 15) | light_blocked(36 * ecx + 8) & light_blocked(36 * edx + 1);
			              break;
			            case 22:
			              isLightBlocked = (light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 15)) & light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 15) & (light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 9)) | (light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 15) | light_blocked(36 * edx + 1)) & light_blocked(36 * ecx + 8);
			              break;
			            case 23:
			              isLightBlocked = light_blocked(36 * ecx + 22) & light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 15) & light_blocked(36 * ecx + 9) | light_blocked(36 * ecx + 3) | light_blocked(36 * ecx + 16);
			              break;
			            case 24:
			              v28 = light_blocked(36 * ecx + 23);
			              isLightBlocked = v28 & light_blocked(36 * ecx + 18) | light_blocked(36 * ecx + 17) & (v28 | light_blocked(36 * ecx + 22) | light_blocked(36 * ecx + 15)) | light_blocked(36 * ecx + 8) | light_blocked(36 * ecx + 9) & (light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 15)) | (light_blocked(36 * ecx + 18) | light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 10) | light_blocked(36 * ecx + 9) | light_blocked(36 * ecx)) & light_blocked(36 * ecx + 16);
			              break;
			            case 25:
			              v29 = light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 8);
			              isLightBlocked = light_blocked(36 * ecx + 24) & (light_blocked(36 * ecx + 19) | light_blocked(36 * ecx)) | light_blocked(36 * ecx + 18) & (light_blocked(36 * ecx + 24) | light_blocked(36 * ecx + 23) | v29) | light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 10) & (light_blocked(36 * ecx + 24) | v29 | light_blocked(36 * ecx + 17)) | light_blocked(36 * ecx + 1) & light_blocked(36 * ecx + 8) | (light_blocked(36 * ecx + 24) | light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 15) | light_blocked(36 * ecx + 8)) & light_blocked(36 * ecx + 9);
			              break;
			            case 26:
			              isLightBlocked = light_blocked(36 * edx + 3) & light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 8) & light_blocked(36 * edx + 1) | light_blocked(36 * edx + 2) & light_blocked(36 * ecx + 15);
			              break;
			            case 27:
			              isLightBlocked = light_blocked(36 * ecx + 21) & (light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 8)) | light_blocked(36 * ecx + 15) | light_blocked(36 * edx + 1) & light_blocked(36 * ecx + 8) | (light_blocked(36 * ecx + 26) | light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 15) | light_blocked(36 * edx)) & light_blocked(36 * ecx + 22);
			              break;
			            case 28:
			              isLightBlocked = light_blocked(36 * ecx + 27) & light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 22) & (light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 9)) | light_blocked(36 * ecx + 16) & (light_blocked(36 * ecx + 27) | light_blocked(36 * ecx + 22) | light_blocked(36 * ecx + 21) | light_blocked(36 * edx)) | light_blocked(36 * ecx + 8) | light_blocked(36 * ecx + 15) & (light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 9));
			              break;
			            case 29:
			              isLightBlocked = light_blocked(36 * ecx + 28) & light_blocked(36 * ecx + 24) | light_blocked(36 * ecx + 22) & light_blocked(36 * ecx + 17) | light_blocked(36 * ecx + 15) & light_blocked(36 * ecx + 9) | light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 8) | light_blocked(36 * ecx + 23);
			              break;
			            case 30:
			              isLightBlocked = light_blocked(36 * edx + 4) & light_blocked(36 * ecx + 26) | light_blocked(36 * edx + 2) & light_blocked(36 * ecx + 15) | light_blocked(36 * ecx + 8) & light_blocked(36 * edx + 1) | light_blocked(36 * edx + 3) & light_blocked(36 * ecx + 21);
			              break;
			            case 31:
			              isLightBlocked = light_blocked(36 * ecx + 30) & light_blocked(36 * ecx + 27) | light_blocked(36 * ecx + 26) & (light_blocked(36 * ecx + 27) | light_blocked(36 * ecx + 22) | light_blocked(36 * ecx + 8)) | light_blocked(36 * ecx + 15) | light_blocked(36 * edx + 1) & light_blocked(36 * ecx + 8) | light_blocked(36 * ecx + 21);
			              break;
			            case 32:
			              // XXX: v30 here could be lightOffsetsStart, but that is unlikely
			              v30 = light_blocked(36 * edx + 1) & light_blocked(36 * ecx + 8) | (light_blocked(36 * ecx + 28) | light_blocked(36 * ecx + 23) | light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 9) | light_blocked(36 * ecx + 8)) & light_blocked(36 * ecx + 15);
			              v31 = light_blocked(36 * ecx + 16) | light_blocked(36 * ecx + 8);
			              isLightBlocked = light_blocked(36 * ecx + 28) & (light_blocked(36 * ecx + 31) | light_blocked(36 * ecx)) | light_blocked(36 * ecx + 27) & (light_blocked(36 * ecx + 28) | light_blocked(36 * ecx + 23) | v31) | light_blocked(36 * ecx + 22) | v30 | light_blocked(36 * ecx + 21) & (v31 | light_blocked(36 * ecx + 28));
			              break;
			            case 33:
			              v32 = 36 * edx;
			              isLightBlocked = light_blocked(v32 + 5) & light_blocked(36 * ecx + 30) | light_blocked(v32 + 3) & light_blocked(36 * ecx + 21) | light_blocked(v32 + 2) & light_blocked(36 * ecx + 15) | light_blocked(v32 + 1) & light_blocked(36 * ecx + 8) | light_blocked(v32 + 4) & light_blocked(36 * ecx + 26);
			              break;
			            case 34:
			              v33 = light_blocked(36 * ecx + 30) | light_blocked(36 * ecx + 26) | light_blocked(36 * edx + 2);
			              isLightBlocked = (light_blocked(36 * ecx + 31) | light_blocked(36 * ecx + 27) | light_blocked(36 * ecx + 22) | light_blocked(36 * ecx + 16)) & light_blocked(36 * ecx + 26) | light_blocked(36 * ecx + 21) | light_blocked(36 * ecx + 15) & v33 | v33 & light_blocked(36 * ecx + 8);
			              break;
			            case 35:
			              v34 = 36 * edx;
			              isLightBlocked = light_blocked(v34 + 6) & light_blocked(36 * ecx + 33) | light_blocked(v34 + 4) & light_blocked(36 * ecx + 26) | light_blocked(v34 + 3) & light_blocked(36 * ecx + 21) | light_blocked(v34 + 2) & light_blocked(36 * ecx + 15) | light_blocked(36 * ecx + 8) & light_blocked(v34 + 1) | light_blocked(v34 + 5) & light_blocked(36 * ecx + 30);
			              break;
					}

					if(isLightBlocked === 0) {
						// loc_4A7500:
						var nextTile = toTileNum(obj.position) + light_offsets[(lightOffsetsStart/4|0) + 36 * ecx + i]

						if(nextTile > 0 && nextTile < 40000) { // nextTile is within valid tile range
							var edi = 1
							// for each object at position nextTile
							var objs = objectsAtPosition(fromTileNum(nextTile))
							for(var objsN = 0; objsN < objs.length; objsN++) {
								var curObj = objs[objsN]
								if(!curObj.pro) // XXX: why wouldn't an object have pro?
									continue

								// if(curObj+24h & 1 === 0) { continue }
								if((curObj.flags & 1) !== 0) { // internal flag?
									console.log("continue (%s)", curObj.flags.toString(16))
									continue
								}

								// LightThru flag isn't set -> blocked
								isLightBlocked =  (curObj.flags & 0x20000000 /* LightThru */) ? 0 : 1

								// ebx = (curObj+20h) & 0x0F000000 >> 24
								if(curObj.type === "wall") {
								    //console.log("obj flags: " + curObj.flags.toString(16))
									if(!(curObj.flags & 8)) { // Flat flag?
									    //proto_ptr(*(v37 + 100), &v43, 3, v11);
									    //var flags = (pro+24)
									    var flags = curObj.pro.flags // XXX: flags directly from PRO?
									    //console.log("pro flags: " + flags.toString(16))
									    if(flags & 0x8000000 || flags & 0x40000000) {
									    	if(ecx != 4 && ecx != 5 && (ecx || i >= 8) && (ecx != 3 || i <= 15))
									    		edi = 0
									    }
									    else if(flags & 0x10000000) {
									    	if(ecx && ecx != 5)
									    		edi = 0
									    }
									    else if(flags & 0x20000000) {
									    	if(ecx && ecx != 1 && ecx != 4 && ecx != 5 && (ecx != 3 || i <= 15))
									    		edi = 0
									    }
									    else if(ecx && ecx != 1 && (ecx != 5 || i <= 7)) {
									    	edi = 0
									    }
									}
								}
								// XXX: Is this just an elevation check?
								/*else { // TODO: check logic
									if(edx !== 0) { // XXX: what is edx?
										if(ecx >= 2) {
											if(ecx === 3) {
												edi = 0
											}
										}
										else if(ecx === 1)
											edi = 0
									}
								}*/
							}

							if(edi !== 0) {
								ebx = stackArray[i]
								// eax = 0 // should be set to obj+28h, aka elevation (we don't take elevation into account so we don't need this)
								lightModifier(nextTile, ebx)

							}
						}
					}

					_light_blocked[36 * ecx + i] = isLightBlocked
				}
			}
		}

		return tile_intensity
	}

	export function obj_light_table_init(): void {
		setCenterTile()
		//var centerTile_: Point = centerTile()

		// should we use the center tile at all?
		var edi = toTileNum(tile_center)
		var edx = edi & 1
		var eax = edx*4
		eax -= edx
		eax <<= 5
		edx = eax
		eax <<= 3
		var ecx = 0
		eax += edx

		var v2c = ecx
		var v54 = eax
		var v48
		var ebx, ebp, esi, v3c, v40, v50, v20, v24, lightOffsetsStart, v58
		var v44, v4c, v38, v34, v28, v1c, v28

		do {
			eax = v54
			edx = v2c
			edx++
			v48 = eax
			eax = edx
			edx = eax % 6
			//eax = eax / 6 | 0
			ebp = 0
			esi = 8

			v3c = ebp
			v40 = esi
			v50 = edx

			do {
				ebx = v3c
				edx = v50
				eax = edi
				eax = tile_num_in_direction(eax, edx, ebx) // ?

				esi = ebp*4
				v24 = eax
				eax = v40
				ecx = 0
				v20 = eax
				eax = v48
				edx = v40
				esi += eax

				if(edx > 0) {
					do {
						edx = v2c
						eax = v24
						ecx++
						esi += 4
						ebx = ecx
						ebp++
						eax = tile_num_in_direction(eax, edx, ebx)
						eax -= edi
						ebx = v20
						//console.log("light_offsets[%d] = %d", (esi-4)/4|0, eax)
						light_offsets[(esi-4)/4|0] = eax
					}
					while(ecx < ebx)
				}

				eax = v3c
				esi = v40
				eax++
				esi--
				v3c = eax
				v40 = esi
			}
			while(eax < 8)

			ebx = v2c
			ecx = v54
			ebx++
			ecx += 144
			v2c = ebx
			v54 = ecx
		}
		while(ebx < 6)

		// second part
		edi++
		edx = edi
		edx &= 1
		eax = edx*4
		eax -= edx
		eax <<= 5
		edx = eax
		eax <<= 3
		ebp = 0
		eax += edx
		lightOffsetsStart = ebp
		v58 = eax

		do {
			eax = v58
			edx = lightOffsetsStart
			edx++
			v44 = eax
			eax = edx
			edx = eax % 6
			ebp = 0
			v4c = edx
			edx = 8
			v38 = ebp
			v34 = edx

			do {
				ebx = v38
				edx = v4c
				eax = edi
				eax = tile_num_in_direction(eax, edx, ebx)
				esi = ebp*4
				ecx = 0
				ebx = v44
				v28 = eax
				eax = v34
				esi += ebx
				v1c = eax

				if(eax > 0) {
					do {
						edx = lightOffsetsStart
						eax = v28
						ecx++
						esi += 4
						ebx = ecx
						ebp++
						eax = tile_num_in_direction(eax, edx, ebx)
						eax -= edi
						edx = v1c
						//console.log("light_offsets[%d] = %d", (esi-4)/4|0, eax)
						light_offsets[(esi-4)/4|0] = eax
					}
					while(ecx < edx)
				}

				ebx = v38
				ecx = v34
				ebx++
				ecx--
				v38 = ebx
				v34 = ecx
			}
			while(ebx < 8)

			eax = lightOffsetsStart
			ebp = v58
			eax++
			ebp += 144
			lightOffsetsStart = eax
			v58 = ebp
		}
		while(eax < 6)
	}

	// eax = tile, edx = direction, ebx = distance
	function tile_num_in_direction(tileNum: number, dir: number, distance: number): number {
		//console.log("tileNum: " + tileNum + " (" + tileNum.toString(16) + ")")
		if(dir < 0 || dir > 5)
			throw "tile_num_in_direction: dir = " + dir
		if(distance === 0)
			return tileNum

		var hex = hexInDirectionDistance(fromTileNum(tileNum), dir, distance)
		if(!hex) {
			console.log("hex (input tile is %s) is %o; dir=%d distance=%d", tileNum.toString(16), hex, dir, distance)
			return -1
		}

		//console.log("tile: %d,%d -> %d,%d", fromTileNum(tileNum).x, fromTileNum(tileNum).y, hex.x, hex.y)
		return toTileNum(hex)
	}

	function obj_rebuild_all_light(): void {
		light_reset()

		gMap.getObjects().forEach(obj => {
			obj_adjust_light(obj, false)
		})
	}

	export function resetLight(): void {
		light_reset()
		obj_light_table_init()
	}

	export function rebuildLight(): void {
		obj_rebuild_all_light()
	}
}