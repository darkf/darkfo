baseFile=$(basename ${1%.*}) # strip extension
python fo2map.py $1
python frmOffsetTable.py $baseFile.images.txt > $baseFile.offsets.json