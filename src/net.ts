/*
Copyright 2017 darkf

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

// Multiplayer network code (netcode)

module Netcode {
    let ws: WebSocket|null = null;
    let connected = false;
    const handlers: { [msgType: string]: (msg: any) => void } = {};

    export const netPlayerMap: { [uid: number]: NetPlayer } = {};

    function send(t: string, msg: any={}) {
        assert(connected, "Can't send message to unconnected socket");
        msg.t = t;
        ws.send(JSON.stringify(msg));
    }

    export function on(msgType: string, handler: (msg: any) => void): void {
        if(msgType in handlers)
            console.warn("Overwriting existing message handler");
        handlers[msgType] = handler;
    }

    export function connect(host: string, onConnected?: () => void): void {
        ws = new WebSocket(host);

        ws.binaryType = "arraybuffer";

        ws.onopen = (e) => {
            console.log("WebSocket connected to %s", host);
            connected = true;
            onConnected && onConnected();
        };

        ws.onclose = (e: CloseEvent) => {
            console.warn("WebSocket closed (%d): %s", e.code, e.reason);
            connected = false;
        };

        ws.onerror = (e) => {
            console.error("WebSocket error: %o", e);
            connected = false;
        };

        ws.onmessage = (e) => {
            if(typeof e.data !== "string") {
                if("binary" in handlers)
                    handlers.binary(e.data);
                return;
            }

            const msg = JSON.parse(e.data);

            console.log("net: Got %s message", msg.t);

            if(msg.t in handlers)
                handlers[msg.t](msg);
        };
    }

    export function identify(name: string): void {
        send("ident", { name });
    }

    function findObjectByUID(uid: number): Obj|null {
        return gMap.getObjects().find(obj => obj.uid === uid) || null;
    }

    function setupCommonEvents(): void {
        // Player movement
        on("movePlayer", (msg: any) => {
            if(msg.uid in netPlayerMap)
                netPlayerMap[msg.uid].move(msg.position, undefined, false);
        });

        Events.on("playerMoved", (msg: any) => {
            send("moved", { x: msg.x, y: msg.y });
        });

        // Object open/close
        on("objSetOpen", (msg: any) => {
            const obj = findObjectByUID(msg.uid);
            assert(obj !== null, "net.objSetOpen: No such object");
            setObjectOpen(obj, msg.open, false, false);
        });

        Events.on("objSetOpen", (msg: any) => {
            send("objSetOpen", { uid: msg.obj.uid, open: msg.open });
        });
    }

    function getNetPlayers(): NetPlayer[] {
        return Object.values(netPlayerMap);
    }

    export function host(): void {
        send("host");

        setupCommonEvents();

        on("guestJoined", (msg: any) => {
            console.log("Guest '%s' (%d) joined @ %d, %d", msg.name, msg.uid, msg.position.x, msg.position.y);

            // Add guest network player
            const netPlayer = new NetPlayer(msg.name, msg.uid);
            netPlayer.position = msg.position;
            netPlayer.orientation = msg.orientation;
            gMap.addObject(netPlayer);

            netPlayerMap[msg.uid] = netPlayer;
        });

        Events.on("loadMapPre", () => {
            // Remove the net players from the old map
            for(const netPlayer of getNetPlayers())
                gMap.removeObject(netPlayer);
        });

        Events.on("loadMapPost", () => {
            console.log("Map changed, sending map...");
            changeMap();

            // Add the net players to the new map
            for(const netPlayer of getNetPlayers())
                gMap.addObject(netPlayer);
        });

        Events.on("elevationChanged", (e: any) => {
            if(e.isMapLoading)
                return;
            
            // Move net player's elevation from old to new
            // TODO: Perhaps we should refactor this and make a Critter.changeElevation?

            console.log("net: Changing elevation...");
            
            for(const netPlayer of getNetPlayers()) {
                arrayRemove(gMap.objects[e.oldElevation], netPlayer);
                gMap.objects[e.elevation].push(netPlayer);
            }

            send("changeElevation", { elevation: e.elevation, position: player.position, orientation: player.orientation });
        });

        Events.on("objMove", (e: any) => {
            if(e.obj.isPlayer)
                return;
            send("objMove", { uid: e.obj.uid, position: e.position });
        });
    }

    export function join(): void {
        send("join");

        setupCommonEvents();

        let serializedMap: any = null;

        on("binary", (data: any) => {
            console.log("Received binary remote map, decompressing...");
            console.time("map decompression");
            serializedMap = JSON.parse(pako.inflate(data, { to: "string" }));
            console.timeEnd("map decompression");
        });

        on("map", (msg: any) => {
            console.log("Received map change request, loading...");
            console.time("map deserialization");
            gMap.deserialize(serializedMap);
            console.timeEnd("map deserialization");
            console.log("Loaded serialized remote map.");

            // TODO: Spawn the player somewhere sensible
            player.position = msg.player.position;
            player.orientation = 0;
            player.inventory = [];
            
            gMap.changeElevation(msg.player.elevation, false, false);

            // Add host network player
            const netPlayer = new Netcode.NetPlayer(msg.hostPlayer.name, msg.hostPlayer.uid);
            netPlayer.position = msg.hostPlayer.position;
            netPlayer.orientation = msg.hostPlayer.orientation;
            gMap.addObject(netPlayer);

            Netcode.netPlayerMap[msg.hostPlayer.uid] = netPlayer;

            isWaitingOnRemote = false;
        });

        on("elevationChanged", (msg: any) => {
            const oldElevation = gMap.currentElevation;

            gMap.changeElevation(msg.elevation, false, false);

            console.log("net: Changing elevation...");
            
            for(const netPlayer of getNetPlayers()) {
                arrayRemove(gMap.objects[oldElevation], netPlayer);
                gMap.objects[gMap.currentElevation].push(netPlayer);
            }
        });

        on("objMove", (e: any) => {
            const obj = findObjectByUID(e.uid);
            assert(obj !== null, "net.objMove: No such object");

            console.log("Move: uid %o, obj %o, pos %o", e.uid, obj, e.position);

            // Doesn't matter if we signal events or not, we're on the guest -- we won't be sending them (for now).
            // If this changes, we shouldn't signal events here.
            obj.move(e.position);
        });
    }

    export function changeMap(): void {
        // First send the map so the server has it in its buffer
        console.log("Serializing and compressing map...");
        console.time("serialize/compress map");
        ws.send(pako.deflate(JSON.stringify(gMap.serialize())));
        console.timeEnd("serialize/compress map");

        // Now send the map change notification
        console.log("Sending map change request...");
        send("changeMap", { mapName: gMap.name,
                            player: { position: player.position, elevation: gMap.currentElevation, orientation: player.orientation }
        });
    }

    export class NetPlayer extends Critter {
        // TODO: This should mean userid, it conflicts with Obj.uid
        uid: number;

        constructor(name: string, uid: number) {
            super();

            this.name = name;
            this.uid = uid;
        }

        // isPlayer = true; // TODO: isNetPlayer?
        art = "art/critters/hmjmpsaa";

        teamNum = 0;

        position = {x: 94, y: 109}
        orientation = 3
        gender = "male"

        lightRadius = 4
        lightIntensity = 65536

        toString() { return "The Dude, Mk.II" }
    }
}
