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

// HTML5 Canvas game renderer

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

	clear(r: number, g: number, b: number): void {
		heart.graphics.setBackgroundColor(r, g, b)
	}

	renderLitFloor(matrix: string[][], useColorTable: boolean=false) {
		// get the screen framebuffer
		const imageData = heart.ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
		const screenWidth = imageData.width;
		let tmpCtx = null
		let tileData

		if(useColorTable) {
			// XXX: hack
			if(Lighting.colorLUT === null) {
				Lighting.colorLUT = getFileJSON("lut/color_lut.json")
				Lighting.colorRGB = getFileJSON("lut/color_rgb.json")
			}
		}

		// reverse i to draw in the order Fallout 2 normally does
		// otherwise there will be artifacts in the light rendering
		// due to tile sizes being different and not overlapping properly
		for(let i = matrix.length - 1; i >= 0; i--) {
			for(let j = 0; j < matrix[0].length; j++) {
				const tile = matrix[j][i]
				if(tile === "grid000") continue
				const img = "art/tiles/" + tile

				if(images[img] !== undefined) {
					const scr = tileToScreen(i, j)
					if(scr.x+TILE_WIDTH < cameraX || scr.y+TILE_HEIGHT < cameraY ||
					   scr.x >= cameraX+SCREEN_WIDTH || scr.y >= cameraY+SCREEN_HEIGHT)
						continue

					const sx = scr.x - cameraX
					const sy = scr.y - cameraY

					// XXX: how correct is this?
					const hex = hexFromScreen(scr.x - 13,
						                      scr.y + 13)

					if(this.tileDataCache[img] === undefined) {
						// temp canvas to get tile framebuffer
						if(!tmpCtx)
							tmpCtx = document.createElement("canvas").getContext("2d")

						tmpCtx.drawImage(images[img].img, 0, 0)
						tileData = tmpCtx.getImageData(0, 0, images[img].img.width, images[img].img.height)
						this.tileDataCache[img] = tileData
					}
					else
						tileData = this.tileDataCache[img]

					const tileWidth = tileData.width

					const isTriangleLit = Lighting.initTile(hex)
					let framebuffer
					let intensity_

					if(isTriangleLit)
						framebuffer = Lighting.computeFrame()

					// render tile

					const w = Math.min(SCREEN_WIDTH - sx, 80)
					const h = Math.min(SCREEN_HEIGHT - sy, 36)

					for(var y = 0; y < h; y++) {
						for(var x = 0; x < w; x++) {
							if((sx + x) < 0 || (sy + y) < 0)
								continue

							const tileIndex = getPixelIndex(x, y, tileWidth)

							if(tileData.data[tileIndex + 3] === 0) // transparent pixel, skip
								continue

							if(isTriangleLit) {
								intensity_ = framebuffer[160 + 80*y + x]
							}
							else { // uniformly lit
								intensity_ = Lighting.vertices[3]
							}

							const screenIndex = getPixelIndex(sx + x, sy + y, screenWidth)
							const intensity = Math.min(1.0, intensity_/65536) // tile intensity [0, 1]

							// blit to the framebuffer
							if(useColorTable) { // TODO: optimize
								const orig_color = (tileData.data[tileIndex + 0] << 16) | (tileData.data[tileIndex + 1] << 8) | tileData.data[tileIndex + 2]
								const palIdx = Lighting.colorLUT[orig_color] // NOTE: substitue 221 for white for drawing just the lightbuffer
								const tableIdx = palIdx*256 + (intensity_/512 | 0)
								const colorPal = Lighting.intensityColorTable[tableIdx]
								const color = Lighting.colorRGB[colorPal]

								imageData.data[screenIndex + 0] = color[0]
								imageData.data[screenIndex + 1] = color[1]
								imageData.data[screenIndex + 2] = color[2]
							}
							else { // just draw the source pixel with the light intensity
								imageData.data[screenIndex + 0] = tileData.data[tileIndex + 0] * intensity | 0
								imageData.data[screenIndex + 1] = tileData.data[tileIndex + 1] * intensity | 0
								imageData.data[screenIndex + 2] = tileData.data[tileIndex + 2] * intensity | 0
							}
						}
					}
				}
			}
		}

		// write the framebuffer back to the canvas
		heart.ctx.putImageData(imageData, 0, 0)
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
				else { // Try to lazy-load the missing tile
					lazyLoadImage(img);	
				}
			}
		}
	}

	renderRoof(roof: TileMap): void {
		this.drawTileMap(roof, -96)
	}

	renderFloor(floor: TileMap): void {
		if(Config.engine.doFloorLighting)
			this.renderLitFloor(floor, Config.engine.useLightColorLUT)
		else
			this.drawTileMap(floor, 0)
	}

	renderObjectOutlined(obj: Obj): void {
		// Render an outlined object using the temporary canvas
		//
		// We render the outline by rendering the object 8 times for each 8 directions
		// to achieve a uniformly spaced outline in all directions.
		// We then draw over that silhouette, filling it with the outline color.
		// Finally we can draw the actual object sprite over it normally.

		if(!obj.outline)
			throw Error("renderObjectOutlined received an object without an outline");

		const renderInfo = this.objectRenderInfo(obj);
		if(!renderInfo || !renderInfo.visible)
			return;

		// Clear temp canvas
		tempCanvasCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		const img = images[obj.art].img;
		const w = renderInfo.frameWidth;
		const h = renderInfo.frameHeight;
		const srcX = renderInfo.spriteX;

		// Draw object to temp canvas in 8 directions (up/down/left/right/diagonals)
		// Note that we offset by (1, 1) so that we have a pixel reserved on the boundaries for the outline
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 1+1, 0+1, w, h); // right
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, -1+1, 0+1, w, h); // left
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 0+1, -1+1, w, h); // up
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 0+1, 1+1, w, h); // down
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, -1+1, -1+1, w, h); // up-left
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 1+1, 1+1, w, h); // down-right
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, -1+1, 1+1, w, h); // down-left
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 1+1, -1+1, w, h); // down-right

		// Use source-in blending to fill what we drew with the outline color
		tempCanvasCtx.globalCompositeOperation = "source-in";
		tempCanvasCtx.fillStyle = obj.outline;
		tempCanvasCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		// Revert back to the default source-over blend mode
		tempCanvasCtx.globalCompositeOperation = "source-over";

		// Render the object normally
		tempCanvasCtx.drawImage(img, srcX, 0, w, h, 1, 1, w, h);

		// Render the sprite from the temp canvas to the main canvas
		heart.ctx.drawImage(tempCanvas, 0, 0, renderInfo.frameWidth, renderInfo.frameHeight,
			renderInfo.x - cameraX,
			renderInfo.y - cameraY,
			renderInfo.frameWidth, renderInfo.frameHeight);
	}

	renderObject(obj: Obj): void {
		const renderInfo = this.objectRenderInfo(obj);
		if(!renderInfo || !renderInfo.visible)
			return;

		heart.ctx.drawImage(images[obj.art].img,
			renderInfo.spriteX, 0, renderInfo.frameWidth, renderInfo.frameHeight,
			renderInfo.x - cameraX,
			renderInfo.y - cameraY,
			renderInfo.frameWidth, renderInfo.frameHeight);
	}
}