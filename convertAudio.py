import glob, os, subprocess

def convertDir(inDir, outDir):
	for path in glob.glob(os.path.join(inDir, "*.ACM")):
		basename = os.path.splitext(os.path.basename(path))[0]
		result = basename.lower() + ".wav" # output path of acm2wav
		outpath = os.path.join(outDir, result)

		print(path)
		#print(basename)

		# convert to wav
		#os.system("acm2wav %s" % path)
		subprocess.call(["acm2wav", path], stdout=subprocess.PIPE)

		if not os.path.exists(result):
			print("result file (%s) not found!" % result)
			#break
		elif not os.path.exists(outpath):
			os.rename(result, outpath)

def main():
	if not os.path.exists("acm2wav.exe"):
		print("need acm2wav.exe")
		return
	if not os.path.exists("SFX"):
		print("need SFX/")
		return

	if not os.path.exists("audio"):
		os.mkdir("audio")

	if not os.path.exists("audio/sfx"):
		os.mkdir("audio/sfx")

	if not os.path.exists("audio/music"):
		os.mkdir("audio/music")

	convertDir("SFX", "audio/sfx")
	convertDir("sound/music", "audio/music")

	print("done!")

if __name__ == '__main__': main()