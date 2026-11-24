// src/world/los-cache.js

import { BALLISTICS } from '../data/ballistics.js';

export class LOSCache {
  constructor() {
    this.cache = new Map();
    this.ttl = BALLISTICS.LOS_CACHE_TTL_MS;
    this.maxSize = BALLISTICS.LOS_CACHE_MAX_SIZE;
  }

  _key(x0, y0, x1, y1) {
    return x0 + ',' + y0 + ',' + x1 + ',' + y1;
  }

  get(x0, y0, x1, y1, now) {
    const key = this._key(x0, y0, x1, y1);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (now - entry.time > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.visible;
  }

  set(x0, y0, x1, y1, visible, now) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(this._key(x0, y0, x1, y1), { visible, time: now });
  }

  hasLineOfSight(grid, x0, y0, x1, y1, now) {
    const cached = this.get(x0, y0, x1, y1, now);
    if (cached !== null) return cached;
    const visible = grid.hasLineOfSight(x0, y0, x1, y1);
    this.set(x0, y0, x1, y1, visible, now);
    return visible;
  }

  clear() {
    this.cache.clear();
  }
}