module IDBCache {
    let db: IDBDatabase = null;

    function withTransaction(f: (trans: IDBTransaction) => void, finished?: () => void) {
        const trans = db.transaction("cache", "readwrite");
        trans.oncomplete = finished;
        f(trans);
    }

    export function nuke(): void {
        withTransaction(trans => {
            trans.objectStore("cache").clear();
        });
    }

    export function add(key: string, value: any): any {
        withTransaction(trans => {
            trans.objectStore("cache").add({key, value})
        });

        return value;
    }

    export function exists(key: string, callback: (exists: boolean) => void): void {
        withTransaction(trans => {
            const req = trans.objectStore("cache").count(key);
            req.onsuccess = (e) => { callback((<any>e).result !== 0); };
        });
    }

    export function get(key: string, callback: (value: any) => void): any {
        withTransaction(trans => {
            trans.objectStore("cache").get(key).onsuccess = function(e) {
                const result = (<any>e.target).result;
                callback(result ? result.value : null);
            };
        });
    }

    export function init(callback?: () => void): void {
        const request = indexedDB.open("darkfo-cache", 1);

        request.onupgradeneeded = function() {
            const db = request.result;
            const store = db.createObjectStore("cache", {keyPath: "key"});
            // store.createIndex("key", "key", {unique: true});
        };

        request.onsuccess = function() {
            db = request.result;

            db.onerror = function(e) {
                console.error("Database error: " + (<any>e.target).errorCode, (<any>e).target);
            };

            console.log("Established Cache DB connection");

            callback && callback();
        }
    }
}
