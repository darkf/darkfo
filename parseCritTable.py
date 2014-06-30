import sys, os, struct, json

areaName = {0: "head", 1: "leftArm",2: "rightArm",3: "torso",4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
effectName = {0: "knockout", 1: "knockdown", 2: "crippledLeftLeg", 3: "crippledRightLeg", 4: "crippledLeftArm", 5: "crippledRightArm", 6: "blinded", 7: "death", 8: "onFire", 9: "bypassArmor", 10: "droppedWeapon", 11: "loseNextTurn", 12: "random"}

def read32(f):
	return struct.unpack("l", f.read(4))[0]

	
def ParseEffectBinToNamed(_effectBinary):
	ret = []
	for i in range(0,13):
		shift = 0x20000
		if i != 12:
			shift = 0x1 << i
		if _effectBinary & shift: ret.insert(0,effectName[i])
	return ret
	
def ParseOneCrit(f):
	DamageMult = read32(f)
	Effects = ParseEffectBinToNamed(read32(f))
	
	StatCheck = read32(f)
	CheckModifier = read32(f)
	FailureEffect = ParseEffectBinToNamed(read32(f))
	Message = read32(f)
	FailureMessage = read32(f)
	return {'dmgMultiplier':DamageMult,'critEffect':Effects,'statCheck':{'stat':StatCheck,'checkModifier':CheckModifier,'failureEffect':FailureEffect,'fmsg':FailureMessage},'msg':Message}


def DoEverything(_File,_iStartOffset,_iEndOffset,_targetDir):
	if((_iEndOffset-_iStartOffset+1) % (7*4) != 0):
		print "StartOffset: ",_iStartOffset," EndOffset: ",_iEndOffset
		print "EndOffset-StartOffset+1 contains a partial Crit. Aborting."
		sys.exit(1)
	if((_iEndOffset-_iStartOffset+1) % (7*4*9*6) != 0):
		print "StartOffset: ",_iStartOffset," EndOffset: ",_iEndOffset
		print "EndOffset-StartOffset+1 contains a partial Critter Crit Table. Aborting."
		sys.exit(1)		
	openedFile = open(_File,"rb")
	openedFile.seek(_iStartOffset,os.SEEK_SET)
	iCurrentOffset = _iStartOffset
	iCurrentTableNumber = 0
	while iCurrentOffset < _iEndOffset:
		critterTableJson = {}
		for iCurrentAreaNumber in range(0,9):
			critterTableJson[areaName[iCurrentAreaNumber]] = {}
			for iCurrentCritHeight in range(0,6):
				critterTableJson[areaName[iCurrentAreaNumber]]["critLevel"+str(iCurrentCritHeight)] = ParseOneCrit(openedFile)
				iCurrentOffset += (7*4)
		json.dump(critterTableJson, open('%s/critterTable%i.json' % (_targetDir, iCurrentTableNumber), "w"))
		print "written table #",iCurrentTableNumber
		iCurrentTableNumber += 1
	openedFile.close()

def main():
	if len(sys.argv) < 2:
		print "USAGE: %s EXE OUTDIR" % sys.argv[0]
		sys.exit(1)
	#FO2 parsing for the internal crit effect table has to begin at:
	#000fef78
	#and goes till about
	#00106597
	#thats 1080 entries.
	#or 20 critters a 9 regions a 6 entries per region
	DoEverything(sys.argv[1],0x000fef78,0x00106597,sys.argv[2])
		
if __name__ == '__main__':
	main()