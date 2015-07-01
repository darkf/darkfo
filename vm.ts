var opMap = {0x8002: function() { } // start critical (nop)
            ,0xC001: function() { this.push(this.script.read32()) } // op_push_d
            ,0x800D: function() { this.push(this.pop() + "") } // op_d_to_a
            ,0x8004: function() { this.pc = this.pop() } // op_jmp
        	}

class ScriptVM {
	script: BinaryReader
	pc: number = 0
	dataStack: any[] = []
	retStack: number[] = []

	constructor(script: BinaryReader) {
		this.script = script
	}

	push(value: any): void {
		this.dataStack.push(value)
	}

	pop(): any {
		return this.dataStack.pop()
	}

	step(): boolean {
		// fetch op
		var pc = this.pc
		this.script.seek(pc)
		var opcode = this.script.read16()

		// dispatch based on opMap
		if(opMap[opcode] !== undefined)
			opMap[opcode].call(this)
		else {
			console.log("unimplemented opcode %s (pc=%s)", opcode.toString(16), this.pc.toString(16))
			return false
		}

		if(this.pc === pc) // PC wasn't explicitly set, let's advance it to the current file offset
			this.pc = this.script.offset
		return true
	}

	run(): void {
		while(this.step()) { }
	}
}