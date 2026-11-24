// src/data/armor.js

export const ARMOR_ITEMS = {
  helmet_light: {
    id: 'helmet_light', nameKey: 'armor.helmet_light',
    slot: 'head', armorClass_mm: 2.0, coverage: ['head'],
    weight: 5, spriteKey: 'helmet_1',
    invSize: [1, 1]
  },
  helmet_medium: {
    id: 'helmet_medium', nameKey: 'armor.helmet_medium',
    slot: 'head', armorClass_mm: 4.0, coverage: ['head'],
    weight: 8, spriteKey: 'helmet_2',
    invSize: [1, 1]
  },
  helmet_heavy: {
    id: 'helmet_heavy', nameKey: 'armor.helmet_heavy',
    slot: 'head', armorClass_mm: 6.0, coverage: ['head'],
    weight: 12, spriteKey: 'helmet_3',
    invSize: [1, 1]
  },
  vest_light: {
    id: 'vest_light', nameKey: 'armor.vest_light',
    slot: 'body', armorClass_mm: 3.0, coverage: ['torso', 'arms'],
    weight: 10, spriteKey: 'vest_1',
    invSize: [2, 2]
  },
  vest_medium: {
    id: 'vest_medium', nameKey: 'armor.vest_medium',
    slot: 'body', armorClass_mm: 5.0, coverage: ['torso', 'arms'],
    weight: 15, spriteKey: 'vest_2',
    invSize: [2, 2]
  },
  vest_heavy: {
    id: 'vest_heavy', nameKey: 'armor.vest_heavy',
    slot: 'body', armorClass_mm: 7.0, coverage: ['torso', 'arms'],
    weight: 20, spriteKey: 'vest_3',
    invSize: [2, 2]
  },
  pants_light: {
    id: 'pants_light', nameKey: 'armor.pants_light',
    slot: 'legs', armorClass_mm: 2.0, coverage: ['legs'],
    weight: 6, spriteKey: 'pants_1',
    invSize: [2, 1]
  },
  pants_heavy: {
    id: 'pants_heavy', nameKey: 'armor.pants_heavy',
    slot: 'legs', armorClass_mm: 4.0, coverage: ['legs'],
    weight: 9, spriteKey: 'pants_2',
    invSize: [2, 1]
  },
  boots: {
    id: 'boots', nameKey: 'armor.boots',
    slot: 'foot', armorClass_mm: 1.5, coverage: ['feet'],
    weight: 3, spriteKey: 'boots_1',
    invSize: [1, 1]
  }
};

export const HIT_ZONES = {
  head:  { id: 'head',  nameKey: 'zone.head',  chance: 0.08, multiplier: 3.0, armorSlot: 'head' },
  torso: { id: 'torso', nameKey: 'zone.torso', chance: 0.45, multiplier: 1.0, armorSlot: 'body' },
  arms:  { id: 'arms',  nameKey: 'zone.arms',  chance: 0.17, multiplier: 0.7, armorSlot: 'body' },
  legs:  { id: 'legs',  nameKey: 'zone.legs',  chance: 0.20, multiplier: 0.6, armorSlot: 'legs' },
  feet:  { id: 'feet',  nameKey: 'zone.feet',  chance: 0.10, multiplier: 0.4, armorSlot: 'foot' }
};

export function rollHitZone() {
  const roll = Math.random();
  let cumulative = 0;
  for (const zone of Object.values(HIT_ZONES)) {
    cumulative += zone.chance;
    if (roll < cumulative) return zone;
  }
  return HIT_ZONES.torso;
}