// src/data/items.js

export const CONSUMABLE_ITEMS = {
  medkit: {
    id: 'medkit',
    nameKey: 'item.medkit',
    type: 'heal',
    healAmount: 30,
    useTime: 0,
    weight: 0.5,
    invSize: [1, 1],
    spriteKey: 'medkit'
  },
  grenade_smoke: {
    id: 'grenade_smoke',
    nameKey: 'item.grenade_smoke',
    type: 'grenade',
    grenadeKind: 'smoke',
    radius: 3,
    duration: 5000,
    weight: 0.4,
    invSize: [1, 1],
    spriteKey: 'grenade_smoke'
  },
  grenade_frag: {
    id: 'grenade_frag',
    nameKey: 'item.grenade_frag',
    type: 'grenade',
    grenadeKind: 'frag',
    radius: 2,
    explosionDamage: 30,
    weight: 0.4,
    invSize: [1, 1],
    spriteKey: 'grenade_frag'
  }
};

export function getItemById(id) {
  return CONSUMABLE_ITEMS[id] || null;
}