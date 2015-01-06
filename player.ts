class Player extends Critter {
	// TODO: make it so this gets added whenever needed so that other things than just the player can use it
	// It is however only used for tag skills and temporary levelup menu stuff, so it's not crucial
	tempChanges = {skills: {}, stats: {}};

	isPlayer = true;
	art = "art/critters/hmjmpsaa";

	stats = {AGI: 8, INT: 8, STR: 8, CHA: 8, HP: 100}
	skills = {}


	constructor() {
		super()

		this.position = {x: 94, y: 109}
		this.orientation = 3
		//this.frame = 0
		this.leftHand = playerWeapon
	}


	/*
	obj.inventory = [{type: "misc", name: "Money", pid: 41, pidID: 41, amount: 1337, pro: {textID: 4100,
	 				extra: {cost: 1}, invFRM: 117440552}, invArt: 'art/inven/cap2'}]
	obj.toString = function() { return "The Dude" }
	*/

	/*
	var obj = {position: {x: 94, y: 109}, orientation: 2, frame: 0, type: "critter",
				   art: "art/critters/hmjmpsaa", isPlayer: true, anim: "idle", lastFrameTime: 0,
				   path: null, animCallback: null,
				   leftHand: playerWeapon, rightHand: null, weapon: null, armor: null,
				   dead: false, name: "Player", gender: "male", inventory: [
	          	   {type: "misc", name: "Money", pid: 41, pidID: 41, amount: 1337, pro: {textID: 4100, extra: {cost: 1}, invFRM: 117440552}, invArt: 'art/inven/cap2'}
	          	   ], stats: null, skills: null, tempChanges: null}
	*/
}