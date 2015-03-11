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
	var vertices = [
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

	//int intensity_map[] = {...}; // unknown
	//char intensity_map[1024*12] = {0}; // unknown size, etc
	export var intensity_map = new Array(1024*12)

	// zero array
	for(var i = 0; i < intensity_map.length; i++)
		intensity_map[i] = 0;

	var ambient = 0xA000 // ambient light level

	function light_get_tile(tilenum: number): number {
		return 65536 // TODO
	}

	function init(tilenum: number): boolean {
		var start = (tilenum & 1); // even/odd

		for(var i = 0, j = start; i < 36; i += 4, j += 4) {
			var offset = vertices[1 + j];
			//printf("init: j = %u, v[1+j] = 0x%X (%d)\n", j, offset, offset);
			var t = tilenum + offset;
			//int light = light_get_tile(t);
			var light = Math.max(light_get_tile(t), ambient);

			vertices[3 + i] = light;
			//printf("init: i=%d, j=%d, light=0x%X (%d)\n", i, j, light, light);
		}

		/*printf("vertices:\n");
		for(uint i = 0; i < 40; i++) {
			printf("vertices[%d] = 0x%X\n", i, vertices[i]);
		}*/

		// do a uniform-lit check
		for(var i = 0; i < 36/2; i++) {
			if(vertices[7 + i] != vertices[3 + i])
				return true
		}

		return false
	}

	function rutris(): void {
		for(var i = 0; i < 15; i += 3) {
			//printf("i = %u ...\n", i);
			var a = rightside_up_triangles[i + 0];
			var b = rightside_up_triangles[i + 1];
			var c = rightside_up_triangles[i + 2];

			// each "element" of vertices is 16 bytes, so that's 4 int elements
			var x = vertices[3 + 4*a]; // eax
			var y = vertices[3 + 4*b]; // esi
			var z = vertices[3 + 4*c]; // ebx
			// see below
			//int ecx = vertices[4*c];
		    //ecx *= 4; // should be for an index?

		    // printf("i=%d, x=%d, y=%d, z=%d\n", i, x, y, z);

			var esi = Math.floor((y - x) / 32);

		    // eax = vertices[12+a]
		    // esi = vertices[12+b]
		    // ebx = vertices[12+c]

		    //int eax = x - z;
		    var eax = Math.floor((x - z) / 13);
		    var v1 = eax;

		    //printf("vertices[4*c] = 0x%X (%d)\n", vertices[4*c], vertices[4*c]);
		    //char *ecx = intensity_map + vertices[4*c] * 4; // pointer arithmetic (this is on a char*)
		    var ecx = vertices[4*c]

		    if(Math.floor((b - a) / 32) == 0) {
		    	// right branch
				//printf("right ...\n");

				var j = 0; // esi
				var edi = 0;

				var right_right = (eax != 0);  // right-right branch
	    		do {
		    		var eax = rightside_up_table[j] /* * 4 */;
		    		var edx = rightside_up_table[1 + j];
		    		ecx += eax; // add to offset
		    		//printf("eax=%d, ecx += %d\n", eax, eax);
	    			//printf("rutris: j=%d, eax=%d edx=%d\n", j, eax, edx);
		    		
		    		eax = edi;
		    		if(edx > 0) {
		    			do {
		    				/*if(ecx - intensity_map >= sizeof(intensity_map)) {
		    					printf("!!! OUT OF BOUNDS\n");
		    					*(volatile int*)0 = 0;
		    				}*/
		    				//printf("%d\n", ecx - intensity_map);
		    				//unsigned long offset = (unsigned long)(ecx - intensity_map);
		    				//printf("intensity_map offset = 0x%X (%d)\n", offset, offset);

			    			//*(int *)ecx = z;
			    			intensity_map[ecx] = z
			    			ecx++
			    			eax++
			    		}
			    		while(eax < edx);
		    		}

		    		if(right_right) {
						eax = v1;
						z += eax;
					}

					j += 2; // 8
				}
				while(j < 26); // 13);
		    }
		    else {
		    	// todo: left branch
		    	throw "left ..."
		    }
		}

		//printf("end ...\n");
	}

	export function initTile(hex: Point): boolean  {
		return init(toTileNum(hex));
	}

	export function computeFrame(): number[] {
		rutris()
		// udtris()
		return intensity_map
	}
}