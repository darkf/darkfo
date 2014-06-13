subdirs=("items")

for subdir in "${subdirs[@]}"
do
	for proto in data/proto/$subdir/{*.pro,*.PRO}
	do
		baseFile=$(basename ${proto%.*}) # strip extension
		echo $proto
		python proto.py $proto > proto/$subdir/$baseFile.pro.json
	done
done