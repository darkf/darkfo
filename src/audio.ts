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

// Audio engine for handling music and sound effects

"use strict";

interface AudioEngine {
    playSfx(sfx: string): void;
    playMusic(music: string): void;
    playSound(soundName: string): HTMLAudioElement|null;
    stopMusic(): void;
    stopAll(): void;
    tick(): void;
}

class NullAudioEngine implements AudioEngine {
    playSfx(sfx: string): void {}
    playMusic(music: string): void {}
    playSound(soundName: string): HTMLAudioElement|null { return null }
    stopMusic(): void {}
    stopAll(): void {}
    tick(): void {}
}

class HTMLAudioEngine implements AudioEngine {
    //lastSfxTime: number = 0
    nextSfxTime: number = 0
    nextSfx: string|null = null
    musicAudio: HTMLAudioElement|null = null

    playSfx(sfx: string): void {
        this.playSound("sfx/" + sfx)
    }

    playMusic(music: string): void {
        this.stopMusic()
        this.musicAudio = this.playSound("music/" + music)
    }

    playSound(soundName: string): HTMLAudioElement|null {
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
        const curMapInfo = getCurrentMapInfo()
        if(!curMapInfo)
            return ""

        const sfx = curMapInfo.ambientSfx
        const sumFreqs = sfx.reduce((sum: number, x: [string, number]) => sum + x[1], 0)
        let roll = getRandomInt(0, sumFreqs)

        for(var i = 0; i < sfx.length; i++) {
            var freq = sfx[i][1]

            if(roll >= freq)
                return sfx[i][0]

            roll -= freq
        }

        // XXX: What happens here when none roll?
        throw Error("shouldn't be here")
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