class WebGLRenderer extends Renderer {
	canvas: any;
	gl: any;
	offsetLocation: any;
	positionLocation: any;
	texCoordLocation: any;
	uScaleLocation: any;
	uNumFramesLocation: any;
	uFrameLocation: any;
	objectUVBuffer: any;
	texCoordBuffer: any;
	tileBuffer: any;
	tileShader: any;

	uLightBuffer: any;
	litOffsetLocation: any;
	litScaleLocation: any;
	u_colorTable: any; // [0x8000];
	u_intensityColorTable: any; // [65536];
	u_paletteRGB: any; // vec3 [256];
	lightBufferTexture: any;
	floorLightShader: any;

	textures: {[key: string]: any} = {}; // WebGL texture cache

	newTexture(key: string, img: any, doCache: boolean=true): any {
		var gl = this.gl
		var texture = this.gl.createTexture();
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

		// Set the parameters so we can render any size image.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		// Upload the image into the texture.
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

		if(doCache)
			this.textures[key] = texture
		return texture
	}

	getTexture(name: string): any {
		var texture = this.textures[name]
		if(texture !== undefined)
			return texture
		return null
	}

	getTextureFromHack(name: string): any {
		// TODO: hack (ideally it should already be in textures)
		if(this.textures[name] === undefined) {
			if(images[name] !== undefined) {
				// generate a new texture
				return this.newTexture(name, images[name].img)
			}
			return null
		}
		return this.textures[name]
	}

	// create a texture from an array-like thing into a 3-component Float32Array using only the R component
	// TODO: find a better format to store data in textures
	textureFromArray(arr: any, size: number=256): any {
		var buf = new Float32Array(size*size*3)
		for(var i = 0; i < arr.length; i++) {
			buf[i*3] = arr[i]
		}

		var gl = this.gl
		var texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, buf)
		return texture
	}

	// create a texture from a Uint8Array with RGB components
	textureFromColorArray(arr: any, width: number): any {
		var gl = this.gl
		var texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, arr)
		return texture
	}

	init(): void {
	    this.canvas = document.getElementById("cnv")

	    // TODO: hack
	    heart.canvas = this.canvas
	    heart.ctx = null

	    var gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl")
	    if(!gl) {
	    	alert("error getting WebGL context")
	    	return
	    }
	    this.gl = gl

	    if(!gl.getExtension("OES_texture_float"))
	    	throw "no texture float extension"

	    this.gl.clearColor(0.75, 0.75, 0.75, 1.0);
	    this.gl.enable(this.gl.DEPTH_TEST);
	    this.gl.depthFunc(this.gl.LEQUAL);
	    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

	    // enable alpha blending
	    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
	    this.gl.enable(this.gl.BLEND);

	    // set up tile shader
	    this.tileShader = this.getProgram(this.gl, "2d-vertex-shader", "2d-fragment-shader")
	    this.gl.useProgram(this.tileShader)

	    // set up uniforms/attributes
	    this.positionLocation = gl.getAttribLocation(this.tileShader, "a_position")
	    this.offsetLocation = gl.getUniformLocation(this.tileShader, "u_offset")

	    var resolutionLocation = gl.getUniformLocation(this.tileShader, "u_resolution")
	    gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height)

	    this.texCoordLocation = gl.getAttribLocation(this.tileShader, "a_texCoord")
	    this.uNumFramesLocation = gl.getUniformLocation(this.tileShader, "u_numFrames")
	    this.uFrameLocation = gl.getUniformLocation(this.tileShader, "u_frame")

	    //this.uOffsetLocation = gl.getUniformLocation(this.tileShader, "u_uOffset")
	    this.uScaleLocation = gl.getUniformLocation(this.tileShader, "u_scale")


	    // provide texture coordinates for the rectangle.
	    this.texCoordBuffer = gl.createBuffer();
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
	    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	        0.0,  0.0,
	        1.0,  0.0,
	        0.0,  1.0,
	        0.0,  1.0,
	        1.0,  0.0,
	        1.0,  1.0]), gl.STATIC_DRAW);
	    gl.enableVertexAttribArray(this.texCoordLocation);
	    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	    this.objectUVBuffer = gl.createBuffer()

	    //this.tileBuffer = this.rectangleBuffer(this.gl, 0, 0, 80, 36)
	    this.tileBuffer = this.rectangleBuffer(this.gl, 0, 0, 1, 1)
	    gl.enableVertexAttribArray(this.positionLocation);
	    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

	    // set up floor light shader
	    if(doFloorLighting) {
        	this.floorLightShader = this.getProgram(this.gl, "2d-vertex-shader", "2d-lighting-fragment-shader")
	    	gl.useProgram(this.floorLightShader)
    	    this.litOffsetLocation = gl.getUniformLocation(this.floorLightShader, "u_offset")
    	    this.litScaleLocation = gl.getUniformLocation(this.floorLightShader, "u_scale")
    	    this.uLightBuffer = gl.getUniformLocation(this.floorLightShader, "u_lightBuffer")
    	    var litResolutionLocation = gl.getUniformLocation(this.floorLightShader, "u_resolution")
    	    var litPositionLocation = gl.getAttribLocation(this.floorLightShader, "a_position")

	    	gl.uniform2f(litResolutionLocation, this.canvas.width, this.canvas.height)

		    var litTexCoordLocation = gl.getAttribLocation(this.floorLightShader, "a_texCoord")
		    gl.enableVertexAttribArray(litTexCoordLocation);
		    gl.vertexAttribPointer(litTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

		    gl.enableVertexAttribArray(litPositionLocation);
		    gl.vertexAttribPointer(litPositionLocation, 2, gl.FLOAT, false, 0, 0);

		    // upload ancillery textures

    	    this.u_colorTable = gl.getUniformLocation(this.floorLightShader, "u_colorTable")
    	    this.u_intensityColorTable = gl.getUniformLocation(this.floorLightShader, "u_intensityColorTable")
    	    this.u_paletteRGB = gl.getUniformLocation(this.floorLightShader, "u_paletteRGB")

    	    // upload color tables
    	    // TODO: have it in a typed array anyway
    	    var _colorTable = getFileJSON("colorTable.json")
    	    gl.activeTexture(gl.TEXTURE2)
    	    this.textureFromArray(_colorTable)
    	    gl.uniform1i(this.u_colorTable, 2)

    	    // intensityColorTable
    	    var _intensityColorTable = Lighting.intensityColorTable
    	    var intensityColorTable = new Uint8Array(65536)
    	    for(var i = 0; i < 65536; i++)
    	    	intensityColorTable[i] = _intensityColorTable[i]
    	    gl.activeTexture(gl.TEXTURE3)
    	    this.textureFromArray(intensityColorTable)
    	    gl.uniform1i(this.u_intensityColorTable, 3)

    	    // paletteRGB
    	    var _colorRGB = getFileJSON("color_rgb.json")
    	    var paletteRGB = new Uint8Array(256*3)
    	    for(var i = 0; i < 256; i++) {
    	    	paletteRGB[i*3 + 0] = _colorRGB[i][0]
    	    	paletteRGB[i*3 + 1] = _colorRGB[i][1]
    	    	paletteRGB[i*3 + 2] = _colorRGB[i][2]
    	    }
    	    gl.activeTexture(gl.TEXTURE4)
    	    this.textureFromColorArray(paletteRGB, 256)
    	    gl.uniform1i(this.u_paletteRGB, 4)

    	    // set up light buffer texture
    	    gl.activeTexture(gl.TEXTURE1)
    	    this.lightBufferTexture = gl.createTexture()
    	    gl.bindTexture(gl.TEXTURE_2D, this.lightBufferTexture)
    	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    	    gl.uniform1i(this.uLightBuffer, 1) // bind the light buffer texture to the shader

    	    gl.activeTexture(gl.TEXTURE0)
	    	gl.useProgram(this.tileShader)
	    }
	}

	setUVs(x: number, w: number, tw: number): void {
		var gl = this.gl
		var s = w/tw
		var sx = x/tw
		gl.bindBuffer(gl.ARRAY_BUFFER, this.objectUVBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		    sx,  0.0,
		    1.0 * s + sx,  0.0,
		    sx,  1.0,
		    sx,  1.0,
		    1.0 * s + sx,  0.0,
		    1.0 * s + sx,  1.0]), gl.STATIC_DRAW);
	}

	renderLoop(): void {
		console.log("render")
		this.render()
		//window.requestAnimationFrame(this.renderLoop.bind(this))
		setTimeout(16, this.renderLoop.bind(this))
	}

	/*render(): void {
		super.render()
	}*/

	rectangleBuffer(gl, x, y, width, height) {
		var gl = this.gl
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		var x1 = x;
		var x2 = x + width;
		var y1 = y;
		var y2 = y + height;
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		   x1, y1,
		   x2, y1,
		   x1, y2,
		   x1, y2,
		   x2, y1,
		   x2, y2]), gl.STATIC_DRAW);
		return buffer
	}

	getShader(gl, id) {
	    var el: any = document.getElementById(id) // TODO
	    var source = el.text
	    var shader = gl.createShader(el.type === "x-shader/x-fragment" ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)
	    gl.shaderSource(shader, source)
	    gl.compileShader(shader)

	    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
	        console.log("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader))
	        return null
	    }

	    return shader
	}

	getProgram(gl, vid, fid) {
	    var fsh = this.getShader(gl, fid)
	    var vsh = this.getShader(gl, vid)
	    var program = gl.createProgram()
	    gl.attachShader(program, vsh)
	    gl.attachShader(program, fsh)
	    gl.linkProgram(program)

	    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	        console.log("Unable to initialize the shader program.");
	        return null
	    }

	    return program
	}

	color(r: number, g: number, b: number, a: number=255): void {
		//heart.graphics.setColor(r, g, b, a)
	}

	rectangle(x: number, y: number, w: number, h: number, filled: boolean=true): void {
		//heart.graphics.rectangle(filled ? "fill" : "stroke", x, y, w, h)
	}

	text(txt: string, x: number, y: number): void {
		//heart.graphics.print(txt, x, y)
	}

	image(img: any /*HTMLImageElement*/, x: number, y: number, w?: number, h?: number): void {
		//heart.graphics.draw(img, x, y, w, h)
	}

	clear(r: number, g: number, b: number): void {
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
	}

	renderLitFloor(tilemap, useColorTable: boolean=true) {
		// iniitalize color tables if necessary (TODO: hack, should be initialized elsewhere)
		if(useColorTable) {
			if(Lighting.colorLUT === null) {
				Lighting.colorLUT = getFileJSON("color_lut.json")
				Lighting.colorRGB = getFileJSON("color_rgb.json")
			}
		}

		var gl = this.gl

		// use floor light shader
		gl.useProgram(this.floorLightShader)

		// bind buffers
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tileBuffer)
		gl.uniform2f(this.litScaleLocation, 80, 36)

		// bind light buffer texture in texture unit 0
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, this.lightBufferTexture)

		// use tile texture unit
		gl.activeTexture(gl.TEXTURE0)

		for(var i = 0; i < tilemap.length; i++) {
			for(var j = 0; j < tilemap[0].length; j++) {
				var tile = tilemap[j][i]
				if(tile === "grid000") continue
				var img = "art/tiles/" + tile

				var scr = tileToScreen(i, j)
				if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
				   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
					continue

				// TODO: uses hack
				var texture = this.getTextureFromHack(img)
				if(!texture) {
					console.log("skipping tile without a texture: " + img)
					continue
				}
				gl.bindTexture(gl.TEXTURE_2D, texture)

				// compute lighting

				// TODO: how correct is this?
				var hex = hexFromScreen(scr.x - 13,
					                    scr.y + 13)

				var isTriangleLit = Lighting.initTile(hex)
				var framebuffer
				var intensity_

				if(isTriangleLit)
					framebuffer = Lighting.computeFrame()

				// construct light buffer
				//var lightBuffer = new Uint8Array(80*4*36)
				var lightBuffer = new Float32Array(80*4*36)

				// render tile
				for(var y = 0; y < 36; y++) {
					for(var x = 0; x < 80; x++) {
						if(isTriangleLit) {
							intensity_ = framebuffer[160 + 80*y + x]
						}
						else { // uniformly lit
							intensity_ = Lighting.vertices[3]
						}

						// blit to the light buffer
						lightBuffer[(y*80 + x) * 4] = intensity_
					}
				}

				// update light buffer texture
				gl.activeTexture(gl.TEXTURE1)
				//gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 36, 0, gl.RGBA, gl.UNSIGNED_BYTE, lightBuffer)
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 36, 0, gl.RGBA, gl.FLOAT, lightBuffer)
				gl.activeTexture(gl.TEXTURE0)

				// draw
				gl.uniform2f(this.litOffsetLocation, scr.x - cameraX, scr.y - cameraY)
				gl.drawArrays(gl.TRIANGLES, 0, 6)
			}
		}

		// use normal shader
		gl.useProgram(this.tileShader)
	}

	drawTileMap(tilemap: TileMap, offsetY: number): void {
		var gl = this.gl
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tileBuffer)
		gl.uniform1f(this.uNumFramesLocation, 1)
		gl.uniform1f(this.uFrameLocation, 0)
		gl.uniform2f(this.uScaleLocation, 80, 36)

		for(var i = 0; i < tilemap.length; i++) {
			for(var j = 0; j < tilemap[0].length; j++) {
				var tile = tilemap[j][i]
				if(tile === "grid000") continue
				var img = "art/tiles/" + tile

				var scr = tileToScreen(i, j)
				scr.y += offsetY
				if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
				   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
					continue

				// TODO: uses hack
				var texture = this.getTextureFromHack(img)
				if(!texture) {
					console.log("skipping tile without a texture: " + img)
					continue
				}
				gl.bindTexture(gl.TEXTURE_2D, texture)

				// draw
				gl.uniform2f(this.offsetLocation, scr.x - cameraX, scr.y - cameraY)
				gl.drawArrays(gl.TRIANGLES, 0, 6)
			}
		}
	}

	renderRoof(roof: TileMap): void {
		this.drawTileMap(roof, -96)
	}

	renderFloor(floor: TileMap): void {
		if(doFloorLighting)
			this.renderLitFloor(floor)
		else
			this.drawTileMap(floor, 0)
	}

	renderObject(obj: Obj): void {
		var scr = hexToScreen(obj.position.x, obj.position.y)

		if(images[obj.art] === undefined) {
			lazyLoadImage(obj.art) // try to load it in
			return
		}

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
		var scrX = scr.x - offsetX, scrY = scr.y - offsetY

		var spriteFrameNum = info.numFrames * obj.orientation + frameIdx

		if(scrX + frameInfo.w < cameraX || scrY + frameInfo.h < cameraY ||
		   scrX >= cameraX+SCREEN_WIDTH || scrY >= cameraY+SCREEN_HEIGHT)
			return // out of screen bounds, no need to draw

		// TODO: uses hack
		var texture = this.getTextureFromHack(obj.art)
		if(!texture) {
			console.log("no texture for object")
			return
		}

		var gl = this.gl

		// draw
		gl.bindTexture(gl.TEXTURE_2D, texture)

		gl.uniform1f(this.uNumFramesLocation, info.totalFrames)
		gl.uniform1f(this.uFrameLocation, spriteFrameNum)

		gl.uniform2f(this.offsetLocation, scrX - cameraX, scrY - cameraY) // pos
		gl.uniform2f(this.uScaleLocation, info.frameWidth, frameInfo.h) // size

		gl.drawArrays(gl.TRIANGLES, 0, 6)
	}
}