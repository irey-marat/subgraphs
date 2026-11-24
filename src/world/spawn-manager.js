// src/world/spawn-manager.js

import { SPAWN, POI_TYPE, SOUND_LOUDNESS } from '../core/constants.js';
import { BOT_PROFILES, BOT_PROFILE_WEIGHTS } from '../data/bots.js';

export class SpawnManager {
  constructor(world) {
    this.world = world;
    this.spawnPoints = [];
    this.lastSpawnTime = 0;
  }

  async loadAllSpawnPoints() {
    const keys = await this.world.db.getAllKeys('spawn_points');
    this.spawnPoints = [];
    for (const key of keys) {
      const data = await this.world.db.get('spawn_points', key);
      let points = [];
      if (Array.isArray(data)) points = data;
      else if (Array.isArray(data?.points)) points = data.points;
      for (const p of points) {
        this.spawnPoints.push({
          sectorId: p.sectorId !== undefined ? p.sectorId : Number(key),
          gx: p.gx,
          gy: p.gy,
          capacity: p.capacity || SPAWN.PER_SPAWN_POINT,
          profileWeights: p.profileWeights || BOT_PROFILE_WEIGHTS
        });
      }
    }
  }

  pickProfile(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = Math.random() * total;
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return BOT_PROFILES[k];
    }
    return BOT_PROFILES.assault;
  }

  countAliveBots() {
    let count = 0;
    for (const e of this.world.entities.values()) {
      if (!e.isPlayer && e.isAlive) count++;
    }
    return count;
  }

  update(now) {
    if (now - this.lastSpawnTime < SPAWN.SPAWN_COOLDOWN_MS) return;
    if (this.countAliveBots() >= SPAWN.POPULATION_THRESHOLD) return;
    if (this.spawnPoints.length === 0) return;

    const validPoints = this.spawnPoints.filter((sp) => sp.sectorId === this.world.currentSectorId);
    if (validPoints.length === 0) return;

    const sp = validPoints[Math.floor(Math.random() * validPoints.length)];

    if (!this.world.grid.isWalkable(sp.gx, sp.gy, null)) {
      console.warn('[SpawnManager] Spawn point not walkable, skipping:', sp);
      return;
    }

    const profile = this.pickProfile(sp.profileWeights);
    const spawned = this.world.spawnBot(this.world.currentSectorId, sp.gx, sp.gy, profile);
    if (spawned) this.lastSpawnTime = now;
  }
}