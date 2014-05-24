import sys, os, glob

DATA_PATH = "data"
OUT_DIR = ""

if len(sys.argv) != 2:
	print "USAGE: %s <object_list.txt>" % sys.argv[0]
	sys.exit(1)

FRM2BMP_PATH = os.path.abspath("frm2bmp.exe")

if not os.path.exists(FRM2BMP_PATH):
	print "needs frm2bmp.exe"
	sys.exit(1)

def checkdir(path):
	if not os.path.exists(path):
		os.mkdir(path)

TILE_LIST_PATH = sys.argv[1]
tiles = list(open(TILE_LIST_PATH, "r"))
dataPath = os.path.abspath(DATA_PATH)
basePath = os.path.abspath(OUT_DIR)

checkdir(basePath)
checkdir(os.path.join(basePath, "art"))
checkdir(os.path.join(basePath, "art/walls"))
checkdir(os.path.join(basePath, "art/scenery"))
checkdir(os.path.join(basePath, "art/tiles"))
checkdir(os.path.join(basePath, "art/misc"))
checkdir(os.path.join(basePath, "art/critters"))

paths = []
for tile in tiles:
	path = tile.rstrip() + ".frm"
	basename = os.path.splitext(tile.rstrip())[0]
	basedir = os.path.dirname(basename)
	#bmp = os.path.join(basePath, basename + ".bmp")

	if not os.path.exists(os.path.join(dataPath, path)):
		print "tile", path, "does not exist"
		continue

	print path
	paths.append((path, basedir))

for path,basedir in paths:
	os.chdir(os.path.join(dataPath, os.path.dirname(path)))
	os.system(FRM2BMP_PATH + " " + os.path.basename(path))
	img = os.path.splitext(os.path.basename(path))[0]
	bmps = glob.glob(img + "*.bmp")
	for bmp in bmps:
		basename = os.path.splitext(bmp)[0]
		filename = os.path.join(basedir, basename) # e.g. art/tiles/BRICK23_000.BMP
		out = os.path.abspath(os.path.join(basePath, filename + ".png"))
		os.system("gm convert -type TrueColor -transparent \"rgb(11,0,11)\" " + bmp + " " + out)
	#print os.system("python " + basePath + "/../frminfo.py " + path)
