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

function light_reset(): void {
	for(var i = 0; i < tile_intensity.length; i++)
		tile_intensity[i] = 655
}

// tile lightmap
var tile_intensity = new Array(40000)
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
	for(var i = 0; i < gObjects.length; i++) {
		if(gObjects[i].position.x === pos.x && gObjects[i].position.y === pos.y) {
			return gObjects[i]
		}
	}
	return null
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
	//var v30 = light_offsets + eax // so &light_offsets[eax/4|0], we'd use an index here
	var v30 = eax // so &light_offsets[eax/4|0], we'd use an index here

	var light_per_dist = /* obj.lightIntensity - */ (((obj.lightIntensity - 655) / (obj.lightRadius+1)) | 0)

	//console.log("light per dist: %d", light_per_dist)

	var stackArray = new Array(36)
	var idx = 0
	var light = obj.lightIntensity

	light -= light_per_dist
	stackArray[0] = light

	light -= light_per_dist
	stackArray[4/4|0] = light
	stackArray[0x20/4|0] = light

	light -= light_per_dist
	stackArray[0x8/4|0] = light
	stackArray[0x24/4|0] = light
	stackArray[0x3C/4|0] = light

	light -= light_per_dist
	stackArray[0x0C/4|0] = light
	stackArray[0x28/4|0] = light
	stackArray[0x40/4|0] = light
	stackArray[0x54/4|0] = light

	light -= light_per_dist
	stackArray[0x10/4|0] = light
	stackArray[0x2C/4|0] = light
	stackArray[0x44/4|0] = light
	stackArray[0x58/4|0] = light
	stackArray[0x68/4|0] = light

	light -= light_per_dist
	stackArray[0x14/4|0] = light
	stackArray[0x30/4|0] = light
	stackArray[0x48/4|0] = light
	stackArray[0x5C/4|0] = light
	stackArray[0x6C/4|0] = light
	stackArray[0x78/4|0] = light

	light -= light_per_dist
	stackArray[0x18/4|0] = light
	stackArray[0x34/4|0] = light
	stackArray[0x4C/4|0] = light
	stackArray[0x60/4|0] = light
	stackArray[0x70/4|0] = light
	stackArray[0x7C/4|0] = light
	stackArray[0x84/4|0] = light

	light -= light_per_dist
	stackArray[0x1C/4|0] = light
	stackArray[0x38/4|0] = light
	stackArray[0x50/4|0] = light
	stackArray[0x64/4|0] = light
	stackArray[0x74/4|0] = light
	stackArray[0x80/4|0] = light
	stackArray[0x88/4|0] = light
	stackArray[0x8C/4|0] = light

	var light_blocked = new Array(36)

	// zero arrays
	zeroArray(light_blocked)

	var ebp = 0 // i
	var loopCnt = 0 // var_2c / v2c: loop counter from 0 to 36*4, in 4 byte increments
	var ebx, vc, esi, v14

	do {
		edx = obj
		eax = loopCnt

		if(obj.lightRadius /* esi */ >= light_distance[eax/4|0]) {
			var edi = v30
			var v24 = eax
			var v20 = eax
			eax += edi
			var v1c = eax

			var v18 = loopCnt
			var v26, v27, v28, v29, v31, v32, v33, v34 // temporaries

			var ecx = 0 // loop counter (j)
			do {
				//edx = ecx+1
				//eax = edx/6 | 0
				edx = (ecx + 1) % 6

				if(ebp <= 35) {
					switch(v20/4|0) {
						/*
						case 0*4:
							eax = 0
							vc = 0
							break
						case 1*4:
							eax = light_blocked[ecx*144 / 4|0]
							break
						case 2*4:
							eax = light_blocked[(4 + ecx*144) / 4|0]
							break
						case 3*4:
							eax = light_blocked[(8 + ecx*144) / 4|0]
							break
						case 4*4:
							eax = light_blocked[(12 + ecx*144) / 4|0]
							break
						case 5*4:
							eax = light_blocked[(16 + ecx*144) / 4|0]
							break
						case 6*4:
							eax = light_blocked[(0x14 + ecx*144) / 4|0]
							break
						case 7*4:
							eax = light_blocked[(0x18 + ecx*144) / 4|0]
							break
						case 8*4: // changed from above
							eax = light_blocked[ecx*144 / 4|0]
							esi = light_blocked[edx*144 / 4|0]
							eax = eax & esi
							break
						case 9*4:
							eax = light_blocked[(0x20 + ecx*144) / 4|0]
							ebx = light_blocked[(0x4 + ecx*144) / 4|0]
							eax = eax & ebx
							break
						case 10*4:
							eax = light_blocked[(0x24 + ecx*144) / 4|0]
							edi = light_blocked[(0x8 + ecx*144) / 4|0]
							eax = eax & edi
							break
						case 11*4:
							eax = light_blocked[(0x28 + ecx*144) / 4|0]
							esi = light_blocked[(0x0c + ecx*144) / 4|0]
							eax = eax & esi
							break
						case 12*4:
							eax = light_blocked[(0x2c + ecx*144) / 4|0]
							ebx = light_blocked[(0x10 + ecx*144) / 4|0]
							eax = eax & ebx
							break
						case 13*4:
							eax = light_blocked[(0x30 + ecx*144) / 4|0]
							edi = light_blocked[(0x14 + ecx*144) / 4|0]
							eax = eax & edi
							break
						case 14*4:
							eax = light_blocked[(0x34 + ecx*144) / 4|0]
							esi = light_blocked[(0x18 + ecx*144) / 4|0]
							eax = eax & esi
							break
						case 15*4: // changed
							eax = light_blocked[(0x20 + ecx*144) / 4|0]
							ebx = light_blocked[(0x4 + edx*144) / 4|0]
							eax = eax & ebx
							break
						case 16*4: // changed
							eax = light_blocked[(0x24 + ecx*144) / 4|0]
							edi = light_blocked[(0x3c + ecx*144) / 4|0]
							edx = light_blocked[(0x20 + ecx*144) / 4|0]
							eax = eax & edi
							edx |= eax
							vc = edx
							//if(vc === 0)
							//	goto loc_4A7500;
							break
						case 17*4:
							edx = light_blocked[(0x24 + ecx*144) / 4|0]
							edx |= light_blocked[(0x28 + ecx*144) / 4|0]

							ebx = light_blocked[(0x20 + ecx*144) / 4|0]
							esi = light_blocked[(0x40 + ecx*144) / 4|0]
							ebx &= edx
							edx &= esi

							edi = light_blocked[(0x3c + ecx*144) / 4|0]
							ebx |= edx

							edx = light_blocked[(0x28 + ecx*144) / 4|0]
							esi = light_blocked[(0x24 + ecx*144) / 4|0]
							edx |= edi
							edx &= esi
							ebx |= edx

							vc = ebx
							//if(vc === 0)
							//	loc_4A7500 = 1
							break
						*/

			            case 0:
			              vc = 0;
			              break;
			            case 1:
			              vc = light_blocked[36 * ecx];
			              break
			            case 2:
			              vc = light_blocked[36 * ecx + 1];
			              break
			            case 3:
			              vc = light_blocked[36 * ecx + 2];
			              break
			            case 4:
			              vc = light_blocked[36 * ecx + 3];
			              break
			            case 5:
			              vc = light_blocked[36 * ecx + 4];
			              break
			            case 6:
			              vc = light_blocked[36 * ecx + 5];
			              break
			            case 7:
			              vc = light_blocked[36 * ecx + 6];
			              break
			            case 8:
			              vc = light_blocked[36 * edx] & light_blocked[36 * ecx];
			              break
			            case 9:
			              vc = light_blocked[36 * ecx + 1] & light_blocked[36 * ecx + 8];
			              break
			            case 0xA:
			              vc = light_blocked[36 * ecx + 2] & light_blocked[36 * ecx + 9];
			              break
			            case 0xB:
			              vc = light_blocked[36 * ecx + 3] & light_blocked[36 * ecx + 10];
			              break
			            case 0xC:
			              vc = light_blocked[36 * ecx + 4] & light_blocked[36 * ecx + 11];
			              break
			            case 0xD:
			              vc = light_blocked[36 * ecx + 5] & light_blocked[36 * ecx + 12];
			              break
			            case 0xE:
			              vc = light_blocked[36 * ecx + 6] & light_blocked[36 * ecx + 13];
			              break
			            case 0xF:
			              vc = light_blocked[36 * edx + 1] & light_blocked[36 * ecx + 8];
			              break

			            // 16...
			            case 0x10:
			              vc = light_blocked[36 * ecx + 15] & light_blocked[36 * ecx + 9] | light_blocked[36 * ecx + 8];
			              break;
			            case 0x11:
			              v26 = light_blocked[36 * ecx + 10] | light_blocked[36 * ecx + 9];
			              vc = light_blocked[36 * ecx + 9] & (light_blocked[36 * ecx + 15] | light_blocked[36 * ecx + 10]) | light_blocked[36 * ecx + 16] & v26 | v26 & light_blocked[36 * ecx + 8];
			              break;
			            case 0x12:
			              vc = (light_blocked[36 * ecx + 11] | light_blocked[36 * ecx + 10] | light_blocked[36 * ecx + 9] | light_blocked[36 * ecx]) & light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 9] | light_blocked[36 * ecx + 16] & light_blocked[36 * ecx + 10];
			              break;
			            case 0x13:
			              vc = light_blocked[36 * ecx + 18] & light_blocked[36 * ecx + 12] | light_blocked[36 * ecx + 10] | light_blocked[36 * ecx + 9] | (light_blocked[36 * ecx + 18] | light_blocked[36 * ecx + 17]) & light_blocked[36 * ecx + 11];
			              break;
			            case 0x14:
			              v27 = light_blocked[36 * ecx + 12] | light_blocked[36 * ecx + 11] | light_blocked[36 * ecx + 2];
			              vc = (light_blocked[36 * ecx + 19] | light_blocked[36 * ecx + 18] | light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 16]) & light_blocked[36 * ecx + 11] | v27 & light_blocked[36 * ecx + 8] | light_blocked[36 * ecx + 9] & v27 | light_blocked[36 * ecx + 10];
			              break;
			            case 0x15:
			              vc = light_blocked[36 * edx + 2] & light_blocked[36 * ecx + 15] | light_blocked[36 * ecx + 8] & light_blocked[36 * edx + 1];
			              break;
			            case 0x16:
			              vc = (light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 15]) & light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 15] & (light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 9]) | (light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 15] | light_blocked[36 * edx + 1]) & light_blocked[36 * ecx + 8];
			              break;
			            case 0x17:
			              vc = light_blocked[36 * ecx + 22] & light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 15] & light_blocked[36 * ecx + 9] | light_blocked[36 * ecx + 3] | light_blocked[36 * ecx + 16];
			              break;
			            case 0x18:
			              v28 = light_blocked[36 * ecx + 23];
			              vc = v28 & light_blocked[36 * ecx + 18] | light_blocked[36 * ecx + 17] & (v28 | light_blocked[36 * ecx + 22] | light_blocked[36 * ecx + 15]) | light_blocked[36 * ecx + 8] | light_blocked[36 * ecx + 9] & (light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 15]) | (light_blocked[36 * ecx + 18] | light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 10] | light_blocked[36 * ecx + 9] | light_blocked[36 * ecx]) & light_blocked[36 * ecx + 16];
			              break;
			            case 0x19:
			              v29 = light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 8];
			              vc = light_blocked[36 * ecx + 24] & (light_blocked[36 * ecx + 19] | light_blocked[36 * ecx]) | light_blocked[36 * ecx + 18] & (light_blocked[36 * ecx + 24] | light_blocked[36 * ecx + 23] | v29) | light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 10] & (light_blocked[36 * ecx + 24] | v29 | light_blocked[36 * ecx + 17]) | light_blocked[36 * ecx + 1] & light_blocked[36 * ecx + 8] | (light_blocked[36 * ecx + 24] | light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 15] | light_blocked[36 * ecx + 8]) & light_blocked[36 * ecx + 9];
			              break;
			            case 0x1A:
			              vc = light_blocked[36 * edx + 3] & light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 8] & light_blocked[36 * edx + 1] | light_blocked[36 * edx + 2] & light_blocked[36 * ecx + 15];
			              break;
			            case 0x1B:
			              vc = light_blocked[36 * ecx + 21] & (light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 8]) | light_blocked[36 * ecx + 15] | light_blocked[36 * edx + 1] & light_blocked[36 * ecx + 8] | (light_blocked[36 * ecx + 26] | light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 15] | light_blocked[36 * edx]) & light_blocked[36 * ecx + 22];
			              break;
			            case 0x1C:
			              vc = light_blocked[36 * ecx + 27] & light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 22] & (light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 9]) | light_blocked[36 * ecx + 16] & (light_blocked[36 * ecx + 27] | light_blocked[36 * ecx + 22] | light_blocked[36 * ecx + 21] | light_blocked[36 * edx]) | light_blocked[36 * ecx + 8] | light_blocked[36 * ecx + 15] & (light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 9]);
			              break;
			            case 0x1D:
			              vc = light_blocked[36 * ecx + 28] & light_blocked[36 * ecx + 24] | light_blocked[36 * ecx + 22] & light_blocked[36 * ecx + 17] | light_blocked[36 * ecx + 15] & light_blocked[36 * ecx + 9] | light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 8] | light_blocked[36 * ecx + 23];
			              break;
			            case 0x1E:
			              vc = light_blocked[36 * edx + 4] & light_blocked[36 * ecx + 26] | light_blocked[36 * edx + 2] & light_blocked[36 * ecx + 15] | light_blocked[36 * ecx + 8] & light_blocked[36 * edx + 1] | light_blocked[36 * edx + 3] & light_blocked[36 * ecx + 21];
			              break;
			            case 0x1F:
			              vc = light_blocked[36 * ecx + 30] & light_blocked[36 * ecx + 27] | light_blocked[36 * ecx + 26] & (light_blocked[36 * ecx + 27] | light_blocked[36 * ecx + 22] | light_blocked[36 * ecx + 8]) | light_blocked[36 * ecx + 15] | light_blocked[36 * edx + 1] & light_blocked[36 * ecx + 8] | light_blocked[36 * ecx + 21];
			              break;
			            case 0x20:
			              v30 = light_blocked[36 * edx + 1] & light_blocked[36 * ecx + 8] | (light_blocked[36 * ecx + 28] | light_blocked[36 * ecx + 23] | light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 9] | light_blocked[36 * ecx + 8]) & light_blocked[36 * ecx + 15];
			              v31 = light_blocked[36 * ecx + 16] | light_blocked[36 * ecx + 8];
			              vc = light_blocked[36 * ecx + 28] & (light_blocked[36 * ecx + 31] | light_blocked[36 * ecx]) | light_blocked[36 * ecx + 27] & (light_blocked[36 * ecx + 28] | light_blocked[36 * ecx + 23] | v31) | light_blocked[36 * ecx + 22] | v30 | light_blocked[36 * ecx + 21] & (v31 | light_blocked[36 * ecx + 28]);
			              break;
			            case 0x21:
			              v32 = 36 * edx;
			              vc = light_blocked[v32 + 5] & light_blocked[36 * ecx + 30] | light_blocked[v32 + 3] & light_blocked[36 * ecx + 21] | light_blocked[v32 + 2] & light_blocked[36 * ecx + 15] | light_blocked[v32 + 1] & light_blocked[36 * ecx + 8] | light_blocked[v32 + 4] & light_blocked[36 * ecx + 26];
			              break;
			            case 0x22:
			              v33 = light_blocked[36 * ecx + 30] | light_blocked[36 * ecx + 26] | light_blocked[36 * edx + 2];
			              vc = (light_blocked[36 * ecx + 31] | light_blocked[36 * ecx + 27] | light_blocked[36 * ecx + 22] | light_blocked[36 * ecx + 16]) & light_blocked[36 * ecx + 26] | light_blocked[36 * ecx + 21] | light_blocked[36 * ecx + 15] & v33 | v33 & light_blocked[36 * ecx + 8];
			              break;
			            case 0x23:
			              v34 = 36 * edx;
			              vc = light_blocked[v34 + 6] & light_blocked[36 * ecx + 33] | light_blocked[v34 + 4] & light_blocked[36 * ecx + 26] | light_blocked[v34 + 3] & light_blocked[36 * ecx + 21] | light_blocked[v34 + 2] & light_blocked[36 * ecx + 15] | light_blocked[36 * ecx + 8] & light_blocked[v34 + 1] | light_blocked[v34 + 5] & light_blocked[36 * ecx + 30];
			              break;

						default:
							console.log("UNHANDLED SWITCH: v20=" + v20 + " (case " + (v20/4|0) + ")")
							vc = 0
					}
				}

				if(vc === 0) {
					// loc_4A7500:
					edx = v1c // light_offset idx
					//console.log("edx: %d (index: %d?)", edx, edx/4|0)
					ebx = light_offsets[edx/4|0]
					eax = /* light_offsets + */ ebx + toTileNum(obj.position)
					v14 = eax

					if(eax > 0 && eax < 40000) {
						//esi = objectAt(fromTileNum(eax))
						edi = 1
						// for each object at position eax
						var objs = objectsAtPosition(fromTileNum(eax))
						for(var objsN = 0; objsN < objs.length; objsN++) {
							var curObj = objs[objsN]
							if(!curObj.pro)
								continue

							// vc = light blocked

							// if(curObj+24h & 1 === 0) { continue }
							if((curObj.flags & 1) !== 0) { // ?
								console.log("continue (%s)", curObj.flags.toString(16))
								continue
							}

							// edx = !(curObj+27h & 0x20)
							vc = !((curObj.flags >> 24) & 0x20) // LightThru flag?
							//console.log("vc = %o", vc)

							// ebx = (curObj+20h) & 0x0F000000 >> 24
							if(curObj.type === "wall") {
							    //console.log("obj flags: " + curObj.flags.toString(16))
								if(!(curObj.flags & 8)) // Flat flag?
								{
								    //proto_ptr(*(v37 + 100), &v43, 3, v11);
								    //var flags = (pro+24)
								    var flags = curObj.pro.flags // flags directly from PRO?
								    //console.log("pro flags: " + flags.toString(16))
								    if(flags & 0x8000000 || flags & 0x40000000) {
								    	if(ecx != 4 && ecx != 5 && (ecx || ebp >= 8) && (ecx != 3 || ebp <= 15))
								    		edi = 0
								    }
								    else if(flags & 0x10000000) {
								    	if(ecx && ecx != 5)
								    		edi = 0
								    }
								    else if(flags & 0x20000000) {
								    	if(ecx && ecx != 1 && ecx != 4 && ecx != 5 && (ecx != 3 || ebp <= 15))
								    		edi = 0
								    }
								    else if(ecx && ecx != 1 && (ecx != 5 || ebp <= 7)) {
								    	edi = 0
								    }
								}
							}
							else { // TODO: check logic
								if(edx !== 0) {
									if(ecx >= 2) {
										if(ecx === 3) {
											edi = 0
										}
									}
									else if(ecx === 1)
										edi = 0
								}
							}
						    //console.log("edi: " + edi)

							//vc = 0 // hack, temporary
							//edi = 0
						}

						if(edi !== 0) {
							ebx = v24
							edx = v14
							//console.log("ebx: %d, index: %d", stackArray[ebx/4|0], ebx/4|0);
							ebx = stackArray[ebx/4|0]
							eax = 0 // obj+28h, aka elevation
							lightModifier(edx, ebx)

						}
					}
				}

				eax = vc // is light blocked?
				edx = v18
				ebx = v18
				ecx++ // j++
				light_blocked[edx/4|0] = eax

				edx = v1c
				ebx += 144
				edx += 144
				v18 = ebx
				v1c = edx
			}
			while(ecx < 6)
		}

		loopCnt += 4
		ebp++ // i++
	}
	while(ebp < 36)

	return tile_intensity
}

function obj_light_table_init(): void {
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
	var ebx, ebp, esi, v3c, v40, v50, v20, v24, v30, v58
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
	v30 = ebp
	v58 = eax

	do {
		eax = v58
		edx = v30
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
					edx = v30
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

		eax = v30
		ebp = v58
		eax++
		ebp += 144
		v30 = eax
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

	gObjects.forEach(obj => {
		obj_adjust_light(obj, false)
	})
}