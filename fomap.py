"""
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
"""

# Parser/converter for Fallout 1 (partially) and 2 .MAP files to a JSON format

from __future__ import print_function
import sys, os, struct, json

def read16(f):
    return struct.unpack("!h", f.read(2))[0]

def readU16(f):
    return struct.unpack("!H", f.read(2))[0]

def read32(f):
    return struct.unpack("!l", f.read(4))[0]

def readU32(f):
    return struct.unpack("!L", f.read(4))[0]

def stripExt(path):
    return os.path.splitext(path)[0]

def getNumLevels(elevationFlags):
    if elevationFlags & 8:
        if elevationFlags & 4:
            return 1
        return 2
    return 3

def fromTileNum(tileNum):
    return {"x": tileNum % 200, "y": tileNum // 200}

def blankTileMap():
    # 100x100 2D array
    return [[0]*100 for _ in range(100)]

def parseTiles(f, numLevels):
    # parse floor/roof tiles
    floorTiles = [blankTileMap() for _ in range(numLevels)]
    roofTiles = [blankTileMap() for _ in range(numLevels)]

    # read interspersed roof/floor tiles
    for level in range(numLevels):
        for i in range(10000):
            x = i % 100; y = i // 100

            # reversed on the x axis because Fallout maps are normally reversed
            roofTiles[level][y][99 - x] = readU16(f)
            floorTiles[level][y][99 - x] = readU16(f)

    return floorTiles, roofTiles

def parseMapScripts(f):
    print("todo: map scripts")

def parseMapObjects(f):
    print("todo: map objects")

def parseLevel(level, floorTiles, roofTiles, objects, tilesLst):
    def transformTile(idx):
        return stripExt(tilesLst[idx].rstrip()).lower()

    def transformTileMap(tileMap):
        return [[transformTile(idx) for idx in row] for row in tileMap]

    return {"tiles": {"floor": transformTileMap(floorTiles[level]),
                      "roof": transformTileMap(roofTiles[level])
                     },
            "spatials": [],
            "objects": []
           }

def parseMap(f, lstFiles):
    version = readU32(f)
    if version == 19:
        namedVersion = "FO1"
    elif version == 20:
        namedVersion = "FO2"
    else:
        raise ValueError("not a FO1 or FO2 map")

    mapName = f.read(16).decode('ascii').rstrip('\0')
    playerPosition = read32(f)
    playerElevation = read32(f)
    playerOrientation = read32(f)
    numLocalVars = read32(f)
    mapScriptID = read32(f)
    elevationFlags = read32(f)
    numLevels = getNumLevels(elevationFlags)
    unk1 = read32(f)
    numGlobalVars = read32(f)
    mapID = read32(f)
    time = readU32(f)
    f.read(4*44) # unk2

    gvars = [read32(f) for _ in range(numGlobalVars)]
    lvars = [read32(f) for _ in range(numLocalVars)]

    floorTiles, roofTiles = parseTiles(f, numLevels)

    scripts = parseMapScripts(f)
    objects = parseMapObjects(f)

    print("version:", version, namedVersion)
    print("name: %r" % mapName)

    levels = [parseLevel(level, floorTiles, roofTiles, objects, lstFiles["tiles"]) for level in range(numLevels)]

    return {"version": namedVersion,
            "mapID": mapID,
            "name": mapName,
            "levels":  levels,
            "startPosition": fromTileNum(playerPosition),
            "startElevation": playerElevation,
            "startOrientation": playerOrientation
           }

def readLst(dataDir, path):
    with open(os.path.join(dataDir, path), "rb") as f:
        return [x.rstrip() for x in list(f)]

def getImageList(map):
    images = set()

    for levels in map["levels"]:
        for tilemap in levels["tiles"].values():
            for row in tilemap:
                for tile in row:
                    images.add("art/tiles/" + tile)

        # TODO: objects

    return list(images)

def main():
    if len(sys.argv) < 3:
        print("USAGE: %s DATA_DIR MAP_FILE [OUT_FILE]" % sys.argv[0])
        print("DATA_DIR should be the base directory where the .DATs are extracted")
        return

    DATA_DIR = sys.argv[1]
    MAP_FILE = sys.argv[2]
    MAP_NAME = os.path.basename(MAP_FILE).lower()
    OUT_FILE = os.path.join("maps", stripExt(MAP_NAME) + ".json") # default path
    if len(sys.argv) == 4:
        OUT_FILE = sys.argv[3]

    lstFiles = {"tiles": readLst(DATA_DIR, "art/tiles/tiles.lst")}

    with open(MAP_FILE, "rb") as fin:
        with open(OUT_FILE, "wb") as fout:
            print("writing %s..." % OUT_FILE)
            map = parseMap(fin, lstFiles)
            json.dump(map, fout)

            # write image list
            print("writing image list...")
            with open(stripExt(OUT_FILE) + ".images.json", "wb") as fimg:
                json.dump(getImageList(map), fimg)

            print("done")

if __name__ == '__main__':
    main()