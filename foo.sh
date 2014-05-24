gm identify $1_*.bmp | sed -r 's/.+BMP ([0-9]+)x([0-9]+).+/\1x\2/' |
  python foo.py