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

import Image

def main():
	# 20 tiles, 7x6 squares each
	# each tile is 350x300
	# 4 tiles horizontally, 5 vertically

	img = Image.new("RGBA", (350*4, 300*5))

	for i in range(0, 20):
		print i
		tilePath = "art/intrface/wrldmp%s.png" % str(i).zfill(2)
		tile = Image.open(tilePath)

		x = i % 4
		y = i / 4

		img.paste(tile, (x*350, y*300))

	img.save("worldmap.png")


if __name__ == '__main__':
	main()