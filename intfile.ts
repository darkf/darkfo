/*
Copyright 2015 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Parser for .INT files

interface Procedure {
	nameIndex: number;
	name: string;
	offset: number;
	index: number;
	argc: number;
}

interface IntFile {
	procedures: { [name: number]: Procedure };
	proceduresTable: Procedure[];
	identifiers: { [offset: number]: string };
	strings: { [offset: number]: string };
	codeOffset: number;
	name: string;
}

// parse .INT files
function parseIntFile(reader: BinaryReader, name: string=""): IntFile {
	reader.seek(0x2A) // seek to procedure table

	// read procedure table
	var numProcs = reader.read32()
	var procs: Procedure[] = []
	var procedures: { [name: number]: Procedure } = {}
	//console.log("procs: %d", numProcs)
	//console.log("")

	for(var i = 0; i < numProcs; i++) {
		var nameIndex = reader.read32()
		var flags = reader.read32()
		//console.log("name index: %d", nameIndex)
		//console.log("flags: %d", flags)
		assertEq(reader.read32(), 0, "unk0 != 0")
		assertEq(reader.read32(), 0, "unk1 != 0")
		var offset = reader.read32()
		//console.log("offset: %d", offset)
		var argc = reader.read32()
		//console.log("argc: %d", argc)
		//console.log("")

		procs.push({nameIndex: nameIndex
			       ,name: ""
			       ,offset: offset
			       ,index: i
			       ,argc: argc
			       })
	}

	// offset->identifier table
	var identEnd = reader.read32()
	var identifiers: { [offset: number]: string } = {}

	var baseOffset = reader.offset
	while(true) {
		if(reader.offset - baseOffset >= identEnd)
			break

		var len = reader.read16()
		var offset = reader.offset - baseOffset + 4
		var str = ""
		// console.log("len=%d, offset=%d", len, offset)

		for(var j = 0; j < len; j++) {
			var c = reader.read8()
			if(c)
				str += String.fromCharCode(c)
		}

		// console.log("str=%s", str)
		identifiers[offset] = str
	}

	assertEq(reader.read32(), 0xFFFFFFFF, "did not get 0xFFFFFFFF signature")

	// give procedures their names from the identifier table
	procs.forEach(proc => proc.name = identifiers[proc.nameIndex])

	// and populate the procedures table
	procs.forEach(proc => procedures[proc.name] = proc)

	// procs.forEach(proc => console.log("proc: %o", proc))

	/*console.log("")
	console.log("strings:")
	console.log("")*/

	// offset->strings table
	var stringEnd = reader.read32()
	var strings: { [offset: number]: string } = {}

	//assertEq(stringEnd, 0xFFFFFFFF, "TODO: string table")

	if(stringEnd !== 0xFFFFFFFF) {
		// read string table
		var baseOffset = reader.offset
		while(true) {
			if(reader.offset - baseOffset >= stringEnd)
				break

			var len = reader.read16()
			var offset = reader.offset - baseOffset + 4
			var str = ""
			// console.log("len=%d, offset=%d, stringEnd=%d", len, offset, stringEnd)

			for(var j = 0; j < len; j++) {
				var c = reader.read8()
				if(c)
					str += String.fromCharCode(c)
			}

			// console.log("str=%s", str)
			strings[offset] = str
		}
	}

	var codeOffset = reader.offset

	return {procedures: procedures
		   ,proceduresTable: procs
		   ,identifiers: identifiers
	       ,strings: strings
	       ,codeOffset: codeOffset
	       ,name: name}
}