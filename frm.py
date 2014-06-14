# DarkFO
# Copyright (c) 2014 darkf
# Licensed under the terms of the zlib license

import sys, os, struct

def read16(f):
	return struct.unpack("!h", f.read(2))[0]

def read32(f):
	return struct.unpack("!l", f.read(4))[0]

def read16At(buf, idx):
	return struct.unpack('!h', buf[idx:idx + 2])[0]

def read32At(buf, idx):
	return struct.unpack('!l', buf[idx:idx + 4])[0]

def readFRMInfo(f):
	f.seek(8)
	numFrames = read16(f)
	dOffsetX = [read16(f) for _ in range(6)]
	dOffsetY = [read16(f) for _ in range(6)]
	directionPtrs = [read32(f) for _ in range(6)]
	framesBufSize = read32(f)
	nDirTotal = 1 + sum(1 for x in directionPtrs if x != 0)

	framesData = f.read(framesBufSize)

	# print "num frames:", numFrames
	# print "dOffsetX:", dOffsetX
	# print "dOffsetY:", dOffsetY
	# print "directionOffset:", directionOffset
	# print "framesBufSize:", framesBufSize
	# print "nDirTotal:", nDirTotal

	frameOffset = [[] for _ in range(nDirTotal)]
	for nDir in range(nDirTotal):
		ptr = directionPtrs[nDir]

		for nFrame in range(numFrames):
			pixelDataSize = read32At(framesData, ptr + 4)
			frameOffset[nDir].append({'x': read16At(framesData, ptr + 8),
			                          'y': read16At(framesData, ptr + 10),
			                          'w': read16At(framesData, ptr),
			                          'h': read16At(framesData, ptr + 2)})
			ptr += 12 + pixelDataSize

	# print "frameOffset:", frameOffset
	return {'numFrames': numFrames,
	        'directionOffsets': [{'x': x, 'y': y} for x,y in zip(dOffsetX, dOffsetY)],
	        'frameOffsets': frameOffset}

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s FRM" % sys.argv[0]
		sys.exit(1)

	with open(sys.argv[1], "rb") as f:
		print readFRMInfo(f)

if __name__ == '__main__':
	main()