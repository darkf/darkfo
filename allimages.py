import os, glob, json

dirs = ["critters", "walls", "items", "tiles", "misc"]

images = {}
for dir in dirs:
	group = dir[:-1] if dir[-1] == 's' else dir
	images[group] = []
	suffix = "AA" if group == "critter" else "" # only tag main *AA critters
	for file in glob.glob("art/" + dir + "/*%s.png" % suffix):
		name = os.path.splitext(os.path.basename(file))[0]
		fullname = "art/" + dir + "/" + name
		images[group].append({"name": name, "fullname": fullname})

print json.dumps(images)