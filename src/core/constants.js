// src/core/constants.js

export const CELL_SIZE = 36;
export const VIEW_W = 25;
export const VIEW_H = 25;
export const CAMERA_MARGIN = 4;
export const MOVE_COOLDOWN = 0.15;

export const MINIMAP_PX_PER_CELL = 2;
export const MINIMAP_SIZE = 98 * MINIMAP_PX_PER_CELL;

export const GLOBAL_MAP_CELL_PX = 98;
export const GLOBAL_MAP_SIZE = 7;

export const BOT_TURN_DELAY_MS = 200;
export const SPRITE_ANGLE_OFFSET = 0;

export const SAFE_ZONE = { gx: 34, gy: 36, sectorId: 1010, radius: 14 };

export const TERRAIN_SPRITE_KEY = 'terrain';
export const GLOBAL_MAP_SPRITE_KEY = 'global_map';

export const MAX_PROJECTILES = 100;
export const RESPAWN_DELAY = 3000;
export const INVULNERABLE_AFTER_RESPAWN = 1500;

export const SOUND_MAX_AGE = 1000;
export const SOUND_MAX_RANGE = 25;
export const SOUND_LOUDNESS = {
  pistol: 0.5,
  rifle: 0.7,
  heavy: 0.8,
  pellet: 0.4,
  rocket: 1.0,
  explosion: 1.0,
  footstep: 0.1
};

export const SUPPRESSION_GAIN = 0.15;
export const SUPPRESSION_DECAY = 0.1;
export const SUPPRESSION_NEAR_RADIUS = 2;
export const SHOOTING_THRESHOLD = 0.3;

export const AI_STATE = {
  PATROL: 'patrol',
  ALERT: 'alert',
  COMBAT: 'combat'
};

export const INTENT = {
  PATROL: 'patrol',
  HOLD: 'hold',
  PUSH: 'push',
  FALL_BACK: 'fall_back',
  SEARCH: 'search',
  LOOT: 'loot'
};

export const AI_CONFIG = {
  PATROL_RADIUS: 8,
  PATROL_POINTS: 5,
  PATROL_PAUSE_MIN: 1500,
  PATROL_PAUSE_MAX: 3500,
  VISION_RANGE: 20,
  VISION_NEAR: 8,
  VISION_MID: 14,
  VISION_FAR: 20,
  CENTRAL_FOV: Math.PI / 2,
  PERIPHERAL_FOV: Math.PI,
  NEAR_FACTOR: 1.0,
  MID_FACTOR: 0.7,
  FAR_FACTOR: 0.4,
  PERIPHERAL_FACTOR: 0.4,
  COVER_SEARCH_RADIUS: 8,
  RETREAT_DISTANCE: 3,
  COMBAT_APPROACH_DISTANCE: 6,
  COMBAT_IDLE_DISTANCE: 2,
  SEARCH_RADIUS: 4,
  THINK_INTERVAL: 900,
  MOVE_DELAY: 400,
  GROUP_COMMUNICATION_RANGE: 14,
  MIN_STATE_DURATION: 1500,
  AIM_DURATION: 250,
  BURST_COOLDOWN: 1500,
  RADIO_MAX_QUEUE: 5,
  RADIO_THROTTLE_MS: 1000,
  PURSUIT_MAX_SECTORS: 1,

  INTENT_MIN_DURATION_MS: 1800,
  INTENT_MAX_DURATION_MS: 4000,
  INTENT_HOLD_FIRE_AFTER_ALLY_MS: 1000
};

export const INTEREST_FACTORS = {
  VISUAL_CONTACT: 15,
  SOUND_GUNSHOT: 10,
  SOUND_EXPLOSION: 15,
  TAKING_DAMAGE: 30,
  ALLY_INFO: 8,
  DECAY_PATROL: 2.0,
  DECAY_ALERT: 3.0,
  DECAY_COMBAT: 5.0
};

export const INTEREST_THRESHOLDS = {
  PATROL_TO_ALERT: 35,
  ALERT_TO_COMBAT: 70,
  COMBAT_TO_ALERT: 20,
  ALERT_TO_PATROL: 15
};

export const RADIO_MSG_TYPE = {
  SPOTTED_PLAYER: 'spotted',
  HEARD_SHOT: 'heard_shot',
  UNDER_FIRE: 'under_fire',
  MOVING_TO: 'moving_to',
  TAKING_COVER: 'taking_cover',
  MOVE_ASIDE: 'move_aside',
  ACKNOWLEDGE: 'ack'
};

export const RADIO_PRIORITY = {
  [RADIO_MSG_TYPE.UNDER_FIRE]: 100,
  [RADIO_MSG_TYPE.SPOTTED_PLAYER]: 90,
  [RADIO_MSG_TYPE.MOVE_ASIDE]: 80,
  [RADIO_MSG_TYPE.ACKNOWLEDGE]: 70,
  [RADIO_MSG_TYPE.TAKING_COVER]: 50,
  [RADIO_MSG_TYPE.MOVING_TO]: 30,
  [RADIO_MSG_TYPE.HEARD_SHOT]: 20
};

export const RADIO_DROPPABLE = new Set([
  RADIO_MSG_TYPE.MOVING_TO,
  RADIO_MSG_TYPE.HEARD_SHOT
]);

export const POI_TYPE = {
  LOOT: 'loot',
  ALERT: 'alert',
  PATROL_ROUTE: 'patrol_route',
  SPAWN_POINT: 'spawn_point'
};

export const POI_STATE = {
  ACTIVE: 'active',
  DEPLETED: 'depleted',
  EXPIRED: 'expired'
};

export const POI_ALERT_TTL = 30000;

export const WORLD_SIM = {
  ACTIVE: 'active',
  NEIGHBOR: 'neighbor',
  REMOTE: 'remote',
  NEIGHBOR_INTERVAL_MS: 1000,
  REMOTE_INTERVAL_MS: 20000,
  SOFT_SECTOR_BOT_LIMIT: 8
};

export const SPAWN = {
  WORLD_BOTS: 40,
  SPAWN_POINTS_PER_SECTOR: 3,
  POPULATION_THRESHOLD: 20,
  SPAWN_COOLDOWN_MS: 45000,
  PER_SPAWN_POINT: 1
};

export const DEATH_PENALTY = {
  XP_LOSS_PERCENT: 0,
  CONSUMABLE_LOSS_PERCENT: 0
};

export const STATS_CAP = 20;

export const GAME_KEYS = {
  MOVE_UP: 'KeyW',
  MOVE_DOWN: 'KeyS',
  MOVE_LEFT: 'KeyA',
  MOVE_RIGHT: 'KeyD',
  RELOAD: 'KeyR',
  SWAP_WEAPON: 'KeyF',
  INVENTORY: 'KeyI',
  MINIMAP: 'KeyM',
  GLOBAL_MAP: 'KeyG',
  ESCAPE: 'Escape',
  USE_SLOT_1: 'Digit1',
  USE_SLOT_2: 'Digit2',
  USE_SLOT_3: 'Digit3',
  USE_SLOT_4: 'Digit4'
};