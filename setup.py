"""
Copyright 2015-2017 darkf

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

# Setup script to import Fallout 2 data for DarkFO

from __future__ import print_function
import sys, os, glob, json, traceback

def error(msg):
	print("ERROR:", msg)
	raw_input("")
	sys.exit(1)

def warn(msg):
	print("WARNING:", msg)

def info(msg):
	print(msg)

# Check for numpy and pillow (required)
info("Checking for necessary Python modules...")

try: import numpy
except ImportError:
	error("NumPy not found. Please install it from http://www.numpy.org or http://www.lfd.uci.edu/~gohlke/pythonlibs/#numpy . Make sure the version matches your installed version of Python (%d.%d)." % (sys.version_info.major, sys.version_info.minor))

try: from PIL import Image
except ImportError:
	error("Pillow not found. Please see https://pillow.readthedocs.io/en/4.0.x for installation instructions. Make sure the version matches your installed version of Python (%d.%d)." % (sys.version_info.major, sys.version_info.minor))

# import local modules
import dat2
import parseCritTable
import parseElevatorTable
import exportImagesPar
import exportPRO
import fomap

# global paths/flags
SRC_DIR = None
NO_EXTRACT_DAT = False
NO_EXPORT_IMAGES = False
EXE_PATH = None

def setup_check():
	global EXE_PATH

	# Check whether everything we need to set up is included in the given source directory

	print("Checking installation directory (%s)..." % SRC_DIR)

	def install_file_exists(path):
		return os.path.exists(os.path.join(SRC_DIR, path))

	if not os.path.exists(SRC_DIR):
		error("Installation directory (%s) does not exist." % SRC_DIR)
	if not (install_file_exists("master.dat") and install_file_exists("critter.dat")):
		error("Installation directory does not contain master.dat or critter.dat, please ensure they exist.")
	if not install_file_exists("fallout2.exe"):
		warn("Installation directory does not contain fallout2.exe. Please ensure this is the right directory and the file exists. Some features may not be available without it!")
	else:
		EXE_PATH = os.path.join(SRC_DIR, "fallout2.exe")

	return True

def parse_crit_table():
	if EXE_PATH is not None:
		info("Parsing critical table from fallout2.exe...")
		try:
			with open(EXE_PATH, "rb") as fp:
				# TODO: Don't hardcode paths, and need version check!
				critTables = parseCritTable.readCriticalTables(fp, 0x000fef78, 0x00106597)
				json.dump(critTables, open("criticalTables.json", "w"))
				info("Done parsing critical table")
		except Exception:
			traceback.print_exc()
			warn("Error occurred while parsing critical table (see traceback above).")
	else:
		warn("Cannot parse critical table, missing fallout2.exe")

	return True

def parse_elevator_table():
	if EXE_PATH is not None:
		info("Parsing elevator table from fallout2.exe...")
		try:
			with open(EXE_PATH, "rb") as fp:
				elevators = parseElevatorTable.parseElevators(fp)
				json.dump(elevators, open("elevators.json", "w"))
				info("Done parsing elevator table")
		except Exception:
			traceback.print_exc()
			warn("Error occurred while parsing elevator table (see traceback above).")
	else:
		warn("Cannot parse elevator table, missing fallout2.exe")

	return True

def extract_dats():
	# Create data directory
	if not os.path.exists("data"):
		os.mkdir("data")

	def extract_dat(path):
		with open(path, "rb") as f:
			dat2.dumpFiles(f, "data")

	if not NO_EXTRACT_DAT:
		# Extract DATs
		info("Extracting master.dat...")
		extract_dat(os.path.join(SRC_DIR, "master.dat"))
		
		info("Extracting critter.dat...")
		extract_dat(os.path.join(SRC_DIR, "critter.dat"))

		info("Done extracting DAT archives.")

	return True

def export_images():
	# Export FRMs/FR[0-9]s

	try:
		palette = exportImagesPar.readPAL(os.path.join("data", "color.pal"))
	except IOError:
		error("Couldn't read data/color.pal")

	# Export them to art/, which will be created if it does not already exist.
	info("Converting images, please wait while this runs.")

	try:
		exportImagesPar.convertAll(palette, "data", "art", verbose=True)
	except Exception:
		traceback.print_exc()
		warn("Error when converting images (see traceback above). Will not finish converting images, but will continue setup.")
		return False

	return True

def export_pros():
	# Export PROs

	info("Converting prototypes (PROs), please wait while this runs.")

	exportPRO.extractPROs(os.path.join("data", "proto"), "proto")

	return True

# TODO: extract audio using convertAudio

def export_maps():
	# Export MAPs

	info("Converting map files, please wait while this runs.")

	if not os.path.exists("maps"):
		os.mkdir("maps")

	for mapFile in glob.glob(os.path.join("data", "maps", "*.map")):
		mapName = os.path.basename(mapFile).lower()
		outFile = os.path.join("maps", os.path.splitext(mapName)[0] + ".json")

		try:
			info("Converting map %s ..." % mapFile)
			fomap.exportMap("data", mapFile, outFile)
		except Exception:
			traceback.print_exc()
			warn("Error converting map %s (see traceback above). Will continue converting the rest." % mapFile)

	return True

def main():
	global SRC_DIR, NO_EXTRACT_DAT, NO_EXPORT_IMAGES

	if len(sys.argv) < 2:
		print("USAGE:", sys.argv[0], "FALLOUT2_INSTALL_DIR [--no-extract-dat] [--no-export-images]")
		return

	NO_EXTRACT_DAT = "--no-extract-dat" in sys.argv
	if NO_EXTRACT_DAT:
		sys.argv.remove("--no-extract-dat")

	NO_EXPORT_IMAGES = "--no-export-images" in sys.argv
	if NO_EXPORT_IMAGES:
		sys.argv.remove("--no-export-images")

	SRC_DIR = sys.argv[1]

	setup_check()
	parse_crit_table()
	parse_elevator_table()
	extract_dats()
	if not NO_EXPORT_IMAGES:
		export_images()
	export_pros()
	export_maps()

	info("")
	info("Setup complete. Please review the messages above, looking for any warnings.")
	info("Please run tsc after this to compile the source files.")
	raw_input("")

if __name__ == "__main__":
	main()