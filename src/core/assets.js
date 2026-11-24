// src/core/assets.js

import { getCharacterSpriteKey } from '../data/ammunition.js';
import { WEAPONS } from '../data/weapons.js';
import { TERRAIN_SPRITE_KEY, GLOBAL_MAP_SPRITE_KEY } from './constants.js';

export class AssetManager {
  constructor(db) {
    this.db = db;
    this.images = new Map();
    this.failed = new Set();
  }

  async loadSprite(name) {
    if (!name || typeof name !== 'string') return null;
    name = name.trim();
    if (this.images.has(name)) return this.images.get(name);
    if (this.failed.has(name)) return null;
    try {
      const blob = await this.db.get('sprites', name);
      if (!blob) { this.failed.add(name); return null; }
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = () => { this.images.set(name, img); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); this.failed.add(name); reject(); };
      });
      return this.images.get(name);
    } catch {
      this.failed.add(name);
      return null;
    }
  }

  getImage(name) {
    return name ? this.images.get(name.trim()) : null;
  }

  getCharSprite(weaponId) {
    const key = getCharacterSpriteKey(weaponId, WEAPONS);
    return this.images.get(key);
  }

  async preloadLevel(sector) {
    const keys = new Set();
    keys.add(TERRAIN_SPRITE_KEY);
    for (const spriteKey of Object.values(sector.obstacles || {})) {
      keys.add(String(spriteKey).trim());
    }
    for (let i = 1; i <= 7; i++) keys.add('charwt_' + i);
    await Promise.all(Array.from(keys).map((k) => this.loadSprite(k)));
  }

  async loadGlobalMap() {
    return this.loadSprite(GLOBAL_MAP_SPRITE_KEY);
  }
}