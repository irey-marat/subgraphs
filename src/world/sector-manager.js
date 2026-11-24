// src/world/sector-manager.js

import { SAFE_ZONE } from '../core/constants.js';

export class SectorManager {
  constructor(world) {
    this.world = world;
  }

  async switchSector(targetSectorId, entryGx, entryGy) {
    await this.world.transitionToSector(targetSectorId, entryGx, entryGy);
  }

  getNeighborSectors() {
    return this.world.transitionManager.getNeighborSectors(this.world.currentSectorId);
  }

  isSafeZone(gx, gy) {
    if (this.world.currentSectorId !== SAFE_ZONE.sectorId) return false;
    return Math.max(Math.abs(gx - SAFE_ZONE.gx), Math.abs(gy - SAFE_ZONE.gy)) <= SAFE_ZONE.radius;
  }
}