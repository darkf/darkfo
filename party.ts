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

// Party member system for DarkFO

class Party {
	// party members
	party: Critter[] = []

	addPartyMember(obj: Critter) {
		console.log("party member %o added", obj)
		this.party.push(obj)
	}

	removePartyMember(obj: Critter) {
		console.log("party member %o removed", obj)
		_.pull(this.party, obj)
	}

	getPartyMembers(): Critter[] {
		return this.party
	}

	getPartyMembersAndPlayer(): Critter[] {
		return [<Critter>player].concat(this.party)
	}

	isPartyMember(obj: Critter) {
		return _.includes(this.party, obj)
	}

	getPartyMemberByPID(pid: number) {
		return _.find(this.party, (obj: Critter) => obj.pid === pid) || null
	}
}

var gParty = new Party()
