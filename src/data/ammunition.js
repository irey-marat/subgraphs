// src/data/ammunition.js

export const AMMUNITION_TYPES = {
  pistol: {
    id: 'pistol',
    nameKey: 'ammo.pistol',
    caliber_mm: 9.0,
    mass_g: 6.0,
    v0_mps: 420,
    dragPerCell: 0.035,
    penetrationBase_mm: 3.0,
    isRocket: false,
    explosiveMass_g: 0,
    pellets: 1,
    shape: 'oval',
    size: [4, 2],
    color: '#D2691E'
  },
  rifle: {
    id: 'rifle',
    nameKey: 'ammo.rifle',
    caliber_mm: 5.45,
    mass_g: 10.0,
    v0_mps: 715,
    dragPerCell: 0.025,
    penetrationBase_mm: 5.0,
    isRocket: false,
    explosiveMass_g: 0,
    pellets: 1,
    shape: 'oval',
    size: [6, 3],
    color: '#797979'
  },
  heavy: {
    id: 'heavy',
    nameKey: 'ammo.heavy',
    caliber_mm: 7.62,
    mass_g: 12.0,
    v0_mps: 830,
    dragPerCell: 0.020,
    penetrationBase_mm: 7.0,
    isRocket: false,
    explosiveMass_g: 0,
    pellets: 1,
    shape: 'oval',
    size: [8, 4],
    color: '#B8860B'
  },
  pellet: {
    id: 'pellet',
    nameKey: 'ammo.pellet',
    caliber_mm: 18.5,
    mass_g: 3.5,
    v0_mps: 400,
    dragPerCell: 0.060,
    penetrationBase_mm: 1.5,
    isRocket: false,
    explosiveMass_g: 0,
    pellets: 10,
    shape: 'circle',
    size: 2,
    color: '#76888f'
  },
  rocket: {
    id: 'rocket',
    nameKey: 'ammo.rocket',
    caliber_mm: 85,
    mass_g: 2500,
    v0_mps: 300,
    dragPerCell: 0.005,
    penetrationBase_mm: 200,
    isRocket: true,
    explosiveMass_g: 1000,
    explosionRadius: 3,
    shrapnelCount: 8,
    shrapnelRange: 4,
    pellets: 1,
    shape: 'oval',
    size: [12, 3],
    color: '#4a4a4a'
  }
};

export const CHARACTER_SPRITE_KEYS = {
  1: 'charwt_1',
  2: 'charwt_2',
  3: 'charwt_3',
  4: 'charwt_4',
  5: 'charwt_5',
  6: 'charwt_6',
  7: 'charwt_7'
};

export function getWeaponById(id, WEAPONS) {
  return WEAPONS[id] || null;
}

export function getCharacterSpriteKey(weaponId, WEAPONS) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return 'charwt_3';
  return CHARACTER_SPRITE_KEYS[weapon.spriteType] || 'charwt_3';
}