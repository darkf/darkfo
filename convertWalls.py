import sys, os

DATA_PATH = "../data/art/walls/"

if len(sys.argv) != 2:
	print "USAGE: %s <tile_list.txt>" % sys.argv[0]
	sys.exit(1)

FRM2BMP_PATH = os.path.abspath("frm2bmp.exe")

if not os.path.exists(FRM2BMP_PATH):
	print "needs frm2bmp.exe"
	sys.exit(1)

if not os.path.exists("walls"):
	os.mkdir("walls")

TILE_LIST_PATH = sys.argv[1]
tiles = list(open(TILE_LIST_PATH, "r"))
basePath = os.path.abspath("")

paths = []
for tile in tiles:
	path = tile.rstrip() + ".frm"
	basename = os.path.splitext(tile.rstrip())[0]
	bmp = basename + ".bmp"
	out = os.path.abspath(os.path.join("walls", basename + ".png"))

	if not os.path.exists(os.path.join(DATA_PATH, path)):
		print "tile", path, "does not exist"
		continue

	print path, out
	paths.append((path, bmp, out))

os.chdir(DATA_PATH)
for path,bmp,out in paths:
	os.system(FRM2BMP_PATH + " " + path)
	# \"#0b000b\"
	os.system("gm convert -type TrueColor -transparent \"rgb(11,0,11)\" " + bmp + " " + out)
	print os.system("python " + basePath + "/../frminfo.py " + path)
