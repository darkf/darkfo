module SaveLoad {
    let db: IDBDatabase = null;

    // Save game metadata + maps
    interface SaveGame {
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
               , savedMaps: {[curMap.name]: curMap}
               };
    }

    export function formatSaveDate(save: SaveGame): string {
        const date = new Date(save.timestamp);
        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    }

    function withTransaction(f: (trans: IDBTransaction) => void, finished?: () => void) {
        const trans = db.transaction("saves", "readwrite");
        trans.oncomplete = finished;
        f(trans);
    }

    function getAll<T>(store: IDBObjectStore, callback?: (result: T[]) => void) {
        const out: T[] = [];

        store.openCursor().onsuccess = function(e) {
          const cursor = (<any>e.target).result;
          if (cursor) {
            out.push(cursor.value);
            cursor.continue();
          }
          else
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
        save("debug", () => { console.log("[SaveLoad] Done"); });
    }

    export function save(name: string, callback: () => void): void {
        const save = gatherSaveData(name);

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
