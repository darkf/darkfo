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
	else:
		print "warning: unhandled item subtype", objSubType

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