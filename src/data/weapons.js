// src/data/weapons.js

export const WEAPONS = {
  tt33: {
    id: 'tt33', nameKey: 'weapon.tt33', ammoId: 'pistol', spriteType: 7, spriteKey: 'tt33',
    slot: 'secondary', v0_scale: 1.00, range: 5, accuracy: 0.90, fireRate: 380,
    burstCount: 1, burstInterval: 0, preferredDistance: 4,
    weight: 3, magazineSize: 8, reloadTime: 1300,
    recoilPerShot: 0.10, recoilRecovery: 0.11, maxRecoil: 0.35, recoilSpreadMultiplier: 0.35,
    aimTime: 200, movementPenalty: 0.35, firstShotMultiplier: 1.10,
    recoveryDelay: 120, bloomPerShot: 0.03, bloomMax: 0.25, bloomRecovery: 0.7
  },
  ppsh41: {
    id: 'ppsh41', nameKey: 'weapon.ppsh41', ammoId: 'pistol', spriteType: 6, spriteKey: 'ppsh41',
    slot: 'primary', v0_scale: 1.10, range: 8, accuracy: 0.70, fireRate: 100,
    burstCount: 5, burstInterval: 45, preferredDistance: 6,
    weight: 8, magazineSize: 35, reloadTime: 2200,
    recoilPerShot: 0.15, recoilRecovery: 0.09, maxRecoil: 0.60, recoilSpreadMultiplier: 0.60,
    aimTime: 280, movementPenalty: 0.55, firstShotMultiplier: 1.05,
    recoveryDelay: 180, bloomPerShot: 0.04, bloomMax: 0.45, bloomRecovery: 0.55
  },
  ak47: {
    id: 'ak47', nameKey: 'weapon.ak47', ammoId: 'rifle', spriteType: 3, spriteKey: 'ak47',
    slot: 'primary', v0_scale: 1.00, range: 12, accuracy: 0.78, fireRate: 160,
    burstCount: 3, burstInterval: 55, preferredDistance: 8,
    weight: 10, magazineSize: 30, reloadTime: 2100,
    recoilPerShot: 0.18, recoilRecovery: 0.07, maxRecoil: 1.10, recoilSpreadMultiplier: 0.85,
    aimTime: 320, movementPenalty: 0.60, firstShotMultiplier: 1.15,
    recoveryDelay: 200, bloomPerShot: 0.05, bloomMax: 0.60, bloomRecovery: 0.50
  },
  pkm: {
    id: 'pkm', nameKey: 'weapon.pkm', ammoId: 'heavy', spriteType: 2, spriteKey: 'pkm',
    slot: 'primary', v0_scale: 0.99, range: 13, accuracy: 0.70, fireRate: 145,
    burstCount: 3, burstInterval: 60, preferredDistance: 10,
    weight: 15, magazineSize: 100, reloadTime: 3200,
    recoilPerShot: 0.25, recoilRecovery: 0.04, maxRecoil: 1.40, recoilSpreadMultiplier: 1.00,
    aimTime: 380, movementPenalty: 0.70, firstShotMultiplier: 1.05,
    recoveryDelay: 250, bloomPerShot: 0.07, bloomMax: 0.80, bloomRecovery: 0.40
  },
  svd: {
    id: 'svd', nameKey: 'weapon.svd', ammoId: 'heavy', spriteType: 4, spriteKey: 'svd',
    slot: 'primary', v0_scale: 1.00, range: 15, accuracy: 0.95, fireRate: 1200,
    burstCount: 1, burstInterval: 0, preferredDistance: 12,
    weight: 12, magazineSize: 10, reloadTime: 2400,
    recoilPerShot: 0.45, recoilRecovery: 0.04, maxRecoil: 1.10, recoilSpreadMultiplier: 0.90,
    aimTime: 500, movementPenalty: 0.85, firstShotMultiplier: 1.30,
    recoveryDelay: 350, bloomPerShot: 0.09, bloomMax: 0.70, bloomRecovery: 0.35
  },
  saiga12: {
    id: 'saiga12', nameKey: 'weapon.saiga12', ammoId: 'pellet', spriteType: 1, spriteKey: 'saiga12',
    slot: 'primary', v0_scale: 0.95, range: 5, accuracy: 0.65, fireRate: 850,
    burstCount: 1, burstInterval: 0, preferredDistance: 4,
    weight: 9, magazineSize: 8, reloadTime: 2600,
    recoilPerShot: 0.22, recoilRecovery: 0.11, maxRecoil: 0.65, recoilSpreadMultiplier: 0.45,
    aimTime: 250, movementPenalty: 0.75, firstShotMultiplier: 1.05,
    recoveryDelay: 200, bloomPerShot: 0.06, bloomMax: 0.55, bloomRecovery: 0.55
  },
  rocket_launcher: {
    id: 'rocket_launcher', nameKey: 'weapon.rocket_launcher', ammoId: 'rocket', spriteType: 5, spriteKey: 'rocket_launcher',
    slot: 'primary', v0_scale: 1.00, range: 12, accuracy: 0.75, fireRate: 3500,
    burstCount: 1, burstInterval: 0, preferredDistance: 10,
    weight: 18, magazineSize: 1, reloadTime: 4500,
    recoilPerShot: 0.50, recoilRecovery: 0.03, maxRecoil: 1.20, recoilSpreadMultiplier: 1.00,
    aimTime: 450, movementPenalty: 0.90, firstShotMultiplier: 1.20,
    recoveryDelay: 400, bloomPerShot: 0.10, bloomMax: 0.90, bloomRecovery: 0.30
  }
};