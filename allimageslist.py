import os, glob

dirs = ["critters", "walls", "items", "tiles", "misc"]

for dir in dirs:
	suffix = "AA" if dir == "critters" else "" # only tag main *AA critters
	for file in glob.glob("data/art/" + dir + "/*%s.FRM" % suffix):
		name = os.path.splitext(os.path.basename(file))[0]
		fullname = "art/" + dir + "/" + name
		print fullname
