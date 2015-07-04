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
	function bridged(procName: string, argc: number) {
		return function() {
			var args = []
			for(var i = 0; i < argc; i++)
				args.push(this.pop())
			args.reverse()

			this.push(this.scriptObj[procName].apply(this.scriptObj, args))
		}
	}

	var bridgeOpMap = {
	    0x80BF: function() { this.push(player) } // dude_obj
	   ,0x80BC: function() { this.push(this.scriptObj.self_obj) } // self_obj
       ,0x8128: function() { this.push(this.scriptObj.combat_is_initialized) } // combat_is_initialized
       ,0x8118: function() { this.push(1) } // get_month // TODO
       ,0x80F6: function() { this.push(1200) } // game_time_hour // TODO

       ,0x80B4: bridged("random", 2)
       ,0x80CA: bridged("get_critter_stat", 2)
       ,0x8105: bridged("message_str", 2)
       ,0x80B8: bridged("display_msg", 1)
       ,0x810E: bridged("reg_anim_func", 2)
       ,0x8126: bridged("reg_anim_animate_forever", 2)
       ,0x810B: bridged("metarule", 2)
       ,0x80C1: bridged("local_var", 1)
       ,0x80C5: bridged("global_var", 1)
       ,0x80C6: bridged("set_global_var", 2)
       ,0x80C2: bridged("set_local_var", 2)
       ,0x80B7: bridged("create_object_sid", 4)
       ,0x8102: bridged("critter_add_trait", 4)
       ,0x8116: bridged("add_mult_objs_to_inven", 3)
       ,0x80DC: bridged("obj_can_see_obj", 2)
       ,0x80E9: bridged("set_light_level", 1)
       ,0x80BB: bridged("tile_contains_obj_pid", 3)
       ,0x80A9: bridged("override_map_start", 4)
       ,0x8154: bridged("debug_msg", 1)
       ,0x80F3: bridged("has_trait", 3)
       ,0x8149: bridged("obj_art_fid", 1)
       ,0x80DE: bridged("start_gdialog", 5)
       ,0x811C: bridged("gsay_start", 0)
       ,0x811D: bridged("gsay_end", 0)
       ,0x811E: bridged("gsay_reply", 2)
       ,0x80DF: bridged("end_dialogue", 0)
       ,0x8120: bridged("gsay_message", 3)

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
    	scriptObj = _.clone(scriptingEngine.ScriptProto)

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
    }
}