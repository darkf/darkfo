"""
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
"""

# Converts Fallout 2 format .MAP files to a custom JSON format for DarkFO

import sys, math, struct, os, json
from construct import *
from collections import Counter

mapScriptPIDs = [{} for _ in range(5)]

def pidType(pid):
	return (pid >> 24) & 0xff

class ScriptsIgnore(Construct):
    def _parse(self, stream, context):
        totalScriptCount = 0
        spatials = []
        #scripts = []

        for scriptType in range(5):
        	scriptCount = SBInt32("")._parse(stream, context)
        	#print "script type", scriptType, "count:", scriptCount

        	totalScriptCount += scriptCount

        	if scriptCount > 0:
        		loop = scriptCount
        		if loop % 16:
        			loop = scriptCount + (16 - scriptCount % 16)

        		checkCount = 0
        		for i in range(loop):
        			pid = SBInt32("")._parse(stream, context)
        			pid_type = pidType(pid)

        			# TODO: find out more about this
        			#print "!!! PID:", hex(pid & 0xffff)
        			script = Peek(Struct("",
        				UBInt32("unk1"),
        				#Padding(0 if pid_type not in (1, 2) else 4),
        				IfThenElse("tileNum", lambda _: pid_type in (1, 2),
        					UBInt32(""),
        					Padding(0)),
        				IfThenElse("unk3", lambda _: pid_type == 2,
        					UBInt32("unk3_value"),
        					Padding(0)),
        				UBInt32("range"),
        				UBInt32("id"),
        				IfThenElse("spatialScriptID", lambda _: pid_type == 1,
        					UBInt32(""),
        					Padding(0))
        			))._parse(stream, context)

        			script_id = script.id
        			#print "script_id:", script_id
        			pidID = pid & 0xffff

        			if pid_type == 1: # spatial scripts
	        			if script.range > 50:
	        				# this is a hack because, presumably due to this entire
	        				# procedure being undocumented hacks that need better
	        				# reverse engineering, we get garbage that is not
	        				# actually a valid script.
	        				# filter them out here.

	        				print "invalid spatial script range:", script.range
	        			else:
		        			#print "script id:", script.spatialScriptID, "or", (script.spatialScriptID & 0xffff)
		        			scriptName = stripExt(getProFile(scriptLst, script.spatialScriptID).split()[0])
	        				spatials.append({"tileNum": script.tileNum & 0xffff,
	        					             "elevation": ((script.tileNum >> 28) & 0xf) >> 1,
	        					             "range": script.range,
	        					             "scriptID": script.spatialScriptID,
	        					             "script": scriptName})

        			#scripts.append({"type": pid_type, "pidID": pidID, "script": script})
        			#if pid_ > 16:
        			#	print "ignoring script pid:", hex(pid), "(", pid_, ")"
        			#else:
        			if script_id > 0 and script_id < len(scriptLst):
	    				scriptName = stripExt(getProFile(scriptLst, script_id).split()[0])
	    				#print "Map script PID %d type %d is %d (%s)" % (pidID, scriptType, script_id, scriptName)
	        			mapScriptPIDs[scriptType][pidID] = scriptName
	        			#print "name:", scriptName

        			move = 15
        			if pid_type == 1:
        				move += 2
        			elif pid_type == 2:
        				move += 1

        			if scriptType == pid_type:
        				checkCount += 1

        			Padding(move * 4)._parse(stream, context)
        			if (i % 16) == 15:
        				check = SBInt32("")._parse(stream, context)
        				SBInt32("")._parse(stream, context) # unknown

        				if checkCount < check:
        					raise Exception("script check failed")

        return {"count": totalScriptCount, "spatials": spatials}

    def _build(self, obj, stream, context):
        # write obj to the stream (usually not directly)
        # no return value is necessary
        raise NotImpl()

    def _sizeof(self, context):
        # return computed size, or raise SizeofError if not possible
        raise SizeofError()

class Stub(Construct):
    def _parse(self, stream, context):
        raise Exception("stub: " + self.msg)

    def _build(self, obj, stream, context):
        raise NotImpl()

    def _sizeof(self, context):
        raise SizeofError()

def stub(msg):
	s = Stub("stub")
	s.msg = msg
	return s

objtype_item = 0
objtype_critter = 1
objtype_scenery = 2
objtype_wall = 3
objtype_tile = 4
objtype_misc = 5
objtype_interface = 6
objtype_inventory = 7
objtype_head = 8
objtype_background = 9

# items
itemtype_armor = 0
itemtype_container = 1
itemtype_drug = 2
itemtype_weapon = 3
itemtype_ammo = 4
itemtype_misc = 5
itemtype_key = 6

# scenery
scenerytype_portal = 0
scenerytype_stairs = 1
scenerytype_elevator = 2
scenerytype_ladderup = 3
scenerytype_ladderdown = 4
scenerytype_generic = 5

def getProSubType(path):
	with open(os.path.join("data", path), "rb") as f:
		f.seek(0x20)
		sub = struct.unpack("!L", f.read(4))[0]
		#print "subtype:", sub
		return sub

def loadLst(lst):
	with open(os.path.join("data", lst), "r") as f:
		return [x.rstrip() for x in list(f)]

def stripExt(path):
	return os.path.splitext(path)[0]

def getProFile(lst, id):
	return lst[id]

def getCritterArtPath(frmPID):
	#"art/critters/" + stripExt(getProFile(critterLst, ctx._.frmPID & 0x00000fff))
	idx =  frmPID & 0x00000fff
	id1 = (frmPID & 0x0000f000) >> 12
	id2 = (frmPID & 0x00ff0000) >> 16
	id3 = (frmPID & 0x70000000) >> 28

	if (id2 == 0x1b or id2 == 0x1d or
			id2 == 0x1e or id2 == 0x37 or
			id2 == 0x39 or id2 == 0x3a or
			id2 == 0x21 or id2 == 0x40):
		raise Exception("reindex")
		#print "switching critter id from %d" % idx
		#idx = lst.getReIndex(idx);
		#Log("DEBUG") << "new critter id " << idx;

	path = "art/critters/" + getProFile(critterLst, idx).split(",")[0].upper()

	#tmpBuf = ""

	if (id1 >= 0x0b):
		raise Exception("?")

	if (id2 >= 0x26 and id2 <= 0x2f):
		raise Exception("0x26 and 0x2f")
		#tmpBuf = str(id1 + 'c') + str(id2 + 0x3d)
		#tmpBuf[0] = char(id1) + 'c';
		#tmpBuf[1] = char(id2) + 0x3d;
		#path.append(tmpBuf);
		#path += tmpBuf
	elif (id2 == 0x24):
		path += "ch"
	elif (id2 == 0x25):
		path += "cj"
	elif (id2 >= 0x30):
		#tmpBuf[0] = 'r';
		#tmpBuf[1] = char(id2) + 0x31;
		#path.append(tmpBuf);
		path += 'r' + chr(id2 + 0x31)
	elif (id2 >= 0x14):
		raise Exception("0x14")
		#tmpBuf[0] = 'b';
		#tmpBuf[1] = char(id2) + 0x4d;
		#path.append(tmpBuf);
	elif (id2 == 0x12):
		raise Exception("0x12")
		if id1 == 0x01:
			path += "dm"
		elif id1 == 0x04:
			path += "gm"
		else:
			path += "as"
	elif (id2 == 0x0d):
		raise Exception("0x0d")
		# if (id1 > 0) {
		# 	tmpBuf[0] = char(id1) + 'c';
		# 	tmpBuf[1] = 'e';
		# 	path.append(tmpBuf);
		# }
		# else {
		# 	path.append("an");
		# }
	else:
		#raise Exception("other")
		if (id2 <= 1 and id1 > 0):
			#print "ID1:", id1
			path += chr(id1 + ord('c'))
			#tmpBuf[0] = char(id1) + 'c';
		else:
			#tmpBuf[0] = 'a';
			path += 'A'
		#tmpBuf[1] = char(id2) + 'a';
		path += chr(id2 + ord('a'))
		#path.append(tmpBuf);

	path += ".fr"
	if not id3:
		path += "m"
	else:
		path += str(id3 - 1)
		#path.append(boost::lexical_cast<std::string>(id3 - 1));

	return path

itemsLst = loadLst("art/items/items.lst")
itemsProtoLst = loadLst("proto/items/items.lst")
wallsLst = loadLst("art/walls/walls.lst")
critterLst = loadLst("art/critters/critters.lst")
miscLst = loadLst("art/misc/misc.lst")
sceneryLst = loadLst("art/scenery/scenery.lst")
sceneryProtoLst = loadLst("proto/scenery/scenery.lst")
scriptLst = loadLst("scripts/scripts.lst")

ItemInfo = Struct("",
	Value("subtype", lambda ctx: getProSubType("proto/items/" + getProFile(itemsProtoLst, (ctx._.protoPID & 0xffff) - 1))),
	Value("type", lambda _: "item"),
	Value("artPath", lambda ctx: "art/items/" + stripExt(getProFile(itemsLst, (ctx._.frmPID & 0xffff)))),
	Switch("info", lambda ctx: ctx.subtype, {
		itemtype_ammo: Struct("",
			Value("subtype", lambda _: "ammo"),
			UBInt32("ammoCount"),
		),
		itemtype_weapon: Struct("",
			Value("subtype", lambda _: "weapon"),
			Padding(8)
		),
		itemtype_container: Struct("", Value("subtype", lambda _: "container")),
		itemtype_armor: Struct("", Value("subtype", lambda _: "armor")),
		itemtype_drug: Struct("", Value("subtype", lambda _: "drug")),
		itemtype_misc: Struct("",
			Value("subtype", lambda _: "misc"),
			Padding(4)
		),
		itemtype_key: Struct("",
			Value("subtype", lambda _: "key"),
			Padding(4)
		)
	})
)

CritterInfo = Struct("",
	Value("type", lambda _: "critter"),
	Value("artPath", lambda ctx: stripExt(getCritterArtPath(ctx._.frmPID))),
	Padding(4*4),
	SBInt32("AInum"),
	UBInt32("groupID"),
	Padding(4),
	UBInt32("hp"),
	Padding(4*2)
)

Ladder = IfThenElse("", lambda ctx: ctx._._._.version == 20,
		Struct("", # fallout 2
			SBInt32("unknown1"),
			SBInt32("destination")),
		Padding(4) # fallout 1 (probably destination?)
)

SceneryInfo = Struct("",
	Value("type", lambda _: "scenery"),
	Value("artPath", lambda ctx: "art/scenery/" + stripExt(getProFile(sceneryLst, ctx._.frmPID & 0xffff))),
	Value("subtype", lambda ctx: getProSubType("proto/scenery/" + getProFile(sceneryProtoLst, (ctx._.protoPID & 0xffff) - 1))),
	Switch("extra", lambda ctx: ctx.subtype, {
		scenerytype_portal: Struct("",
			Value("subtype", lambda _: "door"),
			Padding(4)
		),
		scenerytype_elevator: Struct("",
			Value("subtype", lambda _: "elevator"),
			UBInt32("type"),
			UBInt32("level")
			#Padding(4*2)
		),
		scenerytype_stairs: Struct("",
			Value("subtype", lambda _: "stairs"),
			SBInt32("destination"),
			SBInt32("destinationMap"),
		),
		scenerytype_ladderup: Ladder,
		scenerytype_ladderdown: Ladder,
		scenerytype_generic: Struct("", Value("subtype", lambda _: "generic"))
	})
)

ExtraObjectInfo = \
	Switch("extra", lambda ctx: ctx.objtype, {
		objtype_item: ItemInfo,
		objtype_wall: Struct("",
			Value("type", lambda _: "wall"),
			Value("artPath", lambda ctx: "art/walls/" + stripExt(getProFile(wallsLst, (ctx._.frmPID & 0xffff))))
		),
		objtype_critter: CritterInfo,
		objtype_misc: Struct("",
			Value("type", lambda _: "misc"),
			Value("artPath", lambda ctx: "art/misc/" + stripExt(getProFile(miscLst, ctx._.frmPID & 0xffff))),
			If(lambda ctx: (ctx._.protoPID & 0xffff) != 1 and (ctx._.protoPID & 0xffff) != 12,
				#Padding(4*4))
				# exit grids
				Struct("extra",
					SBInt32("exitMapID"),
					SBInt32("startingPosition"),
					SBInt32("startingElevation"),
					UBInt32("startingOrientation")
			))
		),
		objtype_scenery: SceneryInfo,

		# stubs
		objtype_tile: stub("tile"),
		objtype_interface: stub("interface"),
		objtype_inventory: stub("inventory"),
		objtype_head: stub("head"),
		objtype_background: stub("background")
	})

def computeLevels(ctx):
	if (ctx.elevationFlags & 8) != 0:
		if (ctx.elevationFlags & 4) != 0:
			return 1
		return 2
	return 3

object_ = Struct("object",
	Padding(4), # unknown (separator)
	SBInt32("position"),
	Padding(4*4), # unknown
	UBInt32("frameNum"), # index into FRM file
	UBInt32("orientation"),
	UBInt32("frmPID"),
	UBInt32("flags"),
	UBInt32("elevation"),
	UBInt32("protoPID"),
	Padding(4), # unknown
	UBInt32("lightRadius"),
	UBInt32("lightIntensity"),
	Padding(4), # unknown
	UBInt32("mapPID"),
	SBInt32("scriptID"),
	UBInt32("numInventory"),
	Padding(4*3), # unknown

	Value("objtype", lambda ctx: (ctx.protoPID >> 24) & 0xff),
	ExtraObjectInfo,

	Array(lambda ctx: ctx.numInventory,
		Struct("inventory",
			UBInt32("amount"),
			LazyBound("_obj", lambda: object_)
		)
	)
)

fomap = Struct("map",
	UBInt32("version"),
	String("name", 16, padchar='\0', paddir='right'),
	SBInt32("playerPos"),
	SBInt32("elevation"),
	SBInt32("playerOrientation"),
	SBInt32("numLocalVars"),
	SBInt32("scriptID"),
	SBInt32("elevationFlags"),
	Value("numLevels", computeLevels),
	SBInt32("unknown1"),
	SBInt32("numGlobalVars"),
	SBInt32("mapID"),
	SBInt32("time"),
	Padding(4*44),

	Array(lambda ctx: ctx.numGlobalVars, SBInt32("gvars")),
	Array(lambda ctx: ctx.numLocalVars, SBInt32("lvars")),

	# floor/roof tiles
	Array(lambda ctx: ctx.numLevels,
		Array(10000,
			Struct("tiles",
				UBInt16("roof"),
				UBInt16("floor")
			)
		)
	),
	#Padding(10000 * 4),

	ScriptsIgnore("scripts"),

	# map
	SBInt32("totalObjects"),
	Array(lambda ctx: ctx.numLevels, Struct("objects",
		SBInt32("totalObjectsLevel"),
		Array(lambda ctx: ctx.totalObjectsLevel, object_)
	))
)

def tileNumToPos(t):
	return {"x": t % 200, "y": t / 200}

def convertMap(data, mapName, outDir, verbose=True):
	map_ = fomap.parse(data)
	if map_.version != 20:
		raise Exception("not a FO2 map")
	if verbose:
		print "elevation:", map_.numLevels
		print sum(len(level) for level in map_.tiles), "tiles"
		print map_.totalObjects, "objects"
		print map_.objects[0].totalObjectsLevel, "objects on level 1"
		print len(map_.scripts['spatials']), "spatial scripts"

	sumObjects = sum(level.totalObjectsLevel for level in map_.objects)
	if map_.totalObjects != sumObjects:
		raise Exception("totalObjects != sum of objects in each level? (totalObjects=%s, sumObjects=%d)" % (map_.totalObjects, sumObjects))

	#print map_.object[0]

	theMap = {
		"levels": [], # info for each elevation
		"startPosition": tileNumToPos(map_.playerPos),
		"startElevation": map_.elevation,
		"startOrientation": map_.playerOrientation,
		"mapID": map_.mapID
	}
	lst = loadLst("art/tiles/tiles.lst")
	#scriptLst = loadLst("scripts/scripts.lst")
	tileCounter = Counter()
	objectCounter = Counter()
	scriptCounter = Counter()
	writeTiles = True
	writeObjects = True
	writeImageList = True
	writeSpatials = True

	"""
	del map_.tiles
	for spatial in map_.scripts['spatials']:
		del spatial['_script']
		print "spatial:", spatial
	scripts = map_.scripts['scripts']
	for script in scripts:
		print "type:", script['type']
		print "PID:", script['pidID']
		print "script:", script['script']
	return
	"""

	for elevation in range(map_.numLevels):
		# break down list of 1000 tiles into a 100x100 2d list
		floorTiles = [tile.floor for tile in map_.tiles[elevation]]
		roofTiles = [tile.roof for tile in map_.tiles[elevation]]

		floorMap = [floorTiles[i*100:i*100+100] for i in range(100)]
		roofMap = [roofTiles[i*100:i*100+100] for i in range(100)]

		m = {"tiles": {"floor": [], "roof": []}, "objects": []}
		if writeTiles:
			for i in range(100):
				floorRow = [stripExt(getProFile(lst, t).rstrip()).lower() for t in floorMap[i]]
				roofRow = [stripExt(getProFile(lst, t).rstrip()).lower() for t in roofMap[i]]
				for tile in floorRow: tileCounter[tile] += 1
				for tile in roofRow: tileCounter[tile] += 1
				# reverse because FO's maps are reversed in the X axis
				m["tiles"]["floor"].append(list(reversed(floorRow)))
				m["tiles"]["roof"].append(list(reversed(roofRow)))

		if writeObjects:
			def getObject(object_):
				if hasattr(object_, "_obj"): # subobjects
					amount = object_.amount
					object_ = object_._obj
					object_.amount = amount

				obj = {"type": object_.extra.type,
					   "pid": object_.protoPID,
					   "pidID": (object_.protoPID & 0xffff),
					   "frmPID": object_.frmPID,
					   "flags": object_.flags,
					   "position": tileNumToPos(object_.position),
					   "orientation": object_.orientation,
					   "lightRadius": object_.lightRadius,
					   "lightIntensity": object_.lightIntensity}
				#if hasattr(object_.extra, "subtype"):
				#	obj["subtype"] = object_.extra.subtype

				#if (object_.protoPID & 0xffff) == 1293:
				#	print "elevator stub:", repr(object_)

				if hasattr(object_.extra, "extra"):
					obj["extra"] = object_.extra.extra
				if hasattr(object_.extra, "info"):
					obj["subtype"] = object_.extra.info.subtype
				if hasattr(object_.extra, "artPath"):
					obj["art"] = object_.extra.artPath.lower()
					objectCounter[object_.extra.artPath.lower()] += 1

				if object_.scriptID != -1:
					scriptName = stripExt(getProFile(scriptLst, object_.scriptID).split()[0])
					obj["script"] = scriptName
					scriptCounter[scriptName] += 1
				elif object_.scriptID == -1 and object_.mapPID != 0xFFFFFFFF:
					# this is some funky stuff... let's try to use the script IDs we got from
					# the weird script ignore step
					scriptType = (object_.mapPID >> 24) & 0xff
					scriptPID = object_.mapPID & 0xffff
					if verbose: print "using map script for %s (script PID %d)" % (object_.extra.artPath, scriptPID)
					scriptName = mapScriptPIDs[scriptType][scriptPID]
					if verbose: print "(map script %d type %d = %s)" %  (scriptPID, scriptType, scriptName)
					obj["script"] = scriptName
					scriptCounter[scriptName] += 1

				if hasattr(object_, "amount"):
					obj["amount"] = object_.amount

				# inventory
				obj["inventory"] = [getObject(inv) for inv in object_.inventory]

				return obj

			if writeSpatials:
				m["spatials"] = [x for x in map_.scripts['spatials'] if x['elevation'] == elevation]

			for i,object_ in enumerate(map_.objects[elevation].object):
				m["objects"].append(getObject(object_))

		theMap["levels"].append(m)

	json.dump(theMap, open(os.path.join(outDir, stripExt(mapName) + ".json"), "w"))

	# player (Vault 13 Jumpsuit)
	#objectCounter["art/critters/hmjmpsaa"] += 1
	#objectCounter["art/critters/hmjmpsab"] += 1

	if writeImageList:
		images = list("art/tiles/" + x for x in tileCounter) + list(objectCounter)
		json.dump(images, open(os.path.join(outDir, stripExt(mapName) + ".images.json"), "w"))
		#open(os.path.join(outDir, stripExt(mapName)+".images.txt"), "w").writelines(x+"\n" for x in images)

	#for tile in tileCounter:
	#	print "art/tiles/" + tile
	#for obj in objectCounter:
	#	print obj
	if verbose:
		for script in scriptCounter:
			print script

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s MAP" % sys.argv[0]
		return

	MAP_FILE = sys.argv[1]
	MAP_NAME = os.path.basename(MAP_FILE)

	with open(MAP_FILE, "rb") as f:
		convertMap(f.read(), MAP_NAME, outDir="maps")

if __name__ == '__main__':
	main()