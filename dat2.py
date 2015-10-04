"""
Copyright 2015 darkf

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

from __future__ import print_function
import sys, os, struct, zlib, collections

# Fallout 2 .DAT (DAT2) file reader

SEEK_END = 2

File = collections.namedtuple('File', 'filename compressed unpackedSize packedSize offset')

def read16(f):
	return struct.unpack("<h", f.read(2))[0]

def read32(f):
	return struct.unpack("<l", f.read(4))[0]

def read16At(buf, idx):
	return struct.unpack('<h', buf[idx:idx + 2])[0]

def read32At(buf, idx):
	return struct.unpack('<l', buf[idx:idx + 4])[0]

def readDAT(f, keepFilenameCase=False):
	# read the size of the dir tree and data block
	f.seek(-8, SEEK_END)

	dirTreeSize = read32(f) # size of (numFiles + dir tree)
	archiveSize = read32(f)
	dataBlockSize = archiveSize - dirTreeSize - 4*2

	#print "dir tree size: %d (%d KiB)" % (dirTreeSize, dirTreeSize / 1024)
	#print "archive size: %d (%d MiB)" % (archiveSize, archiveSize / 1024 / 1024)
	#print "data block size: %d (%d MiB)" % (dataBlockSize, dataBlockSize / 1024 / 1024)

	# read number of files
	f.seek(dataBlockSize)
	numFiles = read32(f)

	#print "numFiles:", numFiles

	# read directory tree
	dirTree = collections.OrderedDict()

	for _ in range(numFiles):
		filenameSize = read32(f)
		filename = f.read(filenameSize).decode('ascii')
		compressed = bool(ord(f.read(1)))
		unpackedSize = read32(f)
		packedSize = read32(f)
		offset = read32(f)
		#ratio = float(packedSize) / unpackedSize

		if not keepFilenameCase:
			filename = filename.lower()

		dirTree[filename] = File(filename, compressed, unpackedSize, packedSize, offset)

		#print "filename: %s | offset: %d | compressed: %r | packed size: %d | unpacked size: %d (ratio: %.1f)" %
		# (filename, offset, compressed, packedSize, unpackedSize, ratio)

	return dirTree

def readFile(f, fileEntry, checkSize=True):
	"Read the contents of a file given a file object and a file entry"

	f.seek(fileEntry.offset)
	data = f.read(fileEntry.packedSize)

	if fileEntry.compressed:
		data = zlib.decompress(data, 15, fileEntry.unpackedSize)

		if len(data) != fileEntry.unpackedSize:
			raise ValueError("The size of the uncompressed data does not matched the reported unpacked size")

	return data

def mkdirs(path):
	dir = ""
	for component in path.split("\\"):
		dir += component + "/"

		if not os.path.exists(dir):
			os.mkdir(dir)

def dumpFiles(f, outDir):
	dirTree = readDAT(f)
	numFiles = len(dirTree)
	i = 1

	for filename, fileEntry in dirTree.iteritems():
		outPath = os.path.join(outDir, filename).replace("\\", "/")
		mkdirs(outDir + "\\" + os.path.dirname(filename))

		print("[%d/%d] dumping %s..." % (i, numFiles, filename))
		with open(outPath, "wb") as fp:
			try:
				fp.write(readFile(f, fileEntry))
			except Exception as e:
				print("ERROR:", str(e))

		i += 1

	print("done")

def main():
	if len(sys.argv) < 3:
		print("USAGE:", sys.argv[0], "DAT_FILE OUT_DIR")
		return

	outDir = sys.argv[2]

	with open(sys.argv[1], "rb") as f:
		dumpFiles(f, outDir)

if __name__ == "__main__":
	main()
