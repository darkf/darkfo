for proto in data/proto/CRITTERS/*.pro
do
	baseFile=$(basename ${proto%.*}) # strip extension
	echo $proto
	python proto.py $proto > proto/$baseFile.pro
done