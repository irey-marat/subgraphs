// src/data/bots.js

export const BOT_PROFILES = {
  scout: {
    name: 'Scout',
    primaryWeapon: 'ppsh41',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_light', body: 'vest_light', legs: null, foot: 'boots' },
    stats: { health: 8, strength: 8, accuracy: 12, endurance: 12 },
    personality: { aggression: 0.6, caution: 0.5, discipline: 0.4, accuracySkill: 0.6, enduranceSkill: 0.6 }
  },
  assault: {
    name: 'Assault',
    primaryWeapon: 'ak47',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_medium', body: 'vest_medium', legs: 'pants_light', foot: 'boots' },
    stats: { health: 12, strength: 12, accuracy: 10, endurance: 10 },
    personality: { aggression: 0.8, caution: 0.4, discipline: 0.7, accuracySkill: 0.7, enduranceSkill: 0.5 }
  },
  heavy: {
    name: 'Heavy',
    primaryWeapon: 'pkm',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_heavy', body: 'vest_heavy', legs: 'pants_heavy', foot: 'boots' },
    stats: { health: 15, strength: 15, accuracy: 8, endurance: 8 },
    personality: { aggression: 0.9, caution: 0.3, discipline: 0.8, accuracySkill: 0.5, enduranceSkill: 0.4 }
  },
  sniper: {
    name: 'Sniper',
    primaryWeapon: 'svd',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_medium', body: 'vest_light', legs: null, foot: 'boots' },
    stats: { health: 8, strength: 8, accuracy: 15, endurance: 10 },
    personality: { aggression: 0.4, caution: 0.8, discipline: 0.9, accuracySkill: 0.9, enduranceSkill: 0.5 }
  },
  shotgun: {
    name: 'Shotgunner',
    primaryWeapon: 'saiga12',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_light', body: 'vest_medium', legs: null, foot: 'boots' },
    stats: { health: 10, strength: 10, accuracy: 8, endurance: 12 },
    personality: { aggression: 0.7, caution: 0.3, discipline: 0.5, accuracySkill: 0.5, enduranceSkill: 0.7 }
  },
  grenadier: {
    name: 'Grenadier',
    primaryWeapon: 'rocket_launcher',
    secondaryWeapon: 'tt33',
    armor: { head: 'helmet_medium', body: 'vest_heavy', legs: 'pants_light', foot: 'boots' },
    stats: { health: 10, strength: 12, accuracy: 8, endurance: 8 },
    personality: { aggression: 0.5, caution: 0.6, discipline: 0.7, accuracySkill: 0.5, enduranceSkill: 0.4 }
  }
};

export const BOT_PROFILE_WEIGHTS = {
  scout: 1,
  assault: 1,
  heavy: 1,
  sniper: 1,
  shotgun: 1,
  grenadier: 1
};