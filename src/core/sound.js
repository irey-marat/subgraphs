// src/core/sound.js

import { SOUND_MAX_AGE, SOUND_MAX_RANGE } from './constants.js';

export class SoundManager {
  constructor(world) {
    this.world = world;
    this.soundEvents = [];
  }

  emitSound(gx, gy, loudness, type, source) {
    this.soundEvents.push({
      gx, gy, loudness, type, source,
      time: performance.now()
    });
  }

  getSoundAt(targetGx, targetGy, now) {
    this.soundEvents = this.soundEvents.filter((s) => now - s.time < SOUND_MAX_AGE);
    let loudest = null;
    for (let i = 0; i < this.soundEvents.length; i++) {
      const sound = this.soundEvents[i];
      const dx = sound.gx - targetGx;
      const dy = sound.gy - targetGy;
      const distance = Math.hypot(dx, dy);
      if (distance > SOUND_MAX_RANGE) continue;
      let heardLoudness = sound.loudness * (1 - distance / SOUND_MAX_RANGE);
      const attenuation = this.world.grid.getSoundAttenuation(sound.gx, sound.gy, targetGx, targetGy);
      heardLoudness *= attenuation;
      if (heardLoudness > 0.05 && (loudest === null || heardLoudness > loudest.heardLoudness)) {
        loudest = {
          gx: sound.gx, gy: sound.gy,
          loudness: sound.loudness,
          heardLoudness,
          type: sound.type,
          source: sound.source
        };
      }
    }
    return loudest;
  }

  getActiveSounds() {
    const now = performance.now();
    return this.soundEvents.filter((s) => now - s.time < 500);
  }

  clear() {
    this.soundEvents = [];
  }
}