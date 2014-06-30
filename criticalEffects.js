var generalRegionName = {0: "head", 1: "leftArm",2: "rightArm",3: "torso",4: "rightLeg", 5: "leftLeg", 6: "eyes", 7: "groin",8: "uncalled"}
var regionHitChanceDecTable = {"head":40,"torso":0}

function knockout(target)
{
	console.log(critterGetName(target) + " has been knocked out. This does not do anything yet")
}

function knockdown(target)
{
	console.log(critterGetName(target) + " has been knocked down. This does not do anything yet")

}

function crippledLeftLeg(target)
{
	console.log(critterGetName(target) + " has been crippled in the left leg. This does not do anything yet")

}

function crippledRightLeg(target)
{
	console.log(critterGetName(target) + " has been crippled in the right leg. This does not do anything yet")

}

function crippledLeftArm(target)
{
	console.log(critterGetName(target) + " has been crippled in the left arm. This does not do anything yet")

}

function crippledRightArm(target)
{
	console.log(critterGetName(target) + " has been crippled in the right arm. This does not do anything yet")

}

function blinded(target) {
	console.log(critterGetName(target) + " has been blinded by delight. This does not do anything yet")
}

function death(target) {
	console.log(critterGetName(target) + " has met the reaperpony. This does not do anything yet")
}

function onFire(target) {
	console.log(critterGetName(target) + " just got a flame lit in their heart. This does not do anything yet")
}

function bypassArmor(target) {
	console.log(critterGetName(target) + " is being hit by an armor bypassing bullet, blame the Zebras. This does not do anything yet")
}

function droppedWeapon(target) {
	console.log(critterGetName(target) + " needs to drop their weapon like it's hot. The documentation claims this is broken. This does not do anything yet")
}

function loseNextTurn(target) {
	console.log(critterGetName(target) + " lost their next turn. This does not do anything yet")
}

function random(target) {
	console.log(critterGetName(target) + " is affected by a random effect. How random! This does not do anything yet")
}

var Effects = function(effectCallbackList)
{
	this.effects = effectCallbackList
}

Effects.prototype.DoEffectsOn = function(target)
{
	for(var i = 0; i < this.effects.length; i++)
	{
		this.effects[i](target)
	}
}

var StatCheck = function(stat, modifier, Effects, failEffectMessage)
{
	this.stat = stat
	this.modifier = modifier
	this.Effects = Effects
	this.failEffectMessageID = failEffectMessage
}

StatCheck.prototype.DoEffectsOn = function(target)
{
	if(this.stat === -1)
	{
		return false
	}
	var statToRollAgainst = target.stats[this.stat]
	statToRollAgainst += modifier
	//todo: rolling
	var failedRoll = true
	if(failedRoll === true) //never trust JS
	{
		this.Effects.DoEffectsOn(target)
		return (true,this.failEffectMessageID)
	}else{
		return false
	}
}

var CritType = function(DamageMultiplier, Effects, statCheck, EffectMsg)
{
	this.DM = DamageMultiplier
	this.Effects = Effects
	this.statCheck = statCheck
	this.msgID = EffectMsg
}

CritType.prototype.DoEffectsOn = function(target)
{
	var statCheckResults = this.statCheck.DoEffectsOn(target)
	var returnMsgID = this.msgID
	this.Effects.DoEffectsOn(target)
	//did statCheck do its effects as well?
	if(statCheckResults[0] === true)
	{
		returnMsgID = statCheckResults[1]
	}
	return {'DM':this.DM,'msgID':returnMsgID}
}

var CritterTable = {}

function getTable(number)
{
	$.get("critTables/critterTable1.json",function(table){
		CritterTable[number] = critTableJsonToJsObjectParser(table)
	}, "json")
}

function critTableJsonToJsObjectParser(table)
{	
	var retTable = {}
	for(var i = 0; i < 9; i++)
	{
		var curGeneralRegionName = generalRegionName[i]
		retTable[curGeneralRegionName] = parseRegion(table[curGeneralRegionName])
	}
	return retTable
}

function parseRegion(jsonRegion)
{
	var retRegion = {}
	for(var i = 0; i < 6; i++)
	{
		retRegion[i] = parseCritLevel(jsonRegion["critLevel"+i])
	}
	return retRegion
}

function parseCritLevel(jsonCritLevel)
{
	var jsonStat = jsonCritLevel.statCheck
	var tempStatCheck = new StatCheck(jsonStat.stat,jsonStat.checkModifier,parseEffects(jsonStat.failureEffect),jsonStat.fmsg)
	var retCritLevel = new CritType(jsonCritLevel.dmgMultiplier,parseEffects(jsonCritLevel.critEffect),tempStatCheck,jsonCritLevel.msg)
	return retCritLevel
}

function parseEffects(jsonEffects)
{
	var tempEffects = {}
	for(var i = 0; i < jsonEffects.length; i++)
	{
		tempEffects[i] = window[jsonEffects[i]]
	}
	return new Effects(tempEffects)
}


//todo: better than that. Probably with a lazy approach.
for(var i = 0; i < 20; i++)
{
	getTable(i)
}