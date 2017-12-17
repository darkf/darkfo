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
*/

// UI system

// TODO: reduce code duplication, circular references,
//       and general badness/unmaintainability.
// TODO: combat UI on main bar
// TODO: stats/info view in inventory screen
// TODO: fix inventory image size
// TODO: fix style for inventory image amount
// TODO: option for scaling the UI

"use strict";

module Ui {
    // Container that all of the top-level UI elements reside in
    let $uiContainer: HTMLElement = null as HTMLElement;

    export function init() {
        $uiContainer = document.getElementById("game-container");

        initSkilldex();
        // initCharacterScreen();

        document.getElementById("chrButton").onclick = () => {
            characterWindow && characterWindow.close();
            initCharacterScreen();
        };
    }

    // Bounding box that accepts strings as well as numbers
    export interface CSSBoundingBox {
        x: number|string;
        y: number|string;
        w: number|string;
        h: number|string;
    }

    export class WindowFrame {
        children: Widget[] = [];
        elem: HTMLElement;
        showing: boolean = false;

        constructor(public background: string, public bbox: CSSBoundingBox, children?: Widget[]) {
            this.elem = document.createElement("div");

            Object.assign(this.elem.style, {
                position: "absolute",
                left: `${bbox.x}px`,
                top: `${bbox.y}px`,
                width: `${bbox.w}px`,
                height: `${bbox.h}px`,
                backgroundImage: `url('${background}')`,
            });

            if(children) {
                for(const child of children)
                    this.add(child);
            }
        }

        add(widget: Widget): this {
            this.children.push(widget);
            this.elem.appendChild(widget.elem);
            return this;
        }

        show(): this {
            if(this.showing) return this;
            this.showing = true;
            $uiContainer.appendChild(this.elem);
            return this;
        }

        close(): void {
            if(!this.showing) return;
            this.showing = false;
            this.elem.parentNode.removeChild(this.elem);
        }

        toggle(): this {
            if(this.showing) this.close();
            else this.show();
            return this;
        }
    }

    export class Widget {
        elem: HTMLElement;
        hoverBackground: string|null = null;
        mouseDownBackground: string|null = null;

        constructor(public background: string|null, public bbox: CSSBoundingBox) {
            this.elem = document.createElement("div");

            Object.assign(this.elem.style, {
                position: "absolute",
                left: `${bbox.x}px`,
                top: `${bbox.y}px`,
                width: `${bbox.w}px`,
                height: `${bbox.h}px`,
                backgroundImage: background && `url('${background}')`,
            });
        }

        onClick(fn: (widget?: Widget) => void): this {
            this.elem.onclick = () => { fn(this); };
            return this;
        }

        hoverBG(background: string): this {
            this.hoverBackground = background;

            if(!this.elem.onmouseenter) {
                // Set up events for hovering/not hovering
                this.elem.onmouseenter = () => {
                    this.elem.style.backgroundImage = `url('${this.hoverBackground}')`;
                };
                this.elem.onmouseleave = () => {
                    this.elem.style.backgroundImage = `url('${this.background}')`;
                };
            }

            return this;
        }

        mouseDownBG(background: string): this {
            this.mouseDownBackground = background;

            if(!this.elem.onmousedown) {
                // Set up events for mouse down/up
                this.elem.onmousedown = () => {
                    this.elem.style.backgroundImage = `url('${this.mouseDownBackground}')`;
                };
                this.elem.onmouseup = () => {
                    this.elem.style.backgroundImage = `url('${this.background}')`;
                };
            }

            return this;
        }

        css(props: object): this {
            Object.assign(this.elem.style, props);
            return this;
        }
    }

    export class SmallButton extends Widget {
        constructor(x: number, y: number) {
            super("art/intrface/lilredup.png", { x, y, w: 15, h: 16 });
            this.mouseDownBG("art/intrface/lilreddn.png");
        }
    }

    export class Label extends Widget {
        constructor(x: number, y: number, text: string, public textColor: string="yellow") {
            super(null, { x, y, w: "auto", h: "auto" });
            this.setText(text);
            this.elem.style.color = this.textColor;
        }

        setText(text: string): void {
            this.elem.innerHTML = text;
        }
    }

    interface ListItem {
        id?: any; // identifier userdata
        uid?: number; // unique identifier (filled in by List)
        text: string;
        onSelected?: () => void;
    }

    // TODO: disable-selection class
    export class List extends Widget {
        items: ListItem[] = [];
        itemSelected?: (item: ListItem) => void;
        currentlySelected: ListItem|null = null;
        currentlySelectedElem: HTMLElement|null = null;
        _lastUID: number = 0;

        constructor(bbox: CSSBoundingBox, items?: ListItem[], public textColor: string="#00FF00", public selectedTextColor: string="#FCFC7C") {
            super(null, bbox);
            this.elem.style.color = this.textColor;

            if(items) {
                for(const item of items)
                    this.addItem(item);
            }
        }

        onItemSelected(fn: (item: ListItem) => void): this {
            this.itemSelected = fn;
            return this;
        }

        getSelection(): ListItem|null { return this.currentlySelected; }

        // Select the given item (and optionally, give its element for performance reasons)
        select(item: ListItem, itemElem?: HTMLElement): boolean {
            if(!itemElem) // Find element belonging to this item
                itemElem = this.elem.querySelector(`[data-uid="${item.uid}"]`);

            if(!itemElem) {
                console.warn(`Can't find item's element for item UID ${item.uid}`);
                return false;
            }

            this.itemSelected && this.itemSelected(item);

            item.onSelected && item.onSelected();

            if(this.currentlySelectedElem) // Reset text color for old selection
                this.currentlySelectedElem.style.color = this.textColor;

            // Use selection color for new selection
            itemElem.style.color = this.selectedTextColor;

            this.currentlySelected = item;
            this.currentlySelectedElem = itemElem;

            return true;
        }

        // Select item given by its id
        selectId(id: any): boolean {
            const item = this.items.filter(item => item.id === id)[0];
            if(!item) return false;
            this.select(item);
            return true;
        }

        addItem(item: ListItem): ListItem {
            item.uid = this._lastUID++;
            this.items.push(item);

            const itemElem = document.createElement("div");
            itemElem.style.cursor = "pointer";
            itemElem.textContent = item.text;
            itemElem.setAttribute("data-uid", item.uid+"");
            itemElem.onclick = () => { this.select(item, itemElem); };
            this.elem.appendChild(itemElem);

            // Select first item added
            if(!this.currentlySelected)
                this.select(item);

            return item;
        }

        clear(): void {
            this.items.length = 0;
            
            const node = this.elem;
            while(node.firstChild)
                node.removeChild(node.firstChild);
        }
    }

    export let skilldexWindow: WindowFrame|null = null;
    export let characterWindow: WindowFrame|null = null;

    function initSkilldex() {
        function useSkill(skill: Skills) {
            return () => {
                skilldexWindow.close();
                uiMode = UI_MODE_USE_SKILL;
                skillMode = skill;
                console.log("[UI] Using skill:", skill);
            }
        }

        skilldexWindow = new WindowFrame("art/intrface/skldxbox.png",
                                         { x: Config.ui.screenWidth - 185 - 5, y: Config.ui.screenHeight - 368, w: 185, h: 368 })
                             .add(new Label(65, 13, "Skilldex"))
                             .add(new Label(25, 85, "Lockpick").onClick(useSkill(Skills.Lockpick)))
                             .add(new Label(25, 300, "Repair").onClick(useSkill(Skills.Repair)));
    }

    function initCharacterScreen() {
        const skillList = new List({ x: 380, y: 27, w: "auto", h: "auto" });

        skillList.css({fontSize: "0.75em"});

        characterWindow = new WindowFrame("art/intrface/edtredt.png",
                                         { x: Config.ui.screenWidth/2 - 640/2, y: Config.ui.screenHeight/2 - 480/2, w: 640, h: 480 })
                              .add(new SmallButton(455, 454).onClick(() => { })).add(new Label(455+18, 454, "Done"))
                              .add(new SmallButton(552, 454).onClick(() => { characterWindow.close(); })).add(new Label(552+18, 454, "Cancel"))
                              .add(new Label(22,  6, "Name"))
                              .add(new Label(160, 6, "Age"))
                              .add(new Label(242, 6, "Gender"))
                              .add(new Label(33, 280, `Level: ${critterGetStat(player, "Level")}`).css({fontSize: "0.75em", color: "#00FF00"}))
                              .add(new Label(33, 292, `Exp: ${critterGetStat(player, "Experience")}`).css({fontSize: "0.75em", color: "#00FF00"}))
                              .add(new Label(380, 5, "Skill"))
                              .add(new Label(399, 233, "Skill Points"))
                              .add(new Label(194, 45, `Hit Points ${critterGetStat(player, "HP")}/${critterGetStat(player, "Max HP")}`)
                                       .css({fontSize: "0.75em", color: "#00FF00"}))
                              .add(skillList)
                              .show();

        // TODO: Move these constants to their proper place

        const skills = [
            "Small Guns",
            "Big Guns",
            "Energy Weapons",
            "Unarmed",
            "Melee Weapons",
            "Throwing",
            "First Aid",
            "Doctor",
            "Sneak",
            "Lockpick",
            "Steal",
            "Traps",
            "Science",
            "Repair",
            "Speech",
            "Barter",
            "Gambling",
            "Outdoorsman"
        ];

        const stats = [
            "STR",
            "PER",
            "END",
            "CHA",
            "INT",
            "AGI",
            "LUK"
        ];

        // TODO: Use a list of widgets or something for stats instead of this hack
        const statWidgets: Label[] = [];

        let selectedStat = stats[0];

        let n = 0;
        for(const stat of stats) {
            const widget = new Label(20, 39 + n, "").css({background: "black", padding: "5px"});
            widget.onClick(() => { selectedStat = stat; });
            statWidgets.push(widget);
            characterWindow.add(widget);
            n += 33;
        }

        // TODO: (Re-)run this after window is shown / a level-up is invoked
        const newStatSet = player.stats.clone();
        const newSkillSet = player.skills.clone();

        // Skill Points / Tag Skills counter
        const skillPointCounter = new Label(522, 230, "").css({background: "black", padding: "5px"});
        characterWindow.add(skillPointCounter);

        const redrawStatsSkills = () => {
            // Draw skills
            skillList.clear(); // TODO: setItemText or something
            
            for(const skill of skills)
                skillList.addItem({ text: `${skill} ${newSkillSet.get(skill, newStatSet)}%`, id: skill });

            // Draw stats
            for(let i = 0; i < stats.length; i++) {
                const stat = stats[i];
                statWidgets[i].setText(`${stat} - ${newStatSet.get(stat)}`);
            }

            // Update skill point counter
            skillPointCounter.setText(pad(newSkillSet.skillPoints, 2));
        };

        redrawStatsSkills();

        const isLevelUp = true; // TODO
        const canChangeStats = true; // TODO

        if(isLevelUp) {

            const modifySkill = (inc: boolean) => {
                const skill = skillList.getSelection().id;
                console.log("skill: %s currently: %d", skill, newSkillSet.get(skill, newStatSet));

                if(inc) {
                    const changed = newSkillSet.incBase(skill);
                    if(!changed) {
                        console.warn("Not enough skill points!");
                    }
                }
                else {
                    newSkillSet.decBase(skill);
                }

                redrawStatsSkills();
            };

            const toggleTagSkill = () => {
                const skill = skillList.getSelection().id;
                const tagged = newSkillSet.isTagged(skill);
                console.log("skill: %s currently: %d tagged: %s", skill, newSkillSet.get(skill, newStatSet), tagged);

                if(!tagged)
                    newSkillSet.tag(skill);
                else
                    newSkillSet.untag(skill);
                
                redrawStatsSkills();
            };

            const modifyStat = (change: number) => {
                console.log("stat: %s currently: %d", selectedStat, newStatSet.get(selectedStat));

                newStatSet.modifyBase(selectedStat, change);
                redrawStatsSkills();
            };

            // Skill level up buttons
            characterWindow.add(new Label(580,  236, "-").onClick(() => { console.log("-"); modifySkill(false); }));
            characterWindow.add(new Label(600,  236, "+").onClick(() => { console.log("+"); modifySkill(true); }));
            characterWindow.add(new Label(620,  236, "Tag").onClick(() => { console.log("Tag"); toggleTagSkill(); }));

            // Stat level up buttons
            if(canChangeStats) {
                characterWindow.add(new Label(115,  260, "-").onClick(() => { console.log("-"); modifyStat(-1); }));
                characterWindow.add(new Label(135,  260, "+").onClick(() => { console.log("+"); modifyStat(+1); }));
            }
        }
    }
}

// TODO: enum this
var UI_MODE_NONE = 0, UI_MODE_DIALOGUE = 1, UI_MODE_BARTER = 2, UI_MODE_LOOT = 3,
    UI_MODE_INVENTORY = 4, UI_MODE_WORLDMAP = 5, UI_MODE_ELEVATOR = 6,
    UI_MODE_CALLED_SHOT = 7, UI_MODE_SKILLDEX = 8, UI_MODE_USE_SKILL = 9,
    UI_MODE_CONTEXT_MENU = 10, UI_MODE_SAVELOAD = 11, UI_MODE_CHAR = 12
var uiMode: number = UI_MODE_NONE

function $id(id: string): HTMLElement {
    return document.getElementById(id);
}

function $img(id: string): HTMLImageElement {
    return document.getElementById(id) as HTMLImageElement;
}

function initUI() {
    Ui.init();

    makeDropTarget($("#inventoryBoxList"), (data: string) => { uiMoveSlot(data, "inventory") })
    makeDropTarget($("#inventoryBoxItem1"), (data: string) => { uiMoveSlot(data, "leftHand") })
    makeDropTarget($("#inventoryBoxItem2"), (data: string) => { uiMoveSlot(data, "rightHand") })

    for(var i = 0; i < 2; i++) {
        $("#calledShotBox .calledShotChance")
           .append(
              $("<div class='number'>").css("left", i*9).attr("id", "digit" + (i+1)))
    }

    $id("calledShotCancelBtn").onclick = () => { uiCloseCalledShot() }

    /*
    $id("worldmapViewButton").onclick = () => {
        var onAreaMap = ($("#areamap").css("visibility") === "visible")
        if(onAreaMap)
            uiWorldMapWorldView()
        else {
            var currentArea = areaContainingMap(gMap.name)
            if(currentArea)
                uiWorldMapShowArea(currentArea)
            else
                uiWorldMapAreaView()
        }
    }
    */

    $id("inventoryButton").onclick = () => { uiInventoryScreen() }
    $id("inventoryDoneButton").onclick = () => {
        uiMode = UI_MODE_NONE
        $id("inventoryBox").style.visibility = "hidden"
        uiDrawWeapon()
    }

    $id("lootBoxDoneButton").onclick = () => { uiEndLoot(); }

    $("#attackButtonContainer").click(() => {
        if(!Config.engine.doCombat) return
        if(inCombat) {
            // TODO: targeting reticle for attacks
        }
        else {
            // begin combat
            Combat.start()
        }
    }).bind("contextmenu", () => { // right mouse button (cycle weapon modes)
        var wep = critterGetEquippedWeapon(player)
        if(!wep) return false
        wep.weapon.cycleMode()
        uiDrawWeapon()
        return false
    })

    $id("endTurnButton").onclick = () => {
        if(inCombat && combat.inPlayerTurn) {
            console.log("[TURN]")
            combat.nextTurn()
        }
    }

    $id("endCombatButton").onclick = () => {
        if(inCombat)
            combat.end()
    }

    $("#endContainer").bind("animationiteration", uiEndCombatAnimationDone)
    $("#endContainer").bind("webkitAnimationIteration", uiEndCombatAnimationDone)

    $id("skilldexButton").onclick = () => { Ui.skilldexWindow.toggle() }

    function makeScrollable($el: any, scroll?: number) {
        // TODO: Use WheelEvent instead (and deltaX/Y/Z)
        $el.bind("mousewheel DOMMouseScroll", (e: JqEvent<MouseWheelEvent>) => {
            var delta = (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) ? -1 : 1
            $el.scrollTop($el.scrollTop() + (scroll || 60)*delta)
        })
    }

    makeScrollable($("#inventoryBoxList"))

    makeScrollable($("#barterBoxInventoryLeft"))
    makeScrollable($("#barterBoxInventoryRight"))
    makeScrollable($("#barterBoxLeft"))
    makeScrollable($("#barterBoxRight"))
    makeScrollable($("#lootBoxLeft"))
    makeScrollable($("#lootBoxRight"))
    makeScrollable($("#worldMapLabels"))
    makeScrollable($("#displayLog"))
    makeScrollable($("#dialogueBoxReply"), 30)

    drawHP(critterGetStat(player, "HP"))
    uiDrawWeapon()
}

function uiHideContextMenu() {
    uiMode = UI_MODE_NONE
    $id("itemContextMenu").style.visibility = "hidden"
}

function uiContextMenu(obj: Obj, evt: any) {
    uiMode = UI_MODE_CONTEXT_MENU

    function button(obj: Obj, action: string, onclick: () => void) {
        return $("<img>").attr("id", "context_" + action).
                          addClass("itemContextMenuButton").
                          click(function() {
                                onclick()
                                uiHideContextMenu()
                          })
    }

    var $menu = $("#itemContextMenu").css("visibility", "visible").html("").
                                      css({left: evt.clientX,
                                           top: evt.clientY})
    var cancelBtn = button(obj, "cancel", () => {})
    var lookBtn = button(obj, "look", () => uiLog("You see: " + obj.getDescription()))
    var useBtn = button(obj, "use", () => playerUse()) // TODO: playerUse should take an object
    var talkBtn = button(obj, "talk", () => {
            console.log("talking to " + obj.name)
            scriptingEngine.talk(obj._script, obj)
    })
    var pickupBtn = button(obj, "pickup", () => pickupObject(obj, player))

    $menu.append(cancelBtn)
    $menu.append(lookBtn)
    if(obj._script && obj._script.talk_p_proc !== undefined)
        $menu.append(talkBtn)
    if(canUseObject(obj))
        $menu.append(useBtn)
    $menu.append(pickupBtn)
}

function uiStartCombat() {
    // play end container animation
    $("#endContainer").css({animationPlayState: "running", webkitAnimationPlayState: "running"})
}

function uiEndCombat() {
    // play end container animation
    $("#endContainer").css({animationPlayState: "running", webkitAnimationPlayState: "running"})

    // disable buttons
    $("#endTurnButton").css("visibility", "hidden")
    $("#endCombatButton").css("visibility", "hidden")
}

function uiEndCombatAnimationDone(this: HTMLElement) {
    $(this).css({animationPlayState: "paused", webkitAnimationPlayState: "paused"})

    if(inCombat === true) {
        // enable buttons
        $("#endTurnButton").css("visibility", "visible")
        $("#endCombatButton").css("visibility", "visible")
    }
}

function uiDrawWeapon() {
    // draw the active weapon in the interface bar
    var weapon = critterGetEquippedWeapon(player)
    $id("attackButton").innerHTML = ""
    if(weapon === null)
        return

    if(weapon.weapon.type !== "melee") {
        $("#attackButtonWeapon").off("load")
        $("#attackButtonWeapon").load(function(this: HTMLImageElement) {
            if(!this.complete) return
            $(this).css({position: "absolute",
                         top: 5,
                         left: $("#attackButton").width() / 2 - this.width / 2,
                         maxHeight: $("#attackButton").height() - 10}).attr("draggable", "false")
        }).attr("src", weapon.invArt + ".png")
    }

    // draw weapon AP
    var CHAR_W = 10
    var digit = weapon.weapon.getAPCost(1)
    if(digit === undefined || digit > 9)
        return // TODO: Weapon AP >9?
    $id("attackButtonAPDigit").style.backgroundPosition = (0 - CHAR_W*digit) + "px"

    // draw weapon type (single, burst, called, punch, ...)
    // TODO: all melee weapons
    var wepTypes: { [wepType: string]: string } = {"melee": "punch", "gun": "single"};
    var type = wepTypes[weapon.weapon.type];
    $img("attackButtonType").src = `art/intrface/${type}.png`

    // hide or show called shot sigil?
    if(weapon.weapon.mode === "called")
        $("#attackButtonCalled").show()
    else
        $("#attackButtonCalled").hide()
}

// TODO: Rewrite this sanely (and not directly modify the player object's properties...)
function uiMoveSlot(data: string, target: string) {
    const playerUnsafe = player as any;    
    var obj = null

    if(data[0] === "i") {
        if(target === "inventory")
            return // disallow inventory -> inventory

        var idx = parseInt(data.slice(1))
        console.log("idx: " + idx)
        obj = player.inventory[idx]
        player.inventory.splice(idx, 1) // remove object from inventory
    }
    else {
        obj = playerUnsafe[data]
        playerUnsafe[data] = null // remove object from slot
    }

    console.log("obj: " + obj + " (data: " + data + ", target: " + target + ")")

    if(target === "inventory")
        player.inventory.push(obj)
    else {
        if(playerUnsafe[target] !== undefined && playerUnsafe[target] !== null) {
            // perform a swap
            if(data[0] === "i")
                player.inventory.push(playerUnsafe[target]) // inventory -> slot
            else
                playerUnsafe[data] = playerUnsafe[target] // slot -> slot
        }

        playerUnsafe[target] = obj // move the object over
    }

    uiInventoryScreen()
}

function makeDropTarget($el: Jq, dropCallback: (data: string, e?: JqEvent<DragEvent>) => void) {
    $el.on("drop", (e: JqEvent<DragEvent>) => {
        var data = e.originalEvent.dataTransfer.getData("text/plain")
        dropCallback(data, e)
        return false
    }).on("dragenter", () => false).
       on("dragover",  () => false)
}

function makeDraggable($el: Jq, data: string, endCallback?: () => void) {
    $el.attr("draggable", "true").on("dragstart", (e: JqEvent<DragEvent>) => {
        e.originalEvent.dataTransfer.setData('text/plain', data)
        console.log("start drag")
    }).on("dragend", (e: JqEvent<DragEvent>) => {
        if(e.originalEvent.dataTransfer.dropEffect !== 'none') {
            //$(this).remove()
            endCallback && endCallback()
        }
    })
}

function uiInventoryScreen() {
    uiMode = UI_MODE_INVENTORY

    $("#inventoryBox").css("visibility", "visible")
    drawInventory($("#inventoryBoxList"), player.inventory, (obj: Obj, e: MouseEvent) => {
        makeItemContextMenu(e, obj, "inventory")
    })

    function drawInventory($el: Jq, objects: Obj[], clickCallback?: (item: Obj, e: MouseEvent) => void) {
        $el.html("")
        $("#inventoryBoxItem1").html("")
        $("#inventoryBoxItem2").html("")

        for(let i = 0; i < objects.length; i++) {
            const invObj = objects[i]
            const img = $("<img>").attr("src", invObj.invArt+'.png').
                        attr("width", 72).attr("height", 60) // 90x60 // 70x40
            img.attr("title", invObj.name)
            if(clickCallback)
                    img.click((e: JqEvent<MouseEvent>) => { clickCallback(invObj, e.originalEvent) })
            $el.append(img).append("x" + invObj.amount)
            makeDraggable(img, "i" + i, () => { uiInventoryScreen() })
        }
    }

    function itemAction(obj: Obj, slot: keyof Player, action: "cancel"|"use"|"drop") {
        switch(action) {
            case "cancel": break
            case "use":
                console.log("using object: " + obj.art)
                useObject(obj, player)
                break
            case "drop":
                //console.log("todo: drop " + obj.art); break
                console.log("dropping: " + obj.art + " with pid " + obj.pid)
                if(slot !== "inventory") {
                    // add into inventory to drop
                    console.log("moving into inventory first")
                    player.inventory.push(obj)
                    player[slot] = null
                }

                dropObject(player, obj)
                uiInventoryScreen()
                break
        }
    }

    function makeContextButton(obj: Obj, slot: keyof Player, action: "cancel"|"use"|"drop") {
        return $("<img>").attr("id", "context_" + action).
                          addClass("itemContextMenuButton").
                          click(() => {
                              itemAction(obj, slot, action)
                              $("#itemContextMenu").css("visibility", "hidden")
        })
    }

    function makeItemContextMenu(e: MouseEvent, obj: Obj, slot: keyof Player) {
        var $menu = $("#itemContextMenu").css("visibility", "visible").html("").
                                          css({left: e.clientX,
                                               top: e.clientY})
        var cancelBtn = makeContextButton(obj, slot, "cancel")
        var useBtn = makeContextButton(obj, slot, "use")
        var dropBtn = makeContextButton(obj, slot, "drop")

        $menu.append(cancelBtn)
        if(canUseObject(obj))
            $menu.append(useBtn)
        $menu.append(dropBtn)
    }

    function drawSlot(slot: keyof Player, slotID: string) {
        var art = player[slot].invArt
        var img = $("<img>").attr("src", art+'.png').
                  attr("width", 72).attr("height", 60) // 90x60 // 70x40
        img.attr("title", player[slot].name)
        img.click((e: JqEvent<MouseEvent>) => {
            makeItemContextMenu(e.originalEvent, player[slot], slot)
        })
        makeDraggable(img, slot)
        $(slotID).html("").append(img)
    }

    if(player.leftHand)
        drawSlot("leftHand", "#inventoryBoxItem1")
    if(player.rightHand)
        drawSlot("rightHand", "#inventoryBoxItem2")
}

function drawHP(hp: number) {
    drawDigits("#hpDigit", hp, 4, true)
}

function drawDigits(idPrefix: string, amount: number, maxDigits: number, hasSign: boolean) {
    var CHAR_W = 9, CHAR_NEG = 12
    var sign = (amount < 0) ? CHAR_NEG : 0
    if(amount < 0) amount = -amount
    var digits = amount.toString()
    var firstDigitIdx = (hasSign ? 1 : 0)
    if(hasSign)
        $(idPrefix+"1").css("background-position", 0 - CHAR_W*sign) // sign
    for(var i = firstDigitIdx; i <= maxDigits-digits.length; i++) // left-fill with zeroes
        $(idPrefix + i).css("background-position", 0)
    for(var i = 0; i < digits.length; i++) {
        var idx = digits.length - 1 - i
        if(digits[idx] === '-')
            var digit = 12
        else
            var digit = parseInt(digits[idx])
        $(idPrefix + (maxDigits-i)).css("background-position", 0 - CHAR_W*digit)
    }
}

function uiStartDialogue(force: boolean, target?: Critter) {
    if(uiMode === UI_MODE_BARTER && force !== true)
        return

    uiMode = UI_MODE_DIALOGUE
    $("#dialogueContainer").css("visibility", "visible")
    $("#dialogueBox").css("visibility", "visible").css("top", 480).animate({top: 290}, 1000)

    // center around the dialogue target
    if(!target) return
    var bbox = objectBoundingBox(target)
    if(bbox !== null) {
        var dc = $("#dialogueContainer")
        // alternatively: dc.offset().left - $(heart.canvas).offset().left
        var dx = (dc.width() / 2 | 0) + dc[0].offsetLeft
        var dy = (dc.height() / 4 | 0) + dc[0].offsetTop - (bbox.h / 2 | 0)
        cameraX = bbox.x - dx
        cameraY = bbox.y - dy
    }
}

function uiEndDialogue() {
    uiMode = UI_MODE_NONE
    $("#dialogueContainer").css("visibility", "hidden")
    $("#dialogueBox").css("visibility", "hidden")
    $("#dialogueBoxReply").html("")
}

function uiSetDialogueReply(reply: string) {
    $("#dialogueBoxReply").html(reply).scrollTop(0)
    $("#dialogueBoxTextArea").html("")
}

function uiAddDialogueOption(msg: string, optionID: number) {
    $("#dialogueBoxTextArea").append(
        "<li><a href=\"javascript:dialogueReply(" + optionID + ")\">" + msg + "</a></li>")
}

function uiGetAmount(item: Obj) {
    while(true) {
        var amount: any = prompt("How many?")
        if(amount === null)
            return 0
        else if(amount === "")
            return item.amount // all of it!
        else amount = parseInt(amount)

        if(isNaN(amount) || item.amount < amount)
            alert("Invalid amount")
        else return amount
    }
}

function _uiAddItem(items: Obj[], item: Obj, count: number) {
    for(var i = 0; i < items.length; i++) {
        if(items[i].approxEq(item)) {
            items[i].amount += count
            return
        }
    }

    // no existing item, add new inventory object
    items.push(item.clone().setAmount(count))
}

function uiSwapItem(a: Obj[], item: Obj, b: Obj[], amount: number) {
    // swap item from a -> b
    if(amount === 0) return

    var idx = -1
    for(var i = 0; i < a.length; i++) {
        if(a[i].approxEq(item)) {
            idx = i
            break
        }
    }
    if(idx === -1)
        throw "item (" + item + ") does not exist in a"

    if(amount < item.amount) // deduct amount from a and give amount to b
        item.amount -= amount
    else // just swap them
        a.splice(idx, 1)

    // add the item to b
    _uiAddItem(b, item, amount)
}

function uiEndBarterMode() {
    $("#barterBox").animate({top: 480}, 1000, function() {
        $("#barterBox").css("visibility", "hidden")
        $("#barterBoxLeft").off("drop dragenter dragover")
        $("#barterBoxRight").off("drop dragenter dragover")
        $("#barterBoxInventoryLeft").off("drop dragenter dragover")
        $("#barterBoxInventoryRight").off("drop dragenter dragover")
        $("#barterTalkButton").off("click")
        $("#barterOfferButton").off("click")
        $("#barterBox").css("visibility", "hidden")
        
        uiStartDialogue(true) // force dialogue mode
    })
}

function uiBarterMode(merchant: Critter) {
    uiMode = UI_MODE_BARTER

    // hide dialogue screen for now
    $("#dialogueBox").animate({top: 480}, 1000, "swing", function() {
        $("#dialogueBox").css("visibility", "hidden")
        console.log("going to pop up")
        // pop up the bartering screen
        $("#barterBox").css("visibility", "visible").css("top", 480).animate({top: 290}, 1000)
    })

    // logic + UI for bartering
    // TODO: would it be better if we dropped the "working" copies?

    // a copy of inventories for both parties
    let workingPlayerInventory = player.inventory.map(cloneItem)
    let workingMerchantInventory = merchant.inventory.map(cloneItem)

    // and our working barter tables
    let playerBarterTable: Obj[] = []
    let merchantBarterTable: Obj[] = []

    function totalAmount(objects: Obj[]): number {
        var total = 0
        for(var i = 0; i < objects.length; i++) {
            total += objects[i].pro.extra.cost * objects[i].amount
        }
        return total
    }

    // TODO: checkOffer() or some-such
    function offer() {
        console.log("[OFFER]")

        var merchantOffered = totalAmount(merchantBarterTable)
        var playerOffered = totalAmount(playerBarterTable)
        var diffOffered = playerOffered - merchantOffered

        if(diffOffered >= 0) {
            // OK, player offered equal to more more than the value
            console.log("[OFFER OK]")

            // finalize and apply the deal

            // swap to working inventories
            merchant.inventory = workingMerchantInventory
            player.inventory = workingPlayerInventory

            // add in the table items
            for(var i = 0; i < merchantBarterTable.length; i++)
                player.addInventoryItem(merchantBarterTable[i], merchantBarterTable[i].amount)
            for(var i = 0; i < playerBarterTable.length; i++)
                merchant.addInventoryItem(playerBarterTable[i], playerBarterTable[i].amount)

            // re-clone so we can continue bartering if necessary
            workingPlayerInventory = player.inventory.map(cloneItem)
            workingMerchantInventory = merchant.inventory.map(cloneItem)

            playerBarterTable = []
            merchantBarterTable = []

            redrawBarterInventory()
        }
        else {
            console.log("[OFFER REFUSED]")
        }
    }

    function drawInventory($el: Jq, who: "p"|"m"|"l"|"r", objects: Obj[]) {
        $el.html("")

        for(var i = 0; i < objects.length; i++) {
            var inventoryImage = objects[i].invArt
            var img = $("<img>").attr("src", inventoryImage+'.png').
                      attr("width", 72).attr("height", 60) // 90x60 // 70x40
            img.attr("title", objects[i].name)
            $el.append(img).append("x" + objects[i].amount)
            makeDraggable(img, who + i)
        }
    }

    function uiBarterMove(data: string, where: "left"|"right"|"leftInv"|"rightInv") {
        console.log("barter: move " + data + " to " + where)

        var from = ({"p": workingPlayerInventory,
                    "m": workingMerchantInventory,
                    "l": playerBarterTable,
                    "r": merchantBarterTable} as any)[data[0]]

        if(from === undefined) throw "uiBarterMove: wrong data: " + data

        var idx = parseInt(data.slice(1))
        var obj = from[idx]
        if(obj === undefined) throw "uiBarterMove: obj not found in list (" + idx + ")"

        // player inventory -> left table or player inventory
        if(data[0] === "p" && where !== "left" && where !== "leftInv")
            return

        // merchant inventory -> right table or merchant inventory
        if(data[0] === "m" && where !== "right" && where !== "rightInv")
            return

        var to = {"left": playerBarterTable,
                  "right": merchantBarterTable,
                  "leftInv": workingPlayerInventory,
                  "rightInv": workingMerchantInventory}[where]

        if(to === undefined)
            throw "uiBarterMove: invalid location: " + where
        else if(to === from) // table -> same table
            return
        else if(obj.amount > 1)
            uiSwapItem(from, obj, to, uiGetAmount(obj))
        else uiSwapItem(from, obj, to, 1)

        redrawBarterInventory()
    }

    // bartering drop targets
    makeDropTarget($("#barterBoxLeft"), (data: string) => { uiBarterMove(data, "left") })
    makeDropTarget($("#barterBoxRight"), (data: string) => { uiBarterMove(data, "right") })
    makeDropTarget($("#barterBoxInventoryLeft"), (data: string) => { uiBarterMove(data, "leftInv") })
    makeDropTarget($("#barterBoxInventoryRight"), (data: string) => { uiBarterMove(data, "rightInv") })

    $("#barterTalkButton").click(uiEndBarterMode)
    $("#barterOfferButton").click(offer)

    function redrawBarterInventory() {
        drawInventory($("#barterBoxInventoryLeft"), "p", workingPlayerInventory)
        drawInventory($("#barterBoxInventoryRight"), "m", workingMerchantInventory)
        drawInventory($("#barterBoxLeft"), "l", playerBarterTable)
        drawInventory($("#barterBoxRight"), "r", merchantBarterTable)

        var moneyLeft = totalAmount(playerBarterTable)
        var moneyRight = totalAmount(merchantBarterTable)

        $("#barterBoxLeftAmount").html("$" + moneyLeft)
        $("#barterBoxRightAmount").html("$" + moneyRight)
    }

    redrawBarterInventory()
}

function uiEndLoot() {
    uiMode = UI_MODE_NONE
    
    $("#lootBox").css("visibility", "hidden")
    $("#lootBoxLeft").off("drop dragenter dragover")
    $("#lootBoxRight").off("drop dragenter dragover")
    $("#lootBoxTakeAllButton").off("click")
}

function uiLoot(object: Obj) {
    uiMode = UI_MODE_LOOT

    function uiLootMove(data: string /* "l"|"r" */, where: "left"|"right") {
        console.log("loot: move " + data + " to " + where)

        var from = ({"l": player.inventory,
                    "r": object.inventory} as any)[data[0]]

        if(from === undefined) throw "uiLootMove: wrong data: " + data

        var idx = parseInt(data.slice(1))
        var obj = from[idx]
        if(obj === undefined) throw "uiLootMove: obj not found in list (" + idx + ")"

        var to = {"left": player.inventory,
                  "right": object.inventory}[where]

        if(to === undefined)
            throw "uiLootMove: invalid location: " + where
        else if(to === from) // object -> same location
            return
        else if(obj.amount > 1)
            uiSwapItem(from, obj, to, uiGetAmount(obj))
        else uiSwapItem(from, obj, to, 1)

        drawLoot()
    }

    function drawInventory($el: Jq, who: "p"|"m"|"l"|"r", objects: Obj[]) {
        $el.html("")

        for(var i = 0; i < objects.length; i++) {
            var inventoryImage = objects[i].invArt
            var img = $("<img>").attr("src", inventoryImage+'.png').
                      attr("width", 72).attr("height", 60) // 90x60 // 70x40
            img.attr("title", objects[i].name)
            $el.append(img).append("x" + objects[i].amount)
            makeDraggable(img, who + i)
        }
    }

    console.log("looting...")

    $("#lootBox").css("visibility", "visible")

    // loot drop targets
    makeDropTarget($("#lootBoxLeft"), (data: string) => { uiLootMove(data, "left") })
    makeDropTarget($("#lootBoxRight"), (data: string) => { uiLootMove(data, "right") })

    $("#lootBoxTakeAllButton").click(() => {
        console.log("take all...")
        var inv = object.inventory.slice(0) // clone inventory
        for(var i = 0; i < inv.length; i++)
            uiSwapItem(object.inventory, inv[i], player.inventory, inv[i].amount)
        drawLoot()
    })

    function drawLoot() {
        drawInventory($("#lootBoxLeft"), "l", player.inventory)
        drawInventory($("#lootBoxRight"), "r", object.inventory)
    }

    drawLoot()
}

function uiLog(msg: string) {
    var $log = $("#displayLog")
    $log.append("<li>" + msg + "</li>").scrollTop($log[0].scrollHeight)
}

function uiCloseWorldMap() {
    uiMode = UI_MODE_NONE

    $("#worldMapContainer").hide()
    $("#areamap").css("visibility", "hidden")
    $("#worldmap").css("visibility", "hidden")

    Worldmap.stop()
}

function uiWorldMap(onAreaMap: boolean=false) {
    uiMode = UI_MODE_WORLDMAP
    $("#worldMapContainer").show()

    if(!mapAreas)
        mapAreas = loadAreas()

    if(onAreaMap)
        uiWorldMapAreaView()
    else
        uiWorldMapWorldView()
    uiWorldMapLabels()
}

function uiWorldMapAreaView() {
    $("#worldmap").css("visibility", "hidden")
    $("#areamap").css("visibility", "visible")

    Worldmap.stop()
}

function uiWorldMapWorldView() {
    $("#worldmap").css("visibility", "visible")
    $("#areamap").css("visibility", "hidden")

    Worldmap.start()
}

function uiWorldMapShowArea(area: Area) {
    uiWorldMapAreaView()

    $("#areamap").css({
        backgroundImage: "url('" + area.mapArt + ".png')"
    }).html("")

    var entrances = area.entrances
    for(var j = 0; j < entrances.length; j++) {
        console.log("entrance: " + entrances[j].mapLookupName)
        var $entranceEl = $("<div class='worldmapEntrance'>")
        var $hotspot = $("<div class='worldmapEntranceHotspot'>")

        $hotspot.click((function(entrance) {
            return function() {
                // hotspot click -- travel to relevant map
                var mapName = lookupMapNameFromLookup(entrance.mapLookupName)
                console.log("hotspot -> " + mapName + " (via " +
                            entrance.mapLookupName + ")")
                gMap.loadMap(mapName)
                uiCloseWorldMap()
            }
        })(entrances[j]))

        $entranceEl.append($hotspot)
        $entranceEl.append(entrances[j].mapLookupName)
        $entranceEl.css({
            left: entrances[j].x,
            top:  entrances[j].y
        })
        $("#areamap").append($entranceEl)
    }
}

function uiWorldMapLabels() {
    $("#worldMapLabels").html("<div id='worldMapLabelsBackground'></div>")

    var i = 0
    for(const areaID in mapAreas) {
        var area = mapAreas[areaID]
        if(!area.labelArt) continue

        var label = $("<img>").addClass("worldMapLabelImage").
                               attr("src", area.labelArt + ".png")
        var labelButton = $("<div>").addClass("worldMapLabelButton")
                                    .click(() => { uiWorldMapShowArea(mapAreas[areaID]) })

        var areaLabel = $("<div>").addClass("worldMapLabel").
                                   css({top: 1 + i*(27)}).
                                   append(label).append(labelButton)
        $("#worldMapLabels").append(areaLabel)      
        i++ 
    }
}

function uiElevatorDone() {
    uiMode = UI_MODE_NONE
    $("#elevatorBox").css("visibility", "hidden")

    // flip all buttons to hidden
    $(".elevatorButton").css("visibility", "hidden").off("click")
    $("#elevatorLabel").css("visibility", "hidden")
}

function uiElevator(elevator: Elevator) {
    uiMode = UI_MODE_ELEVATOR
    var art = lookupInterfaceArt(elevator.type)
    console.log("elevator art: " + art)
    console.log("buttons: " + elevator.buttonCount)

    if(elevator.labels !== -1) {
        var labelArt = lookupInterfaceArt(elevator.labels)
        console.log("elevator label art: " + labelArt)

        $("#elevatorLabel").css({visibility: "visible",
                                 backgroundImage: "url('" + labelArt + ".png')"})
    }

    $("#elevatorBox").css({visibility: "visible",
                           backgroundImage: "url('" + art + ".png')"})

    // flip the buttons we need visible
    for(var i = 1; i <= elevator.buttonCount; i++) {
        $("#elevatorButton" + i).css("visibility", "visible").click(function(i) {
            return function() {
                // button i pushed
                // todo: animate positioner/spinner (and come up with a better name for that)

                var mapID = elevator.buttons[i-1].mapID
                var level = elevator.buttons[i-1].level
                var position = fromTileNum(elevator.buttons[i-1].tileNum)

                if(mapID !== gMap.mapID) {
                    // different map
                    console.log("elevator -> map " + mapID + ", level " + level + " @ " +
                                position.x + ", " + position.y)
                    gMap.loadMapByID(mapID, position, level)
                }
                else if(level !== currentElevation) {
                    // same map, different elevation
                    console.log("elevator -> level " + level + " @ " + 
                                position.x + ", " + position.y)
                    player.move(position)
                    gMap.changeElevation(level, true)
                }

                // else, same elevation, do nothing
                uiElevatorDone()
            }
        }(i))
    }
}

function uiCloseCalledShot() {
    uiMode = UI_MODE_NONE
    $("#calledShotBox").hide()
}

function uiCalledShot(art: string, target: Critter, callback?: (regionHit: string) => void) {
    uiMode = UI_MODE_CALLED_SHOT
    $("#calledShotBox").show()

    function drawChance(region: string) {
        var chance: any = Combat.prototype.getHitChance(player, target, region).hit
        console.log("id: %s | chance: %d", "#calledShot-"+region+"-chance #digit", chance)
        if(chance <= 0)
            chance = "--"
        drawDigits("#calledShot-"+region+"-chance #digit", chance, 2, false)
    }

    drawChance("torso")
    drawChance("head")
    drawChance("eyes")
    drawChance("groin")
    drawChance("leftArm")
    drawChance("rightArm")
    drawChance("leftLeg")
    drawChance("rightLeg")

    $("#calledShotBackground").css("background-image", "url('" + art + ".png')")

    $(".calledShotLabel").click((evt: JqEvent<MouseEvent>) => {
        var id = $(evt.target).attr("id")
        var regionHit = id.split("-")[1]
        console.log("clicked a called location (%s)", regionHit)
        if(callback)
            callback(regionHit)
    })
}

function uiSaveLoad(isSave: boolean): void {
    uiMode = UI_MODE_SAVELOAD;

    const saveList = new Ui.List({ x: 55, y: 50, w: "auto", h: "auto" });
    const saveInfo = new Ui.Label(404, 262, "", "#00FF00");
    // TODO: CSSBoundingBox's width and height should be optional (and default to `auto`), then Label can accept one
    Object.assign(saveInfo.elem.style, {
         width: "154px", height: "33px",
        fontSize: "8pt",
        overflow: "hidden",
    });

    const saveLoadWindow = new Ui.WindowFrame("art/intrface/lsgame.png", { x: 80, y: 20, w: 640, h: 480 })
                                 .add(new Ui.Widget("art/intrface/lscover.png", { x: 340, y: 40, w: 275, h: 173 }))
                                 .add(new Ui.Label(50, 26, isSave ? "Save Game" : "Load Game"))
                                 .add(new Ui.SmallButton(391, 349).onClick(selected)).add(new Ui.Label(391+18, 349, "Done"))
                                 .add(new Ui.SmallButton(495, 349).onClick(done)).add(new Ui.Label(495+18, 349, "Cancel"))
                                 .add(saveInfo)
                                 .add(saveList)
                                 .show();

    if(isSave) {
        saveList.select(saveList.addItem({ text: "<New Slot>", id: -1, onSelected: () => {
            saveInfo.setText("New save");
        } }));
    }

    // List saves, and write them to the UI list
    SaveLoad.saveList((saves: SaveLoad.SaveGame[]) => {
        for(const save of saves) {
            saveList.addItem({ text: save.name, id: save.id, onSelected: () => {
                saveInfo.setText(SaveLoad.formatSaveDate(save) + "<br>" + save.currentMap);
            } });
        }
    });

    function done() {
        uiMode = UI_MODE_NONE;
        saveLoadWindow.close();
    }

    function selected() { // Done was clicked, so save/load the slot
        const item = saveList.getSelection();
        if(!item) return; // No slot selected

        const saveID = item.id;

        console.log("[UI] %s save #%d.", isSave ? "Saving" : "Loading", saveID);

        if(isSave) {
            const name = prompt("Save Name?");

            if(saveID !== -1) {
                if(!confirm("Are you sure you want to overwrite that save slot?"))
                    return;
            }

            SaveLoad.save(name, saveID === -1 ? undefined : saveID, done);
        }
        else {
            SaveLoad.load(saveID);
            done();
        }
    }
}
