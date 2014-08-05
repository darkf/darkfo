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

# FRM parsing/conversion library

import sys, os, struct, json
import pal
import Image
import numpy as np

def read16(f):
	return struct.unpack("!h", f.read(2))[0]

def read32(f):
	return struct.unpack("!l", f.read(4))[0]

def read16At(buf, idx):
	return struct.unpack('!h', buf[idx:idx + 2])[0]

def read32At(buf, idx):
	return struct.unpack('!l', buf[idx:idx + 4])[0]

def readFRMInfo(f, exportImage=True):
	_version = read32(f)
	fps = read16(f)
	_actionFrame = read16(f)
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

	framePixels = [[] for _ in range(nDirTotal)]
	frameOffset = [[] for _ in range(nDirTotal)]
	for nDir in range(nDirTotal):
		ptr = directionPtrs[nDir]

		for nFrame in range(numFrames):
			pixelDataSize = read32At(framesData, ptr + 4)
			frameOffset[nDir].append({'x': read16At(framesData, ptr + 8),
			                          'y': read16At(framesData, ptr + 10),
			                          'w': read16At(framesData, ptr),
			                          'h': read16At(framesData, ptr + 2)})

			frameSize = read32At(framesData, ptr + 4) # w*h
			if exportImage:
				framePixels[nDir].append(np.array([ord(byte) for byte in framesData[ptr + 12 : ptr + 12 + frameSize]]))

			ptr += 12 + pixelDataSize

	# print "frameOffset:", frameOffset
	return {'numFrames': numFrames,
			'fps': fps,
			'numDirections': nDirTotal,
	        'directionOffsets': [{'x': x, 'y': y} for x,y in zip(dOffsetX, dOffsetY)],
	        'frameOffsets': frameOffset,
	        'framePixels': framePixels}

def exportFRM(frmFile, outFile, palette, exportImage=True):
	with open(frmFile, "rb") as f:
		frmInfo = readFRMInfo(f, exportImage)
		framePixels = frmInfo['framePixels']
		frameOffsets = frmInfo['frameOffsets']

		totalW = sum(sum(fo['w'] for fo in offset) for offset in frameOffsets)
		#print totalW

		maxH = max(max(fo['h'] for fo in offset) for offset in frameOffsets)
		#print maxH

		if exportImage:
			finalImg = Image.new("RGBA", (totalW, maxH))
		currentX = 0

		for nDir in range(frmInfo['numDirections']):
			for frameNum,frame in enumerate(framePixels[nDir]):
				offsets = frameOffsets[nDir][frameNum]
				w,h = offsets['w'], offsets['h']
				#print frame.shape, w, h, nDir, frameNum
				if exportImage:
					frame = np.reshape(frame, (h, w))

					pixels = np.empty((h, w, 4), dtype=int) # HxW RGBA
					for rowI,row in enumerate(frame):
						for colI,palIdx in enumerate(row):
							pixels[(rowI, colI)] = palette[palIdx] + (0 if palIdx == 0 else 255,)

					img = Image.fromarray(pixels.astype('uint8'), "RGBA")
					finalImg.paste(img, (currentX, 0))
				currentX += w

		if exportImage:
			finalImg.save(outFile)

		# build an image map
		sx = 0 # running total width offset
		for direction in frmInfo['frameOffsets']:
			ox = 0 # running total offsets
			oy = 0
			for frame in direction:
				ox += frame['x']
				oy += frame['y']
				frame['sx'] = sx
				frame['ox'] = ox
				frame['oy'] = oy
				sx += frame['w']

		del frmInfo['framePixels']
		
		return frmInfo

def flatten(l):
	return [item for sublist in l for item in sublist]

# For .FR[0-5]
def exportFRMs(frmFiles, outFile, palette, exportImage=True):
	maxH = 0

	frmInfos = []
	for frmFile in frmFiles:
		with open(frmFile, "rb") as f:
			frmInfos.append(readFRMInfo(f, exportImage))

	totalW = sum(sum(sum(fo['w'] for fo in offset) for offset in
		                info['frameOffsets']) for info in frmInfos)

	maxH = max(max(max(fo['h'] for fo in offset) for offset in info['frameOffsets']) for info in frmInfos)

	#print totalW, maxH

	_fps = frmInfos[0]['fps']
	_numFrames = frmInfos[0]['numFrames']
	_frameOffsets = flatten(frmInfo['frameOffsets'] for frmInfo in frmInfos)

	if _fps == 0:
		fpses = [x['fps'] for x in frmInfos if x['fps'] != 0]
		if len(fpses) == 0:
			_fps = 10 # default
		else:
			_fps = fpses[0]

	for frmInfo in frmInfos:
		if frmInfo['numFrames'] != _numFrames:
			raise Exception("number of frames do not match")
		elif frmInfo['fps'] != _fps and frmInfo['fps'] != 0:
			raise Exception("FPS does not match (%d vs %d)" % (_fps, frmInfo['fps']))
		elif len(frmInfo['frameOffsets']) != 1:
			raise Exception("frameOffsets is not 1 (more than one direction?)")

	if exportImage:
		finalImg = Image.new("RGBA", (totalW, maxH))
	currentX = 0
	_sx = 0 # running total width offset

	for frmInfo in frmInfos:
			framePixels = frmInfo['framePixels']
			frameOffsets = frmInfo['frameOffsets']

			for nDir in range(frmInfo['numDirections']):
				for frameNum,frame in enumerate(framePixels[nDir]):
					offsets = frameOffsets[nDir][frameNum]
					w,h = offsets['w'], offsets['h']
					#print frame.shape, w, h, nDir, frameNum
					if exportImage:
						frame = np.reshape(frame, (h, w))

						pixels = np.empty((h, w, 4), dtype=int) # HxW RGBA
						for rowI,row in enumerate(frame):
							for colI,palIdx in enumerate(row):
								pixels[(rowI, colI)] = palette[palIdx] + (0 if palIdx == 0 else 255,)

						img = Image.fromarray(pixels.astype('uint8'), "RGBA")
						finalImg.paste(img, (currentX, 0))
					currentX += w

			# build an image map
			for direction in frmInfo['frameOffsets']:
				ox = 0 # running total offsets
				oy = 0
				for frame in direction:
					ox += frame['x']
					oy += frame['y']
					frame['sx'] = _sx
					frame['ox'] = ox
					frame['oy'] = oy
					_sx += frame['w']

			del frmInfo['framePixels']

	if exportImage:
		finalImg.save(outFile)
	
	dOffsets = [[] for _ in range(6)]
	for i,frmInfo in enumerate(frmInfos):
		dOffsets[i] = frmInfo['directionOffsets'][0]

	# construct new FRM info
	return {'numFrames': _numFrames,
			'fps': _fps,
			'numDirections': len(frmFiles),
	        'directionOffsets': dOffsets,
	        'frameOffsets': _frameOffsets}

def main():
	if len(sys.argv) < 3:
		print "USAGE: %s FRM OUTFILE [PALETTE]" % sys.argv[0]
		sys.exit(1)

	if len(sys.argv) < 4:
		palFile = "data/color.pal"
	else:
		palFile = sys.argv[3]

	palette = pal.readPAL(open(palFile, "rb"))
	print json.dumps(exportFRM(sys.argv[1], sys.argv[2], palette))


if __name__ == '__main__':
	main()