class AudioEngine {
	//lastSfxTime: number = 0
	nextSfxTime: number = 0
	nextSfx: string = null
	musicAudio: HTMLAudioElement = null

	playSfx(sfx: string): void {
		this.playSound("sfx/" + sfx)
	}

	playMusic(music: string): void {
		this.stopMusic()
		this.musicAudio = this.playSound("music/" + music)
	}

	playSound(soundName: string): HTMLAudioElement {
		var sound = new Audio()
		sound.addEventListener("loadeddata", () => sound.play(), false)
		sound.src = "audio/" + soundName + ".wav"
		return sound
	}

	stopMusic(): void {
		if(this.musicAudio)
			this.musicAudio.pause()
	}

	stopAll(): void {
		this.nextSfxTime = 0
		this.nextSfx = null
		this.stopMusic()
	}

	rollNextSfx(): string {
		// Randomly obtain the next map sfx
		var curMapInfo = getCurrentMapInfo()
		if(!curMapInfo)
			return ""

		var sfx = curMapInfo.ambientSfx
		var sumFreqs = _.sum(sfx, x => x[1])
		var roll = getRandomInt(0, sumFreqs)

		for(var i = 0; i < sfx.length; i++) {
			var freq = sfx[i][1]

			if(roll >= freq)
				return sfx[i][0]

			roll -= freq
		}
	}

	tick(): void {
		var time = heart.timer.getTime()

		if(!this.nextSfx)
			this.nextSfx = this.rollNextSfx()

		if(time >= this.nextSfxTime) {
			// play next sfx in queue
			this.playSfx(this.nextSfx)

			// queue up next sfx
			this.nextSfx = this.rollNextSfx()
			this.nextSfxTime = time + getRandomInt(15, 20)*1000
		}
	}
}