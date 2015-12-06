"""
Copyright 2014 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

# Converts and dumps data/proto/*.PRO files into proto/*.json

import os, glob, json
import proto

subdirs = ("items", "critters", "scenery", "walls", "misc")

def onError(path):
	print "error reading", path

def extractPROs(dataProtoPath, outDir, onError=onError, verbose=False):
	if not os.path.exists(outDir):
		os.mkdir(outDir)

	for subdir in subdirs:
		if not os.path.exists(os.path.join(outDir, subdir)):
			os.mkdir(os.path.join(outDir, subdir))

		for protofile in glob.glob(os.path.join(dataProtoPath, subdir, "*.pro")):
			baseFile = os.path.basename(os.path.splitext(protofile)[0])

			try:
				pro = proto.readPRO(open(protofile, "rb"))
				json.dump(pro, open(os.path.join(outDir, subdir, baseFile + ".pro.json"), "w"))
				if verbose: print "dumping:", protofile
			except Exception:
				onError(protofile)

def main():
	extractPROs(os.path.join("data", "proto"), "proto", verbose=True)

if __name__ == "__main__":
	main()
