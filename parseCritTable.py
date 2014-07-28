"""
Copyright 2014 darkf, Stratege

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

# Parser for Critical Hit tables from the Fallout 2 v1.02 .exe file

import sys, os, struct, json

areaName = {0: "head", 1: "leftArm", 2: "rightArm", 3: "torso", 4: "rightLeg",
            5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
effectName = {0: "knockout", 1: "knockdown", 2: "crippledLeftLeg",
              3: "crippledRightLeg", 4: "crippledLeftArm", 5: "crippledRightArm",
              6: "blinded", 7: "death", 8: "onFire", 9: "bypassArmor", 10: "droppedWeapon",
              11: "loseNextTurn", 12: "random"}

def read32(f):
	return struct.unpack("<l", f.read(4))[0]
	
def parseEffectBinToNamed(effectBinary):
	ret = []
	for i in range(0,13):
		shift = 0x20000
		if i != 12:
			shift = 1 << i
		if effectBinary & shift:
			ret.insert(0, effectName[i])
	return ret
	
def parseOneCrit(f):
	damageMult = read32(f)
	effects = parseEffectBinToNamed(read32(f))
	
	statCheck = read32(f)
	checkModifier = read32(f)
	failureEffect = parseEffectBinToNamed(read32(f))
	message = read32(f)
	failureMessage = read32(f)
	
	return {'dmgMultiplier': damageMult,
	        'critEffect': effects,
	        'statCheck': {'stat': statCheck,
	                      'checkModifier': checkModifier,
	                      'failureEffect': failureEffect,
	                      'failureMessage': failureMessage},
            'msg': message}


def readCriticalTables(f ,startOffset, endOffset):
	if (endOffset - startOffset + 1) % (7 * 4) != 0:
		print "StartOffset: ",startOffset," EndOffset: ",endOffset
		print "EndOffset-StartOffset+1 contains a partial Crit. Aborting."
		sys.exit(1)

	if (endOffset - startOffset + 1) % (7 * 4 * 9 * 6) != 0:
		print "StartOffset: ",startOffset," EndOffset: ",endOffset
		print "EndOffset-StartOffset+1 contains a partial Critter Crit Table. Aborting."
		sys.exit(1)

	f.seek(startOffset)
	offset = startOffset

	critTable = []
	while offset < endOffset:
		critterTable = {}

		for area in range(0, 9):
			critterTable[areaName[area]] = []
			for critHeight in range(0, 6):
				critterTable[areaName[area]].append(parseOneCrit(f))
				offset += 7 * 4

		critTable.append(critterTable)

	return critTable
def main():
	if len(sys.argv) < 2:
		print "USAGE: %s EXE" % sys.argv[0]
		sys.exit(1)

	#FO2 parsing for the internal crit effect table has to begin at:
	#000fef78
	#and goes till about
	#00106597
	#thats 1080 entries.
	#or 20 critters a 9 regions a 6 entries per region

	with open(sys.argv[1], "rb") as f:
		critTables = readCriticalTables(f, 0x000fef78, 0x00106597)
	json.dump(critTables, open("criticalTables.json", "w"))
	print "done"
		
if __name__ == '__main__':
	main()