/*
Copyright 2014 darkf

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
    name = "Player"

    isPlayer = true;
    art = "art/critters/hmjmpsaa";

    stats = new StatSet({AGI: 8, INT: 8, STR: 8, CHA: 8, HP: 100})
    skills = new SkillSet(undefined, undefined, 10) // Start off with 10 skill points

    teamNum = 0

    position = {x: 94, y: 109}
    orientation = 3
    gender = "male"
    leftHand = <WeaponObj>createObjectWithPID(9)

    inventory = [createObjectWithPID(41).setAmount(1337)]

    lightRadius = 4
    lightIntensity = 65536

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

    move(position: Point, curIdx?: number, signalEvents: boolean=true): boolean {
        if(!super.move(position, curIdx, signalEvents))
            return false

        if(signalEvents)
            Events.emit("playerMoved", position);

        // check if the player has entered an exit grid
        var objs = objectsAtPosition(this.position)
        for(var i = 0; i < objs.length; i++) {
            if(objs[i].type === "misc" && objs[i].extra && objs[i].extra.exitMapID !== undefined) {
                // walking on an exit grid
                // todo: exit grids are likely multi-hex (maybe have a set?)
                var exitMapID = objs[i].extra.exitMapID
                var startingPosition = fromTileNum(objs[i].extra.startingPosition)
                var startingElevation = objs[i].extra.startingElevation
                this.clearAnim()

                if(startingPosition.x === -1 || startingPosition.y === -1 ||
                   exitMapID < 0) { // world map
                    console.log("exit grid -> worldmap")
                    uiWorldMap()
                }
                else { // another map
                    console.log("exit grid -> map " + exitMapID + " elevation " + startingElevation +
                        " @ " + startingPosition.x + ", " + startingPosition.y)
                    if(exitMapID === gMap.mapID) {
                        // same map, different elevation
                        gMap.changeElevation(startingElevation, true)
                        player.move(startingPosition)
                        centerCamera(player.position)
                    }
                    else
                        gMap.loadMapByID(exitMapID, startingPosition, startingElevation)
                }

                return false
            }
        }

        return true
    }
}