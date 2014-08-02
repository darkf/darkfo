from multiprocessing import Pool
import os, glob
import fo2map

N_PROCS = 2

def convert(mapFile):
	with open(mapFile, "rb") as f:
		try:
			mapName = os.path.basename(mapFile).lower()
			#print "converting %s (%s)..." % (mapName, mapFile)
			fo2map.convertMap(f.read(), mapName, outDir="maps", verbose=False)
		except Exception as e:
			print "couldn't convert %s: %s" % (mapFile, str(e))

if __name__ == '__main__':
	if not os.path.exists("maps"):
		os.mkdir("maps")

	Pool(N_PROCS).map(convert, glob.glob("data/maps/*.MAP"))