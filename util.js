/*
Copyright 2014 darkf, Stratege

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

// Utility functions

function parseIni(text) {
	// Parse a .ini-style categorized key-value format
	var lines = text.split('\n')
	var category = null
	var ini = {}

	for(var i = 0; i < lines.length; i++) {
		var line = lines[i].replace(/\s*;.*/, "") // replace comments
		if(line.trim() === '') { }
		else if(line[0] === '[')
			category = line.trim().slice(1, -1)
		else {
			// key=value
			var kv = line.match(/(.+?)=(.+)/)
			if(kv === null) { // MAPS.TXT has one of these, so it's not an exception
				console.log("warning: parseIni: not a key=value line: " + line)
				continue
			}
			if(category === null) throw "parseIni: key=value not in category: " + line

			if(ini[category] === undefined) ini[category] = {}
			ini[category][kv[1]] = kv[2]
		}
	}

	return ini
}

function getFileText(path, err) {
	var r = null
	$.ajax(path, {async: false,
		          success: function(text) { r = text },
		          error: err || function() { throw "getFileText: error getting path " + path },
		          dataType: "text"})
	return r
}

function getFileJSON(path, err) {
	var r = null
	$.ajax(path, {async: false,
		          success: function(text) { r = text },
		          error: err || function() { throw "getFileText: error getting path " + path },
		          dataType: "json"})
	return r
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

function rollSkillCheck(skill, modifier, isBounded) {
	var tempSkill = skill + modifier
	if(isBounded === true) {
		clamp(0,95,tempSkill)
	}

	var roll = getRandomInt(0,100)
	return roll < tempSkill
}

function arrayRemove(array, value)
{
	var index = array.indexOf(value)
	if(index !== -1)
	{
		array.splice(index,1)
		return true
	}
	return false
}

function clamp(min, max, value)
{
	return Math.max(min,Math.min(max,value))
}