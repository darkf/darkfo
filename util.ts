/*
Copyright 2014 darkf, Stratege
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

// Utility functions

"use strict";

function parseIni(text: string) {
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

function getFileText(path: string, err?: () => void) {
	var r = null
	$.ajax(path, {async: false,
		          success: function(text) { r = text },
		          error: err || function() { throw "getFileText: error getting path " + path },
		          dataType: "text"})
	return r
}

function getFileJSON(path: string, err?: () => void) {
	var r = null
	$.ajax(path, {async: false,
		          success: function(text) { r = text },
		          error: err || function() { throw "getFileText: error getting path " + path },
		          dataType: "json"})
	return r
}

// GET binary data into a DataView
function getFileBinaryAsync(path: string, callback: (DataView) => void) {
	var xhr = new XMLHttpRequest()
	xhr.open("GET", path, true)
	xhr.responseType = "arraybuffer"
	xhr.onload = function(evt) { callback(new DataView(xhr.response)) }
	xhr.send(null)
}

function getFileBinarySync(path: string) {
	var xhr = new XMLHttpRequest()
	xhr.open("GET", path, false)
	// tell browser not to mess with the response
	xhr.overrideMimeType('text\/plain; charset=x-user-defined')
	xhr.send(null)
	if(xhr.status !== 200)
		throw "getFileBinarySync: got status " + xhr.status + " when requesting " + path

	// convert to ArrayBuffer, and then DataView
	var data = xhr.responseText
	var buffer = new ArrayBuffer(data.length)
	var arr = new Uint8Array(buffer)

	for(var i = 0; i < data.length; i++)
		arr[i] = data.charCodeAt(i) & 0xff

	return new DataView(buffer)
}

// Min inclusive, max inclusive
function getRandomInt(min: number, max: number) {
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

function rollVsSkill(who: Critter, skill: string, modifier: number=0) {
	var skillLevel = critterGetSkill(who, skill) + modifier
	var roll = skillLevel - getRandomInt(1, 100)

	if(roll <= 0) { // failure
		if((-roll)/10 > getRandomInt(1, 100))
			return 0 // critical failure
		return 1 // failure
	}
	else { // success
		var critChance = critterGetStat(who, "Critical Chance")
		if((roll/10 + critChance) > getRandomInt(1, 100))
			return 3 // critical success
		return 2 // success
	}
}

function rollIsSuccess(roll: number) {
	return (roll == 2) || (roll == 3)
}

function rollIsCritical(roll: number) {
	return (roll == 0) || (roll == 3)
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

function getMessage(name, id) {
	if(messageFiles[name] !== undefined && messageFiles[name][id] !== undefined)
		return messageFiles[name][id]
	else {
		loadMessage(name)
		if(messageFiles[name] !== undefined && messageFiles[name][id] !== undefined)
			return messageFiles[name][id]
		else null
	}
}

function getProtoMsg(id) {
	return getMessage("proto", id)
}

function pad(n: any, width: number, z?: string) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

class BinaryReader {
	data: DataView
	offset: number = 0
	length: number

	constructor(data: DataView) {
	    this.data = data
	    this.length = data.byteLength
	}

	seek(offset: number) { this.offset = offset }
	read8(): number { return this.data.getUint8(this.offset++) }
	read16(): number { var r = this.data.getUint16(this.offset); this.offset += 2; return r }
	read32(): number { var r = this.data.getUint32(this.offset); this.offset += 4; return r }
}

function assert(value: boolean, message: string) {
	if(!value)
		throw "AssertionError: " + message
}

function assertEq<T>(value: T, expected: T, message: string) {
	if(value !== expected)
		throw `AssertionError: value (${value}) does not match expected (${expected}): ${message}`
}
