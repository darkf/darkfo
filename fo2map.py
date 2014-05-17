import sys, math, struct, os
from construct import *
from collections import Counter

def pidType(pid):
	return (pid >> 24) & 0xff

class ScriptsIgnore(Construct):
    def _parse(self, stream, context):
        totalScriptCount = 0

        for scriptType in range(5):
        	scriptCount = SBInt32("")._parse(stream, context)
        	print "script type", scriptType, "count:", scriptCount

        	totalScriptCount += scriptCount

        	if scriptCount > 0:
        		loop = scriptCount
        		if loop % 16:
        			loop = scriptCount + (16 - scriptCount % 16)

        		checkCount = 0
        		for i in range(loop):
        			pid = SBInt32("")._parse(stream, context)
        			pid_type = pidType(pid)

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

        return totalScriptCount

    def _build(self, obj, stream, context):
        # write obj to the stream (usually not directly)
        # no return value is necessary
        raise NotImpl()

    def _sizeof(self, context):
        # return computed size, or raise SizeofError if not possible
        raise SizeofError()

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

def getProSubType(path):
	with open(os.path.join("data", path), "rb") as f:
		f.seek(0x20)
		sub = struct.unpack("!L", f.read(4))[0]
		print "subtype:", sub
		return sub

def loadLst(lst):
	with open(os.path.join("data", lst), "r") as f:
		return [x.rstrip() for x in list(f)]

def stripExt(path):
	return os.path.splitext(path)[0]

def getProFile(lst, id):
	return lst[id]

itemsLst = loadLst("proto/items/items.lst")
wallsLst = loadLst("art/walls/walls.lst")

ItemInfo = Struct("",
	Value("subtype", lambda ctx: getProSubType("proto/items/" + getProFile(itemsLst, (ctx._.protoPID & 0xffff) - 1))),
	Value("type", lambda _: "item"),
	Switch("info", lambda ctx: ctx.subtype, {
		itemtype_ammo: Struct("",
			Value("subtype", lambda _: "ammo"),
			UBInt32("ammoCount"),
			Value("artPath", lambda ctx: "art/items/" + stripExt(getProFile(wallsLst, (ctx._._.frmPID & 0xffff))))
		)
	})
)

ExtraObjectInfo = \
	Switch("extra", lambda ctx: ctx.objtype, {
		objtype_item: ItemInfo,
		#objtype_tile: Padding(0),
		objtype_wall: Struct("",
			Value("type", lambda _: "wall"),
			Value("artPath", lambda ctx: "art/walls/" + stripExt(getProFile(wallsLst, (ctx._.frmPID & 0xffff))))
		)
	})

def computeLevels(ctx):
	if (ctx.elevationFlags & 8) != 0:
		if (ctx.elevationFlags & 4) != 0:
			return 1
		return 2
	return 3

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
	#Array(44, SBInt32("unknown2")),
	Padding(4*44),

	Array(lambda ctx: ctx.numGlobalVars, SBInt32("gvars")),
	Array(lambda ctx: ctx.numLocalVars, SBInt32("lvars")),

	# tiles
	# todo: elevation
	Array(10000,
		Struct("tiles",
			UBInt16("roof"),
			UBInt16("floor")
		)
	),
	#Padding(10000 * 4),

	ScriptsIgnore("scripts"),

	# map
	SBInt32("totalObjects"),
	# todo: elevation as well
	SBInt32("totalObjectsLevel"),
	Array(lambda ctx: ctx.totalObjectsLevel,
		Struct("object",
			Padding(4), # unknown (separator)
			SBInt32("position"),
			Padding(4*4), # unknown
			UBInt32("frameNum"), # index into FRM file
			UBInt32("orientation"),
			UBInt32("frmPID"),
			Padding(4), # unknown flags
			UBInt32("elevation"),
			UBInt32("protoPID"),
			Padding(4), # unknown
			Padding(4), # unknown (light strength?)
			Padding(4*2), # unknown
			UBInt32("mapPID"),
			SBInt32("scriptID"),
			UBInt32("numInventory"), # TODO
			Padding(4*3), # unknown

			Value("objtype", lambda ctx: (ctx.protoPID >> 24) & 0xff),
			ExtraObjectInfo
		)
	)

	#Array(5,
	#	SBInt32("count"),
	#	
	#)
)

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s MAP" % sys.argv[0]
		return

	MAP_FILE = sys.argv[1]

	with open(MAP_FILE, "rb") as f:
		data = f.read()
		map_ = fomap.parse(data)
		if map_.version != 20:
			print "not a FO2 map"
			sys.exit(1)
		#print map_
		print len(map_.tiles), "tiles"
		print map_.totalObjects, "objects"
		print map_.totalObjectsLevel, "objects on level 1"

		print map_.object[0]

		# quick export
		# break down list of 1000 tiles into a 100x100 2d list
		tiles = [tile.floor for tile in map_.tiles]
		newmap = []
		for i in range(100):
			newmap.append(tiles[i*100:i*100+100])

		#print [tile.floor for tile in map_.tiles]
		#print sum(len(row) for row in newmap)
		lst = loadLst("art/tiles/tiles.lst")
		c = Counter()
		cWalls = Counter()
		writeTiles = True
		with open(stripExt(MAP_FILE) + ".json", "w") as g:
			g.write("{\"tiles\":\n")
			#g.write(repr(newmap))
			g.write('[\n')
			if writeTiles:
				for i,row in enumerate(newmap):
					row = [getProFile(lst, t).rstrip() for t in row]
					for t in row:
						c[t] += 1
					g.write('\t' + repr(row).replace("'", '"').replace(".frm", ".png"))
					if i != len(newmap)-1:
						g.write(',\n')
					else: g.write('\n')
			g.write(']\n')
			g.write(', "objects": [\n')
			for i,obj in enumerate(map_.object):
				g.write('{"type": "' + obj.extra.type + '",\n')
				x = obj.position % 200
				y = obj.position / 200
				g.write(' "position": {"x":%d, "y":%d},\n' % (x,y))
				g.write(' "elevation": ' + str(obj.elevation+1) + ',\n')
				if hasattr(obj.extra, "artPath"):
					g.write(' "art": "' + str(obj.extra.artPath) + '"\n')
					cWalls[obj.extra.artPath] += 1

				g.write('}')
				if i != len(map_.object)-1:
					g.write(',\n')
				else: g.write('\n')
			g.write(']\n')
			g.write('\n}')

		print c.most_common(20)
		print len(c), "unique tiles"
		for t,o in c.iteritems():
			print t

		print ""
		print "walls"

		for t,o in cWalls.iteritems():
			print t

if __name__ == '__main__':
	main()