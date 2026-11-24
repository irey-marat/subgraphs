// src/world/transitions.js

export class TransitionManager {
  constructor(db, world) {
    this.db = db;
    this.world = world;
    this.bySector = new Map();
  }

  async loadAll() {
    const keys = await this.db.getAllKeys('transitions');
    this.bySector.clear();
    for (const key of keys) {
      const t = await this.db.get('transitions', key);
      if (!t || !t.from || !t.to) continue;
      const fromSector = t.from.sectorId;
      if (!this.bySector.has(fromSector)) this.bySector.set(fromSector, []);
      this.bySector.get(fromSector).push(t);
    }
  }

  getForSector(sectorId) {
    return this.bySector.get(sectorId) || [];
  }

  getAt(sectorId, gx, gy) {
    const list = this.getForSector(sectorId);
    for (const t of list) {
      if (t.from.gx === gx && t.from.gy === gy) return t;
    }
    return null;
  }

  getNeighborSectors(sectorId) {
    const set = new Set();
    const list = this.getForSector(sectorId);
    for (const t of list) {
      if (t.to && t.to.sectorId !== sectorId) set.add(t.to.sectorId);
    }
    return Array.from(set);
  }
}