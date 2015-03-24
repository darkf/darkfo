class WebGLRenderer extends Renderer {
	canvas: any;
	gl: any;
	offsetLocation: any;
	positionLocation: any;
	uOffsetLocation: any;
	tileBuffer: any;
	tileShader: any;
	textures: {[key: string]: any} = {}; // WebGL texture cache

	newTexture(key: string, img: any): any {
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

	init(): void {
		//heart.attach("cnv")
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

	    var texCoordLocation = gl.getAttribLocation(this.tileShader, "a_texCoord")

	    this.uOffsetLocation = gl.getUniformLocation(this.tileShader, "u_uOffset")

	    // provide texture coordinates for the rectangle.
	    var texCoordBuffer = gl.createBuffer();
	    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	        0.0,  0.0,
	        1.0,  0.0,
	        0.0,  1.0,
	        0.0,  1.0,
	        1.0,  0.0,
	        1.0,  1.0]), gl.STATIC_DRAW);
	    gl.enableVertexAttribArray(texCoordLocation);
	    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	    this.tileBuffer = this.rectangleBuffer(this.gl, 0, 0, 80, 36)
	    gl.enableVertexAttribArray(this.positionLocation);
	    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

	    // TODO: hack
	    // render loop
	    //this.renderLoop()
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

	drawTileMap(tilemap: TileMap, offsetY: number): void {
		var gl = this.gl
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tileBuffer)

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
		this.gl.uniform1f(this.uOffsetLocation, 0)
		this.drawTileMap(roof, -96)
	}

	renderFloor(floor: TileMap): void {
		this.gl.uniform1f(this.uOffsetLocation, 0)
		this.drawTileMap(floor, 0)
	}

	renderObject(obj: Obj): void {
		/*
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

		if(scrX + frameInfo.w < cameraX || scrY + frameInfo.h < cameraY ||
		   scrX >= cameraX+SCREEN_WIDTH || scrY >= cameraY+SCREEN_HEIGHT)
			return // out of screen bounds, no need to draw

		// TODO: uses hack
		var texture = this.getTextureFromHack(obj.art)

		// TODO

		heart.ctx.drawImage(images[obj.art].img,
			frameInfo.sx, 0, frameInfo.w, frameInfo.h,
			scrX - cameraX,
			scrY - cameraY,
			frameInfo.w, frameInfo.h
		)
		*/
	}
}