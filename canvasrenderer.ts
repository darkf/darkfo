class CanvasRenderer extends Renderer {
	tileDataCache: {[key: string]: any} = {}

	init(): void {
		heart.attach("cnv")
	}

	color(r: number, g: number, b: number, a: number=255): void {
		heart.graphics.setColor(r, g, b, a)
	}

	rectangle(x: number, y: number, w: number, h: number, filled: boolean=true): void {
		heart.graphics.rectangle(filled ? "fill" : "stroke", x, y, w, h)
	}

	text(txt: string, x: number, y: number): void {
		heart.graphics.print(txt, x, y)
	}

	image(img: any /*HTMLImageElement*/, x: number, y: number, w?: number, h?: number): void {
		heart.graphics.draw(img, x, y, w, h)
	}

	renderLitFloor(matrix, useColorTable: boolean=true) {
		// get the screen framebuffer
		var imageData = heart.ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
		var hexes = []

		if(useColorTable) {
			// TODO: hack
			if(Lighting.colorLUT === null) {
				Lighting.colorLUT = getFileJSON("color_lut.json")
				Lighting.colorRGB = getFileJSON("color_rgb.json")
			}
		}

		for(var i = 0; i < matrix.length; i++) {
			for(var j = 0; j < matrix[0].length; j++) {
				var tile = matrix[j][i]
				if(tile === "grid000") continue
				var img = "art/tiles/" + tile

				if(images[img] !== undefined) {
					var scr = tileToScreen(i, j)
					if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
					   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
						continue

					var sx = scr.x - cameraX
					var sy = scr.y - cameraY

					// TODO: how correct is this?
					var hex = hexFromScreen(scr.x - 13,
						                    scr.y + 13)

					//hexes.push(hex)
					//hex.x = 199 - hex.x

					if(this.tileDataCache[img] === undefined) {
						// temp canvas to get tile framebuffer
						var tmpCanvas = document.createElement('canvas')
						var ctx = tmpCanvas.getContext('2d')
						ctx.drawImage(images[img].img, 0, 0)
						var tileData = ctx.getImageData(0, 0, images[img].img.width, images[img].img.height)
						this.tileDataCache[img] = tileData
					}
					else
						tileData = this.tileDataCache[img]

					var isTriangleLit = Lighting.initTile(hex)
					var framebuffer
					var intensity_

					if(isTriangleLit)
						framebuffer = Lighting.computeFrame()

					// render tile
					var w = Math.min(SCREEN_WIDTH - sx, 80)
					var h = Math.min(SCREEN_HEIGHT - sy, 36)
					for(var y = 0; y < h; y++) {
						for(var x = 0; x < w; x++) {
							if((sx + x) < 0 || (sy + y) < 0)
								continue
							var tileIndex = getPixelIndex(x, y, tileData)
							if(tileData.data[tileIndex + 3] === 0) // transparent pixel
								continue
							var index = getPixelIndex(sx + x, sy + y, imageData)

							if(isTriangleLit) {
								intensity_ = framebuffer[160 + 80*y + x]
							}
							else { // uniformly lit
								intensity_ = Lighting.vertices[3]
							}

							// blit to the framebuffer
							if(useColorTable) {
								var orig_color = (tileData.data[tileIndex + 0] << 16) | (tileData.data[tileIndex + 1] << 8) | tileData.data[tileIndex + 2]
								var palIdx = Lighting.colorLUT[orig_color]
								var tableIdx = palIdx*256 + (intensity_/512 | 0)
								var colorPal = Lighting.intensityColorTable[tableIdx]
								var color = Lighting.colorRGB[colorPal]

								imageData.data[index + 0] = color[0]
								imageData.data[index + 1] = color[1]
								imageData.data[index + 2] = color[2]
								//imageData.data[index + 3] = 255
							}
							else {
								var intensity = Math.min(1.0, intensity_/65536)
								imageData.data[index + 0] = Math.floor(tileData.data[tileIndex + 0] * intensity)
								imageData.data[index + 1] = Math.floor(tileData.data[tileIndex + 1] * intensity)
								imageData.data[index + 2] = Math.floor(tileData.data[tileIndex + 2] * intensity)
								//imageData.data[index + 3] = 255
							}
						}
					}
				}
			}
		}

		// write the framebuffer back
		heart.ctx.putImageData(imageData, 0, 0)

		// draw hexes
		hexes.forEach(hex => {
			var hscr = hexToScreen(hex.x, hex.y)
			heart.graphics.draw(hexOverlay, hscr.x - 16 - cameraX, hscr.y - 12 - cameraY)
		})
	}

	drawTileMap(matrix: TileMap, offsetY: number): void {
		for(var i = 0; i < matrix.length; i++) {
			for(var j = 0; j < matrix[0].length; j++) {
				var tile = matrix[j][i]
				if(tile === "grid000") continue
				var img = "art/tiles/" + tile

				if(images[img] !== undefined) {
					var scr = tileToScreen(i, j)
					scr.y += offsetY
					if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
					   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
						continue
					heart.graphics.draw(images[img], scr.x - cameraX, scr.y - cameraY)
				}
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
		//heart.graphics.setColor(255, 0, 0)
		//heart.graphics.rectangle("fill", 0, 0, 64, 64)

		var scr = hexToScreen(obj.position.x, obj.position.y)

		if(images[obj.art] === undefined) {
			lazyLoadImage(obj.art) // try to load it in
			return
		}

		var info = imageInfo[obj.art]
		if(info === undefined)
			throw "No image map info for: " + obj.art

		if(!(obj.orientation in info.frameOffsets))
			obj.orientation = 0 // ...
		var frameInfo = info.frameOffsets[obj.orientation][obj.frame]
		var dirOffset = info.directionOffsets[obj.orientation]

		// Anchored from the bottom center
		var offsetX = -(frameInfo.w / 2 | 0) + dirOffset.x
		var offsetY = -frameInfo.h + dirOffset.y

		if(obj.shift) {
			offsetX += obj.shift.x
			offsetY += obj.shift.y
		}
		else {
			offsetX += frameInfo.ox
			offsetY += frameInfo.oy
		}

		var scrX = scr.x + offsetX, scrY = scr.y + offsetY

		if(scrX + frameInfo.w < cameraX || scrY + frameInfo.h < cameraY ||
		   scrX >= cameraX+SCREEN_WIDTH || scrY >= cameraY+SCREEN_HEIGHT)
			return // out of screen bounds, no need to draw

		var spriteFrameNum = info.numFrames * obj.orientation + obj.frame
		var sx = spriteFrameNum * info.frameWidth

		heart.ctx.drawImage(images[obj.art].img,
			sx, 0, frameInfo.w, frameInfo.h,
			scrX - cameraX,
			scrY - cameraY,
			frameInfo.w, frameInfo.h
		)
	}
}