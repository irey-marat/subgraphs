// src/world/poi.js

import { POI_TYPE, POI_STATE, POI_ALERT_TTL } from '../core/constants.js';

export class POIManager {
  constructor(world) {
    this.world = world;
    this.pois = new Map();
    this.nextId = 1;
  }

  create({ type, sectorId, gx, gy, radius = 2, capacity = 1, ttl = null, data = {} }) {
    const id = 'poi_' + (this.nextId++);
    const poi = {
      id, type, sectorId, gx, gy,
      radius, capacity, ttl,
      data,
      state: POI_STATE.ACTIVE,
      createdAt: performance.now()
    };
    this.pois.set(id, poi);
    return poi;
  }

  createLoot({ sectorId, gx, gy, items }) {
    return this.create({
      type: POI_TYPE.LOOT, sectorId, gx, gy,
      radius: 1, capacity: 1, ttl: null,
      data: { items }
    });
  }

  createAlert({ sectorId, gx, gy }) {
    const now = performance.now();
    for (const poi of this.pois.values()) {
      if (poi.type !== POI_TYPE.ALERT) continue;
      if (poi.state !== POI_STATE.ACTIVE) continue;
      if (poi.sectorId !== sectorId) continue;
      const dist = Math.max(Math.abs(poi.gx - gx), Math.abs(poi.gy - gy));
      if (dist <= poi.radius) {
        poi.createdAt = now;
        return poi;
      }
    }
    return this.create({
      type: POI_TYPE.ALERT, sectorId, gx, gy,
      radius: 3, capacity: 3, ttl: POI_ALERT_TTL,
      data: {}
    });
  }

  getById(id) {
    return this.pois.get(id);
  }

  getForSector(sectorId) {
    const out = [];
    for (const poi of this.pois.values()) {
      if (poi.sectorId === sectorId) out.push(poi);
    }
    return out;
  }

  getActiveForSector(sectorId) {
    return this.getForSector(sectorId).filter((p) => p.state === POI_STATE.ACTIVE);
  }

  markDepleted(poi) {
    poi.state = POI_STATE.DEPLETED;
  }

  expire(poi) {
    poi.state = POI_STATE.EXPIRED;
  }

  update(now) {
    for (const poi of this.pois.values()) {
      if (poi.state !== POI_STATE.ACTIVE) continue;
      if (poi.ttl !== null && now - poi.createdAt > poi.ttl) {
        poi.state = POI_STATE.EXPIRED;
      }
    }
    for (const [id, poi] of this.pois) {
      if (poi.state !== POI_STATE.ACTIVE) this.pois.delete(id);
    }
  }

  serialize() {
    const out = [];
    for (const poi of this.pois.values()) out.push(poi);
    return out;
  }

  deserialize(arr) {
    this.pois.clear();
    for (const poi of arr || []) this.pois.set(poi.id, poi);
  }
}