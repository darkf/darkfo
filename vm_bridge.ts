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
       ,0x80B4: bridged("random", 2)
       ,0x80CA: bridged("get_critter_stat", 2)
       ,0x8105: bridged("message_str", 2)
       ,0x80B8: bridged("display_msg", 1)
       ,0x810E: bridged("reg_anim_func", 2)
       ,0x8126: bridged("reg_anim_animate_forever", 2)
    }

    // update VM opMap with our bridgeOpMap
    _.assign(opMap, bridgeOpMap)

    // define a game-oriented Script VM that has a ScriptProto instance
    export class GameScriptVM extends ScriptVM {
    	scriptObj = _.clone(scriptingEngine.ScriptProto)

    	constructor(script: BinaryReader, intfile: IntFile, obj: Obj) {
    	    super(script, intfile)
    	    this.scriptObj.self_obj = obj
    	}
    }
}