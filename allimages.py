import os, glob, json

dirs = ["critters", "walls", "items", "tiles", "misc"]

images = {}
for dir in dirs:
	type_ = dir[:-1] if dir[-1] == 's' else dir
	images[type_] = []
	for file in glob.glob("art/" + dir + "/*.png"):
		name = os.path.splitext(os.path.basename(file))[0]
		fullname = "art/" + dir + "/" + name
		images[type_].append({"name": name, "fullname": fullname})

print json.dumps(images)