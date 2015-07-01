interface Procedure {
	nameIndex: number;
	name: string;
	offset: number;
	argc: number;
}

// parse .INT files
function parseIntFile(reader: BinaryReader) {
	reader.seek(0x2A) // seek to procedure table

	// read procedure table
	var numProcs = reader.read32()
	var procs: Procedure[] = []
	console.log("procs: %d", numProcs)
	console.log("")

	for(var i = 0; i < numProcs; i++) {
		var nameIndex = reader.read32()
		var flags = reader.read32()
		console.log("name index: %d", nameIndex)
		console.log("flags: %d", flags)
		assertEq(reader.read32(), 0, "unk0 != 0")
		assertEq(reader.read32(), 0, "unk1 != 0")
		var offset = reader.read32()
		console.log("offset: %d", offset)
		var argc = reader.read32()
		console.log("argc: %d", argc)
		console.log("")

		procs.push({nameIndex: nameIndex
			       ,name: ""
			       ,offset: offset
			       ,argc: argc
			       })
	}

	// offset->identifier table
	var numIdents = reader.read32()
	var identifiers = {}

	var baseOffset = reader.offset
	while(true) {
		if(reader.offset - baseOffset >= numIdents)
			break

		var len = reader.read16()
		var offset = reader.offset - baseOffset + 4
		var str = ""
		console.log("len=%d", len)
		console.log("offset=%s", offset)

		for(var j = 0; j < len; j++)
			str += String.fromCharCode(reader.read8())

		console.log("str=%s", str)
		identifiers[offset] = str
	}

	assertEq(reader.read32(), 0xFFFFFFFF, "did not get 0xFFFFFFFF signature")

	// give procedures their names from the identifier table
	procs.forEach(proc => proc.name = identifiers[proc.nameIndex])

	procs.forEach(proc => console.log("proc: %o", proc))
}