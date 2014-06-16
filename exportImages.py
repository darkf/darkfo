import sys, os, glob, json
import pal
import frmpixels

def main():
	if len(sys.argv) < 4:
		print "USAGE: %s PALETTE DATA_DIR OUT_DIR [--no-map] [--only-map] [--update]" % sys.argv[0]
		sys.exit(1)

	PALETTE = sys.argv[1]
	DATA_DIR = sys.argv[2]
	OUT_DIR = sys.argv[3]

	if not os.path.exists(OUT_DIR):
		os.mkdir(OUT_DIR)

	exportImage = '--only-map' not in sys.argv

	palette = pal.readPAL(open(PALETTE, "rb"))

	subdirs = ("inven", "tiles", "critters", "items", "scenery", "walls", "misc", "intrface") # etc
	imageInfo = {}

	for subdir in subdirs:
		dir = '%s/%s' % (OUT_DIR, subdir)
		if not os.path.exists(dir):
			os.mkdir(dir)

	subdirFRMs = [glob.glob("%s/art/%s/*.FRM" % (DATA_DIR, subdir)) for subdir in subdirs]
	totalNum = sum(len(x) for x in subdirFRMs)

	if '--update' in sys.argv:
		imageMap = json.load(open('%s/imageMap.json' % OUT_DIR, "r"))

	i = 1
	for subdirIdx,FRMs in enumerate(subdirFRMs):
		subdir = subdirs[subdirIdx]
		
		for FRM in FRMs:
			name = '%s/%s' % (subdir, os.path.splitext(os.path.basename(FRM))[0].lower())
			outpath = "%s/%s.png" % (OUT_DIR, name)

			if '--update' in sys.argv and os.path.exists(outpath) and ('art/'+name) in imageMap:
				# already exists, skip it
				i += 1
				continue

			print "[%d/%d/%d] %s..." % (i, len(FRMs), totalNum, name)
			imageInfo['art/'+name] = frmpixels.exportFRM(FRM, outpath, palette, exportImage)

			i += 1

	if '--no-map' not in sys.argv:
		if '--update' in sys.argv:
			# merge our changes into the existing imageMap
			imageMap.update(imageInfo)
			imageInfo = imageMap

		# write new imageMap
		json.dump(imageInfo, open('%s/imageMap.json' % OUT_DIR, "w"))


if __name__ == '__main__':
	main()