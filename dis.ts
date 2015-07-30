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

// Disassembler for .INT files

// Map of opcode -> function that returns a list of arguments
// If not present, it is assumed that the opcode is nullary
var opArgs = {0xC001: function(reader) { return [reader.read32()] } // op_push_d
             ,0x9001: function(reader) { return [reader.read32()]} // 9001 op_push_d
             }

var opNames = {0x8004: "op_jmp"
              ,0x8005: "op_call"
              ,0x800C: "op_a_to_d"
              ,0x800D: "op_d_to_a"
              ,0x8010: "op_exit_prog"
              ,0x8012: "value"
              ,0x8013: "op_store_global"
              ,0x8015: "op_store_external"
              ,0x8016: "op_export_var"
              ,0x8018: "op_swap"
              ,0x8019: "op_swapa"
              ,0x801A: "op_pop"
              ,0x801C: "op_pop_return"
              ,0x8029: "op_pop_base"
              ,0x802A: "op_pop_to_base"
              ,0x802B: "op_push_base"
              ,0x802C: "op_set_global"
              ,0x802F: "op_if"
              ,0x8030: "op_while"
              ,0x8031: "op_store"
              ,0x8032: "op_fetch"
              ,0x8039: "op_add"
              ,0x803A: "op_sub"
              ,0x803B: "op_mul"
              ,0x803C: "op_div"
              ,0x803D: "op_mod"
              ,0x803E: "op_and"
              ,0x8040: "op_bwand"
              ,0x8041: "op_bwor"
              ,0x8042: "op_bwxor"
              ,0x8043: "op_bwnot"
              ,0x8044: "op_floor"
              ,0x8045: "op_not"
              ,0x8046: "op_negate"
              ,0x80AF: "is_success"
              ,0x80B0: "is_critical"
              ,0x80B8: "display_msg"
              ,0x80C1: "lvar"
              ,0x80C2: "set_local_var"
              ,0x80C7: "script_action"
              ,0x80D5: "tile_num_in_direction"
              ,0x80DE: "start_gdialog"
              ,0x80E1: "metarule3"
              ,0x80E9: "set_light_level"
              ,0x80EA: "gameTime"
              ,0x80F6: "game_time_hour"
              ,0x80FF: "critter_attempt_placement"
              ,0x8102: "critter_add_trait"
              ,0x810B: "metarule"
              ,0x810C: "anim"
              ,0x8115: "playMovie"
              ,0x8118: "get_month"
              ,0x8119: "get_day"
              ,0x8127: "critter_injure"
              ,0x814B: "party_member_obj"
              ,0x8154: "debug"
              ,0x9001: "push_d"
              ,0xA001: "push_d"
              ,0xC001: "push_d"
              ,0x8002: "op_critical_start"

              ,0x80CA: "get_critter_stat"
              ,0x80C5: "global_var"
              ,0x80C6: "set_global_var"
              ,0x80BC: "self_obj"
              ,0x806B: "display"

              // logic ops
              ,0x8033: "op_eq"
              ,0x8034: "op_neq"
              ,0x8035: "op_lte"
              ,0x8036: "op_gte"
              ,0x8037: "op_lt"
              ,0x8038: "op_gt"
}

function disassemble(intfile: IntFile, reader: BinaryReader): string {
	var str = ""
	function emit(msg: string, t: number=0) {
		for(var i = 0; i < t; i++)
			str += " "
		str += msg + "\n"
	}
	function emitOp(opcode: number, offset: number, args: any[], t: number=0) {
		var sargs = args.map(x => "0x" + x.toString(16))
		var p = ""
		if(opcode === 0x9001)
			p = ` ("${intfile.strings[args[0]]}" | ${intfile.identifiers[args[0]]})`
		emit(`0x${offset.toString(16)}: ${opcode.toString(16)} ${opNames[opcode]} ${sargs}` + p, t)
	}

	function disasm(t: number=0): number {
		var offset = reader.offset
		var opcode = reader.read16()
		var args = opArgs[opcode] ? opArgs[opcode](reader) : []
		emitOp(opcode, offset, args, t)
		return opcode
	}

	reader.seek(0)

	// disassemble __start (the code at 00x0-0x2A)
	emit("__start:")
	for(; reader.offset < 0x2A;)
		disasm(2)
	emit("")

	var procOffsets = {}
	for(var procName in intfile.procedures) {
		var proc = intfile.procedures[procName]
		procOffsets[proc.offset] = procName
	}

	// disassemble the rest of the code, marking procedures
	reader.seek(intfile.codeOffset)
	var t = 0
	for(; reader.offset < reader.data.byteLength;) {
		if(procOffsets[reader.offset] !== undefined) {
			emit("")
			emit(procOffsets[reader.offset] + ":")
			t = 2
		}

		disasm(t)
	}

	return str
}