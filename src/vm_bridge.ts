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

// Bridge between Scripting API and the Scripting VM

module ScriptVMBridge {
	// create a bridged function that calls procedures on scriptObj
	function bridged(procName: string, argc: number, pushResult: boolean=true) {
		return function(this: GameScriptVM) {
			var args = []
			for(var i = 0; i < argc; i++)
				args.push(this.pop())
			args.reverse()

			var r = this.scriptObj[procName].apply(this.scriptObj, args)
            if(pushResult)
                this.push(r)
		}
	}

    function varName(this: ScriptVM, value: any): string {
        if(typeof value === "number")
            return this.intfile.identifiers[value]
        return value
    }

	var bridgeOpMap: { [opcode: number]: (this: GameScriptVM) => void } = {
	    0x80BF: function() { this.push(player) } // dude_obj
	   ,0x80BC: function() { this.push(this.scriptObj.self_obj) } // self_obj
       ,0x8128: function() { this.push(this.scriptObj.combat_is_initialized) } // combat_is_initialized
       ,0x8118: function() { this.push(1) } // get_month // TODO
       ,0x80F6: function() { this.push(1200) } // game_time_hour // TODO
       ,0x80EA: function() { this.push(this.scriptObj.game_time) } // game_time
       ,0x8119: function() { this.push(0) } // get_day // TODO
       ,0x8101: function() { this.push(this.scriptObj.cur_map_index) } // cur_map_index
       ,0x80BD: function() { this.push(this.scriptObj.source_obj) } // source_obj
       ,0x80FA: function() { this.push(this.scriptObj.action_being_used) } // action_being_used
       ,0x80BE: function() { this.push(this.scriptObj.target_obj) } // target_obj
       ,0x80F7: function() { this.push(this.scriptObj.fixed_param) } // fixed_param

       ,0x8016: function() { this.mapScript()[this.pop()] = 0 } // op_export_var
       ,0x8015: function() { var name = varName.call(this, this.pop()); this.mapScript()[name] = this.pop() } // op_store_external
       ,0x8014: function() { this.push(this.mapScript()[varName.call(this, this.pop())]) } // op_fetch_external

       ,0x80B9: bridged("script_overrides", 0, false)
       ,0x80B4: bridged("random", 2)
       ,0x80E1: bridged("metarule3", 4)
       ,0x80CA: bridged("get_critter_stat", 2)
       ,0x8105: bridged("message_str", 2)
       ,0x80B8: bridged("display_msg", 1, false)
       ,0x810E: bridged("reg_anim_func", 2, false)
       ,0x8126: bridged("reg_anim_animate_forever", 2, false)
       ,0x810F: bridged("reg_anim_animate", 3, false)
       ,0x810C: bridged("anim", 3, false)
       ,0x80E7: bridged("anim_busy", 1)
       ,0x810B: bridged("metarule", 2)
       ,0x80C1: bridged("local_var", 1)
       ,0x80C2: bridged("set_local_var", 2, false)
       ,0x80C5: bridged("global_var", 1)
       ,0x80C6: bridged("set_global_var", 2, false)
       ,0x80C3: bridged("map_var", 1)
       ,0x80C4: bridged("set_map_var", 2, false)
       ,0x80B2: bridged("mark_area_known", 3, false)
       ,0x80E5: bridged("wm_area_set_pos", 3, false)
       ,0x80B7: bridged("create_object_sid", 4)
       ,0x8102: bridged("critter_add_trait", 4)
       ,0x8106: bridged("critter_inven_obj", 2)
       ,0x80FF: bridged("critter_attempt_placement", 3)
       ,0x8127: bridged("critter_injure", 2, false)
       ,0x80E8: bridged("critter_heal", 2, false)
       ,0x8151: bridged("critter_is_fleeing", 1)
       ,0x8152: bridged("critter_set_flee_state", 2, false) // void?
       ,0x80DA: bridged("wield_obj_critter", 2, false)
       ,0x8116: bridged("add_mult_objs_to_inven", 3, false)
       ,0x8117: bridged("rm_mult_objs_from_inven", 3)
       ,0x80D8: bridged("add_obj_to_inven", 2, false)
       ,0x80DC: bridged("obj_can_see_obj", 2)
       ,0x80E9: bridged("set_light_level", 1)
       ,0x80BB: bridged("tile_contains_obj_pid", 3)
       ,0x80D3: bridged("tile_distance_objs", 2)
       ,0x80D2: bridged("tile_distance", 2)
       ,0x80A7: bridged("tile_contains_pid_obj", 3)
       ,0x814C: bridged("rotation_to_tile", 2)
       ,0x80AE: bridged("do_check", 3)
       ,0x814a: bridged("art_anim", 1)
       ,0x80F4: bridged("destroy_object", 1, false)
       ,0x80A9: bridged("override_map_start", 4, false)
       ,0x8154: bridged("debug_msg", 1, false)
       ,0x80F3: bridged("has_trait", 3)
       ,0x80C9: bridged("obj_item_subtype", 1)
       ,0x80BA: bridged("obj_is_carrying_obj_pid", 2)
       ,0x810D: bridged("obj_carrying_pid_obj", 2)
       ,0x80B6: bridged("move_to", 3)
       ,0x8147: bridged("move_obj_inven_to_obj", 2, false)
       ,0x8100: bridged("obj_pid", 1)
       ,0x80A4: bridged("obj_name", 1)
       ,0x8149: bridged("obj_art_fid", 1)
       ,0x8150: bridged("obj_on_screen", 1)
       ,0x80f5: bridged("obj_can_hear_obj", 2)
       ,0x80E3: bridged("set_obj_visibility", 2, false)
       ,0x8130: bridged("obj_is_open", 1)
       ,0x80C8: bridged("obj_type", 1)
       ,0x8131: bridged("obj_open", 1, false)
       ,0x8132: bridged("obj_close", 1, false)
       ,0x812E: bridged("obj_lock", 1, false)
       ,0x812F: bridged("obj_unlock", 1, false)
       ,0x812D: bridged("obj_is_locked", 1)
       ,0x80AC: bridged("roll_vs_skill", 3)
       ,0x80AF: bridged("is_success", 1)
       ,0x80B0: bridged("is_critical", 1)
       ,0x80AA: bridged("has_skill", 2)
       ,0x80AB: bridged("using_skill", 2)
       ,0x813C: bridged("critter_mod_skill", 3) // int or void?
       ,0x80EF: bridged("critter_dmg", 3, false)
       ,0x80ed: bridged("kill_critter", 2, false)
       ,0x811a: bridged("explosion", 3) // int?
       ,0x8123: bridged("get_poison", 1)
       ,0x80A1: bridged("give_exp_points", 1, false)
       ,0x8138: bridged("item_caps_total", 1)
       ,0x8139: bridged("item_caps_adjust", 2)
       ,0x80FB: bridged("critter_state", 1)
       ,0x8124: bridged("party_add", 1, false)
       ,0x8125: bridged("party_remove", 1, false)
       ,0x814B: bridged("party_member_obj", 1)
       ,0x80EC: bridged("elevation", 1)
       ,0x80F2: bridged("game_ticks", 1)
       ,0x8133: bridged("game_ui_disable", 0, false)
       ,0x8134: bridged("game_ui_enable", 0, false)
       ,0x80f8: bridged("tile_is_visible", 1)
       ,0x80CF: bridged("tile_in_tile_rect", 5)
       ,0x80D4: bridged("tile_num", 1)
       ,0x80D5: bridged("tile_num_in_direction", 3)
       ,0x80CE: bridged("animate_move_obj_to_tile", 3, false)
       ,0x80D0: bridged("attack_complex", 8, false)
       ,0x8153: bridged("terminate_combat", 0, false)
       ,0x8145: bridged("use_obj_on_obj", 2, false)
       ,0x80E4: bridged("load_map", 2, false)
       ,0x8115: bridged("play_gmovie", 1, false)
       ,0x80A3: bridged("play_sfx", 1, false)
       ,0x80FC: bridged("game_time_advance", 1, false)
       ,0x8137: bridged("gfade_in", 1, false)
       ,0x8136: bridged("gfade_out", 1, false)
       ,0x810A: bridged("float_msg", 3, false)
       ,0x80F0: bridged("add_timer_event", 3, false)
       ,0x80F1: bridged("rm_timer_event", 1, false)
       ,0x80F9: bridged("dialogue_system_enter", 0, false)
       ,0x8129: bridged("gdialog_mod_barter", 1, false)
       ,0x80DE: bridged("start_gdialog", 5, false)
       ,0x811C: bridged("gsay_start", 0) // void?
       //,0x811D: bridged("gsay_end", 0) // void?
       ,0x811E: bridged("gsay_reply", 2, false)
       ,0x80DF: bridged("end_dialogue", 0) // void?
       ,0x8120: bridged("gsay_message", 3, false)
       //,0x806B: bridged("display", 1)
       ,0x814E: bridged("gdialog_set_barter_mod", 1, false)

       ,0x811D: function() { // gsay_end
            // halt where we are, saving our return address.
            // we will resume when the dialogue system resumes us on dialogue exit
            // usually to run cleanup code.
            console.log("halting in gsay_end (pc=0x%s)", this.pc.toString(16))
            this.retStack.push(this.pc + 2)
            this.halted = true
            this.scriptObj.gsay_end()
       }

       //,0x8121: bridged("giq_option", 5) // TODO: wrap this so that target becomes a function
       // giq_option
       ,0x8121: function() { // giq_option
       		var reaction = this.pop()
       		var target = this.pop()
       		var msgId = this.pop()
       		var msgList = this.pop()
       		var iqTest = this.pop()

       		// wrap target in a function
       		//var targetFn = () => { this.call() }
       		//console.log("TARGET=%o, proc=%o this=%o", targetFn, this.intfile.proceduresTable[target], this)
       		var targetProc = this.intfile.proceduresTable[target].name
       		// TODO: do we save the current PC as the return address?
       		// otherwise when end_dialogue is reached, we will have
       		// interrupted to this targetFn, and have no way back
       		var targetFn = () => { this.call(targetProc) }

       		this.scriptObj.giq_option(iqTest, msgList, msgId, targetFn, reaction)
       	}
    }

    // update VM opMap with our bridgeOpMap
    _.assign(opMap, bridgeOpMap)

    // define a game-oriented Script VM that has a ScriptProto instance
    export class GameScriptVM extends ScriptVM {
    	scriptObj = _.clone(Scripting.ScriptProto)

    	constructor(script: BinaryReader, intfile: IntFile, obj: Obj) {
    	    super(script, intfile)
    	    this.scriptObj.self_obj = obj

    	    // patch scriptObj to allow transparent procedure calls
    	    // TODO: maybe we should check if we're interrupting the VM
    	    for(var _procName in this.intfile.procedures) {
    	    	(procName => {
	    	    	this.scriptObj[procName] = () => { this.call(procName) }
	    	    })(_procName)
    	    }
    	}

        mapScript(): any {
            if(this.scriptObj._mapScript)
                return this.scriptObj._mapScript
            return this.scriptObj
        }
    }
}