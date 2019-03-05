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

// Saving and loading support

module SaveLoad {
    let db: IDBDatabase;

    // Save game metadata + maps
    export interface SaveGame {
        id?: number;
        version: number;
        name: string;
        timestamp: number;
        currentMap: string;
        currentElevation: number;

        player: { position: Point; orientation: number; inventory: SerializedObj[] };
        party: SerializedObj[];
        savedMaps: { [mapName: string]: SerializedMap }
    }

    function gatherSaveData(name: string): SaveGame {
        // Saves the game and returns the savegame

        const curMap = gMap.serialize();

        return { version: 1
               , name
               , timestamp: Date.now()
               , currentElevation
               , currentMap: curMap.name
               , player: {position: player.position, orientation: player.orientation, inventory: player.inventory.map(obj => obj.serialize())}
               , party: gParty.serialize()
               , savedMaps: {[curMap.name]: curMap, ...dirtyMapCache}
               };
    }

    export function formatSaveDate(save: SaveGame): string {
        const date = new Date(save.timestamp);
        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    }

    function withTransaction(f: (trans: IDBTransaction) => void, finished?: () => void) {
        const trans = db.transaction("saves", "readwrite");
        if(finished) trans.oncomplete = finished;
        trans.onerror = (e: any) => { console.error("Database error: " + (<any>e.target).errorCode) };
        f(trans);
    }

    function getAll<T>(store: IDBObjectStore, callback?: (result: T[]) => void) {
        const out: T[] = [];

        store.openCursor().onsuccess = function(e) {
          const cursor = (<any>e.target).result;
          if(cursor) {
            out.push(cursor.value);
            cursor.continue();
          }
          else if(callback)
              callback(out);
        };
    }

    export function saveList(callback: (saves: SaveGame[]) => void): void {
        withTransaction(trans => {
            getAll(trans.objectStore("saves"), callback);
        });
    }

    export function debugSaveList(): void {
        saveList((saves: SaveGame[]) => {
            console.log("Save List:");
            for(const savegame of saves)
                console.log("  -", savegame.name, formatSaveDate(savegame), savegame);
        });
    }

    export function debugSave(): void {
        save("debug", undefined, () => { console.log("[SaveLoad] Done"); });
    }

    export function save(name: string, slot: number=-1, callback?: () => void): void {
        const save = gatherSaveData(name);

        const dirtyMapNames = Object.keys(dirtyMapCache);
        console.log(`[SaveLoad] Saving ${1 + dirtyMapNames.length} maps (current: ${gMap.name} plus dirty maps: ${dirtyMapNames.join(", ")})`);

        if(slot !== -1)
            save.id = slot;

        withTransaction(trans => {
            trans.objectStore("saves").put(save);

            console.log("[SaveLoad] Saving game data as '%s'", name);
        }, callback);
    }

    export function load(id: number): void {
        // Load stored savegame with id

        withTransaction(trans => {
            trans.objectStore("saves").get(id).onsuccess = function(e) {
                const save: SaveGame = (<any>e.target).result;
                const savedMap = save.savedMaps[save.currentMap];

                console.log("[SaveLoad] Loading save #%d ('%s') from %s", id, save.name, formatSaveDate(save));

                gMap.deserialize(savedMap);
                console.log("[SaveLoad] Finished map deserialization");

                // TODO: Properly (de)serialize the player!
                player.position = save.player.position;
                player.orientation = save.player.orientation;
                player.inventory = save.player.inventory.map(obj => deserializeObj(obj));
                
                gParty.deserialize(save.party);

                gMap.changeElevation(save.currentElevation, false);

                // populate dirty map cache out of non-current saved maps
                dirtyMapCache = {...save.savedMaps};
                delete dirtyMapCache[savedMap.name];

                console.log("[SaveLoad] Finished loading map %s", savedMap.name);
            };
        });
    }

    export function init(): void {
        const request = indexedDB.open("darkfo", 1);

        request.onupgradeneeded = function() {
            const db = request.result;
            const store = db.createObjectStore("saves", {keyPath: "id", autoIncrement: true});
        };

        request.onsuccess = function() {
            db = request.result;

            db.onerror = function(e) {
                console.error("Database error: " + (<any>e.target).errorCode);
            };

            console.log("Established DB connection");
        }
    }
}
