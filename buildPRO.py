import os, glob, json
import proto

subdirs = ("items", "critters","scenery", "walls")

if not os.path.exists("proto"):
	os.mkdir("proto")

for subdir in subdirs:
	if not os.path.exists("proto/" + subdir):
		os.mkdir("proto/" + subdir)

	for protofile in glob.glob("data/proto/" + subdir + "/*.pro"):
		baseFile = os.path.basename(os.path.splitext(protofile)[0])

		try:
			pro = proto.readPRO(open(protofile, "rb"))
			json.dump(pro, open("proto/" + subdir + "/" + baseFile + ".pro.json", "w"))
			print "dumping: ", protofile
		except Exception:
			print "error reading", protofile
