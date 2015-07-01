var opMap = {0x8002: function() { } // start critical (nop)
            ,0xC001: function() { this.push(this.script.read32()) } // op_push_d
            ,0x800D: function() { this.retStack.push(this.pop()) } // op_d_to_a
            ,0x800C: function() { this.push(this.retStack.pop()) } // op_a_to_d
            ,0x8004: function() { this.pc = this.pop() } // op_jmp
            ,0x8003: function() { } // op_critical_done (nop)
            ,0x802B: function() {
            		var argc = this.pop()
            		this.retStack.push(this.dvarBase)
            		this.dvarBase = this.dataStack.length - argc
            		console.log("op_push_base (argc %d)", argc)
            	} // op_push_base
            ,0x8019: function() { // op_swapa
	            	var a = this.retStack.pop()
	            	var b = this.retStack.pop()
	            	this.retStack.push(a)
	            	this.retStack.push(b)
            	}
            ,0x802A: function() { this.dataStack.splice(0, this.dvarBase) } // op_pop_to_base
            ,0x802C: function() { this.svarBase = this.dataStack.length } // op_set_global 
            ,0x8029: function() { this.dvarBase = this.retStack.pop() } // op_pop_base
            ,0x801C: function() { this.pc = this.retStack.pop() } // op_pop_return
            ,0x8010: function() { this.halted = true; console.log("op_exit_prog") } // op_exit_prog
        	}

class ScriptVM {
	script: BinaryReader
	pc: number = 0
	dataStack: any[] = []
	retStack: number[] = []
	svarBase: number
	dvarBase: number
	halted: boolean = false

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
		if(this.halted)
			return false

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