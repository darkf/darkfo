import os, glob, json
import proto

subdirs = ("items", "critters")

for subdir in subdirs:
	if not os.path.exists("proto/" + subdir):
		os.mkdir("proto/" + subdir)

	for protofile in glob.glob("data/proto/" + subdir + "/*.pro"):
		baseFile = os.path.basename(os.path.splitext(protofile)[0])

		try:
			pro = proto.readPRO(open(protofile, "rb"))
			json.dump(pro, open("proto/" + subdir + "/" + baseFile + ".pro.json", "w"))
		except Exception:
			print "error reading", protofile

		#python proto.py $proto > proto/$subdir/$baseFile.pro.json
