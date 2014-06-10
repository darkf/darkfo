baseDir=$(dirname $1)
baseFile=$(basename ${1%.*}) # strip extension
python fo2map.py $1
python convertObjects.py $baseDir/$baseFile.images.txt --no-overwrite
#python frmOffsetTable.py $baseDir/$baseFile.images.txt | python buildImageInfo.py > $baseDir/$baseFile.offsets.json
python buildOffsetMap.py $baseDir/$baseFile.images.txt > $baseDir/$baseFile.offsets.play.json