/*
Copyright 2014 darkf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Scripting system/engine for DarkFO
*/

module Scripting {
    var gameObjects: Obj[]|null = null
    var mapVars: any = null
    var globalVars: any = {
        0: 50, // GVAR_PLAYER_REPUTATION
        //10: 1, // GVAR_START_ARROYO_TRIAL (1 = TRIAL_FIGHT)
        531: 1, // GVAR_TALKED_TO_ELDER
        452: 2, // GVAR_DEN_VIC_KNOWN
        88: 0, // GVAR_VAULT_RAIDERS
        83: 2, // GVAR_VAULT_PLANT_STATUS (9 = PLANT_REPAIRED, 2 = PLANT_ACCEPTED_QUEST)
        616: 0, // GVAR_GECKO_FIND_WOODY (0 = WOODY_UNKNOWN)
        345: 16, // GVAR_NEW_RENO_FLAG_2 (16 = know_mordino_bit)
        357: 2, // GVAR_NEW_RENO_LIL_JESUS_REFERS (lil_jesus_refers_yes)
    }
    var currentMapID: number|null = null
    var currentMapObject: Script|null = null
    var mapFirstRun = true
    var scriptMessages: { [scriptName: string]: { [msgID: number]: string } } = {}
    var dialogueOptionProcs: (() => void)[] = [] // Maps dialogue options to handler callbacks
    var currentDialogueObject: Obj|null = null
    export var timeEventList: TimedEvent[] = []
    let overrideStartPos: StartPos|null = null

    export interface StartPos {
        position: Point;
        orientation: number;
        elevation: number;
    }

    export interface TimedEvent {
        obj: Obj|null;
        ticks: number;
        userdata: any;
        fn: () => void;
    }

    var statMap: { [stat: number]: string } = {
        0: "STR", 1: "PER", 2: "END", 3: "CHA", 4: "INT",
        5: "AGI", 6: "LUK",
        35: "HP", 7: "Max HP"
    }

    type DebugLogShowType = keyof typeof Config.scripting.debugLogShowType;

    function stub(name: string, args: IArguments, type?: DebugLogShowType) {
        if(Config.scripting.debugLogShowType.stub === false || Config.scripting.debugLogShowType[type] === false) return
        var a = ""
        for(var i = 0; i < args.length; i++)
            if(i === args.length-1) a += args[i]
            else a += args[i] + ", "
        console.log("STUB: " + name + ": " + a)
    }

    function log(name: string, args: IArguments, type?: DebugLogShowType) {
        if(Config.scripting.debugLogShowType.log === false || Config.scripting.debugLogShowType[type] === false) return
        var a = ""
        for(var i = 0; i < args.length; i++)
            if(i === args.length-1) a += args[i]
            else a += args[i] + ", "
        console.log("log: " + name + ": " + a)
    }

    function warn(msg: string, type?: DebugLogShowType, script?: Script) {
        if(type !== undefined && Config.scripting.debugLogShowType[type] === false) return
        if(script)
            console.log(`WARNING [${(script as any)._vm.intfile.name}]: ${msg}`)
        else
            console.log(`WARNING: ${msg}`)
        }
        
        export function info(msg: string, type?: DebugLogShowType, script?: Script) {
            if(type !== undefined && Config.scripting.debugLogShowType[type] === false) return
            if(script)
                console.log(`INFO [${(script as any)._vm.intfile.name}]: ${msg}`)
            else
                console.log(`INFO: ${msg}`)
    }

    // http://stackoverflow.com/a/23304189/1958152
    function seed(s: number) {
        Math.random = () => {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s)
        }
    }

    export function getGlobalVar(gvar: number): any {
        return (globalVars[gvar] !== undefined) ? globalVars[gvar] : 0
    }

    export function getGlobalVars(): any {
        return globalVars
    }

    function isGameObject(obj: any) {
        // TODO: just use isinstance Obj?
        if(obj === undefined || obj === null) return false
        if(obj.isPlayer === true) return true
        if(obj.type === "item" || obj.type === "critter" || obj.type === "scenery" ||
           obj.type === "wall" || obj.type === "tile" || obj.type === "misc")
            return true

        //warn("is NOT GO: " + obj.toString())
        console.log("is NOT GO: %o", obj)
        return false
    }

    function isSpatial(obj: any): boolean {
        if(!obj)
            return false
        return obj.isSpatial === true
    }

    function getScriptName(id: number): string {
        // return getLstId("scripts/scripts", id - 1).split(".")[0].toLowerCase()
        return lookupScriptName(id);
    }

    function getScriptMessage(id: number, msg: string|number) {
        if(typeof msg === "string") // passed in a string message
            return msg

        var name = getScriptName(id)
        if(name === null) {
            warn("getScriptMessage: no script with ID " + id)
            return null
        }

        if(scriptMessages[name] === undefined)
            loadMessageFile(name)
        if(scriptMessages[name] === undefined)
            throw "getScriptMessage: loadMessageFile failed?"
        if(scriptMessages[name][msg] === undefined)
            throw "getScriptMessage: no message " + msg + " for script " + id + " (" + name + ")"

        return scriptMessages[name][msg]
    }

    export function dialogueReply(id: number): void {
        var f = dialogueOptionProcs[id]
        dialogueOptionProcs = []
        f()
        // by this point we may have already exited dialogue
        if(currentDialogueObject !== null && dialogueOptionProcs.length === 0) {
            // after running the option procedure we have no options...
            // so close the dialogue
            console.log("[dialogue exit via dialogueReply (no replies)]")
            dialogueExit()
        }
    }

    export function dialogueEnd() {
        // dialogue exited from [Done] or the UI
        console.log("[dialogue exit via dialogueExit]")
        dialogueExit()
    }

    function dialogueExit() {
        uiEndDialogue()
        info("[dialogue exit]")

        if(currentDialogueObject) {
            // resume from when we halted in gsay_end
            var vm = currentDialogueObject._script!._vm!
            vm.pc = vm.popAddr()
            info(`[resuming from gsay_end (pc=0x${vm.pc.toString(16)})]`)
            vm.run()
        }

        currentDialogueObject = null
    }

    function canSee(obj: Obj, target: Obj): boolean {
      const dir = Math.abs(obj.orientation - hexDirectionTo(obj.position, target.position));
      return [0, 1, 5].indexOf(dir) !== -1;
    }

    // TODO: Thoroughly test these functions (dealing with critter LOS)
    function isWithinPerception(obj: Critter, target: Critter): boolean {
        const dist = hexDistance(obj.position, target.position);
        const perception = critterGetStat(obj, "PER");
        const sneakSkill = critterGetSkill(target, "Sneak");
        let reqDist;

        // TODO: Implement all of the conditionals here

        if(canSee(obj, target)) {
            reqDist = perception*5;

            if(false /* some target flags & 2 */)
                // @ts-ignore: Unreachable code error (this isn't implemented yet)
                reqDist /= 2;

            if(target === player) {
                if(false /* is_pc_sneak_working */) {
                    // @ts-ignore: Unreachable code error (this isn't implemented yet)
                    reqDist /= 4;

                    if(sneakSkill > 120)
                        reqDist--;
                }
                else if(false /* is_sneaking */)
                    // @ts-ignore: Unreachable code error (this isn't implemented yet)
                    reqDist = reqDist * 2 / 3;
            }

            if(dist <= reqDist)
                return true;
        }

        reqDist = inCombat ? perception*2 : perception;

        if(target === player) {
            if(false /* is_pc_sneak_working */) {
                // @ts-ignore: Unreachable code error (this isn't implemented yet)
                reqDist /= 4;

                if(sneakSkill > 120)
                    reqDist--;
            }
            else if(false /* is_sneaking */)
                // @ts-ignore: Unreachable code error (this isn't implemented yet)
                reqDist = reqDist * 2 / 3;
        }

        return dist <= reqDist;
    }

    function objCanSeeObj(obj: Critter, target: Obj): boolean {
        // Is target within obj's perception, or is it a non-critter object (without perception)?
        if(target.type !== "critter" || isWithinPerception(obj, target as Critter)) {
            // Then, is anything blocking obj from drawing a straight line to target?
            const hit = hexLinecast(obj.position, target.position);
            return !hit;
        }
        return false;
    }

    export interface SerializedScript {
        name: string;
        lvars: { [lvar: number]: any };
    }

    interface ScriptableObj {
        _script: Script;
    }

    export class Script {
        // Stuff we hacked in
        _didOverride = false; // Did the procedure call override the default action?

        scriptName!: string;
        lvars!: { [lvar: number]: any };
        _vm?: ScriptVM;
        _mapScript?: Script;

        // Special built-in variables
        self_obj!: { _script: Script };
        self_tile!: number;
        cur_map_index!: number|null;
        fixed_param!: number;
        source_obj!: Obj|0;
        target_obj!: Obj;
        action_being_used!: number;
        game_time_hour!: number;

        combat_is_initialized!: 0 | 1;
        game_time!: number;

        // Script procedure prototypes
        start!: () => void;

        map_enter_p_proc!: () => void;
        map_update_p_proc!: () => void;

        timed_event_p_proc!: () => void;

        critter_p_proc!: () => void;
        spatial_p_proc!: () => void;
        
        use_p_proc!: () => void;
        talk_p_proc!: () => void;
        pickup_p_proc!: () => void;

        combat_p_proc!: () => void;
        damage_p_proc!: () => void;
        destroy_p_proc!: () => void;

        use_skill_on_p_proc!: () => void;

        // Actual scripting engine API implementations

        set_global_var(gvar: number, value: any) {
            globalVars[gvar] = value
            info("set_global_var: " + gvar + " = " + value, "gvars")
            log("set_global_var", arguments, "gvars")
        }
        set_local_var(lvar: number, value: any) {
            this.lvars[lvar] = value
            info("set_local_var: " + lvar + " = " + value + " [" + this.scriptName + "]", "lvars")
            log("set_local_var", arguments, "lvars")
        }
        local_var(lvar: number) {
            log("local_var", arguments, "lvars")
            if(this.lvars[lvar] === undefined) {
                warn("local_var: setting default value (0) for LVAR " + lvar, "lvars")
                this.lvars[lvar] = 0
            }
            return this.lvars[lvar]
        }
        map_var(mvar: number) {
            if(this._mapScript === undefined) {
                warn("map_var: no map script")
                return
            }
            var scriptName = this._mapScript.scriptName
            if(scriptName === undefined) {
                warn("map_var: map script has no name")
                return
            }
            else if(mapVars[scriptName] === undefined)
                mapVars[scriptName] = {}
            else if(mapVars[scriptName][mvar] === undefined) {
                warn("map_var: setting default value (0) for MVAR " + mvar, "mvars")
                mapVars[scriptName][mvar] = 0
            }
            return mapVars[scriptName][mvar]
        }
        set_map_var(mvar: number, value: any) {
            if(!this._mapScript) throw Error("set_map_var: no map script")
            var scriptName = this._mapScript.scriptName
            if(scriptName === undefined) {
                warn("map_var: map script has no name")
                return
            }
            info("set_map_var: " + mvar + " = " + value, "mvars")
            if(mapVars[scriptName] === undefined)
                mapVars[scriptName] = {}
            mapVars[scriptName][mvar] = value
        }
        global_var(gvar: number) {
            if(globalVars[gvar] === undefined) {
                warn("global_var: unknown gvar " + gvar + ", using default (0)", "gvars")
                globalVars[gvar] = 0
            }
            return globalVars[gvar]
        }
        random(min: number, max: number) { log("random", arguments); return getRandomInt(min, max) }
        debug_msg(msg: string) { log("debug_msg", arguments); info("DEBUG MSG: [" + this.scriptName + "]: " + msg, "debugMessage") }
        display_msg(msg: string) { log("display_msg", arguments); info("DISPLAY MSG: " + msg, "displayMessage"); uiLog(msg) }
        message_str(msgList: number, msgNum: number) { return getScriptMessage(msgList, msgNum) }
        metarule(id: number, target: number): any {
            switch(id) {
                case 14: return mapFirstRun // map_first_run
                case 15: // elevator
                    if(target !== -1)
                        throw "elevator given explicit type"
                    useElevator()
                    break
                case 17: stub("metarule", arguments); return 0  // is area known? (TODO)
                case 18: return 0 // is the critter under the influence of drugs? (TODO)
                case 22: return 0 // is_game_loading
                case 46: return 0 // METARULE_CURRENT_TOWN (TODO: return current city ID)
                case 48: return 2 // METARULE_VIOLENCE_FILTER (2 = VLNCLVL_NORMAL)
                case 49: // METARULE_W_DAMAGE_TYPE
                    switch(objectGetDamageType(target)) {
                        case "explosion": return 6 // DMG_explosion
                        default: throw "unknown damage type"
                    }
                default: stub("metarule", arguments); break
            }
        }
        metarule3(id: number, obj: any, userdata: any, radius: number): any {
            if(id === 100) { // METARULE3_CLR_FIXED_TIMED_EVENTS
                for(var i = 0; i < timeEventList.length; i++) {
                    if(timeEventList[i].obj === obj && 
                       timeEventList[i].userdata === userdata) { // todo: game object equals
                        info("removing timed event (userdata " + userdata + ")", "timer")
                        timeEventList.splice(i, 1)
                        return
                    }
                }
            }
            else if(id === 106) { // METARULE3_TILE_GET_NEXT_CRITTER
                // As far as I know, with lastCritter == 0, it just grabs the critter that is not the player at the tile. TODO: Test this!
                // TODO: use elevation
                var tile = obj, elevation = userdata, lastCritter = radius
                var objs = objectsAtPosition(fromTileNum(tile))
                log("metarule3 106 (tile_get_next_critter)", arguments)
                for(var i = 0; i < objs.length; i++) {
                    if(objs[i].type === "critter" && !(<Critter>objs[i]).isPlayer)
                        return objs[i]
                }
                return 0 // no critter found at that position (TODO: test)
            }

            stub("metarule3", arguments)
        }
        script_overrides() {
            log("script_overrides", arguments)
            info("[SCRIPT OVERRIDES]")
            this._didOverride = true
        }

        // player
        give_exp_points(xp: number) { stub("give_exp_points", arguments) }

        // critters
        get_critter_stat(obj: Critter, stat: number) {
            if(stat === 34) { // STAT_gender
                if(obj.isPlayer)
                    return (<Player>obj).gender === "female" ? 1 : 0
                return 0 // Default to male
            }
            var namedStat = statMap[stat]
            if(namedStat !== undefined)
                return critterGetStat(obj, namedStat)
            stub("get_critter_stat", arguments)
            return 5
        }
        has_trait(traitType: number, obj: Obj, trait: number) {
            if(!isGameObject(obj)) {
                warn("has_trait: not game object: " + obj, undefined, this)
                return 0
            }

            if(traitType === 1) { // TRAIT_OBJECT
                switch(trait) {
                    case 5: break // OBJECT_AI_PACKET (TODO)
                    case 6: break // OBJECT_TEAM_NUM (TODO)
                    case 10: return obj.orientation // OBJECT_CUR_ROT
                    case 666: // OBJECT_VISIBILITY
                        return (obj.visible === false) ? 0 : 1 // 1 = visible, 0 = invisible
                    case 669: break // OBJECT_CUR_WEIGHT (TODO)
                }
            }

            stub("has_trait", arguments)
            return 0
        }
        critter_add_trait(obj: Obj, traitType: number, trait: number, amount: number) {
            stub("critter_add_trait", arguments)

            if(!isGameObject(obj)) {
                warn("critter_add_trait: not game object: " + obj, undefined, this)
                return
            }

            if(obj.type !== "critter") {
                warn("critter_add_trait: not a critter: " + obj, undefined, this)
                return
            }

            if(traitType === 1) { // TRAIT_OBJECT
                switch(trait) {
                    case 5: // OBJECT_AI_PACKET
                        // Set critter's AI packet number
                        info("Setting critter AI packet to " + amount, undefined, this);
                        (<Critter>obj).aiNum = amount
                        break
                        case 6: // OBJECT_TEAM_NUM
                        // Set critter's team number
                        info("Setting critter team to " + amount, undefined, this);
                        (<Critter>obj).teamNum = amount
                        break
                    case 10: break // OBJECT_CUR_ROT (TODO)
                    case 666: break // OBJECT_VISIBILITY (TODO)
                    case 669: break // OBJECT_CUR_WEIGHT (TODO)
                }
            }
        }
        item_caps_total(obj: Obj) {
            if(!isGameObject(obj)) throw "item_caps_total: not game object"
            return objectGetMoney(obj)
        }
        item_caps_adjust(obj: Obj, amount: number) { stub("item_caps_adjust", arguments) }
        move_obj_inven_to_obj(obj: Obj, other: Obj) {
            if(obj === null || other === null) {
                warn("move_obj_inven_to_obj: null pointer passed in")
                return
            }

            if(!isGameObject(obj) || !isGameObject(other)) {
                warn("move_obj_inven_to_obj: not game object")
                return
            }

            info("move_obj_inven_to_obj: " + obj.inventory.length + " to " + other.inventory.length, "inventory")
            other.inventory = obj.inventory
            obj.inventory = []
        }
        obj_is_carrying_obj_pid(obj: Obj, pid: number) { // Number of inventory items with matching PID
            log("obj_is_carrying_obj_pid", arguments)
            if(!isGameObject(obj)) {
                warn("obj_is_carrying_obj_pid: not a game object")
                return 0
            } else if(obj.inventory === undefined) {
                warn("obj_is_carrying_obj_pid: object has no inventory!")
                return 0
            }

            //info("obj_is_carrying_obj_pid: " + pid, "inventory")
            var count = 0
            for(var i = 0; i < obj.inventory.length; i++) {
                if(obj.inventory[i].pid === pid) count++
            }
            return count
        }
        add_mult_objs_to_inven(obj: Obj, item: Obj, count: number) { // Add count copies of item to obj's inventory
            if(!isGameObject(obj)) {
                warn("add_mult_objs_to_inven: not a game object")
                return
            } else if(!isGameObject(item)) {
                warn("add_mult_objs_to_inven: item not a game object: " + item)
                return
            } else if(obj.inventory === undefined) {
                warn("add_mult_objs_to_inven: object has no inventory!")
                return
            }

            //info("add_mult_objs_to_inven: " + count + " counts of " + item.toString(), "inventory")
            console.log("add_mult_objs_to_inven: %d counts of %o to %o", count, item, obj)
            obj.addInventoryItem(item, count)
        }
        rm_mult_objs_from_inven(obj: Obj, item: Obj, count: number) { // Remove count copies of item from obj's inventory
            stub("rm_mult_objs_from_inven", arguments)
        }
        add_obj_to_inven(obj: Obj, item: Obj) {
            this.add_mult_objs_to_inven(obj, item, 1)
        }
        rm_obj_from_inven(obj: Obj, item: Obj) {
            this.rm_mult_objs_from_inven(obj, item, 1)
        }
        obj_carrying_pid_obj(obj: Obj, pid: number) {
            log("obj_carrying_pid_obj", arguments)
            if(!isGameObject(obj)) {
                warn("obj_carrying_pid_obj: not a game object: " + obj)
                return 0
            }

            for(var i = 0; i < obj.inventory.length; i++) {
                if(obj.inventory[i].pid === pid)
                    return obj.inventory[i]
            }	
            return 0
        }
        elevation(obj: Obj) { if(isSpatial(obj) || isGameObject(obj)) return currentElevation
                                        else { warn("elevation: not an object: " + obj); return -1 } }
        obj_can_see_obj(a: Critter, b: Critter) {
            log("obj_can_see_obj", arguments);
            if(!isGameObject(a) || !isGameObject(b)) {
                warn(`obj_can_see_obj: not game object: a=${a} b=${b}`, undefined, this);
                return 0;
            }
            return +objCanSeeObj(a, b);
        }
        obj_can_hear_obj(a: Obj, b: Obj) { /*stub("obj_can_hear_obj", arguments);*/ return 0 }
        critter_mod_skill(obj: Obj, skill: number, amount: number) { stub("critter_mod_skill", arguments); return 0 }
        using_skill(obj: Obj, skill: number) { stub("using_skill", arguments); return 0 }
        has_skill(obj: Obj, skill: number) { stub("has_skill", arguments); return 100 }
        roll_vs_skill(obj: Obj, skill: number, bonus: number) { stub("roll_vs_skill", arguments); return 1 }
        do_check(obj: Obj, check: number, modifier: number) { stub("do_check", arguments); return 1 }
        is_success(roll: number) { stub("is_success", arguments); return 1 }
        is_critical(roll: number) { stub("is_critical", arguments); return 0 }
        critter_inven_obj(obj: Critter, where: number) {
            if(!isGameObject(obj)) throw "critter_inven_obj: not game object"
            if(where === 0) {} // INVEN_TYPE_WORN
            else if(where === 1) return obj.rightHand // INVEN_TYPE_RIGHT_HAND
            else if(where === 2) return obj.leftHand // INVEN_TYPE_LEFT_HAND
            else if(where === -2) { warn("INVEN_TYPE_INV_COUNT", "inventory", this); return 0; /*throw "INVEN_TYPE_INV_COUNT"*/ }
            stub("critter_inven_obj", arguments)
            return null
        }
        inven_cmds(obj: Critter, invenCmd: number, itemIndex: number): Obj|null {
            stub("inven_cmds", arguments, "inventory");
            assert(invenCmd === 13 /* INVEN_CMD_INDEX_PTR */, "Invalid invenCmd");
            return null;
        }
        critter_attempt_placement(obj: Obj, tileNum: number, elevation: number) {
            stub("critter_attempt_placement", arguments)
            // TODO: it should find a place around tileNum if it's occupied
            return this.move_to(obj, tileNum, elevation)
        }
        critter_state(obj: Critter) {
            /*stub("critter_state", arguments);*/
            if(!isGameObject(obj)) {
                warn("critter_state: not game object: " + obj)
                return 0
            }

            var state = 0
            if(obj.dead === true)
                state |= 1
            // TODO: if obj is prone, state |= 2

            return state
        }
        kill_critter(obj: Critter, deathFrame: number) {
            log("kill_critter", arguments)
            critterKill(obj)
        }
        get_poison(obj: Obj) { stub("get_poison", arguments); return 0 }
        get_pc_stat(pcstat: number) {
            switch(pcstat) {
                case 0: // PCSTAT_unspent_skill_points
                case 1: // PCSTAT_level
                case 2: // PCSTAT_experience
                case 3: // PCSTAT_reputation
                case 4: // PCSTAT_karma
                case 5: // PCSTAT_max_pc_stat
                    stub("get_pc_stat", arguments)
                    return 0
                default: throw `get_pc_stat: unhandled ${pcstat}`
            }
        }
        critter_injure(obj: Obj, how: number) { stub("critter_injure", arguments) }
        critter_is_fleeing(obj: Obj) { stub("critter_is_fleeing", arguments); return 0 }
        wield_obj_critter(obj: Obj, item: Obj) { stub("wield_obj_critter", arguments) }
        critter_dmg(obj: Critter, damage: number, damageType: string) {
            if(!isGameObject(obj)) {
                warn("critter_dmg: not game object: " + obj)
                return
            }
            critterDamage(obj, damage, this.self_obj as Critter, true, true, damageType)
        }
        critter_heal(obj: Obj, amount: number) {
            stub("critter_heal", arguments)
        }
        poison(obj: Obj, amount: number) { stub("poison", arguments) }
        radiation_dec(obj: Obj, amount: number) { stub("radiation_dec", arguments) }

        // combat
        attack_complex(obj: Obj, calledShot: number, numAttacks: number, bonus: number,
                                 minDmg: number, maxDmg: number, attackerResults: number, targetResults: number) {
            info("[enter combat via attack_complex]")
            //stub("attack_complex", arguments)
            // since this isn't actually used beyond its basic form, we're not going to bother
            // implementing all of it

            // begin combat, turn starting with us
            if(Config.engine.doCombat)
                Combat.start(this.self_obj as Critter)
        }
        terminate_combat() {
            info("[terminate_combat]")
            if(combat) combat.end()
        }
        critter_set_flee_state(obj: Obj, isFleeing: number) { stub("critter_set_flee_state", arguments) }

        // objects
        obj_is_locked(obj: Obj) {
            log("obj_is_locked", arguments);
            if(!isGameObject(obj)) {
                warn("obj_is_locked: not game object: " + obj, undefined, this)
                return 1
            }
            return obj.locked ? 1 : 0
        }
        obj_lock(obj: Obj) {
            log("obj_lock", arguments);
            if(!isGameObject(obj)) {
                warn("obj_lock: not game object: " + obj, undefined, this)
                return
            }
            obj.locked = true
        }
        obj_unlock(obj: Obj) {
            log("obj_unlock", arguments);
            if(!isGameObject(obj)) {
                warn("obj_unlock: not game object: " + obj, undefined, this)
                return
            }
            obj.locked = false
        }
        obj_is_open(obj: Obj) {
            log("obj_is_open", arguments)
            if(!isGameObject(obj)) {
                warn("obj_is_open: not game object: " + obj, undefined, this)
                return 0
            }
            return obj.open ? 1 : 0
        }
        obj_close(obj: Obj) {
            if(!isGameObject(obj)) {
                warn("obj_close: not game object: " + obj)
                return
            }
            info("obj_close")
            if(!obj.open) return
            useObject(obj, this.self_obj as Critter, false)
            //stub("obj_close", arguments)
        }
        obj_open(obj: Obj) {
            if(!isGameObject(obj)) {
                warn("obj_open: not game object: " + obj)
                return
            }
            info("obj_open")
            if(obj.open) return
            useObject(obj, this.self_obj as Critter, false)
            //stub("obj_open", arguments)
        }
        proto_data(pid: number, data_member: number): any { stub("proto_data", arguments); return null }
        create_object_sid(pid: number, tile: number, elev: number, sid: number) { // Create object of pid and possibly script
            info("create_object_sid: pid=" + pid + " tile=" + tile + " elev=" + elev + " sid=" + sid, undefined, this)

            if(elev < 0 || elev > 2)
                throw "create_object_sid: elev out of range: elev=" + elev

            var obj = createObjectWithPID(pid, sid)
            if(!obj) {
                warn("create_object_sid: couldn't create object", undefined, this)
                return null
            }
            obj.position = fromTileNum(tile)

            //stub("create_object_sid", arguments)

            // TODO: if tile is valid...
            /*if(elevation !== currentElevation) {
                warn("create_object_sid: want to create object on another elevation (current=" + currentElevation + ", elev=" + elevation + ")")
                return
            }*/


            // add it to the map
            gMap.addObject(obj, elev)

            return obj
        }
        obj_name(obj: Obj) { return obj.name }
        obj_item_subtype(obj: Obj) {
            if(!isGameObject(obj)) {
                warn("obj_item_subtype: not game object: " + obj)
                return null
            }

            if(obj.type === "item" && obj.pro !== undefined)
                return obj.pro.extra.subtype
            stub("obj_item_subtype", arguments)
            return null
        }
        anim_busy(obj: Obj) {
            log("anim_busy", arguments)
            if(!isGameObject(obj)) {
                warn("anim_busy: not game object: " + obj)
                return false
            }
            return obj.inAnim()
        }
        obj_art_fid(obj: Obj) { stub("obj_art_fid", arguments); return 0 }
        art_anim(fid: number): number { stub("art_anim", arguments); return 0 }
        set_obj_visibility(obj: Obj, visibility: number) {
            if(!isGameObject(obj)) {
                warn("set_obj_visibility: not a game object: " + obj)
                return
            }

            obj.visible = !visibility
        }
        use_obj_on_obj(obj: Obj, who: Obj) { stub("use_obj_on_obj", arguments) }
        use_obj(obj: Obj) { stub("use_obj", arguments) }
        anim(obj: Obj, anim: number, param: number) {
            if(!isGameObject(obj)) {
                warn("anim: not a game object: " + obj)
                return
            }
            stub("anim", arguments)
            if(anim === 1000) // set rotation
                obj.orientation = param
            else if(anim === 1010) // set frame
                obj.frame = param
            else
                warn("anim: unknown anim request: " + anim)
        }

        // environment
        set_light_level(level: number) { stub("set_light_level", arguments) }
        obj_set_light_level(obj: Obj, intensity: number, distance: number) { stub("obj_set_light_level", arguments) }
        override_map_start(x: number, y: number, elevation: number, rotation: number) {
            log("override_map_start", arguments)
            info(`override_map_start: ${x}, ${y} / elevation ${elevation}`);
            overrideStartPos = { position: {x, y}, orientation: rotation, elevation };
        }
        obj_pid(obj: Obj) {
            if(!isGameObject(obj)) {
                warn("obj_pid: not game object: " + obj, undefined, this)
                return null
            }
            return obj.pid
        }
        obj_on_screen(obj: Obj) {
            log("obj_on_screen", arguments)
            if(!isGameObject(obj)) {
                warn("obj_on_screen: not a game object: " + obj)
                return 0
            }
            return objectOnScreen(obj) ? 1 : 0
        }
        obj_type(obj: Obj) {
            if(!isGameObject(obj)) { warn("obj_type: not game object: " + obj); return null }
            else if(obj.type === "critter") return 1 // critter
            else if(obj.pid === undefined) { warn("obj_type: no PID"); return null }
            return (obj.pid >> 24) & 0xff
        }
        destroy_object(obj: Obj) { // destroy object from world
            log("destroy_object", arguments)
            gMap.destroyObject(obj)
        }
        set_exit_grids(onElev: number, mapID: number, elevation: number, tileNum: number, rotation: number) {
            stub("set_exit_grids", arguments)
            for(var i = 0; i < gameObjects!.length; i++) {
                var obj = gameObjects![i]
                if(obj.type === "misc" && obj.extra && obj.extra.exitMapID !== undefined) {
                    obj.extra.exitMapID = mapID
                    obj.extra.startingPosition = tileNum
                    obj.extra.startingElevation = elevation
                }
            }
        }

        // tiles
        tile_distance_objs(a: Obj, b: Obj) {
            if((!isSpatial(a) && !isSpatial(b)) && (!isGameObject(a) || !isGameObject(b))) {
                warn("tile_distance_objs: " + a + " or " + b + " are not game objects")
                return null
            }
            return hexDistance(a.position, b.position)
        }
        tile_distance(a: number, b: number) {
            if(a === -1 || b === -1)
                return 9999
            return hexDistance(fromTileNum(a), fromTileNum(b))
        }
        tile_num(obj: Obj) {
            if(!isSpatial(obj) && !isGameObject(obj)) {
                warn("tile_num: not a game object: " + obj, undefined, this)
                return null
            }
            return toTileNum(obj.position)
        }
        tile_contains_pid_obj(tile: number, elevation: number, pid: number): any {
            stub("tile_contains_pid_obj", arguments, "tiles")
            var pos = fromTileNum(tile)
            var objects = gMap.getObjects(elevation)
            for(var i = 0; i < objects.length; i++) {
                if(objects[i].position.x === pos.x && objects[i].position.y === pos.y &&
                   objects[i].pid === pid) {
                    return objects[i]
                }
            }
            return 0 // it's not there
        }
        tile_is_visible(tile: number) {
            stub("tile_is_visible", arguments, "tiles")
            return 1
        }
        tile_num_in_direction(tile: number, direction: number, distance: number) {
            if(distance === 0) {
                //warn("tile_num_in_direction: distance=" + distance)
                return -1
            }
            let newTile = hexInDirection(fromTileNum(tile), direction)
            for(var i = 0; i < distance-1; i++) // repeat for each further distance
                newTile = hexInDirection(newTile, direction)
            return toTileNum(newTile)
        }
        tile_in_tile_rect(ul: number, ur: number, ll: number, lr: number, t: number) {
            //stub("tile_in_tile_rect", arguments, "tiles")
            const _ul = fromTileNum(ul), _ur = fromTileNum(ur)
            const _ll = fromTileNum(ll), _lr = fromTileNum(lr)
            const _t = fromTileNum(t)
            return (tile_in_tile_rect(_t, _ur, _lr, _ll, _ul) ? 1 : 0)
        }
        tile_contains_obj_pid(tile: number, elevation: number, pid: number) {
            if(elevation !== currentElevation) {
                warn("tile_contains_obj_pid: not same elevation")
                return 0
            }
            var objs = objectsAtPosition(fromTileNum(tile))
            for(var i = 0; i < objs.length; i++) {
                if(objs[i].pid === pid)
                    return 1
            }
            return 0
        }
        rotation_to_tile(srcTile: number, destTile: number) {
            var src = fromTileNum(srcTile), dest = fromTileNum(destTile)
            var hex = hexNearestNeighbor(src, dest)
            if(hex !== null)
                return hex.direction
            warn("rotation_to_tile: invalid hex: " + srcTile + " / " + destTile)
            return -1 // TODO/XXX: what does this return if invalid?
        }
        move_to(obj: Obj, tileNum: number, elevation: number) {
            if(!isGameObject(obj)) {
                warn("move_to: not a game object: " + obj)
                return
            }
            if(elevation !== currentElevation) {
                info("move_to: moving to elevation " + elevation)

                if(obj instanceof Critter && obj.isPlayer)
                    gMap.changeElevation(elevation, true)
                else {
                    gMap.removeObject(obj)
                    gMap.addObject(obj, elevation)
                }
            }
            obj.position = fromTileNum(tileNum)

            if(obj instanceof Critter && obj.isPlayer)
                centerCamera(obj.position)
        }

        // combat
        node998() { // enter combat
            console.log("[enter combat]")
        }

        // dialogue
        node999() { // exit dialogue
            info("DIALOGUE EXIT (Node999)")
            dialogueExit()
        }
        gdialog_set_barter_mod(mod: number) { stub("gdialog_set_barter_mod", arguments) }
        gdialog_mod_barter(mod: number) { // switch to barter mode
            log("gdialog_mod_barter", arguments)
            console.log("--> barter mode")
            if(!this.self_obj) throw "need self_obj"
            uiBarterMode(this.self_obj as Critter)
        }
        start_gdialog(msgFileID: number, obj: Obj, mood: number, headNum: number, backgroundID: number) {
            log("start_gdialog", arguments)
            info("DIALOGUE START", "dialogue")
            if(!this.self_obj) throw "no self_obj for start_gdialog"
            currentDialogueObject = this.self_obj as Critter
            uiStartDialogue(false, this.self_obj as Critter)
            //stub("start_gdialog", arguments)
        }
        gsay_start() { stub("gSay_Start", arguments) }
        //gSay_Option(msgList, msgID, target, reaction) { stub("gSay_Option", arguments) },
        gsay_reply(msgList: number, msgID: string|number) {
            log("gSay_Reply", arguments)
            var msg = getScriptMessage(msgList, msgID)
            if(msg === null) throw Error("gsay_reply: msg is null");
            info("REPLY: " + msg, "dialogue")
            uiSetDialogueReply(msg)
        }
        gsay_message(msgList: number, msgID: string|number, reaction: number) {
            // TODO: update this for ui
            log("gsay_message", arguments)
            /*
            // message with [Done] option
            var msg = msgID
            if(typeof msgID !== "string")
                msg = getScriptMessage(msgList, msgID)
            */
            
            // TODO: XXX: This has bitrotted, #dialogue no longer exists. [Done] needs testing.
            // $("#dialogue").append("&nbsp;&nbsp;\"" + msg + "\"<br><a href=\"javascript:dialogueEnd()\">[Done]</a><br>")
            // appendHTML($id("dialogue"), `&nbsp;&nbsp;"${msg}"<br><a href="javascript:dialogueEnd()">[Done]</a><br>`);
        }
        gsay_end() { stub("gSay_End", arguments) }
        end_dialogue() { stub("end_dialogue", arguments) }
        giq_option(iqTest: number, msgList: number, msgID: string|number, target: any, reaction: number) {
            log("giQ_Option", arguments)
            var msg = getScriptMessage(msgList, msgID)
            if(msg === null) { console.warn("giq_option: msg is null"); return; }
            info("DIALOGUE OPTION: " + msg +
                 " [INT " + ((iqTest >= 0) ? (">="+iqTest) : ("<="+-iqTest)) + "]", "dialogue")

            var INT = critterGetStat(player, "INT")
            if((iqTest > 0 && INT < iqTest) || (iqTest < 0 && INT > -iqTest))
                return // not enough intelligence for this option

            dialogueOptionProcs.push(target.bind(this))
            uiAddDialogueOption(msg, dialogueOptionProcs.length - 1)
        }
        dialogue_system_enter() {
            log("dialogue_system_enter", arguments)
            if(!this.self_obj) {
                warn("dialogue_system_enter: no self_obj")
                return
            }
            talk(this.self_obj._script, this.self_obj as Obj)
        }
        float_msg(obj: Obj, msg: string, type: number) {
            log("float_msg", arguments)
            //info("FLOAT MSG: " + msg, "floatMessage")
            if(!isGameObject(obj)) {
                warn("float_msg: not game object: " + obj)
                return
            }
            var colorMap: { [color: number]: string } = {
                // todo: take the exact values from some palette. also, yellow is ugly.
                0: "white", //0: "yellow",
                1: "black",
                2: "red",
                3: "green",
                4: "blue",
                5: "purple",
                6: "white",
                7: "red",
                8: "white",//8: "yellow",
                9: "white",
                10: "dark gray",
                11: "dark gray",
                12: "light gray"
            }
            var color = colorMap[type]
            if(type === -2 /* FLOAT_MSG_WARNING */ || type === -1 /* FLOAT_MSG_SEQUENTIAL */)
                color = colorMap[9]
            floatMessages.push({msg: msg, obj: this.self_obj as Obj, startTime: heart.timer.getTime(),
                                color: color})
        }

        // animation
        reg_anim_func(_1: any, _2: any) { stub("reg_anim_func", arguments, "animation") }
        reg_anim_animate(obj: Obj, anim: number, delay: number) { stub("reg_anim_animate", arguments, "animation") }
        reg_anim_animate_forever(obj: Obj, anim: number) {
            log("reg_anim_animate_forever", arguments, "animation")
            if(!isGameObject(obj)) {
                warn("reg_anim_animate_forever: not a game object")
                return
            }
            //console.log("ANIM FOREVER: " + obj.art + " / " + anim)
            if(anim !== 0)
                warn("reg_anim_animate_forever: anim = " + anim)
            function animate() { objectSingleAnim(obj, false, animate) }
            animate()
        }
        animate_move_obj_to_tile(obj: Critter, tileNum: any, isRun: number) {
            log("animate_move_obj_to_tile", arguments, "movement")
            if(!isGameObject(obj)) {
                warn("animate_move_obj_to_tile: not a game object", "movement", this)
                return
            }
            // XXX: is this correct? FCMALPNK passes a procedure name
            // but is it a call (wouldn't make sense for NOption) or
            // a procedure reference that this should call?
            if(typeof(tileNum) === "function")
                tileNum = tileNum.call(this)
            if(isNaN(tileNum)) {
                warn("animate_move_obj_to_tile: invalid tile num", "movement", this)
                return
            }

            var tile = fromTileNum(tileNum)
            if(tile.x < 0 || tile.x >= 200 || tile.y < 0 || tile.y >= 200) {
                warn("animate_move_obj_to_tile: invalid tile: " + tile.x +
                      ", " + tile.y + " (" + tileNum + ")", "movement", this)
                return
            }
            if(!obj.walkTo(tile, !!isRun)) {
                warn("animate_move_obj_to_tile: no path", "movement", this)
                return
            }
        }
        reg_anim_obj_move_to_tile(obj: Obj, tileNum: number, delay: number) { stub("reg_anim_obj_move_to_tile", arguments, "movement") }

        animate_stand_obj(obj: Critter) {
            stub("animate_stand_obj", arguments, "animation");
            // TODO: Play idle animation (animation 0)
        }

        explosion(tile: number, elevation: number, damage: number) {
            log("explosion", arguments)

            // TODO: objectExplode should defer to an auxillary tile explode function, which we should use
            // Make dummy object so we can explode at the tile
            var explosives = createObjectWithPID(makePID(0 /* items */, 85 /* Plastic Explosives */), -1)
            explosives.position = fromTileNum(tile)
            gMap.addObject(explosives)
            objectExplode(explosives, explosives, 0, 100) // TODO: min/max dmg?
            gMap.removeObject(explosives)
        }

        gfade_out(time: number) { stub("gfade_out", arguments) }
        gfade_in(time: number) { stub("gfade_in", arguments) }

        // timing
        add_timer_event(obj: Obj, ticks: number, userdata: any) {
            log("add_timer_event", arguments)
            if(!obj || !obj._script) {
                warn("add_timer_event: not a scriptable object: " + obj)
                return
            }
            info("timer event added in " + ticks + " ticks (userdata " + userdata + ")", "timer")
            // trigger timedEvent in `ticks` game ticks
            timeEventList.push({ticks: ticks, obj: obj, userdata: userdata, fn: function() {
                timedEvent(obj._script!, userdata)
            }.bind(this)})
        }
        rm_timer_event(obj: Obj) {
            log("rm_timer_event", arguments)
            info("rm_timer_event: " + obj + ", " + obj.pid)
            for(var i = 0; i < timeEventList.length; i++) {
                const timedEvent = timeEventList[i];
                if(timedEvent.obj && timedEvent.obj.pid === obj.pid) { // TODO: better object equality
                    info("removing timed event for obj")
                    timeEventList.splice(i--, 1)
                    break
                }
            }
        }
        game_ticks(seconds: number) { return seconds*10 }
        game_time_advance(ticks: number) {
            log("game_time_advance", arguments)
            info("advancing time " + ticks + " ticks " + "(" + ticks/10 + " seconds)")
            gameTickTime += ticks
        }

        // game
        load_map(map: number|string, startLocation: number) {
            log("load_map", arguments)
            info("load_map: " + map)
            if(typeof map === "string")
                gMap.loadMap(map.split(".")[0].toLowerCase())
            else
                gMap.loadMapByID(map)
        }
        play_gmovie(movieID: number) { stub("play_gmovie", arguments) }
        mark_area_known(areaType: number, area: number, markState: number) {
            if(areaType === 0) { // MARK_TYPE_TOWN
                switch(markState) {
                    case 0: break // MARK_STATE_UNKNOWN
                    case 1: // MARK_STATE_KNOWN
                        info("TODO: Mark area " + area + " on map")
                        return
                    case 2: break // MARK_STATE_VISITED
                    case -66: break // MARK_STATE_INVISIBLE
                }

                stub("mark_area_known", arguments)
            }
            else if(areaType === 1) { // MARK_TYPE_MAP
                stub("mark_area_known", arguments)
            }
            else throw "mark_area_known: invalid area type " + areaType
        }
        wm_area_set_pos(area: number, x: number, y: number) { stub("wm_area_set_pos", arguments) }
        game_ui_disable() { stub("game_ui_disable", arguments) }
        game_ui_enable() { stub("game_ui_enable", arguments) }

        // sound
        play_sfx(sfx: string) { stub("play_sfx", arguments) }

        // party
        party_member_obj(pid: number) {
            log("party_member_obj", arguments, "party")
            return gParty.getPartyMemberByPID(pid) || 0
        }
        party_add(obj: Critter) {
            log("party_add", arguments)
            gParty.addPartyMember(obj)
        }
        party_remove(obj: Critter) {
            log("party_remove", arguments)
            gParty.removePartyMember(obj)
        }

        _serialize(): SerializedScript {
            return {name: this.scriptName,
                    lvars: Object.assign({}, this.lvars)}
        }
    }

    export function deserializeScript(obj: SerializedScript): Script {
        var script = loadScript(obj.name)
        script.lvars = obj.lvars
        // TODO: do some kind of logic like enterMap/updateMap
        return script
    }

    function loadMessageFile(name: string) {
        name = name.toLowerCase()
        info("loading message file: " + name, "load")
        var msg = getFileText("data/text/english/dialog/" + name + ".msg")
        if(scriptMessages[name] === undefined)
            scriptMessages[name] = {}

        // parse message file
        var lines = msg.split(/\r|\n/)

        // preprocess and merge lines
        for(var i = 0; i < lines.length; i++) {
            // comments/blanks
            if(lines[i][0] === '#' || lines[i].trim() === '') {
                lines.splice(i--, 1)
                continue
            }

            // probably a continuation -- merge it with the last line
            if(lines[i][0] !== '{') {
                lines[i-1] += lines[i]
                lines.splice(i--, 1)
                continue
            }
        }

        for(var i = 0; i < lines.length; i++) {
            // e.g. {100}{}{You have entered a dark cave in the side of a mountain.}
            var m = lines[i].match(/\{(\d+)\}\{.*\}\{(.*)\}/)
            if(m === null)
                throw "message parsing: not a valid line: " + lines[i]
            // HACK: replace unicode replacement character with an apostrophe (because the Web sucks at character encodings)
            scriptMessages[name][parseInt(m[1])] = m[2].replace(/\ufffd/g, "'")
        }
    }

    export function setMapScript(script: Script) {
        currentMapObject = script
    }

    export function loadScript(name: string): Script {
        info("loading script " + name, "load")

        var path = "data/scripts/" + name.toLowerCase() + ".int"
        var data: DataView = getFileBinarySync(path)
        var reader = new BinaryReader(data)
        //console.log("[%s] loaded %d bytes", name, reader.length)
        var intfile = parseIntFile(reader, name.toLowerCase())

        //console.log("%s int file: %o", name, intfile)

        if(!currentMapObject)
            console.log("note: using current script (%s) as map script for this object", intfile.name);
        
        reader.seek(0)
        var vm = new ScriptVMBridge.GameScriptVM(reader, intfile)
        vm.scriptObj.scriptName = name
        vm.scriptObj.lvars = {}
        vm.scriptObj._mapScript = currentMapObject || vm.scriptObj // map scripts are their own map scripts
        vm.scriptObj._vm = vm
        vm.run()

        // return the scriptObj, which is a clone of ScriptProto
        // which will be patched by the GameScriptVM to allow
        // transparent procedure calls
        return vm.scriptObj
    }

    export function initScript(script: Script, obj: Obj) {
        script.self_obj = obj as ScriptableObj
        script.cur_map_index = currentMapID!
        if(script.start !== undefined)
            script.start()
    }

    export function timedEvent(script: Script, userdata: any): boolean {
        info("timedEvent: " + script.scriptName + ": " + userdata, "timer")
        if(script.timed_event_p_proc === undefined) {
            warn(`timedEvent called on script without a timed_event_p_proc! script: ${script.scriptName} userdata: ${userdata}`)
            return false
        }

        script.fixed_param = userdata
        script._didOverride = false
        script.timed_event_p_proc()
        return script._didOverride
    }

    export function use(obj: Obj, source: Obj): boolean|null {
        if(!obj._script || obj._script.use_p_proc === undefined)
            return null

        obj._script.source_obj = source
        obj._script.self_obj = obj as ScriptableObj
        obj._script._didOverride = false
        obj._script.use_p_proc()
        return obj._script._didOverride
    }

    export function talk(script: Script, obj: Obj): boolean {
        script.self_obj = obj as ScriptableObj
        script.game_time = Math.max(1, gameTickTime)
        script.cur_map_index = currentMapID
        script._didOverride = false
        script.talk_p_proc()
        return script._didOverride
    }

    export function updateCritter(script: Script, obj: Critter): boolean {
        // critter heartbeat (critter_p_proc)
        if(!script.critter_p_proc)
            return false // TODO: Should we override or not if it doesn't exist? Probably not.

        script.game_time = gameTickTime
        script.cur_map_index = currentMapID
        script._didOverride = false
        script.self_obj = obj as ScriptableObj
        script.self_tile = toTileNum(obj.position)
        script.critter_p_proc()
        return script._didOverride
    }

    export function spatial(spatialObj: Obj, source: Obj) { // TODO: Spatial type
        const script = spatialObj._script
        if(!script) throw Error("spatial without a script being triggered");
        if(!script.spatial_p_proc)
            throw Error("spatial script without a spatial_p_proc triggered")

        script.game_time = gameTickTime
        script.cur_map_index = currentMapID
        script.source_obj = source
        script.self_obj = spatialObj as ScriptableObj
        script.spatial_p_proc()
    }

    export function destroy(obj: Obj, source?: Obj) {
        if(!obj._script || !obj._script.destroy_p_proc)
            return null

        obj._script.self_obj = obj as ScriptableObj
        obj._script.source_obj = source || 0
        obj._script.game_time = Math.max(1, gameTickTime)
        obj._script.cur_map_index = currentMapID
        obj._script._didOverride = false
        obj._script.destroy_p_proc()
        return obj._script._didOverride
    }

    export function damage(obj: Obj, target: Obj, source: Obj, damage: number) {
        if(!obj._script || obj._script.damage_p_proc === undefined)
            return null

        obj._script.self_obj = obj as ScriptableObj
        obj._script.target_obj = target
        obj._script.source_obj = source
        obj._script.game_time = Math.max(1, gameTickTime)
        obj._script.cur_map_index = currentMapID
        obj._script._didOverride = false
        obj._script.damage_p_proc()
        return obj._script._didOverride
    }

    export function useSkillOn(who: Critter, skillId: number, obj: Obj): boolean {
        if(!obj._script) throw Error("useSkillOn: Object has no script");
        obj._script.self_obj = obj as ScriptableObj
        obj._script.source_obj = who
        obj._script.cur_map_index = currentMapID
        obj._script._didOverride = false
        obj._script.action_being_used = skillId
        obj._script.use_skill_on_p_proc()
        return obj._script._didOverride
    }

    export function pickup(obj: Obj, source: Critter): boolean {
        if(!obj._script) throw Error("pickup: Object has no script");
        obj._script.self_obj = obj as ScriptableObj
        obj._script.source_obj = source
        obj._script.cur_map_index = currentMapID
        obj._script._didOverride = false
        obj._script.pickup_p_proc()
        return obj._script._didOverride
    }

    export function combatEvent(obj: Obj, event: "turnBegin"): boolean {
        if(!obj._script) throw Error("combatEvent: Object has no script");

        let fixed_param: number|null = null
        switch(event) {
            case "turnBegin": fixed_param = 4; break // COMBAT_SUBTYPE_TURN
            default: throw "combatEvent: unknown event " + event
        }

        if(!obj._script.combat_p_proc)
            return false

        info("[COMBAT EVENT " + event + "]")

        obj._script.combat_is_initialized = 1
        obj._script.fixed_param = fixed_param
        obj._script.self_obj = obj as ScriptableObj
        obj._script.game_time = Math.max(1, gameTickTime)
        obj._script.cur_map_index = currentMapID
        obj._script._didOverride = false

        // TODO: script_overrides

        // hack so that the procedure is allowed to finish before
        // we actually terminate combat
        var doTerminate: any = false // did combat_p_proc terminate combat?
        obj._script.terminate_combat = function() { doTerminate = true }
        obj._script.combat_p_proc()

        if(doTerminate) {
            console.log("DUH DUH TERMINATE!")
            Script.prototype.terminate_combat.call(obj._script) // call original
        }

        return doTerminate
    }

    export function updateMap(mapScript: Script, objects: Obj[], elevation: number) {
        gameObjects = objects
        mapFirstRun = false

        if(mapScript) {
            mapScript.combat_is_initialized = inCombat ? 1 : 0
            if(mapScript.map_update_p_proc !== undefined) {
                mapScript.self_obj = {_script: mapScript}
                mapScript.map_update_p_proc()
            }
        }

        var updated = 0
        for(var i = 0; i < gameObjects.length; i++) {
            var script = gameObjects[i]._script
            if(script !== undefined && script.map_update_p_proc !== undefined) {
                script.combat_is_initialized = inCombat ? 1 : 0
                script.self_obj = gameObjects[i] as ScriptableObj
                script.game_time = Math.max(1, gameTickTime)
                script.game_time_hour = 1200 // hour of the day
                script.cur_map_index = currentMapID
                script.map_update_p_proc()
                updated++
            }
        }

        // info("updated " + updated + " objects")
    }

    export function enterMap(mapScript: Script, objects: Obj[], elevation: number, mapID: number, isFirstRun: boolean): StartPos|null {
        gameObjects = objects
        currentMapID = mapID
        mapFirstRun = isFirstRun

        if(mapScript && mapScript.map_enter_p_proc !== undefined) {
            info("calling map enter")
            mapScript.self_obj = {_script: mapScript}
            mapScript.map_enter_p_proc()
        }

        if(overrideStartPos) {
            const r = overrideStartPos
            overrideStartPos = null
            return r
        }

        // XXX: caller should do this for all objects, which is better?
        /*for(var i = 0; i < gameObjects.length; i++) {
            objectEnterMap(gameObjects[i], elevation, mapID)			
        }*/

        return null
    }

    export function objectEnterMap(obj: Obj, elevation: number, mapID: number) {
        var script = obj._script
        if(script !== undefined && script.map_enter_p_proc !== undefined) {
            script.combat_is_initialized = 0
            script.self_obj = obj as ScriptableObj
            script.game_time = Math.max(1, gameTickTime)
            script.game_time_hour = 1200 // hour of the day
            script.cur_map_index = currentMapID
            script.map_enter_p_proc()
        }
    }

    export function reset(mapName: string, mapID?: number) {
        timeEventList.length = 0 // clear timed events
        dialogueOptionProcs.length = 0
        gameObjects = null
        currentMapObject = null
        currentMapID = (mapID !== undefined) ? mapID : null
        mapVars = {}
    }

    export function init(mapName: string, mapID?: number) {
        seed(123)
        reset(mapName, mapID)
    }
}
