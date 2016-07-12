from __future__ import print_function
from multiprocessing import Pool
import os, glob
import fomap

N_PROCS = 2

def convert(mapFile):
	try:
		mapName = os.path.splitext(os.path.basename(mapFile).lower())[0]
		print("converting %s (%s)..." % (mapName, mapFile))
		fomap.exportMap("data", mapFile, outFile="maps2/" + mapName + ".json", verbose=False)
	except Exception as e:
		print("couldn't convert %s: %s" % (mapFile, str(e)))

if __name__ == '__main__':
	if not os.path.exists("maps"):
		os.mkdir("maps")

	Pool(N_PROCS).map(convert, glob.glob("data/maps/*.MAP"))