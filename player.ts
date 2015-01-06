/*
Copyright 2014-2015 darkf

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

// Contains the Player class and relevant initialization logic

"use strict";

class Player extends Critter {
	// TODO: make it so this gets added whenever needed so that other things than just the player can use it
	// It is however only used for tag skills and temporary levelup menu stuff, so it's not crucial
	tempChanges = {skills: {}, stats: {}};

	isPlayer = true;
	art = "art/critters/hmjmpsaa";

	stats = {AGI: 8, INT: 8, STR: 8, CHA: 8, HP: 100}
	skills = {}

	position = {x: 94, y: 109}
	orientation = 3
	gender = "male"
	leftHand = <WeaponObj>createObjectWithPID(9)

	inventory = [createObjectWithPID(41).setAmount(1337)]

	toString() { return "The Dude" }

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