class CanvasRenderer extends Renderer {
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

		var spriteFrameNum = info.numFrames * obj.orientation + frameIdx
		var sx = spriteFrameNum * info.frameWidth

		heart.ctx.drawImage(images[obj.art].img,
			sx, 0, frameInfo.w, frameInfo.h,
			scrX - cameraX,
			scrY - cameraY,
			frameInfo.w, frameInfo.h
		)
	}
}