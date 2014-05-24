import sys, json

totalW = 0

frames = []

for i,line in enumerate(sys.stdin):
	line = line.rstrip()

	w,h = [int(x) for x in line.split("x")]

	#print "frame %d: %d" % (i, totalW)

	frames.append({'x': totalW, 'w': w, 'h': h})

	totalW += w

print json.dumps(frames)