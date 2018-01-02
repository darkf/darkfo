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

// Abstract game renderer

type TileMap = string[][]

interface ObjectRenderInfo {
	x: number; y: number; spriteX: number;
	frameWidth: number; frameHeight: number;
	uniformFrameWidth: number;
	uniformFrameHeight: number;
	spriteFrameNum: number;
	artInfo: any;
	visible: boolean;
}

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
		var mouseSquare = tileFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)
		//var mouseTile = tileFromScreen(mousePos[0] + cameraX, mousePos[1] + cameraY)

		if(Config.ui.showFloor)   this.renderFloor(this.floorTiles)
		if(Config.ui.showCursor && hexOverlay) {
			var scr = hexToScreen(mouseHex.x, mouseHex.y)
			this.image(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
		}
		if(Config.ui.showObjects) this.renderObjects(this.objects)
		if(Config.ui.showRoof)    this.renderRoof(this.roofTiles)

		if(inCombat) {
			var whose = combat.inPlayerTurn ? "player" : combat.combatants[combat.whoseTurn].name
			var AP = combat.inPlayerTurn ? player.AP : combat.combatants[combat.whoseTurn].AP
			this.text("[turn " + combat.turnNum + " of " + whose + " AP: " + AP.getAvailableMoveAP() + "]", SCREEN_WIDTH - 200, 15)
		}

		if(Config.ui.showSpatials && Config.engine.doSpatials) {
			gMap.getSpatials().forEach(spatial => {
				var scr = hexToScreen(spatial.position.x, spatial.position.y)
				//heart.graphics.draw(hexOverlay, scr.x - 16 - cameraX, scr.y - 12 - cameraY)
				this.text(spatial.script, scr.x - 10 - cameraX, scr.y - 3 - cameraY)
			})
		}

		this.text("mh: " + mouseHex.x + "," + mouseHex.y, 5, 15)
		this.text("mt: " + mouseSquare.x + "," + mouseSquare.y, 75, 15)
		//heart.graphics.print("mt: " + mouseTile.x + "," + mouseTile.y, 100, 15)
		this.text("m: " + mousePos[0] + ", " + mousePos[1], 175, 15)

		//this.text("fps: " + heart.timer.getFPS(), SCREEN_WIDTH - 50, 15)

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

	objectRenderInfo(obj: Obj): ObjectRenderInfo|null {
		var scr = hexToScreen(obj.position.x, obj.position.y)
		var visible = obj.visible

		if(images[obj.art] === undefined) {
			lazyLoadImage(obj.art) // try to load it in
			return null
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
			visible = false // out of screen bounds, no need to draw

		var spriteFrameNum = info.numFrames * obj.orientation + obj.frame
		var sx = spriteFrameNum * info.frameWidth

		return {x: scrX, y: scrY, spriteX: sx,
			   frameWidth: frameInfo.w, frameHeight: frameInfo.h,
			   uniformFrameWidth: info.frameWidth,
			   uniformFrameHeight: info.frameHeight,
			   spriteFrameNum: spriteFrameNum,
			   artInfo: info,
			   visible: visible}
	}

	renderObjects(objs: Obj[]) {
		for(const obj of objs) {
			if(!Config.ui.showWalls && obj.type === "wall")
				continue;
			if(obj.outline)
				this.renderObjectOutlined(obj);
			else
				this.renderObject(obj);
		}
	}

	// stubs to be overriden
	init(): void { }

	clear(r: number, g: number, b: number): void { }
	color(r: number, g: number, b: number, a: number=255): void { }
	rectangle(x: number, y: number, w: number, h: number, filled: boolean=true): void { }
	text(txt: string, x: number, y: number): void { }
	image(img: HTMLImageElement|HeartImage, x: number, y: number, w?: number, h?: number): void { }

	renderRoof(roof: TileMap): void { }
	renderFloor(floor: TileMap): void { }
	renderObjectOutlined(obj: Obj): void { this.renderObject(obj); }
	renderObject(obj: Obj): void { }
}