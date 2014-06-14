import sys, os, glob, json
import pal
import frmpixels

def main():
	if len(sys.argv) != 4:
		print "USAGE: %s PALETTE DATA_DIR OUT_DIR" % sys.argv[0]
		sys.exit(1)

	PALETTE = sys.argv[1]
	DATA_DIR = sys.argv[2]
	OUT_DIR = sys.argv[3]

	if not os.path.exists(OUT_DIR):
		os.mkdir(OUT_DIR)

	palette = pal.readPAL(open(PALETTE, "rb"))

	subdirs = ("inven", "tiles", "critters", "items", "scenery", "walls", "misc") # etc
	imageInfo = {}

	for subdir in subdirs:
		dir = '%s/%s' % (OUT_DIR, subdir)
		if not os.path.exists(dir):
			os.mkdir(dir)

	subdirFRMs = [glob.glob("%s/art/%s/*.FRM" % (DATA_DIR, subdir)) for subdir in subdirs]
	totalNum = sum(len(x) for x in subdirFRMs)

	i = 1
	for subdirIdx,FRMs in enumerate(subdirFRMs):
		subdir = subdirs[subdirIdx]
		
		for FRM in FRMs:
			name = '%s/%s' % (subdir, os.path.splitext(os.path.basename(FRM))[0])
			outpath = "%s/%s.png" % (OUT_DIR, name.lower())

			print "[%d/%d] %s..." % (i, totalNum, name)
			imageInfo['art/'+name] = frmpixels.exportFRM(FRM, outpath, palette)

			i += 1

	json.dump(imageInfo, open('%s/imageMap.json' % OUT_DIR, "wb"))


if __name__ == '__main__':
	main()