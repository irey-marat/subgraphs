// src/entities/inventory.js

import { ARMOR_ITEMS } from '../data/armor.js';
import { WEAPONS } from '../data/weapons.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';

const GRID_W = 10;
const GRID_H = 4;
const BELT_SLOTS = 4;

export class Inventory {
  constructor() {
    this.slots = {
      weapon: null,
      secondary: null,
      head: null,
      body: null,
      legs: null,
      foot: null
    };
    this.grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(null));
    this.belt = new Array(BELT_SLOTS).fill(null);
  }

  // ---- Слоты экипировки ----

  equip(slot, item) {
    if (!this.slots.hasOwnProperty(slot)) return false;
    this.slots[slot] = item;
    return true;
  }

  unequip(slot) {
    if (!this.slots.hasOwnProperty(slot)) return null;
    const item = this.slots[slot];
    this.slots[slot] = null;
    return item;
  }

  getWeapon() { return this.slots.weapon; }
  getSecondary() { return this.slots.secondary; }

  // ---- Сетка ----

  _sizeOf(item) {
    if (!item) return [1, 1];
    const def = WEAPONS[item.id] || ARMOR_ITEMS[item.id] || CONSUMABLE_ITEMS[item.id];
    if (def && def.invSize) return def.invSize;
    return [1, 1];
  }

  canPlace(item, gx, gy) {
    const [w, h] = this._sizeOf(item);
    if (gx < 0 || gy < 0 || gx + w > GRID_W || gy + h > GRID_H) return false;
    for (let y = gy; y < gy + h; y++) {
      for (let x = gx; x < gx + w; x++) {
        if (this.grid[y][x]) return false;
      }
    }
    return true;
  }

  place(item, gx, gy) {
    if (!this.canPlace(item, gx, gy)) return false;
    const [w, h] = this._sizeOf(item);
    const entry = { item, gx, gy, w, h };
    for (let y = gy; y < gy + h; y++) {
      for (let x = gx; x < gx + w; x++) {
        this.grid[y][x] = entry;
      }
    }
    return true;
  }

  findFreeSpot(item) {
    const [w, h] = this._sizeOf(item);
    for (let y = 0; y <= GRID_H - h; y++) {
      for (let x = 0; x <= GRID_W - w; x++) {
        if (this.canPlace(item, x, y)) return { gx: x, gy: y };
      }
    }
    return null;
  }

  addToGrid(item) {
    const spot = this.findFreeSpot(item);
    if (!spot) return false;
    return this.place(item, spot.gx, spot.gy);
  }

  removeFromGrid(gx, gy) {
    const entry = this.grid[gy] && this.grid[gy][gx];
    if (!entry) return null;
    for (let y = entry.gy; y < entry.gy + entry.h; y++) {
      for (let x = entry.gx; x < entry.gx + entry.w; x++) {
        this.grid[y][x] = null;
      }
    }
    return entry.item;
  }

  // ---- Пояс ----

  setBelt(index, item) {
    if (index < 0 || index >= BELT_SLOTS) return false;
    this.belt[index] = item;
    return true;
  }

  getBelt(index) {
    return this.belt[index] || null;
  }

  useBelt(index) {
    const item = this.belt[index];
    if (!item) return null;
    this.belt[index] = null;
    return item;
  }

  // ---- Утилиты ----

  countConsumable(id) {
    let count = 0;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const entry = this.grid[y][x];
        if (entry && entry.gx === x && entry.gy === y && entry.item.id === id) count++;
      }
    }
    for (const b of this.belt) if (b && b.id === id) count++;
    return count;
  }

  removeConsumable(id, count) {
    let removed = 0;
    for (let i = 0; i < BELT_SLOTS && removed < count; i++) {
      if (this.belt[i] && this.belt[i].id === id) { this.belt[i] = null; removed++; }
    }
    for (let y = 0; y < GRID_H && removed < count; y++) {
      for (let x = 0; x < GRID_W && removed < count; x++) {
        const entry = this.grid[y][x];
        if (entry && entry.gx === x && entry.gy === y && entry.item.id === id) {
          this.removeFromGrid(x, y);
          removed++;
        }
      }
    }
    return removed;
  }

  totalWeight() {
    let w = 0;
    for (const slot of Object.values(this.slots)) {
      if (slot && slot.weight !== undefined) w += slot.weight;
    }
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const e = this.grid[y][x];
        if (e && e.gx === x && e.gy === y && e.item.weight !== undefined) w += e.item.weight;
      }
    }
    return w;
  }

  serialize() {
    return {
      slots: this.slots,
      grid: this.grid,
      belt: this.belt
    };
  }

  static deserialize(data) {
    const inv = new Inventory();
    if (data.slots) inv.slots = data.slots;
    if (data.grid) inv.grid = data.grid;
    if (data.belt) inv.belt = data.belt;
    return inv;
  }
}

export { GRID_W, GRID_H, BELT_SLOTS };