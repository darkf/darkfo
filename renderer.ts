type TileMap = string[][]

class Renderer {
	objects: Obj[];
	roofTiles: TileMap;
	floorTiles: TileMap;

	initData(roof: TileMap, floor: TileMap, objects: Obj[]): void {
		this.roofTiles = roof
		this.floorTiles = floor
		this.objects = objects
	}

	render(): void {
		this.clear(127, 127, 127)

		if(isLoading) {
			this.color(0, 0, 0)
			var w = 256, h = 40
			var w2 = (loadingAssetsLoaded / loadingAssetsTotal) * w
			// draw a loading progress bar
			this.rectangle(SCREEN_WIDTH/2 - w/2, SCREEN_HEIGHT/2,
					w, h, false)
			this.rectangle(SCREEN_WIDTH/2 - w/2 + 2, SCREEN_HEIGHT/2 + 2,
					w2 - 4, h - 4)
			return
		}

		this.color(255, 255, 255)

		var mousePos = heart.mouse.getPosition()
		var mouseHex = hexFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)
		//var mouseTile = tileFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

		if(showFloor)   this.renderFloor(this.floorTiles)
		if(showCursor) {
			var scr = hexToScreen(mouseHex.x, mouseHex.y)
			this.image(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
		}
		if(showObjects) this.renderObjects(this.objects)
		if(showRoof)    this.renderRoof(this.roofTiles)


		if(inCombat) {
			var whose = combat.inPlayerTurn ? "player" : critterGetName(combat.combatants[combat.whoseTurn])
			var AP = combat.inPlayerTurn ? player.AP : combat.combatants[combat.whoseTurn].AP
			this.text("[turn " + combat.turnNum + " of " + whose + " AP: " + AP.getAvailableMoveAP() + "]", SCREEN_WIDTH - 200, 15)
		}

		if(showSpatials && doSpatials !== false) {
			for(var i = 0; i < gSpatials.length; i++) {
				var spatial = gSpatials[i]
				var scr = hexToScreen(spatial.position.x, spatial.position.y)
				//heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
				this.text(spatial.script, scr.x - 10 - cameraX, scr.y - 3 - cameraY)
			}
		}

		this.text("mh: " + mouseHex.x + "," + mouseHex.y, 5, 15)
		//heart.graphics.print("mt: " + mouseTile.x + "," + mouseTile.y, 100, 15)
		this.text("m: " + mousePos[0] + ", " + mousePos[1], 175, 15)

		this.text("fps: " + heart.timer.getFPS(), SCREEN_WIDTH - 50, 15)

		for(var i = 0; i < floatMessages.length; i++) {
			var bbox = objectBoundingBox(floatMessages[i].obj)
			if(bbox === null) continue
			heart.ctx.fillStyle = floatMessages[i].color
			var centerX = bbox.x - bbox.w/2 - cameraX
			this.text(floatMessages[i].msg, centerX, bbox.y - cameraY - 16)
		}

		if(player.dead) {
			this.color(255, 0, 0, 50)
			this.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
		}
	}

	renderObjects(objs: Obj[]) {
		objs.forEach(this.renderObject.bind(this))
	}

	// stubs to be overriden
	init(): void { }

	clear(r: number, g: number, b: number): void { }
	color(r: number, g: number, b: number, a: number=255): void { }
	rectangle(x: number, y: number, w: number, h: number, filled: boolean=true): void { }
	text(txt: string, x: number, y: number): void { }
	image(img: any /*HTMLImageElement*/, x: number, y: number, w?: number, h?: number): void { }

	renderRoof(roof: TileMap): void { }
	renderFloor(floor: TileMap): void { }
	renderObject(obj: Obj): void { }
}