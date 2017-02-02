module SaveLoad {
    let db: IDBDatabase = null;

    // Save game metadata + maps
    interface SaveGame {
        version: number;
        name: string;

        savedMaps: { [mapName: string]: SerializedMap }
    }

    function gatherSaveData(name: string): SaveGame {
        // Saves the game and returns the savegame

        const curMap = gMap.serialize();

        return { version: 1
               , name
               , savedMaps: {[curMap.name]: curMap}
               };
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

    export function save(name: string, callback: () => void): void {
        const save = gatherSaveData(name);

        withTransaction(trans => {
            trans.objectStore("saves").put(save);

            console.log("[SaveLoad] Saved game data as '%s'", name);
        }, callback);
    }

    export function load(id: number): void {}

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

            save("test", () => {
                saveList((saves: SaveGame[]) => {
                    console.log("Save List:");
                    for(const savegame of saves)
                        console.log("Save:", savegame);
                });
            });
        }
    }
}
