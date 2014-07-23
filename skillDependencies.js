var Skill = function(_startvalue, _dependencies){
	this.Startvalue = _startvalue
	this.Dependencies = _dependencies
}

var Dependency = function(_statType, _multiplicator){
	this.StatType = _statType
	this.Multiplicator = _multiplicator
}

//FO2 specific, FO1 uses its own, possibly extracting this to an outside file that is loaded in would thus make sense
var skillDependencies = {};
skillDependencies['Small Guns'] = new Skill(5, [new Dependency('AGI', 4)])
skillDependencies['Big Guns'] = new Skill(0, [new Dependency('AGI', 2)])
skillDependencies['Energy Weapons'] = new Skill(0, [new Dependency('AGI',2)])
skillDependencies['Unarmed'] = new Skill(30, [new Dependency('AGI', 2), new Dependency('STR',2)])
skillDependencies['Melee Weapons'] = new Skill(20, [new Dependency('AGI',2), new Dependency('STR',2)])
skillDependencies['Throwing'] = new Skill(0, [new Dependency('AGI',4)])
skillDependencies['First Aid'] = new Skill(0, [new Dependency('PER',2), new Dependency('INT',2)])
skillDependencies['Doctor'] = new Skill(5, [new Dependency('PER',1), new Dependency('INT',1)])
skillDependencies['Sneak'] = new Skill(5, [new Dependency('AGI',3)])
skillDependencies['Lockpick'] = new Skill(10, [new Dependency('PER',1), new Dependency('AGI',1)])
skillDependencies['Steal'] = new Skill(0, [new Dependency('AGI',3)])
skillDependencies['Traps'] = new Skill(10, [new Dependency('PER',1), new Dependency('AGI',1)])
skillDependencies['Science'] = new Skill(0, [new Dependency('INT',4)])
skillDependencies['Repair'] = new Skill(0, [new Dependency('INT',3)])
skillDependencies['Speech'] = new Skill(0, [new Dependency('CHA',5)])
skillDependencies['Barter'] = new Skill(0, [new Dependency('CHA',4)])
skillDependencies['Gambling'] = new Skill(5, [new Dependency('LUK',5)])
skillDependencies['Outdoorsman'] = new Skill(0, [new Dependency('END',2), new Dependency('INT',2)])


var Stat = function(_min, _max, _default, _dependencies) {
	this.Min = _min
	this.Max = _max
	this.Default = _default
	this.Dependencies = _dependencies
}

var statDependencies = {};
statDependencies['STR'] = new Stat(1, 10, 5, [])
statDependencies['PER'] = new Stat(1, 10, 5, [])
statDependencies['END'] = new Stat(1, 10, 5, [])
statDependencies['CHA'] = new Stat(1, 10, 5, [])
statDependencies['INT'] = new Stat(1, 10, 5, [])
statDependencies['AGI'] = new Stat(1, 10, 5, [])
statDependencies['LUK'] = new Stat(1, 10, 5, [])

statDependencies['Max HP'] = new Stat(0, 999, 0, [])
statDependencies['AP'] = new Stat(1, 99, 0, [new Dependency('One', 5), new Dependency('AGI', 0.5)])
statDependencies['AC'] = new Stat(0, 999, 0, [new Dependency('AGI', 1)])
statDependencies['Melee'] = new Stat(1, 500, 0, [new Dependency('One', -5), new Dependency('STR', 1)])
statDependencies['Carry'] = new Stat(0, 999, 0, [new Dependency('One', 25), new Dependency('STR', 25)])
statDependencies['Sequence'] = new Stat(0, 60, 0, [new Dependency('PER', 2)])
statDependencies['Healing Rate'] = new Stat(1, 30, 0, [new Dependency('END', 1/3)])
statDependencies['Critical Chance'] = new Stat(0, 100, 0, [new Dependency('LUK',1)])
statDependencies['Better Criticals'] = new Stat(-60, 100, 0,[])
statDependencies['DT EMP'] = new Stat(0, 100, 0, [])
statDependencies['DT Electrical'] = new Stat(0, 100, 0, [])
statDependencies['DT Explosive'] = new Stat(0, 100, 0, [])
statDependencies['DT Fire'] = new Stat(0, 100, 0, [])
statDependencies['DT Laser'] = new Stat(0, 100, 0, [])
statDependencies['DT Normal'] = new Stat(0, 100, 0, [])
statDependencies['DT Plasma'] = new Stat(0, 100, 0, [])
statDependencies['DR EMP'] = new Stat(0, 100, 0, [])
statDependencies['DR Electrical'] = new Stat(0, 90, 0, [])
statDependencies['DR Explosive'] = new Stat(0, 90,0,[])
statDependencies['DR Fire'] = new Stat(0, 90, 0, [])
statDependencies['DR Laser'] = new Stat(0, 90, 0, [])
statDependencies['DR Normal'] = new Stat(0, 90, 0, [])
statDependencies['DR Plasma'] = new Stat(0, 90, 0, [])
statDependencies['DR Radiation'] = new Stat(0, 95, 0, [new Dependency('END', 2)])
statDependencies['DR Poison'] = new Stat(0, 95, 0, [new Dependency('END', 5)])
statDependencies['Age'] = new Stat(16, 101, 25, [])
statDependencies['Gender'] = new Stat(0, 1, 0, [])
//todo: figure out HP.
statDependencies['HP'] = new Stat(0, 999, 1, [])
statDependencies['Poison Level'] = new Stat(0, 2000, 0, [])
statDependencies['Radiation Level'] = new Stat(0, 2000, 0, [])
statDependencies['Skill Points'] = new Stat(0, 999999, 0, [])
statDependencies['Level'] = new Stat(1, 99, 1, [])
statDependencies['Experience'] = new Stat(0, 99999999, 0, [])
statDependencies['Reputation'] = new Stat(-20, 20, 0, [])
statDependencies['Karma'] = new Stat(-99999999, 99999999, 0, [])


//all the weird pseudo stats
statDependencies['Party Limit'] = new Stat(0, 5, 0, [new Dependency('CHA', 0.5)])
statDependencies['Skill Rate'] = new Skill(0, 2^31-1, 0, [new Dependency('IN', 2), new Dependency('One', 5)])
statDependencies['Perk Rate'] = new Skill(1, 2^31-1, 0, [new Dependency('One', 3)])

//helper
statDependencies['One'] = new Stat(1, 1, 1, [])

//FO2 specific, in FO1 it's always 1
function getImprovementCost(obj, skill) {
	var skillPoints = critterGetSkill(obj, skill)
	if(skillPoints == null)
		return null
	
	if(skillPoints<101)
		return 1
	else if(skillPoints<126)
		return 2
	else if(skillPoints<151)
		return 3
	else if(skillPoints<176)
		return 4
	else if(skillPoints<201)
		return 5
	else if(skillPoints<301)
		return 6
	else
		return 2^31
}

Skill.prototype.calculateValue = function(obj)
{
	var addedValue = 0
	for(var i = 0; i < this.Dependencies.length; i++)
	{
		var stat = critterGetStat(obj,this.Dependencies[i].StatType)
		if(stat !== undefined)
			addedValue += Math.floor(stat * this.Dependencies[i].Multiplicator)
	}
	return (this.Startvalue + addedValue)
} 


function calculateStatValueAddition(obj, stat)
{
	var statDependency = statDependencies[stat]
	var addedValue = 0
	if(statDependency === undefined)
	{
		console.log('Stat dependency not found: ' + stat)
		return 0
	}
	for(var i = 0; i < statDependency.Dependencies.length; i++)
	{
		var stat = critterGetStat(obj,statDependency.Dependencies[i].StatType)
		if(stat !== undefined)
			addedValue += Math.floor(stat * statDependency.Dependencies[i].Multiplicator)
	}
	return addedValue
}
