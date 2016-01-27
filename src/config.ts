// Configuration for the engine internals, controls and UI

var Config = {
	ui: {
		screenWidth: 800,
		screenHeight: 600,

		scrollPadding: 20, // how far the mouse has to be from an edge to scroll, in pixels
		floatMessageDuration: 3, // how long floating messages stay on screen, in seconds

		showHexOverlay: false, // show hex grid?
		showCoordinates: false, // show coordinates on hex grid?
		showCursor: true, // show hex cursor?
		showPath: false, // show player's path?
		showFloor: true, // show floor tiles?
		showRoof: true, // show roof tiles?
		showObjects: true, // show objects?
		showWalls: true, // show walls?
		showBoundingBox: false, // show bounding boxes around objects?
		showSpatials: true, // show spatial script triggers?
	},

	engine: {
		renderer: "canvas", // which renderer backend to use ("canvas" or "webgl")
		doLoadScripts: true, // should we load scripts?
		doUpdateCritters: true, // should we give critters heartbeats?
		doTimedEvents: true, // should we handle registered timed events?
		doSpatials: true, // should we handle spatial triggers?
		doCombat: true, // allow combat?
		doUseWeaponModel: true, // use weapon model for NPC models?
		doLoadItemInfo: true, // load item information (such as inventory images)?
		doAlwaysRun: true, // always run instead of walk?
		doZOrder: true, // Z-order objects?
		doEncounters: true, // allow random encounters?
		doInfiniteUse: false, // allow infinite-range object usage?
		doFloorLighting: false, // use FO2-realistic floor lighting?
		doAudio: false, // enable audio?
	},

	controls: {
		cameraDown: "down",
		cameraUp: "up",
		cameraLeft: "left",
		cameraRight: "right",
		elevationDown: "q",
		elevationUp: "e",
		showRoof: "r",
		showFloor: "f",
		showObjects: "o",
		showWalls: "w",
		talkTo: "t",
		inspect: "i",
		moveTo: "m",
		runTo: "j",
		attack: "g",
		combat: "c",
		playerToTargetRaycast: "y",
		showTargetInventory: "v",
		use: "u",
		kill: "k",
		worldmap: "p",
		calledShot: "z",
	},

	scripting: {
		debugLogShowType: {
				stub: true,
				log: false,
				timer: false,
				load: false,
				debugMessage: true,
				displayMessage: true,
				floatMessage: false,
				gvars: false,
				lvars: false,
				mvars: false,
				tiles: true,
				animation: false,
				movement: false,
				inventory: true,
				party: false,
				dialogue: false
		}
	}
}