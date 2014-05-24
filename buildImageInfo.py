import sys, os, subprocess, glob, json, struct

DATA_PATH = "data"

def getFramesPerDir(frm):
	with open(frm, 'rb') as f:
		f.seek(8) # offset of framesPerDirection
		return struct.unpack("!H", f.read(2))[0]

def main():
	# read offset info
	obj = json.load(sys.stdin)

	for img,v in obj.iteritems():
		frm = os.path.join(DATA_PATH, img + "_*.bmp")
		bmps = glob.glob(frm)

		if len(bmps) == 0:
			continue

		v['framesPerDirection'] = getFramesPerDir(os.path.join(DATA_PATH, img + ".frm"))

		#print bmps
		frameInfo = []
		totalW = 0
		for bmp in bmps:
			line = subprocess.check_output("gm identify " + bmp)
			w,h = [int(x) for x in line.split(" ")[2].split("+")[0].split("x")]

			frameInfo.append({'x': totalW, 'w': w, 'h': h})
			totalW += w

		v['frameInfo'] = frameInfo

	print json.dumps(obj)

if __name__ == '__main__':
	main()