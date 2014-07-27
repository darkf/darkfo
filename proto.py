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

# Parser/converter for Fallout 2 .PRO files to a JSON format

import sys, os, struct, json

def read16(f):
	return struct.unpack("!h", f.read(2))[0]

def read32(f):
	return struct.unpack("!l", f.read(4))[0]

def read16At(buf, idx):
	return struct.unpack('!h', buf[idx:idx + 2])[0]

def read32At(buf, idx):
	return struct.unpack('!l', buf[idx:idx + 4])[0]

TYPE_ITEM = 0
TYPE_CRITTER = 1
TYPE_SCENERY = 2
TYPE_WALL = 3
TYPE_TILE = 4
TYPE_MISC = 5

SUBTYPE_ARMOR = 0
SUBTYPE_CONTAINER = 1
SUBTYPE_DRUG = 2
SUBTYPE_WEAPON = 3
SUBTYPE_AMMO = 4
SUBTYPE_MISC = 5
SUBTYPE_KEY = 6

SCENERY_DOOR = 0
SCENERY_STAIRS = 1
SCENERY_ELEVATOR = 2
SCENERY_LADDER_BOTTOM = 3
SCENERY_LADDER_TOP = 4
SCENERY_GENERIC = 5

def readScenery(f):
	obj = {}

	obj["wallLightTypeFlags"] = read16(f)
	obj["actionFlags"] = read16(f)
	obj["scriptPID"] = read32(f)
	obj["subType"] = read32(f)
	obj["materialID"] = read32(f)
	obj["soundID"] = ord(f.read(1))

	if obj["subType"] == SCENERY_DOOR:
		obj["walkthroughFlag"] = read32(f)
		# 4-byte unknown
	elif obj["subType"] == SCENERY_STAIRS:
		obj["destination"] = read32(f)
		obj["destinationMap"] = read32(f)
	elif obj["subType"] == SCENERY_ELEVATOR:
		obj["elevatorType"] = read32(f)
		obj["elevatorLevel"] = read32(f)
	elif obj["subType"] == SCENERY_LADDER_BOTTOM or obj["subType"] == SCENERY_LADDER_TOP:
		obj["destination"] = read32(f)
	elif obj["subType"] == SCENERY_GENERIC:
		pass # only 4-byte unknown

	return obj

def readDrugEffect(f):
	obj = {}
	
	obj["duration"] = read32(f)
	obj["amount0"] = read32(f)
	obj["amount1"] = read32(f)
	obj["amount2"] = read32(f)

	return obj

def readItem(f):
	obj = {}

	flagsExt = repr(f.read(3))
	attackMode = ord(f.read(1))
	scriptID = read32(f)
	objSubType = read32(f)
	materialID = read32(f)
	size = read32(f)
	weight = read32(f)
	cost = read32(f)
	invFRM = read32(f)
	soundID = ord(f.read(1))

	obj["flagsExt"] = flagsExt
	obj["itemFlags"] = ord(flagsExt[0])
	obj["actionFlags"] = ord(flagsExt[1])
	obj["weaponFlags"] = ord(flagsExt[2])
	obj["attackMode"] = attackMode
	obj["scriptID"] = scriptID
	obj["subType"] = objSubType
	obj["materialID"] = materialID
	obj["size"] = size
	obj["weight"] = weight
	obj["cost"] = cost
	obj["invFRM"] = invFRM
	obj["soundID"] = soundID

	if objSubType == SUBTYPE_WEAPON:
		obj["animCode"] = read32(f)
		obj["minDmg"] = read32(f)
		obj["maxDmg"] = read32(f)
		obj["dmgType"] = read32(f)
		obj["maxRange1"] = read32(f)
		obj["maxRange2"] = read32(f)
		obj["projPID"] = read32(f)
		obj["minST"] = read32(f)
		obj["APCost1"] = read32(f)
		obj["APCost2"] = read32(f)
		obj["critFail"] = read32(f)
		obj["perk"] = read32(f)
		obj["rounds"] = read32(f)
		obj["caliber"] = read32(f)
		obj["ammoPID"] = read32(f)
		obj["maxAmmo"] = read32(f)
		obj["soundID"] = f.read(1)
	elif objSubType == SUBTYPE_AMMO:
		obj["caliber"] = read32(f)
		obj["quantity"] = read32(f)
		obj["AC modifier"] = read32(f)
		obj["DR modifier"] = read32(f)
		obj["damMult"] = read32(f)
		obj["damDiv"] = read32(f)
	elif objSubType == SUBTYPE_ARMOR:
		obj["AC"] = read32(f)
		obj["stats"] = {}
		for stat in ["DR Normal", "DR Laser", "DR Fire",
					 "DR Plasma", "DR Electrical", "DR EMP", "DR Explosive",
					 "DT Normal", "DT Laser", "DT Fire", "DT Plasma", "DT Electrical",
				 	 "DT EMP", "DT Explosive"]:
			obj["stats"][stat] = read32(f)

		obj["perk"] = read32(f)
		obj["maleFID"] = read32(f)
		obj["femaleFID"] = read32(f)
	elif objSubType == SUBTYPE_DRUG:
		obj["stat0"] = read32(f)
		obj["stat1"] = read32(f)
		obj["stat2"] = read32(f)

		obj["amount0"] = read32(f)
		obj["amount1"] = read32(f)
		obj["amount2"] = read32(f)

		obj["firstDelayed"] = readDrugEffect(f)
		obj["secondDelayed"] = readDrugEffect(f)

		obj["addictionRate"] = read32(f)
		obj["addictionEffect"] = read32(f)
		obj["addictionOnset"] = read32(f)

	#else:
	#	print "warning: unhandled item subtype", objSubType

	return obj

def readCritterStats(f):
	stats = {}

	for stat in ["STR", "PER", "END", "CHR", "INT", "AGI", "LUK", "HP", "AP",
				 "AC", "Unarmed", "Melee", "Carry", "Sequence", "Healing Rate",
				 "Critical Chance", "Better Criticals"]:
		stats[stat] = read32(f)

	for stat in ["DT Normal", "DT Laser", "DT Fire", "DT Plasma", "DT Electrical",
				 "DT EMP", "DT Explosive", "DR Normal", "DR Laser", "DR Fire",
				 "DR Plasma", "DR Electrical", "DR EMP", "DR Explosive",
				 "DR Radiation", "DR Poison"]:
		stats[stat] = read32(f)

	return stats

def readCritterSkills(f):
	skills = {}
	for skill in ["Small Guns", "Big Guns", "Energy Weapons", "Unarmed",
				  "Melee", "Throwing", "First Aid", "Doctor", "Sneak",
				  "Lockpick", "Steal", "Traps", "Science", "Repair",
				  "Speech", "Barter", "Gambling", "Outdoorsman"]:
		skills[skill] = read32(f)
	return skills

def readCritter(f):
	obj = {}

	obj["actionFlags"] = read32(f)
	obj["scriptID"] = read32(f)
	obj["headFID"] = read32(f)
	obj["AI"] = read32(f)
	obj["team"] = read32(f)
	obj["flags"] = read32(f)

	obj["baseStats"] = readCritterStats(f)

	obj["age"] = read32(f)
	obj["gender"] = read32(f)

	obj["bonusStats"] = readCritterStats(f)
	obj["bonusAge"] = read32(f)
	obj["bonusGender"] = read32(f)

	obj["skills"] = readCritterSkills(f)

	obj["bodyType"] = read32(f)
	obj["XPValue"] = read32(f)
	obj["killType"] = read32(f)


	if obj["killType"] in (5, 10): # Robots/Brahmin
		obj["damageType"] = None
	else:
		obj["damageType"] = read32(f)

	return obj

def readPRO(f):
	obj = {}

	objectTypeAndID = read32(f)
	textID = read32(f)
	frmTypeAndID = read32(f)
	lightRadius = read32(f)
	lightIntensity = read32(f)
	flags = read32(f)

	pid = objectTypeAndID & 0xffff
	objType = (objectTypeAndID >> 24) & 0xff

	obj["pid"] = pid
	obj["textID"] = textID
	obj["type"] = objType
	obj["flags"] = flags
	obj["lightRadius"] = lightRadius
	obj["lightIntensity"] = lightIntensity

	frmPID = frmTypeAndID & 0xffff
	frmType = (frmTypeAndID >> 24) & 0xff
	obj["frmPID"] = frmPID
	obj["frmType"] = frmType

	#print "type:", objType

	if objType == TYPE_ITEM:
		obj["extra"] = readItem(f)
	elif objType == TYPE_CRITTER:
		obj["extra"] = readCritter(f)
	elif objType == TYPE_SCENERY:
		obj["extra"] = readScenery(f)
	else:
		print "unhandled type", objType

	return obj

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s PRO" % sys.argv[0]
		sys.exit(1)

	with open(sys.argv[1], "rb") as f:
		print json.dumps(readPRO(f))

if __name__ == '__main__':
	main()