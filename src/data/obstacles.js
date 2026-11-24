// src/data/obstacles.js

export const OBSTACLE_TYPES = {
  water:          { id: 'water',          size: [1,1], blocksMovement: true, visionBlock: 0.0, soundBlock: 0.0, obstacleResistance: 0.0, coverValue: 0.0 },
  rock_big:       { id: 'rock_big',       size: [1,1], blocksMovement: true, visionBlock: 1.0, soundBlock: 0.9, obstacleResistance: 0.9, coverValue: 0.9 },
  rock_medium:    { id: 'rock_medium',    size: [1,1], blocksMovement: true, visionBlock: 0.7, soundBlock: 0.5, obstacleResistance: 0.6, coverValue: 0.6 },
  bush_light:     { id: 'bush_light',     size: [1,1], blocksMovement: true, visionBlock: 0.2, soundBlock: 0.1, obstacleResistance: 0.1, coverValue: 0.1 },
  bush_dense:     { id: 'bush_dense',     size: [1,1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.2, obstacleResistance: 0.2, coverValue: 0.2 },
  bush_wide:      { id: 'bush_wide',      size: [2,1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.2, obstacleResistance: 0.2, coverValue: 0.2 },
  palm_vertical:  { id: 'palm_vertical',  size: [1,2], blocksMovement: true, visionBlock: 0.4, soundBlock: 0.3, obstacleResistance: 0.3, coverValue: 0.3 },
  tree_vertical:  { id: 'tree_vertical',  size: [1,2], blocksMovement: true, visionBlock: 0.5, soundBlock: 0.4, obstacleResistance: 0.4, coverValue: 0.4 },
  palm_big:       { id: 'palm_big',       size: [2,2], blocksMovement: true, visionBlock: 0.6, soundBlock: 0.5, obstacleResistance: 0.5, coverValue: 0.5 },
  tree_big:       { id: 'tree_big',       size: [2,2], blocksMovement: true, visionBlock: 0.7, soundBlock: 0.6, obstacleResistance: 0.6, coverValue: 0.6 },
  tree_with_rock: { id: 'tree_with_rock', size: [2,2], blocksMovement: true, visionBlock: 0.9, soundBlock: 0.8, obstacleResistance: 0.8, coverValue: 0.8 },
  grass:          { id: 'grass',          size: [1,1], blocksMovement: true, visionBlock: 0.0, soundBlock: 0.0, obstacleResistance: 0.0, coverValue: 0.0 },
  cactus:         { id: 'cactus',         size: [1,1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.1, obstacleResistance: 0.2, coverValue: 0.2 }
};

export const IMAGE_REGISTRY = {
  "rocks": "rock_big", "rocks_1": "rock_medium",
  "wood": "bush_dense", "wood_1": "bush_wide", "wood_2": "palm_vertical", "wood_3": "cactus",
  "wood_4": "bush_wide", "wood_5": "palm_big", "wood_6": "bush_light", "wood_7": "palm_big",
  "wood_8": "bush_light", "wood_9": "bush_dense", "wood_A": "bush_dense", "wood_B": "bush_dense",
  "wood_C": "palm_vertical", "wood_D": "tree_vertical", "wood_E": "palm_big", "wood_F": "bush_dense",
  "wood_G": "grass", "wood_H": "tree_vertical", "wood_I": "tree_big", "wood_J": "tree_with_rock",
  "wood_K": "tree_with_rock", "wood_L": "palm_vertical",
  "water": "water", "water_0": "water", "water_1": "water", "water_2": "water", "water_3": "water",
  "water_4": "water", "water_5": "water", "water_6": "water", "water_7": "water", "water_8": "water",
  "water_9": "water", "water_A": "water", "water_B": "water",
  "null_1": "grass", "null_2": "grass"
};

export const DIRECTIONS = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
];