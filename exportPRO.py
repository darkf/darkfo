"""
Copyright 2014-2017 darkf

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

from __future__ import print_function
import os, glob, json
import proto

subdirs = ("items", "critters", "scenery", "walls", "misc")

def onError(path):
    print("Error reading", path)

def extractPROs(dataProtoPath, outDir, onError=onError, verbose=False):
    if not os.path.exists(outDir):
        os.mkdir(outDir)

    # master JSON dict
    root_map = {}

    for subdir in subdirs:
        if not os.path.exists(os.path.join(outDir, subdir)):
            os.mkdir(os.path.join(outDir, subdir))

        # export subdir as its own JSON dict
        obj = {}

        for protofile in glob.glob(os.path.join(dataProtoPath, subdir, "*.pro")):
            baseFile = os.path.basename(os.path.splitext(protofile)[0])
            id = int(baseFile)

            try:
                if verbose: print("Dumping", protofile, "...")
                with open(protofile, "rb") as fp:
                    obj[id] = proto.readPRO(fp)
            except Exception:
                onError(protofile)

        root_map[subdir] = obj

    with open(os.path.join(outDir, "pro.json"), "w") as fp:
        print("Writing master JSON map...")
        json.dump(root_map, fp)

def main():
    extractPROs(os.path.join("data", "proto"), "proto", verbose=True)

if __name__ == "__main__":
    main()
