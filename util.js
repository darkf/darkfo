// DarkFO
// Copyright (c) 2014 darkf
// Licensed under the terms of the zlib license

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
		if(tempSkill < 0) tempSkill = 0
		if(tempSkill > 95) tempSkill = 95
	}

	var roll = getRandomInt(0,100)
	return roll < tempSkill
}