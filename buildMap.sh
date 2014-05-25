baseFile=$(basename ${1%.*}) # strip extension
python fo2map.py $1
python convertObjects.py $baseFile.images.txt --no-overwrite
python frmOffsetTable.py $baseFile.images.txt | python buildImageInfo.py > $baseFile.offsets.json