import sys, os, json
import frm

DATA_PATH = "data"

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s IMAGES_LIST" % sys.argv[0]
		sys.exit(1)

	images = list(open(sys.argv[1]))
	imageInfo = {}

	for image in images:
		image = image.rstrip()
		frmPath = os.path.join(DATA_PATH, image + ".FRM")
		frmInfo = frm.readFRMInfo(open(frmPath, "rb"))

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

		imageInfo[image] = frmInfo

	print json.dumps(imageInfo)

if __name__ == '__main__':
	main()