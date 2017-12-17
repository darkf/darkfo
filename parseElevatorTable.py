"""
Copyright 2014-2015 darkf

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

# Parser for the elevator tables from the English Fallout 2 v1.02d .exe file

import sys, os, struct, json

NUM_ELEVATORS = 24 # there are 24 total elevators
NUM_BUTTONS = 4 # max number of buttons

# for Fallout 2 English v1.02d
GRPH_ID = 0x0002ED50 # General image stuff
INTOTAL = 0x0002ED5C # Specific image stuff for each type
BTNCOUNT = 0x0002EE1C # Number of buttons for each type
INFO = 0x0002EE7C # Information like coordinates for each type

def read32(f):
	return struct.unpack("<l", f.read(4))[0]

def parseElevators(f, verbose=False):
	out = {}

	# generic images
	f.seek(GRPH_ID)
	out['buttonUp'] = read32(f)
	out['buttonDown'] = read32(f)
	out['positioner'] = read32(f)

	elevators = [{} for _ in range(NUM_ELEVATORS)]
	out['elevators'] = elevators

	# types/labels
	f.seek(INTOTAL)
	for i in range(NUM_ELEVATORS):
		elevators[i]['type'] = read32(f)
		elevators[i]['labels'] = read32(f)

	# button counts
	f.seek(BTNCOUNT)
	for i in range(NUM_ELEVATORS):
		elevators[i]['buttonCount'] = read32(f)

	# coordinates etc
	f.seek(INFO)
	for i in range(NUM_ELEVATORS):
		btnCount = elevators[i]['buttonCount']
		elevators[i]['buttons'] = [{} for _ in range(btnCount)]
		for btn in range(NUM_BUTTONS):
			if btn > btnCount-1:
				# ignore unused buttons
				read32(f); read32(f); read32(f)
			else:
				elevators[i]['buttons'][btn]['mapID'] = read32(f)
				elevators[i]['buttons'][btn]['level'] = read32(f)
				elevators[i]['buttons'][btn]['tileNum'] = read32(f)

	if verbose:
		for i in range(NUM_ELEVATORS):
			print "elevator", i
			print "  type:", elevators[i]['type']
			if elevators[i]['labels'] != -1:
				print "  labels:", elevators[i]['labels']
			print "  num buttons:", elevators[i]['buttonCount']

			print "  buttons:"
			for btn in elevators[i]['buttons']:
				print "    -> map %d, level %d, tile %d" % (btn['mapID'], btn['level'], btn['tileNum'])

	return out

def main():
	if len(sys.argv) < 2:
		print "USAGE: %s fallout2.exe" % sys.argv[0]
		sys.exit(1)

	with open(sys.argv[1], "rb") as f:
		elevators = parseElevators(f, verbose=True)
		with open("lut/elevators.json", "w") as g:
			json.dump(elevators, g)

	print "done"
		
if __name__ == '__main__':
	main()