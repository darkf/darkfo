import sys, os, struct

def readPAL(f):
	palette = [None]*256

	for i in range(256):
		r,g,b = ord(f.read(1)), ord(f.read(1)), ord(f.read(1))

		if r <= 63: r *= 4
		if g <= 63: g *= 4
		if b <= 63: b *= 4

		palette[i] = (r, g, b)

	return palette

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s PAL" % sys.argv[0]
		sys.exit(1)

	with open(sys.argv[1], "rb") as f:
		print readPAL(f)

if __name__ == '__main__':
	main()