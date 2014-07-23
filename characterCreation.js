function commitSkillChanges(obj) {
	if(obj.tempChanges === undefined)
		return

	commitSkills(obj)
	if(obj.tempChanges.tagSkills !== undefined)
		obj.tagSkills = getTagSkills(obj)
	commitStats(obj)
}

function getTagSkills(obj) {
	var commitedTagSkills = obj.tagSkills !== undefined ? obj.tagSkills : []
	var tempTagSkills = obj.tempChanges.tagSkills !== undefined ? obj.tempChanges.tagSkills : []
	return commitedTagSkills.concat(tempTagSkills)
}

function isTagSkill(obj, skill) {
	var tagSkills = getTagSkills(obj)
	if(tagSkills === undefined)
		return false
	for(var i = 0; i < tagSkills.length; i++) {
		if(tagSkills[i] == skill)
			return true
	}
	return false
}

function makeTagSkill(obj, skill, respectLimit) {
	if(respectLimit === true) {
		if(obj.tagLimit === undefined)
			return
		if(obj.tagLimit <= 0)
			return
	}
	if(obj.tempChanges.tagSkills === undefined)
		obj.tempChanges.tagSkills = []
	obj.tempChanges.tagSkills.push(skill)
	if(obj.tempChanges.skills[skill] !== undefined)	{
		obj.tempChanges.skills[skill] = 2 * obj.tempChanges.skills[skill] + 20
	}else{
		obj.tempChanges.skills[skill] = 20
	}
}

function unmakeTagSkill(obj, skill) {
	if(arrayRemove(obj.tempChanges.tagSkills, skill)) {
		if(obj.tempChanges.skills[skill] !== undefined) {
			obj.tempChanges.skills[skill] = (obj.tempChanges.skills[skill] - 20) /2
		}
	}
}

function toggleTagSkill(obj, skill) {
	if(isTagSkill(obj,skill)) {
		unmakeTagSkill(obj,skill)
	}else{
		makeTagSkill(obj,skill,true)
	}
}

function getTempRawStat(obj, stat) {
	var commitedStat = critterGetRawStat(obj,stat)
	var tempStat = obj.tempChanges.stats[stat]
	return commitedStat + tempStat
}

function getTempRawSkill(obj, skill) {
	var commitedSkill = critterGetRawSkill(obj,skill)
	var tempSkill = obj.tempChanges.skills[skill]
	return commitedSkill + tempSkill
}

function commitSkills(obj) {
	if(obj.tempChanges === undefined || obj.tempChanges.skills === undefined) 
		return
	for(var key in obj.tempChanges.skills)
		obj.skills[key] = getTempRawSkill(obj, key)
	obj.tempChanges.skills = {}
}

function commitStats(obj) {
	if(obj.tempChanges === undefined || obj.tempChanges.stats === undefined)
		return
	for(var key in obj.tempChanges.stats)
		obj.stats[key] = getTempRawStat(obj, key)
	obj.tempChanges.stats = {}
//		alternative way:
//		increaseStat(obj, key, obj.tempChanges.stats[key],false,false,true)
}

function increaseStat(obj, stat, amount, useTemp, costsPoints, allowOverBounds) {
	var statValue = critterGetStat(obj, stat)
	var curTemp =  (useTemp && obj.tempChanges.stats[stat] !== undefined) ? obj.tempChanges.stats[stat] : 0
	if(allowOverBounds === false && statValue !== null && curTemp + critterGetRawStat(obj, stat) + amount > statDependencies[stat].max) {
		amount = statDependencies[stat].max - (critterGetRawStat(obj, stat) + curTemp)
		if(amount <= 0)
			return false
	}
	if(costsPoints === true) {
		if(obj.StatPoints === undefined || obj.StatPoints < amount)
			return false
		obj.StatPoints -= amount
	}
	if(useTemp) {
		if(obj.tempChanges.stats[stat] === undefined)
			obj.tempChanges.stats[stat] = 0
		obj.tempChanges.stats[stat] += amount
	}else{
		critterSetRawStat(obj, stat, statValue + amount)
	}
	return true
}

function decreaseStat(obj, stat, amount, useTemp, costsPoints, allowOverBounds) {
	if(obj.stats[stat] === undefined || (useTemp && obj.tempChanges.stats[stat] === undefined))
		return false
	var statValue = critterGetStat(obj, stat)
	var curTemp =  (useTemp && obj.tempChanges.stats[stat] !== undefined) ? obj.tempChanges.stats[stat] : 0
	if(allowOverBounds === false && statValue !== null && (curTemp + critterGetRawStat(obj, stat)-amount) < statDependencies[stat].min) {
		amount = curTemp + critterGetRawStat(obj, stat) - statDependencies[stat].min
		if(amount <= 0)
			return false
	}
	if(costsPoints === true) {
		if(obj.StatPoints === undefined)
			obj.StatPoints = 0
		obj.StatPoints += amount
	}
	if(useTemp) {
		obj.tempChanges.stats[stat] -= 1
	}else{
		critterSetRawStat(obj, stat, statValue - amount)
	}
	return true
}

function playerInit() {
	var obj = {position: {x: 94, y: 109}, orientation: 2, frame: 0, type: "critter",
			   art: "art/critters/hmjmpsaa", isPlayer: true, anim: "idle", lastFrameTime: 0,
			   path: null, animCallback: null,
			   leftHand: playerWeapon, rightHand: null, weapon: null, armor: null,
			   dead: false, name: "Player", gender: "male", inventory: [
          	   {type: "misc", name: "Money", pid: 41, pidID: 41, amount: 1337, pro: {textID: 4100, extra: {cost: 1}, invFRM: 117440552}, invArt: 'art/inven/cap2'}
          	   ]}

	obj.inventory = [{type: "misc", name: "Money", pid: 41, pidID: 41, amount: 1337, pro: {textID: 4100,
	 				extra: {cost: 1}, invFRM: 117440552}, invArt: 'art/inven/cap2'}]
	obj.toString = function() { return "The Dude" }


    //skills and stats are implicitly generated once needed
    obj.stats = {}
    obj.skills = {}

   	//todo: make it so this gets added whenever needed so that other things than just the player can use it
   	//It is however only used for tag skills and temporary levelup menu stuff, so it's not crucial
   	obj.tempChanges = {skills: {}, stats: {}}

    return obj
}