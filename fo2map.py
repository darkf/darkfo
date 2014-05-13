import sys, math, struct
from construct import *

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

def getProSubType(path):
	with open(path, "rb") as f:
		f.seek(0x20)
		sub = struct.unpack("!L", f.read(4))[0]
		print "subtype:", sub
		return sub

def getProFile(id):
	pass

ExtraObjectInfo = \
	Switch("extra", lambda ctx: ctx.type, {
		#objtype_item: Padding(0)
		objtype_tile: Padding(0)
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
	# todo: elevation as well
	SBInt32("totalObjects"),
	Array(lambda ctx: ctx.totalObjects,
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

			Value("type", lambda ctx: (ctx.protoPID >> 24) & 0xff),
			#Value("subtype", lambda ctx: getProSubType("proto/items/" + getProFile((ctx.protoPID & 0xffff) - 1))),
			ExtraObjectInfo
		)
	)

	#Array(5,
	#	SBInt32("count"),
	#	
	#)
)

with open("derp.map", "rb") as f:
	data = f.read()
	map_ = fomap.parse(data)
	if map_.version != 20:
		print "not a FO2 map"
		sys.exit(1)
	#print map_
	print len(map_.tiles), "tiles"
	print map_.totalObjects, "objects"
	#print map_.object[0].type

	# quick export
	# break down list of 1000 tiles into a 100x100 2d list
	tiles = [tile.floor for tile in map_.tiles]
	newmap = []
	for i in range(100):
		newmap.append(tiles[i*100:i*100+100])

	#print [tile.floor for tile in map_.tiles]
	#print sum(len(row) for row in newmap)
	with open("derp.json", "w") as g:
		g.write("{\"tiles\":\n")
		#g.write(repr(newmap))
		g.write('[\n')
		for i,row in enumerate(newmap):
			g.write('\t' + repr(row))
			if i != len(newmap)-1:
				g.write(',\n')
			else: g.write('\n')
		g.write(']\n')
		g.write('\n}')