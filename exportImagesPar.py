"""
Copyright 2014-2015 darkf

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

# Converts data/art/*/*.FRM and *.FR[0-5] images to .png images

import sys, os, glob, json, time, multiprocessing
import pal
import frmpixels

N_PROCS = 2
CHUNKSIZE = 4
SUBDIRS = ("inven", "tiles", "critters", "items", "scenery", "walls", "misc", "intrface") # etc

def convertFRM(task):
	(name, FRM, outpath, palette, exportImage) = task
	return ('art/'+name, frmpixels.exportFRM(FRM, outpath, palette, exportImage))

def convertFRX(task):
	(name, images, outpath, palette, exportImage) = task
	return ('art/'+name, frmpixels.exportFRMs(images, outpath, palette, exportImage))

def getFRMTasks(palette, dataDir, outDir, exportImage=True):
	subdirFRMs = [glob.glob("%s/art/%s/*.frm" % (dataDir, subdir)) for subdir in SUBDIRS]
	#totalNum = sum(len(x) for x in subdirFRMs)
	
	for subdirIdx,FRMs in enumerate(subdirFRMs):
		subdir = SUBDIRS[subdirIdx]
		
		for FRM in FRMs:
			name = '%s/%s' % (subdir, os.path.splitext(os.path.basename(FRM))[0].lower())
			outpath = "%s/%s.png" % (outDir, name)

			yield (name, FRM, outpath, palette, exportImage)

def getFRXTasks(palette, dataDir, outDir, exportImage=True):
	subdirFRMs = [glob.glob("%s/art/%s/*.fr0" % (dataDir, subdir)) for subdir in SUBDIRS]
	#totalNum = sum(len(x) for x in subdirFRMs)

	for subdirIdx,FRMs in enumerate(subdirFRMs):
		subdir = SUBDIRS[subdirIdx]
		
		for FRM in FRMs:
			basename = os.path.splitext(os.path.basename(FRM))[0].lower()
			images = glob.glob("%s/art/%s/%s.fr[0-5]" % (dataDir, subdir, basename))
			#print "images:", images
			# TODO: validate that images are ordered FR0 to FRn

			name = '%s/%s' % (subdir, basename)
			outpath = "%s/%s.png" % (outDir, name)

			yield (name, images, outpath, palette, exportImage)

def flatten(l):
	return [item for sublist in l for item in sublist]

def readPAL(path):
	palette = pal.readPAL(open(path, "rb"))
	palette = flatten([r, g, b] for r, g, b in palette)
	return palette

def convertAll(palette, dataDir, outDir, mode='both', imageMapMode='yes', nProcs=N_PROCS, verbose=False):
	# Convert FRMs and FR[0-9]s, and output an image map

	start_time = time.clock()

	if not os.path.exists(outDir):
		os.mkdir(outDir)

	exportImage = imageMapMode != 'only'

	imageInfo = {}

	for subdir in SUBDIRS:
		dir = os.path.join(outDir, subdir)
		if not os.path.exists(dir):
			os.mkdir(dir)

	pool = multiprocessing.Pool(processes=nProcs)

	if mode == 'frx' or mode == 'both':
		if verbose: print "scanning directories for FR[0-5]s..."
		tasks = list(getFRXTasks(palette, dataDir, outDir, exportImage))
		numTasks = len(tasks)
		i = 1
		
		if verbose: print "processing %d FR[0-5]s..." % numTasks
		for (k,v) in pool.imap(convertFRX, tasks, chunksize=CHUNKSIZE):
			if verbose: print "[%d/%d] %s..." % (i, numTasks, k)
			imageInfo[k] = v
			i += 1

	if mode == 'frm' or mode == 'both':
		if verbose:
			print ""
			print "scanning directories for FRMs..."
		tasks = list(getFRMTasks(palette, dataDir, outDir, exportImage))
		numTasks = len(tasks)
		i = 1

		if verbose: print "processing FRMs..."
		for (k,v) in pool.imap(convertFRM, tasks, chunksize=CHUNKSIZE):
			if verbose: print "[%d/%d] %s..." % (i, numTasks, k)
			imageInfo[k] = v
			i += 1

	if imageMapMode != 'no':
		if verbose: print "writing image map..."
		
		# write new imageMap
		json.dump(imageInfo, open(outDir + "/imageMap.json", "w"))

	return time.clock() - start_time

def main():
	if len(sys.argv) < 5:
		print "USAGE: %s PALETTE DATA_DIR OUT_DIR MODE [--no-map] [--only-map]" % sys.argv[0]
		print "MODE is either 'frm' for .FRMs only, 'frx' for .FR[0-5]s only, or 'both' for both."
		print "PALETTE is likely data/color.pal, and DATA_DIR is likely data/"
		print "OUT_DIR is wherever you want the exported images and map to go"
		sys.exit(1)

	palettePath = sys.argv[1]
	dataDir = sys.argv[2]
	outDir = sys.argv[3]
	mode = sys.argv[4]

	palette = readPAL(palettePath)

	imageMapMode = 'yes'
	if '--no-map' in sys.argv:
		imageMapMode = 'no'
	if '--only-map' in sys.argv:
		imageMapMode = 'only'

	elapsedTime = convertAll(palette, dataDir, outDir, mode, imageMapMode, verbose=True)
	print "Took %r seconds" % elapsedTime


if __name__ == '__main__':
	main()
