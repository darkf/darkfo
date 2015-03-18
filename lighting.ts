module Lighting {
	// length 15
	var rightside_up_triangles = [2, 3, 0, 3, 4, 1, 5, 6, 3, 6, 7, 4, 8, 9, 6]
	var upside_down_triangles = [0, 3, 1, 2, 5, 3, 3, 6, 4, 5, 8, 6, 6, 9, 7]

	// length 26
	var rightside_up_table = [
		-1,
		0x2,
		0x4E,
		0x2,
		0x4C,
		0x6,
		0x49,
		0x8,
		0x47,
		0x0A,
		0x44,
		0x0E,
		0x41,
		0x10,
		0x3F,
		0x12,
		0x3D,
		0x14,
		0x3A,
		0x18,
		0x37,
		0x1A,
		0x35,
		0x1C,
		0x32,
		0x20
	]

	var upside_down_table = [
		0x0,
		0x20,
		0x30,
		0x20,
		0x31,
		0x1E,
		0x34,
		0x1A,
		0x37,
		0x18,
		0x39,
		0x16,
		0x3C,
		0x12,
		0x3F,
		0x10,
		0x41,
		0x0E,
		0x43,
		0x0C,
		0x46,
		0x8,
		0x49,
		0x6,
		0x4B,
		0x4
	]

	// length 40
	export var vertices = [
		0x10,
		-1,
		-201,
		0x0,
		0x30,
		-2,
		-2,
		0x0,
		0x3C0,
		0x0,
		0x0,
		0x0,
		0x3E0,
		0x0C7,
		-1,
		0x0,
		0x400,
		0x0C6,
		0x0C6,
		0x0,
		0x790,
		0x0C8,
		0x0C8,
		0x0,
		0x7B0,
		0x18F,
		0x0C7,
		0x0,
		0x7D0,
		0x18E,
		0x18E,
		0x0,
		0x0B60,
		0x190,
		0x190,
		0x0,
		0x0B80,
		0x257,
		0x18F,
		0x0
	]

	// Framebuffer for triangle-lit tiles
	// TODO: what size should this be?
	export var intensity_map = new Array(1024*12)

	// zero array
	for(var i = 0; i < intensity_map.length; i++)
		intensity_map[i] = 0

	var ambient = 0xA000 // ambient light level

	// Tile lightmap
	declare var tile_intensity: number[];

	// Color look-up table by light intensity
	export declare var intensityColorTable: number[];

	export var colorLUT: any = null; // string color integer -> palette index
	export var colorRGB: any = null; // palette index -> string color integer

	function light_get_tile(tilenum: number): number {
		return Math.min(65536, tile_intensity[tilenum])
	}

	function init(tilenum: number): boolean {
		var start = (tilenum & 1); // even/odd

		for(var i = 0, j = start; i <= 36; i += 4, j += 4) {
			var offset = vertices[1 + j]
			var t = tilenum + offset
			var light = Math.max(light_get_tile(t), ambient)

			vertices[3 + i] = light
		}

		// do a uniformly-lit check
		// true means it's triangle lit

		if(vertices[7] !== vertices[3])
			return true

		var uni = 1
		for(var i = 4; i < 36; i += 4) {
			if(vertices[7 + i] === vertices[3 + i])
				uni++ //return true
		}

		return (uni !== 9)
	}

	function renderTris(isRightsideUp: boolean): void {
		var tris = isRightsideUp ? rightside_up_triangles : upside_down_triangles
		var table = isRightsideUp ? rightside_up_table : upside_down_table

		for(var i = 0; i < 15; i += 3) {
			var a = tris[i + 0]
			var b = tris[i + 1]
			var c = tris[i + 2]

			var x = vertices[3 + 4*a]
			var y = vertices[3 + 4*b]
			var z = vertices[3 + 4*c]

			var inc, intensityIdx, baseLight, lightInc

			if(isRightsideUp) { // rightside up triangles
			    inc = (x - z) / 13 | 0
			    lightInc = (y - x) / 32 | 0
			    intensityIdx = vertices[4*c]
			    baseLight = z
			}
			else { // upside down triangles
				intensityIdx = vertices[4*a]
				lightInc = (z - x) / 32 | 0
				inc = (y - x) / 13 | 0
				baseLight = vertices[3 + 4*a]
			}

			for(var j = 0; j < 26; j += 2) {
				var edx = table[1 + j]
				intensityIdx += table[j]

				var light = baseLight
				for(var k = 0; k < edx; k++) {
					intensity_map[intensityIdx++] = light
					light += lightInc
				}

				baseLight += inc
			}
		}
	}

	function rutris(): void {
		for(var i = 0; i < 15; i += 3) {
			var a = rightside_up_triangles[i + 0]
			var b = rightside_up_triangles[i + 1]
			var c = rightside_up_triangles[i + 2]

			var x = vertices[3 + 4*a]
			var y = vertices[3 + 4*b]
			var z = vertices[3 + 4*c]

		    var eax = (x - z) / 13 | 0
		    var v1 = eax
		    var ecx = vertices[4*c]
		    var w = (y - x) / 32 | 0

	    	// right branch
	    	for(var j = 0; j < 26; j += 2) {
	    		var edx = rightside_up_table[1 + j]
	    		ecx += rightside_up_table[j] // add to offset
	    		
	    		var light = z
	    		for(var k = 0; k < edx; k++) {
	    			intensity_map[ecx++] = light
	    			light += w
	    		}

				z += v1
			}
		}
	}

	function udtris(): void {
		for(var i = 0; i < 15; i += 3) {
			var a = upside_down_triangles[i + 0] // eax
			var b = upside_down_triangles[i + 1] // middle eax
			var c = upside_down_triangles[i + 2] // esi

			var ebx = vertices[3 + 4*a]
			var esi = vertices[3 + 4*c]
			esi -= ebx
			esi = (esi / 32) | 0
			var ecx = vertices[4*a]

			var eax = vertices[3 + 4*b]
			eax -= ebx
			eax = (eax / 13) | 0

			var v34 = eax

			for(var j = 0; j < 26; j += 2) {
				var edx = upside_down_table[1 + j]
				ecx += upside_down_table[j]

				var light = ebx
				for(var k = 0; k < edx; k++) {
					intensity_map[ecx++] = light
					light += esi
				}

				ebx += v34
			}
		}
	}

	export function initTile(hex: Point): boolean  {
		return init(toTileNum(hex));
	}

	export function computeFrame(): number[] {
		//rutris()
		//udtris()
		renderTris(true)
		renderTris(false)
		return intensity_map
	}
}