// src/data/materials.js

export const MATERIALS = {
  stone: {
    id: 'stone',
    name: 'Камень',
    hardness: 0.9,
    ricochetChance: 0.35,
    ricochetEnergyLoss: 0.6,
    penetrationResistance: 0.85
  },
  metal: {
    id: 'metal',
    name: 'Металл',
    hardness: 1.0,
    ricochetChance: 0.45,
    ricochetEnergyLoss: 0.55,
    penetrationResistance: 0.95
  },
  wood: {
    id: 'wood',
    name: 'Дерево',
    hardness: 0.5,
    ricochetChance: 0.2,
    ricochetEnergyLoss: 0.7,
    penetrationResistance: 0.45
  },
  foliage: {
    id: 'foliage',
    name: 'Листва',
    hardness: 0.1,
    ricochetChance: 0.03,
    ricochetEnergyLoss: 0.85,
    penetrationResistance: 0.1
  }
};

export function getMaterialForObstacle(logicType) {
  switch (logicType) {
    case 'rock_big':
    case 'rock_medium':
      return MATERIALS.stone;
    case 'tree_vertical':
    case 'tree_big':
    case 'tree_with_rock':
    case 'palm_vertical':
    case 'palm_big':
      return MATERIALS.wood;
    case 'bush_light':
    case 'bush_dense':
    case 'bush_wide':
    case 'cactus':
      return MATERIALS.foliage;
    default:
      return null;
  }
}