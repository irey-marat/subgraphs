// src/game/loadout.js

import { Stats } from '../entities/stats.js';
import { Inventory } from '../entities/inventory.js';
import { WEAPONS } from '../data/weapons.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';

export function applyPlayerLoadout(entity) {
  entity.stats = new Stats(10, 10, 10, 10);
  entity.hp = entity.stats.maxHp;

  entity.inventory = new Inventory();
  entity.equipWeapon('tt33');
  entity.inventory.equip('secondary', { id: 'tt33', weight: WEAPONS.tt33.weight });

  // Пояс: аптечка, фугасная, дымовая (для теста)
  entity.inventory.setBelt(0, { ...CONSUMABLE_ITEMS.medkit });
  entity.inventory.setBelt(1, { ...CONSUMABLE_ITEMS.grenade_frag });
  entity.inventory.setBelt(2, { ...CONSUMABLE_ITEMS.grenade_smoke });

  entity.activeWeaponSlot = 'secondary';
  entity.currentWeaponId = 'tt33';
  entity.currentAmmo = WEAPONS.tt33.magazineSize;
  entity.isReloading = false;
  entity.reloadEndTime = 0;
  entity.recoil = 0;
  entity.suppression = 0;
  entity.currentBurstId = null;
}