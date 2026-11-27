// ==UserScript==
// @name         gwars.io -- subgraphs
// @namespace    GW Micro Redesign
// @version      2026-11-27
// @description  Subgraphs/Недографы. Игра, основанная на gwars.io
// @match        https://www.gwars.io/help/
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  "use strict";
  const DB_NAME = "subgraphs_db";
  const DB_VERSION = 1;
  const STORES = ["maps", "transitions", "sprites", "sounds", "saves", "spawn_points", "caches", "global_layout"];
  class DBManager {
    constructor() {
      this.db = null;
    }
    async init() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          for (const name of STORES) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name);
            }
          }
        };
        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }
    async get(store, key) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        if (!this.db.objectStoreNames.contains(store)) {
          resolve(void 0);
          return;
        }
        const tx = this.db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async put(store, key, value) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        const tx = this.db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    async getAll(store) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        if (!this.db.objectStoreNames.contains(store)) {
          resolve([]);
          return;
        }
        const tx = this.db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
    async getAllKeys(store) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        if (!this.db.objectStoreNames.contains(store)) {
          resolve([]);
          return;
        }
        const tx = this.db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
    async clear(store) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        if (!this.db.objectStoreNames.contains(store)) {
          resolve();
          return;
        }
        const tx = this.db.transaction(store, "readwrite");
        const req = tx.objectStore(store).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    async delete(store, key) {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error("DB not initialized"));
          return;
        }
        const tx = this.db.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    async clearAll() {
      for (const store of STORES) {
        if (store === "saves") continue;
        await this.clear(store);
      }
    }
    async deleteAllSaves() {
      await this.clear("saves");
    }
  }
  const AMMUNITION_TYPES = {
    pistol: {
      id: "pistol",
      nameKey: "ammo.pistol",
      caliber_mm: 9,
      mass_g: 6,
      v0_mps: 420,
      dragPerCell: 0.035,
      penetrationBase_mm: 3,
      isRocket: false,
      explosiveMass_g: 0,
      pellets: 1,
      shape: "oval",
      size: [4, 2],
      color: "#D2691E"
    },
    rifle: {
      id: "rifle",
      nameKey: "ammo.rifle",
      caliber_mm: 5.45,
      mass_g: 10,
      v0_mps: 715,
      dragPerCell: 0.025,
      penetrationBase_mm: 5,
      isRocket: false,
      explosiveMass_g: 0,
      pellets: 1,
      shape: "oval",
      size: [6, 3],
      color: "#797979"
    },
    heavy: {
      id: "heavy",
      nameKey: "ammo.heavy",
      caliber_mm: 7.62,
      mass_g: 12,
      v0_mps: 830,
      dragPerCell: 0.02,
      penetrationBase_mm: 7,
      isRocket: false,
      explosiveMass_g: 0,
      pellets: 1,
      shape: "oval",
      size: [8, 4],
      color: "#B8860B"
    },
    pellet: {
      id: "pellet",
      nameKey: "ammo.pellet",
      caliber_mm: 18.5,
      mass_g: 3.5,
      v0_mps: 400,
      dragPerCell: 0.06,
      penetrationBase_mm: 1.5,
      isRocket: false,
      explosiveMass_g: 0,
      pellets: 10,
      shape: "circle",
      size: 2,
      color: "#76888f"
    },
    rocket: {
      id: "rocket",
      nameKey: "ammo.rocket",
      caliber_mm: 85,
      mass_g: 2500,
      v0_mps: 300,
      dragPerCell: 5e-3,
      penetrationBase_mm: 200,
      isRocket: true,
      explosiveMass_g: 1e3,
      explosionRadius: 3,
      shrapnelCount: 8,
      shrapnelRange: 4,
      pellets: 1,
      shape: "oval",
      size: [12, 3],
      color: "#4a4a4a"
    }
  };
  const CHARACTER_SPRITE_KEYS = {
    1: "charwt_1",
    2: "charwt_2",
    3: "charwt_3",
    4: "charwt_4",
    5: "charwt_5",
    6: "charwt_6",
    7: "charwt_7"
  };
  function getCharacterSpriteKey(weaponId, WEAPONS2) {
    const weapon = WEAPONS2[weaponId];
    if (!weapon) return "charwt_3";
    return CHARACTER_SPRITE_KEYS[weapon.spriteType] || "charwt_3";
  }
  const WEAPONS = {
    tt33: {
      id: "tt33",
      nameKey: "weapon.tt33",
      ammoId: "pistol",
      spriteType: 7,
      spriteKey: "tt33",
      slot: "secondary",
      v0_scale: 1,
      range: 5,
      accuracy: 0.9,
      fireRate: 380,
      burstCount: 1,
      burstInterval: 0,
      preferredDistance: 4,
      weight: 3,
      magazineSize: 8,
      reloadTime: 1300,
      recoilPerShot: 0.1,
      recoilRecovery: 0.11,
      maxRecoil: 0.35,
      recoilSpreadMultiplier: 0.35,
      aimTime: 200,
      movementPenalty: 0.35,
      firstShotMultiplier: 1.1,
      recoveryDelay: 120,
      bloomPerShot: 0.03,
      bloomMax: 0.25,
      bloomRecovery: 0.7
    },
    ppsh41: {
      id: "ppsh41",
      nameKey: "weapon.ppsh41",
      ammoId: "pistol",
      spriteType: 6,
      spriteKey: "ppsh41",
      slot: "primary",
      v0_scale: 1.1,
      range: 8,
      accuracy: 0.7,
      fireRate: 100,
      burstCount: 5,
      burstInterval: 45,
      preferredDistance: 6,
      weight: 8,
      magazineSize: 35,
      reloadTime: 2200,
      recoilPerShot: 0.15,
      recoilRecovery: 0.09,
      maxRecoil: 0.6,
      recoilSpreadMultiplier: 0.6,
      aimTime: 280,
      movementPenalty: 0.55,
      firstShotMultiplier: 1.05,
      recoveryDelay: 180,
      bloomPerShot: 0.04,
      bloomMax: 0.45,
      bloomRecovery: 0.55
    },
    ak47: {
      id: "ak47",
      nameKey: "weapon.ak47",
      ammoId: "rifle",
      spriteType: 3,
      spriteKey: "ak47",
      slot: "primary",
      v0_scale: 1,
      range: 12,
      accuracy: 0.78,
      fireRate: 160,
      burstCount: 3,
      burstInterval: 55,
      preferredDistance: 8,
      weight: 10,
      magazineSize: 30,
      reloadTime: 2100,
      recoilPerShot: 0.18,
      recoilRecovery: 0.07,
      maxRecoil: 1.1,
      recoilSpreadMultiplier: 0.85,
      aimTime: 320,
      movementPenalty: 0.6,
      firstShotMultiplier: 1.15,
      recoveryDelay: 200,
      bloomPerShot: 0.05,
      bloomMax: 0.6,
      bloomRecovery: 0.5
    },
    pkm: {
      id: "pkm",
      nameKey: "weapon.pkm",
      ammoId: "heavy",
      spriteType: 2,
      spriteKey: "pkm",
      slot: "primary",
      v0_scale: 0.99,
      range: 13,
      accuracy: 0.7,
      fireRate: 145,
      burstCount: 3,
      burstInterval: 60,
      preferredDistance: 10,
      weight: 15,
      magazineSize: 100,
      reloadTime: 3200,
      recoilPerShot: 0.25,
      recoilRecovery: 0.04,
      maxRecoil: 1.4,
      recoilSpreadMultiplier: 1,
      aimTime: 380,
      movementPenalty: 0.7,
      firstShotMultiplier: 1.05,
      recoveryDelay: 250,
      bloomPerShot: 0.07,
      bloomMax: 0.8,
      bloomRecovery: 0.4
    },
    svd: {
      id: "svd",
      nameKey: "weapon.svd",
      ammoId: "heavy",
      spriteType: 4,
      spriteKey: "svd",
      slot: "primary",
      v0_scale: 1,
      range: 15,
      accuracy: 0.95,
      fireRate: 1200,
      burstCount: 1,
      burstInterval: 0,
      preferredDistance: 12,
      weight: 12,
      magazineSize: 10,
      reloadTime: 2400,
      recoilPerShot: 0.45,
      recoilRecovery: 0.04,
      maxRecoil: 1.1,
      recoilSpreadMultiplier: 0.9,
      aimTime: 500,
      movementPenalty: 0.85,
      firstShotMultiplier: 1.3,
      recoveryDelay: 350,
      bloomPerShot: 0.09,
      bloomMax: 0.7,
      bloomRecovery: 0.35
    },
    saiga12: {
      id: "saiga12",
      nameKey: "weapon.saiga12",
      ammoId: "pellet",
      spriteType: 1,
      spriteKey: "saiga12",
      slot: "primary",
      v0_scale: 0.95,
      range: 5,
      accuracy: 0.65,
      fireRate: 850,
      burstCount: 1,
      burstInterval: 0,
      preferredDistance: 4,
      weight: 9,
      magazineSize: 8,
      reloadTime: 2600,
      recoilPerShot: 0.22,
      recoilRecovery: 0.11,
      maxRecoil: 0.65,
      recoilSpreadMultiplier: 0.45,
      aimTime: 250,
      movementPenalty: 0.75,
      firstShotMultiplier: 1.05,
      recoveryDelay: 200,
      bloomPerShot: 0.06,
      bloomMax: 0.55,
      bloomRecovery: 0.55
    },
    rocket_launcher: {
      id: "rocket_launcher",
      nameKey: "weapon.rocket_launcher",
      ammoId: "rocket",
      spriteType: 5,
      spriteKey: "rocket_launcher",
      slot: "primary",
      v0_scale: 1,
      range: 12,
      accuracy: 0.75,
      fireRate: 3500,
      burstCount: 1,
      burstInterval: 0,
      preferredDistance: 10,
      weight: 18,
      magazineSize: 1,
      reloadTime: 4500,
      recoilPerShot: 0.5,
      recoilRecovery: 0.03,
      maxRecoil: 1.2,
      recoilSpreadMultiplier: 1,
      aimTime: 450,
      movementPenalty: 0.9,
      firstShotMultiplier: 1.2,
      recoveryDelay: 400,
      bloomPerShot: 0.1,
      bloomMax: 0.9,
      bloomRecovery: 0.3
    }
  };
  const CELL_SIZE = 36;
  const VIEW_W = 25;
  const VIEW_H = 25;
  const CAMERA_MARGIN = 4;
  const MINIMAP_PX_PER_CELL = 2;
  const MINIMAP_SIZE = 98 * MINIMAP_PX_PER_CELL;
  const BOT_TURN_DELAY_MS = 200;
  const SPRITE_ANGLE_OFFSET = 0;
  const SAFE_ZONE = { gx: 34, gy: 36, sectorId: 1010, radius: 14 };
  const TERRAIN_SPRITE_KEY = "terrain";
  const GLOBAL_MAP_SPRITE_KEY = "global_map";
  const MAX_PROJECTILES = 100;
  const SOUND_MAX_AGE = 1e3;
  const SOUND_MAX_RANGE = 25;
  const SOUND_LOUDNESS = {
    pistol: 0.5,
    rifle: 0.7,
    heavy: 0.8,
    pellet: 0.4,
    rocket: 1,
    explosion: 1,
    footstep: 0.1
  };
  const SUPPRESSION_GAIN = 0.15;
  const SUPPRESSION_NEAR_RADIUS = 2;
  const SHOOTING_THRESHOLD = 0.3;
  const AI_STATE = {
    PATROL: "patrol",
    ALERT: "alert",
    COMBAT: "combat"
  };
  const INTENT = {
    PATROL: "patrol",
    HOLD: "hold",
    PUSH: "push",
    FALL_BACK: "fall_back",
    SEARCH: "search",
    LOOT: "loot"
  };
  const MIN_INTENT_TIME = {
    [INTENT.HOLD]: 2200,
    [INTENT.PUSH]: 2500,
    [INTENT.FALL_BACK]: 1800,
    [INTENT.SEARCH]: 2800,
    [INTENT.PATROL]: 3e3,
    [INTENT.LOOT]: 2e3
  };
  const INTENT_FAMILY = {
    [INTENT.HOLD]: "engage",
    [INTENT.PUSH]: "engage",
    [INTENT.FALL_BACK]: "evade",
    [INTENT.SEARCH]: "search",
    [INTENT.PATROL]: "idle",
    [INTENT.LOOT]: "idle"
  };
  const GROUP_ROLE = {
    SUPPRESS: "suppress",
    FLANK: "flank",
    ANCHOR: "anchor"
  };
  const GROUP_ACTION_TYPE = {
    MOVING_FLANK: "moving_flank",
    SUPPRESSING: "suppressing",
    FALLING_BACK: "falling_back",
    HOLDING: "holding"
  };
  const GROUP_CONFIG = {
    GROUP_RANGE: 14,
    ROLE_REASSIGN_INTERVAL_MS: 1e4,
    MAX_FLANKERS: 1,
    MAX_SUPPRESSORS: 3,
    RESERVATION_DURATION_MS: 4e3,
    SHARED_LAST_SEEN_CONF_THRESHOLD: 0.75,
    SHOOTER_WINDOW_MS: 400,
    MAX_SHOOTERS_PER_TARGET: 3,
    GROUP_ACTION_LOG_MAX: 10,
    GROUP_ACTION_TTL: 6e3
  };
  const AI_CONFIG = {
    PATROL_RADIUS: 8,
    PATROL_POINTS: 5,
    PATROL_PAUSE_MIN: 1500,
    PATROL_PAUSE_MAX: 3500,
    VISION_RANGE: 20,
    VISION_NEAR: 8,
    VISION_MID: 14,
    CENTRAL_FOV: Math.PI / 2,
    PERIPHERAL_FOV: Math.PI,
    NEAR_FACTOR: 1,
    MID_FACTOR: 0.7,
    FAR_FACTOR: 0.4,
    PERIPHERAL_FACTOR: 0.4,
    COVER_SEARCH_RADIUS: 8,
    THINK_INTERVAL: 900,
    MOVE_DELAY: 400,
    GROUP_COMMUNICATION_RANGE: 14,
    MIN_STATE_DURATION: 1500,
    BURST_COOLDOWN: 1500,
    RADIO_MAX_QUEUE: 5,
    RADIO_THROTTLE_MS: 1e3,
    INTENT_MIN_DURATION_MS: 1800,
    INTENT_MAX_DURATION_MS: 4e3,
    INTENT_HOLD_FIRE_AFTER_ALLY_MS: 1e3,
    INTENT_CHANGE_COOLDOWN_MS: 5e3,
    LISTEN_DURATION_MIN_MS: 1200,
    LISTEN_DURATION_MAX_MS: 2e3,
    INVESTIGATE_DURATION_MIN_MS: 4e3,
    INVESTIGATE_DURATION_MAX_MS: 6e3,
    AIMING_DELAY_MIN_MS: 300,
    AIMING_DELAY_MAX_MS: 700,
    GRENADE_FF_BUFFER_CELLS: 1
  };
  const INTEREST_FACTORS = {
    VISUAL_CONTACT: 15,
    SOUND_GUNSHOT: 10,
    SOUND_EXPLOSION: 15,
    TAKING_DAMAGE: 30,
    ALLY_INFO: 8,
    DECAY_PATROL: 2,
    DECAY_ALERT: 3,
    DECAY_COMBAT: 5
  };
  const INTEREST_THRESHOLDS = {
    PATROL_TO_ALERT: 35,
    ALERT_TO_COMBAT: 70,
    COMBAT_TO_ALERT: 20,
    ALERT_TO_PATROL: 15
  };
  const RADIO_MSG_TYPE = {
    SPOTTED_PLAYER: "spotted",
    HEARD_SHOT: "heard_shot",
    UNDER_FIRE: "under_fire",
    MOVING_TO: "moving_to",
    MOVE_ASIDE: "move_aside",
    ACKNOWLEDGE: "ack"
  };
  const POI_TYPE = {
    LOOT: "loot",
    ALERT: "alert"
  };
  const POI_STATE = {
    ACTIVE: "active",
    DEPLETED: "depleted",
    EXPIRED: "expired"
  };
  const POI_ALERT_TTL = 3e4;
  const WORLD_SIM = {
    NEIGHBOR_INTERVAL_MS: 1e3,
    REMOTE_INTERVAL_MS: 2e4
  };
  const SPAWN = {
    WORLD_BOTS: 40,
    POPULATION_THRESHOLD: 20,
    SPAWN_COOLDOWN_MS: 45e3,
    PER_SPAWN_POINT: 1
  };
  const STATS_CAP = 20;
  const GAME_KEYS = {
    MOVE_UP: "KeyW",
    MOVE_DOWN: "KeyS",
    MOVE_LEFT: "KeyA",
    MOVE_RIGHT: "KeyD",
    RELOAD: "KeyR",
    SWAP_WEAPON: "KeyF",
    INVENTORY: "KeyI",
    MINIMAP: "KeyM",
    GLOBAL_MAP: "KeyG",
    ESCAPE: "Escape",
    USE_SLOT_1: "Digit1",
    USE_SLOT_2: "Digit2",
    USE_SLOT_3: "Digit3",
    USE_SLOT_4: "Digit4"
  };
  class AssetManager {
    constructor(db) {
      this.db = db;
      this.images = /* @__PURE__ */ new Map();
      this.failed = /* @__PURE__ */ new Set();
    }
    async loadSprite(name) {
      if (!name || typeof name !== "string") return null;
      name = name.trim();
      if (this.images.has(name)) return this.images.get(name);
      if (this.failed.has(name)) return null;
      try {
        const blob = await this.db.get("sprites", name);
        if (!blob) {
          this.failed.add(name);
          return null;
        }
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
          img.onload = () => {
            this.images.set(name, img);
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            this.failed.add(name);
            reject();
          };
        });
        return this.images.get(name);
      } catch {
        this.failed.add(name);
        return null;
      }
    }
    getImage(name) {
      return name ? this.images.get(name.trim()) : null;
    }
    getCharSprite(weaponId) {
      const key = getCharacterSpriteKey(weaponId, WEAPONS);
      return this.images.get(key);
    }
    async preloadLevel(sector) {
      const keys = /* @__PURE__ */ new Set();
      keys.add(TERRAIN_SPRITE_KEY);
      for (const spriteKey of Object.values(sector.obstacles || {})) {
        keys.add(String(spriteKey).trim());
      }
      for (let i = 1; i <= 7; i++) keys.add("charwt_" + i);
      await Promise.all(Array.from(keys).map((k) => this.loadSprite(k)));
    }
    async loadGlobalMap() {
      return this.loadSprite(GLOBAL_MAP_SPRITE_KEY);
    }
  }
  const OBSTACLE_TYPES = {
    water: { id: "water", size: [1, 1], blocksMovement: true, visionBlock: 0, soundBlock: 0, obstacleResistance: 0, coverValue: 0 },
    rock_big: { id: "rock_big", size: [1, 1], blocksMovement: true, visionBlock: 1, soundBlock: 0.9, obstacleResistance: 0.9, coverValue: 0.9 },
    rock_medium: { id: "rock_medium", size: [1, 1], blocksMovement: true, visionBlock: 0.7, soundBlock: 0.5, obstacleResistance: 0.6, coverValue: 0.6 },
    bush_light: { id: "bush_light", size: [1, 1], blocksMovement: true, visionBlock: 0.2, soundBlock: 0.1, obstacleResistance: 0.1, coverValue: 0.1 },
    bush_dense: { id: "bush_dense", size: [1, 1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.2, obstacleResistance: 0.2, coverValue: 0.2 },
    bush_wide: { id: "bush_wide", size: [2, 1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.2, obstacleResistance: 0.2, coverValue: 0.2 },
    palm_vertical: { id: "palm_vertical", size: [1, 2], blocksMovement: true, visionBlock: 0.4, soundBlock: 0.3, obstacleResistance: 0.3, coverValue: 0.3 },
    tree_vertical: { id: "tree_vertical", size: [1, 2], blocksMovement: true, visionBlock: 0.5, soundBlock: 0.4, obstacleResistance: 0.4, coverValue: 0.4 },
    palm_big: { id: "palm_big", size: [2, 2], blocksMovement: true, visionBlock: 0.6, soundBlock: 0.5, obstacleResistance: 0.5, coverValue: 0.5 },
    tree_big: { id: "tree_big", size: [2, 2], blocksMovement: true, visionBlock: 0.7, soundBlock: 0.6, obstacleResistance: 0.6, coverValue: 0.6 },
    tree_with_rock: { id: "tree_with_rock", size: [2, 2], blocksMovement: true, visionBlock: 0.9, soundBlock: 0.8, obstacleResistance: 0.8, coverValue: 0.8 },
    grass: { id: "grass", size: [1, 1], blocksMovement: true, visionBlock: 0, soundBlock: 0, obstacleResistance: 0, coverValue: 0 },
    cactus: { id: "cactus", size: [1, 1], blocksMovement: true, visionBlock: 0.3, soundBlock: 0.1, obstacleResistance: 0.2, coverValue: 0.2 }
  };
  const IMAGE_REGISTRY = {
    "rocks": "rock_big",
    "rocks_1": "rock_medium",
    "wood": "bush_dense",
    "wood_1": "bush_wide",
    "wood_2": "palm_vertical",
    "wood_3": "cactus",
    "wood_4": "bush_wide",
    "wood_5": "palm_big",
    "wood_6": "bush_light",
    "wood_7": "palm_big",
    "wood_8": "bush_light",
    "wood_9": "bush_dense",
    "wood_A": "bush_dense",
    "wood_B": "bush_dense",
    "wood_C": "palm_vertical",
    "wood_D": "tree_vertical",
    "wood_E": "palm_big",
    "wood_F": "bush_dense",
    "wood_G": "grass",
    "wood_H": "tree_vertical",
    "wood_I": "tree_big",
    "wood_J": "tree_with_rock",
    "wood_K": "tree_with_rock",
    "wood_L": "palm_vertical",
    "water": "water",
    "water_0": "water",
    "water_1": "water",
    "water_2": "water",
    "water_3": "water",
    "water_4": "water",
    "water_5": "water",
    "water_6": "water",
    "water_7": "water",
    "water_8": "water",
    "water_9": "water",
    "water_A": "water",
    "water_B": "water",
    "null_1": "grass",
    "null_2": "grass"
  };
  const DIRECTIONS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 }
  ];
  const MATERIALS = {
    stone: {
      id: "stone",
      name: "Камень",
      hardness: 0.9,
      ricochetChance: 0.35,
      ricochetEnergyLoss: 0.6,
      penetrationResistance: 0.85
    },
    wood: {
      id: "wood",
      name: "Дерево",
      hardness: 0.5,
      ricochetChance: 0.2,
      ricochetEnergyLoss: 0.7,
      penetrationResistance: 0.45
    },
    foliage: {
      id: "foliage",
      name: "Листва",
      hardness: 0.1,
      ricochetChance: 0.03,
      ricochetEnergyLoss: 0.85,
      penetrationResistance: 0.1
    }
  };
  function getMaterialForObstacle(logicType) {
    switch (logicType) {
      case "rock_big":
      case "rock_medium":
        return MATERIALS.stone;
      case "tree_vertical":
      case "tree_big":
      case "tree_with_rock":
      case "palm_vertical":
      case "palm_big":
        return MATERIALS.wood;
      case "bush_light":
      case "bush_dense":
      case "bush_wide":
      case "cactus":
        return MATERIALS.foliage;
      default:
        return null;
    }
  }
  class GridSystem {
    constructor(db, world) {
      this.db = db;
      this.world = world;
      this.sector = null;
      this.occupancy = [];
      this.transitions = [];
      this.obstacleList = [];
      this.obstacleAnchors = /* @__PURE__ */ new Map();
      this.spawnPoints = [];
      this._skippedObstacles = 0;
    }
    async loadSector(id) {
      this.sector = await this.db.get("maps", id);
      if (!this.sector) throw new Error("Sector " + id + " not found");
      this.transitions = await this.loadTransitions(id);
      this.spawnPoints = await this.loadSpawnPoints(id);
      this.buildOccupancy();
    }
    async loadTransitions(sectorId) {
      const keys = await this.db.getAllKeys("transitions");
      const all = [];
      for (const key of keys) {
        const t2 = await this.db.get("transitions", key);
        if (t2 && t2.from && t2.from.sectorId === sectorId) all.push(t2);
      }
      return all;
    }
    async loadSpawnPoints(sectorId) {
      const data = await this.db.get("spawn_points", sectorId);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.points)) return data.points;
      return [];
    }
    buildOccupancy() {
      const w = this.sector.width;
      const h = this.sector.height;
      this.occupancy = Array.from({ length: h }, () => Array(w).fill(null));
      this.obstacleList = [];
      this.obstacleAnchors.clear();
      this._skippedObstacles = 0;
      const obst = this.sector.obstacles || {};
      for (const key in obst) {
        const rawKey = String(obst[key]).trim();
        const [anchorGx, anchorGy] = key.split("|").map(Number);
        const logicType = (IMAGE_REGISTRY[rawKey] || rawKey).trim();
        const def = OBSTACLE_TYPES[logicType];
        if (!def) {
          this._skippedObstacles++;
          if (this._skippedObstacles <= 5) {
            console.warn("[Grid] Skipped obstacle (unknown type):", { key, rawKey, logicType });
          }
          continue;
        }
        const material = getMaterialForObstacle(logicType);
        const obstacle = {
          id: anchorGx + "|" + anchorGy,
          anchorGx,
          anchorGy,
          rawKey,
          logicType,
          material,
          size: def.size,
          blocksMovement: def.blocksMovement,
          visionBlock: def.visionBlock,
          soundBlock: def.soundBlock,
          obstacleResistance: def.obstacleResistance,
          coverValue: def.coverValue
        };
        this.obstacleList.push(obstacle);
        this.obstacleAnchors.set(obstacle.id, obstacle);
        for (let dy = 0; dy < def.size[1]; dy++) {
          for (let dx = 0; dx < def.size[0]; dx++) {
            const gx = anchorGx + dx;
            const gy = anchorGy + dy;
            if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
              this.occupancy[gy][gx] = obstacle;
            }
          }
        }
      }
      if (this._skippedObstacles > 5) {
        console.warn("[Grid] Total skipped obstacles:", this._skippedObstacles);
      }
    }
    getObstacleAtCell(gx, gy) {
      if (!this.sector) return null;
      if (gx < 0 || gy < 0 || gx >= this.sector.width || gy >= this.sector.height) return null;
      if (!this.occupancy[gy]) return null;
      return this.occupancy[gy][gx] || null;
    }
    isWalkable(gx, gy, excludeEntity) {
      if (!this.sector) return false;
      if (gx < 0 || gy < 0 || gx >= this.sector.width || gy >= this.sector.height) return false;
      const obs = this.getObstacleAtCell(gx, gy);
      if (obs && obs.blocksMovement) return false;
      if (this.world && this.world.entities) {
        for (const entity of this.world.entities.values()) {
          if (entity === excludeEntity) continue;
          if (!entity.isAlive) continue;
          if (entity.gx === gx && entity.gy === gy) return false;
        }
      }
      return true;
    }
    hasLineOfSight(x0, y0, x1, y1) {
      const cells = this.getLineCells(x0, y0, x1, y1);
      const processed = /* @__PURE__ */ new Set();
      for (let i = 1; i < cells.length - 1; i++) {
        const cell = cells[i];
        const obs = this.getObstacleAtCell(cell.x, cell.y);
        if (obs && !processed.has(obs.id)) {
          processed.add(obs.id);
          if (obs.visionBlock >= 1) return false;
        }
        if (this.world && this.world.isSmokeAt && this.world.isSmokeAt(cell.x, cell.y)) {
          return false;
        }
      }
      return true;
    }
    getSoundAttenuation(x0, y0, x1, y1) {
      if (!this.sector) return 1;
      const cells = this.getLineCells(x0, y0, x1, y1);
      const processed = /* @__PURE__ */ new Set();
      let totalBlock = 0;
      for (let i = 1; i < cells.length - 1; i++) {
        const obs = this.getObstacleAtCell(cells[i].x, cells[i].y);
        if (obs && !processed.has(obs.id)) {
          processed.add(obs.id);
          totalBlock += obs.soundBlock;
          if (totalBlock >= 1) return 0;
        }
      }
      return Math.max(0, 1 - totalBlock);
    }
    getLineCells(x0, y0, x1, y1) {
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return [];
      const cells = [];
      let x = x0, y = y0;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      let iterations = 0;
      const maxIter = 1e3;
      while (true) {
        iterations++;
        if (iterations > maxIter) break;
        cells.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
      return cells;
    }
    getTransitionAt(gx, gy) {
      for (const t2 of this.transitions) {
        if (t2.from.gx === gx && t2.from.gy === gy) return t2;
      }
      return null;
    }
  }
  class CameraSystem {
    constructor() {
      this.x = 0;
      this.y = 0;
    }
    snapTo(playerGx, playerGy, sectorW, sectorH) {
      this.x = Math.max(0, Math.min(playerGx - Math.floor(VIEW_W / 2), sectorW - VIEW_W));
      this.y = Math.max(0, Math.min(playerGy - Math.floor(VIEW_H / 2), sectorH - VIEW_H));
    }
    update(playerGx, playerGy, sectorW, sectorH) {
      let targetX = this.x;
      let targetY = this.y;
      const psx = playerGx - this.x;
      const psy = playerGy - this.y;
      if (psx < CAMERA_MARGIN) targetX = playerGx - CAMERA_MARGIN;
      else if (psx > VIEW_W - 1 - CAMERA_MARGIN) targetX = playerGx - (VIEW_W - 1 - CAMERA_MARGIN);
      if (psy < CAMERA_MARGIN) targetY = playerGy - CAMERA_MARGIN;
      else if (psy > VIEW_H - 1 - CAMERA_MARGIN) targetY = playerGy - (VIEW_H - 1 - CAMERA_MARGIN);
      this.x = Math.max(0, Math.min(targetX, sectorW - VIEW_W));
      this.y = Math.max(0, Math.min(targetY, sectorH - VIEW_H));
    }
    toScreen(gx, gy) {
      return {
        x: Math.floor((gx - this.x) * CELL_SIZE),
        y: Math.floor((gy - this.y) * CELL_SIZE)
      };
    }
    screenToGrid(screenX, screenY) {
      return {
        gx: Math.floor(screenX / CELL_SIZE + this.x),
        gy: Math.floor(screenY / CELL_SIZE + this.y)
      };
    }
  }
  class TransitionManager {
    constructor(db, world) {
      this.db = db;
      this.world = world;
      this.bySector = /* @__PURE__ */ new Map();
    }
    async loadAll() {
      const keys = await this.db.getAllKeys("transitions");
      this.bySector.clear();
      for (const key of keys) {
        const t2 = await this.db.get("transitions", key);
        if (!t2 || !t2.from || !t2.to) continue;
        const fromSector = t2.from.sectorId;
        if (!this.bySector.has(fromSector)) this.bySector.set(fromSector, []);
        this.bySector.get(fromSector).push(t2);
      }
    }
    getForSector(sectorId) {
      return this.bySector.get(sectorId) || [];
    }
    getAt(sectorId, gx, gy) {
      const list = this.getForSector(sectorId);
      for (const t2 of list) {
        if (t2.from.gx === gx && t2.from.gy === gy) return t2;
      }
      return null;
    }
    getNeighborSectors(sectorId) {
      const set = /* @__PURE__ */ new Set();
      const list = this.getForSector(sectorId);
      for (const t2 of list) {
        if (t2.to && t2.to.sectorId !== sectorId) set.add(t2.to.sectorId);
      }
      return Array.from(set);
    }
  }
  const BALLISTICS = {
    OBSTACLE_MM_SCALE: 10,
    K_PEN: 0.02,
    K_NONPEN: 5e-3,
    CUML_THRESHOLD_MM: 200,
    CUML_DAMAGE_MULT: 0.1,
    MIN_ENERGY_J: 1,
    MIN_VELOCITY_MPS: 30,
    LOS_CACHE_TTL_MS: 100,
    LOS_CACHE_MAX_SIZE: 500,
    VISUAL_SPEED_CELLS_PER_FRAME: 0.4,
    RICOCHET_MAX_ANGLE_DEG: 60,
    RICOCHET_ENERGY_LOSS_BASE: 0.15,
    RICOCHET_ANGLE_RANDOM_DEG: 10
  };
  class LOSCache {
    constructor() {
      this.cache = /* @__PURE__ */ new Map();
      this.ttl = BALLISTICS.LOS_CACHE_TTL_MS;
      this.maxSize = BALLISTICS.LOS_CACHE_MAX_SIZE;
    }
    _key(x0, y0, x1, y1) {
      return x0 + "," + y0 + "," + x1 + "," + y1;
    }
    get(x0, y0, x1, y1, now) {
      const key = this._key(x0, y0, x1, y1);
      const entry = this.cache.get(key);
      if (!entry) return null;
      if (now - entry.time > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      return entry.visible;
    }
    set(x0, y0, x1, y1, visible, now) {
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      this.cache.set(this._key(x0, y0, x1, y1), { visible, time: now });
    }
    hasLineOfSight(grid, x0, y0, x1, y1, now) {
      const cached = this.get(x0, y0, x1, y1, now);
      if (cached !== null) return cached;
      const visible = grid.hasLineOfSight(x0, y0, x1, y1);
      this.set(x0, y0, x1, y1, visible, now);
      return visible;
    }
    clear() {
      this.cache.clear();
    }
  }
  class POIManager {
    constructor(world) {
      this.world = world;
      this.pois = /* @__PURE__ */ new Map();
      this.nextId = 1;
    }
    create({ type, sectorId, gx, gy, radius = 2, capacity = 1, ttl = null, data = {} }) {
      const id = "poi_" + this.nextId++;
      const poi = {
        id,
        type,
        sectorId,
        gx,
        gy,
        radius,
        capacity,
        ttl,
        data,
        state: POI_STATE.ACTIVE,
        createdAt: performance.now()
      };
      this.pois.set(id, poi);
      return poi;
    }
    createLoot({ sectorId, gx, gy, items }) {
      return this.create({
        type: POI_TYPE.LOOT,
        sectorId,
        gx,
        gy,
        radius: 1,
        capacity: 1,
        ttl: null,
        data: { items }
      });
    }
    createAlert({ sectorId, gx, gy }) {
      const now = performance.now();
      for (const poi of this.pois.values()) {
        if (poi.type !== POI_TYPE.ALERT) continue;
        if (poi.state !== POI_STATE.ACTIVE) continue;
        if (poi.sectorId !== sectorId) continue;
        const dist = Math.max(Math.abs(poi.gx - gx), Math.abs(poi.gy - gy));
        if (dist <= poi.radius) {
          poi.createdAt = now;
          return poi;
        }
      }
      return this.create({
        type: POI_TYPE.ALERT,
        sectorId,
        gx,
        gy,
        radius: 3,
        capacity: 3,
        ttl: POI_ALERT_TTL,
        data: {}
      });
    }
    getById(id) {
      return this.pois.get(id);
    }
    getForSector(sectorId) {
      const out = [];
      for (const poi of this.pois.values()) {
        if (poi.sectorId === sectorId) out.push(poi);
      }
      return out;
    }
    getActiveForSector(sectorId) {
      return this.getForSector(sectorId).filter((p) => p.state === POI_STATE.ACTIVE);
    }
    markDepleted(poi) {
      poi.state = POI_STATE.DEPLETED;
    }
    expire(poi) {
      poi.state = POI_STATE.EXPIRED;
    }
    update(now) {
      for (const poi of this.pois.values()) {
        if (poi.state !== POI_STATE.ACTIVE) continue;
        if (poi.ttl !== null && now - poi.createdAt > poi.ttl) {
          poi.state = POI_STATE.EXPIRED;
        }
      }
      for (const [id, poi] of this.pois) {
        if (poi.state !== POI_STATE.ACTIVE) this.pois.delete(id);
      }
    }
    serialize() {
      const out = [];
      for (const poi of this.pois.values()) out.push(poi);
      return out;
    }
    deserialize(arr) {
      this.pois.clear();
      for (const poi of arr || []) this.pois.set(poi.id, poi);
    }
  }
  const BOT_PROFILES = {
    scout: {
      name: "Scout",
      primaryWeapon: "ppsh41",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_light", body: "vest_light", legs: null, foot: "boots" },
      stats: { health: 8, strength: 8, accuracy: 12, endurance: 12 },
      personality: { aggression: 0.6, caution: 0.5, discipline: 0.4, accuracySkill: 0.6, enduranceSkill: 0.6 }
    },
    assault: {
      name: "Assault",
      primaryWeapon: "ak47",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_medium", body: "vest_medium", legs: "pants_light", foot: "boots" },
      stats: { health: 12, strength: 12, accuracy: 10, endurance: 10 },
      personality: { aggression: 0.8, caution: 0.4, discipline: 0.7, accuracySkill: 0.7, enduranceSkill: 0.5 }
    },
    heavy: {
      name: "Heavy",
      primaryWeapon: "pkm",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_heavy", body: "vest_heavy", legs: "pants_heavy", foot: "boots" },
      stats: { health: 15, strength: 15, accuracy: 8, endurance: 8 },
      personality: { aggression: 0.9, caution: 0.3, discipline: 0.8, accuracySkill: 0.5, enduranceSkill: 0.4 }
    },
    sniper: {
      name: "Sniper",
      primaryWeapon: "svd",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_medium", body: "vest_light", legs: null, foot: "boots" },
      stats: { health: 8, strength: 8, accuracy: 15, endurance: 10 },
      personality: { aggression: 0.4, caution: 0.8, discipline: 0.9, accuracySkill: 0.9, enduranceSkill: 0.5 }
    },
    shotgun: {
      name: "Shotgunner",
      primaryWeapon: "saiga12",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_light", body: "vest_medium", legs: null, foot: "boots" },
      stats: { health: 10, strength: 10, accuracy: 8, endurance: 12 },
      personality: { aggression: 0.7, caution: 0.3, discipline: 0.5, accuracySkill: 0.5, enduranceSkill: 0.7 }
    },
    grenadier: {
      name: "Grenadier",
      primaryWeapon: "rocket_launcher",
      secondaryWeapon: "tt33",
      armor: { head: "helmet_medium", body: "vest_heavy", legs: "pants_light", foot: "boots" },
      stats: { health: 10, strength: 12, accuracy: 8, endurance: 8 },
      personality: { aggression: 0.5, caution: 0.6, discipline: 0.7, accuracySkill: 0.5, enduranceSkill: 0.4 }
    }
  };
  const BOT_PROFILE_WEIGHTS = {
    scout: 1,
    assault: 1,
    heavy: 1,
    sniper: 1,
    shotgun: 1,
    grenadier: 1
  };
  class SpawnManager {
    constructor(world) {
      this.world = world;
      this.spawnPoints = [];
      this.lastSpawnTime = 0;
    }
    async loadAllSpawnPoints() {
      const keys = await this.world.db.getAllKeys("spawn_points");
      this.spawnPoints = [];
      for (const key of keys) {
        const data = await this.world.db.get("spawn_points", key);
        let points = [];
        if (Array.isArray(data)) points = data;
        else if (Array.isArray(data?.points)) points = data.points;
        for (const p of points) {
          this.spawnPoints.push({
            sectorId: p.sectorId !== void 0 ? p.sectorId : Number(key),
            gx: p.gx,
            gy: p.gy,
            capacity: p.capacity || SPAWN.PER_SPAWN_POINT,
            profileWeights: p.profileWeights || BOT_PROFILE_WEIGHTS
          });
        }
      }
    }
    pickProfile(weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let roll = Math.random() * total;
      for (const k in weights) {
        roll -= weights[k];
        if (roll <= 0) return BOT_PROFILES[k];
      }
      return BOT_PROFILES.assault;
    }
    countAliveBots() {
      let count = 0;
      for (const e of this.world.entities.values()) {
        if (!e.isPlayer && e.isAlive) count++;
      }
      return count;
    }
    update(now) {
      if (now - this.lastSpawnTime < SPAWN.SPAWN_COOLDOWN_MS) return;
      if (this.countAliveBots() >= SPAWN.POPULATION_THRESHOLD) return;
      if (this.spawnPoints.length === 0) return;
      const validPoints = this.spawnPoints.filter((sp2) => sp2.sectorId === this.world.currentSectorId);
      if (validPoints.length === 0) return;
      const sp = validPoints[Math.floor(Math.random() * validPoints.length)];
      if (!this.world.grid.isWalkable(sp.gx, sp.gy, null)) {
        console.warn("[SpawnManager] Spawn point not walkable, skipping:", sp);
        return;
      }
      const profile = this.pickProfile(sp.profileWeights);
      const spawned = this.world.spawnBot(this.world.currentSectorId, sp.gx, sp.gy, profile);
      if (spawned) this.lastSpawnTime = now;
    }
  }
  class SoundManager {
    constructor(world) {
      this.world = world;
      this.soundEvents = [];
    }
    emitSound(gx, gy, loudness, type, source) {
      this.soundEvents.push({
        gx,
        gy,
        loudness,
        type,
        source,
        time: performance.now()
      });
    }
    getSoundAt(targetGx, targetGy, now) {
      this.soundEvents = this.soundEvents.filter((s) => now - s.time < SOUND_MAX_AGE);
      let loudest = null;
      for (let i = 0; i < this.soundEvents.length; i++) {
        const sound = this.soundEvents[i];
        const dx = sound.gx - targetGx;
        const dy = sound.gy - targetGy;
        const distance = Math.hypot(dx, dy);
        if (distance > SOUND_MAX_RANGE) continue;
        let heardLoudness = sound.loudness * (1 - distance / SOUND_MAX_RANGE);
        const attenuation = this.world.grid.getSoundAttenuation(sound.gx, sound.gy, targetGx, targetGy);
        heardLoudness *= attenuation;
        if (heardLoudness > 0.05 && (loudest === null || heardLoudness > loudest.heardLoudness)) {
          loudest = {
            gx: sound.gx,
            gy: sound.gy,
            loudness: sound.loudness,
            heardLoudness,
            type: sound.type,
            source: sound.source
          };
        }
      }
      return loudest;
    }
    getActiveSounds() {
      const now = performance.now();
      return this.soundEvents.filter((s) => now - s.time < 500);
    }
    clear() {
      this.soundEvents = [];
    }
  }
  class TaskQueue {
    constructor() {
      this.tasks = [];
    }
    schedule(delayMs, fn) {
      this.tasks.push({ time: performance.now() + delayMs, fn });
    }
    update(now) {
      if (this.tasks.length === 0) return;
      const ready = [];
      const pending = [];
      for (const task of this.tasks) {
        if (task.time <= now) ready.push(task);
        else pending.push(task);
      }
      this.tasks = pending;
      for (const task of ready) {
        try {
          task.fn();
        } catch (err) {
          console.error("[TaskQueue] task error:", err);
        }
      }
    }
    clear() {
      this.tasks = [];
    }
  }
  class EventBus {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
    }
    on(event, handler) {
      if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
      this.listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }
    off(event, handler) {
      const set = this.listeners.get(event);
      if (set) set.delete(handler);
    }
    emit(event, payload) {
      const set = this.listeners.get(event);
      if (!set) return;
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          console.error("[EventBus] handler error:", err);
        }
      }
    }
  }
  const BASE_STEP_COST = 1;
  const COVER_BONUS = -0.5;
  const OPEN_PENALTY_NEAR_TARGET = 1;
  const OPEN_NEAR_TARGET_RADIUS = 3;
  const SUPPRESSION_PENALTY = 2;
  class Pathfinding {
    constructor(world) {
      this.world = world;
      this.maxIterations = 4e3;
    }
    isWalkable(gx, gy, entity) {
      return this.world.grid.isWalkable(gx, gy, entity);
    }
    getCellCost(gx, gy, ctx) {
      let cost = BASE_STEP_COST;
      const obs = this.world.grid.getObstacleAtCell(gx, gy);
      if (obs && obs.coverValue >= 0.2) {
        cost += COVER_BONUS * obs.coverValue;
      }
      if (ctx && ctx.targetGx !== void 0 && ctx.caution !== void 0) {
        const distToTarget = Math.max(Math.abs(gx - ctx.targetGx), Math.abs(gy - ctx.targetGy));
        if (distToTarget <= OPEN_NEAR_TARGET_RADIUS && (!obs || obs.coverValue < 0.2)) {
          cost += OPEN_PENALTY_NEAR_TARGET * ctx.caution * (1 - distToTarget / (OPEN_NEAR_TARGET_RADIUS + 1));
        }
      }
      if (this.world.isSmokeAt && this.world.isSmokeAt(gx, gy)) {
        cost += SUPPRESSION_PENALTY;
      }
      return Math.max(0.1, cost);
    }
    findPath(sx, sy, tx, ty, entity, maxDepth = 30, ctx = null) {
      if (sx === tx && sy === ty) return [];
      const open = new MinHeap();
      const gScore = /* @__PURE__ */ new Map();
      const cameFrom = /* @__PURE__ */ new Map();
      const closed = /* @__PURE__ */ new Set();
      const startKey = sx + "," + sy;
      const targetKey = tx + "," + ty;
      gScore.set(startKey, 0);
      open.push({ gx: sx, gy: sy, g: 0, f: this.heuristic(sx, sy, tx, ty) });
      let iterations = 0;
      while (!open.isEmpty()) {
        iterations++;
        if (iterations > this.maxIterations) break;
        const current = open.pop();
        const currentKey = current.gx + "," + current.gy;
        if (currentKey === targetKey) {
          return this.reconstruct(cameFrom, currentKey);
        }
        if (closed.has(currentKey)) continue;
        closed.add(currentKey);
        const currentG = gScore.get(currentKey) ?? Infinity;
        if (current.g > currentG) continue;
        if (current.g >= maxDepth) continue;
        for (const dir of DIRECTIONS) {
          const nx = current.gx + dir.dx;
          const ny = current.gy + dir.dy;
          if (!this.isWalkable(nx, ny, entity)) continue;
          const key = nx + "," + ny;
          if (closed.has(key)) continue;
          const stepCost = this.getCellCost(nx, ny, ctx);
          const tentativeG = current.g + stepCost;
          const knownG = gScore.get(key);
          if (knownG !== void 0 && tentativeG >= knownG) continue;
          gScore.set(key, tentativeG);
          cameFrom.set(key, currentKey);
          open.push({ gx: nx, gy: ny, g: tentativeG, f: tentativeG + this.heuristic(nx, ny, tx, ty) });
        }
      }
      return null;
    }
    heuristic(x1, y1, x2, y2) {
      return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    }
    reconstruct(cameFrom, targetKey) {
      const path = [];
      let key = targetKey;
      while (cameFrom.has(key)) {
        const [gx, gy] = key.split(",").map(Number);
        path.push({ gx, gy });
        key = cameFrom.get(key);
      }
      path.reverse();
      return path;
    }
    smoothPath(path, entity) {
      if (!path || path.length < 3) return path;
      const out = [path[0]];
      let i = 0;
      while (i < path.length - 1) {
        let j = path.length - 1;
        while (j > i + 1) {
          if (this.hasDirectLOS(path[i], path[j])) break;
          j--;
        }
        out.push(path[j]);
        i = j;
      }
      return out;
    }
    hasDirectLOS(a, b) {
      return this.world.grid.hasLineOfSight(a.gx, a.gy, b.gx, b.gy);
    }
    stepToward(sx, sy, tx, ty, entity) {
      const dx = Math.sign(tx - sx);
      const dy = Math.sign(ty - sy);
      if (dx === 0 && dy === 0) return null;
      if ((dx !== 0 || dy !== 0) && this.isWalkable(sx + dx, sy + dy, entity)) {
        return { gx: sx + dx, gy: sy + dy };
      }
      if (dx !== 0 && this.isWalkable(sx + dx, sy, entity)) {
        return { gx: sx + dx, gy: sy };
      }
      if (dy !== 0 && this.isWalkable(sx, sy + dy, entity)) {
        return { gx: sx, gy: sy + dy };
      }
      return null;
    }
  }
  class MinHeap {
    constructor() {
      this.arr = [];
    }
    isEmpty() {
      return this.arr.length === 0;
    }
    push(node) {
      this.arr.push(node);
      this._bubbleUp(this.arr.length - 1);
    }
    pop() {
      if (this.arr.length === 0) return null;
      const top = this.arr[0];
      const last = this.arr.pop();
      if (this.arr.length > 0) {
        this.arr[0] = last;
        this._bubbleDown(0);
      }
      return top;
    }
    _bubbleUp(i) {
      while (i > 0) {
        const parent = i - 1 >> 1;
        if (this.arr[i].f >= this.arr[parent].f) break;
        [this.arr[i], this.arr[parent]] = [this.arr[parent], this.arr[i]];
        i = parent;
      }
    }
    _bubbleDown(i) {
      const n = this.arr.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.arr[l].f < this.arr[smallest].f) smallest = l;
        if (r < n && this.arr[r].f < this.arr[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.arr[i], this.arr[smallest]] = [this.arr[smallest], this.arr[i]];
        i = smallest;
      }
    }
  }
  let nextRadioId = 1;
  class RadioMessage {
    constructor(type, sender, data, target = null) {
      this.id = nextRadioId++;
      this.type = type;
      this.sender = sender;
      this.target = target;
      this.data = data;
      this.time = performance.now();
    }
  }
  class RadioManager {
    constructor(world) {
      this.world = world;
    }
    send(senderBrain, type, data, targetBot = null) {
      const msg = new RadioMessage(type, senderBrain.entity, data, targetBot);
      senderBrain.lastRadioMessage = type;
      senderBrain.lastRadioMessageTime = msg.time;
      this.world.eventBus.emit("bot:radio", {
        name: senderBrain.profile?.name || senderBrain.entity.id,
        type,
        data,
        target: targetBot ? targetBot.profile?.name || targetBot.id : null
      });
      for (const ally of this.world.entities.values()) {
        if (ally === senderBrain.entity) continue;
        if (ally.isPlayer) continue;
        if (!ally.isAlive) continue;
        if (!ally.botBrain) continue;
        if (targetBot && ally !== targetBot) continue;
        const dist = senderBrain.entity.getDistanceTo(ally.gx, ally.gy, "chebyshev");
        if (dist > AI_CONFIG.GROUP_COMMUNICATION_RANGE) continue;
        ally.botBrain.receiveRadioMessage(msg);
      }
    }
  }
  class GroupManager {
    constructor(world) {
      this.world = world;
      this.groups = /* @__PURE__ */ new Map();
      this.botToGroup = /* @__PURE__ */ new Map();
      this.nextGroupId = 1;
      this.lastUpdate = 0;
    }
    updateGroups(now) {
      if (now - this.lastUpdate < 2e3) return;
      this.lastUpdate = now;
      const bots = [];
      for (const e of this.world.entities.values()) {
        if (e.isPlayer) continue;
        if (!e.isAlive) continue;
        if (!e.botBrain) continue;
        bots.push(e);
      }
      const assigned = /* @__PURE__ */ new Set();
      const newGroups = /* @__PURE__ */ new Map();
      const newBotToGroup = /* @__PURE__ */ new Map();
      for (const bot of bots) {
        if (assigned.has(bot.id)) continue;
        const groupId = "group_" + this.nextGroupId++;
        const members = /* @__PURE__ */ new Set([bot.id]);
        assigned.add(bot.id);
        for (const other of bots) {
          if (assigned.has(other.id)) continue;
          if (other === bot) continue;
          const d = Math.max(Math.abs(other.gx - bot.gx), Math.abs(other.gy - bot.gy));
          if (d <= GROUP_CONFIG.GROUP_RANGE) {
            members.add(other.id);
            assigned.add(other.id);
          }
        }
        const oldGroup = this.botToGroup.has(bot.id) ? this.groups.get(this.botToGroup.get(bot.id)) : null;
        const group = {
          id: groupId,
          members,
          sharedLastKnown: oldGroup ? oldGroup.sharedLastKnown : null,
          roles: oldGroup ? oldGroup.roles : /* @__PURE__ */ new Map(),
          reservations: oldGroup ? oldGroup.reservations : /* @__PURE__ */ new Map(),
          actionLog: oldGroup ? oldGroup.actionLog : [],
          lastRoleAssign: oldGroup ? oldGroup.lastRoleAssign : 0
        };
        newGroups.set(groupId, group);
        for (const memberId of members) {
          newBotToGroup.set(memberId, groupId);
        }
      }
      this.groups = newGroups;
      this.botToGroup = newBotToGroup;
      for (const group of this.groups.values()) {
        this.cleanupReservations(group, now);
        this.cleanupActionLog(group, now);
        if (now - group.lastRoleAssign > GROUP_CONFIG.ROLE_REASSIGN_INTERVAL_MS) {
          this.assignRoles(group, now);
          group.lastRoleAssign = now;
        }
      }
    }
    cleanupReservations(group, now) {
      for (const [key, res] of group.reservations) {
        if (res.until < now) group.reservations.delete(key);
      }
    }
    cleanupActionLog(group, now) {
      group.actionLog = group.actionLog.filter((e) => now - e.time < GROUP_CONFIG.GROUP_ACTION_TTL);
      if (group.actionLog.length > GROUP_CONFIG.GROUP_ACTION_LOG_MAX) {
        group.actionLog = group.actionLog.slice(-10);
      }
    }
    getGroupForBot(bot) {
      const groupId = this.botToGroup.get(bot.id);
      if (!groupId) return null;
      return this.groups.get(groupId) || null;
    }
    getRole(bot) {
      const group = this.getGroupForBot(bot);
      if (!group) return null;
      return group.roles.get(bot.id) || null;
    }
    assignRoles(group, now) {
      const bots = [];
      for (const memberId of group.members) {
        const bot = this.world.entities.get(memberId);
        if (!bot || !bot.isAlive || !bot.botBrain) continue;
        bots.push(bot);
      }
      if (bots.length === 0) {
        group.roles.clear();
        return;
      }
      const sharedLK = group.sharedLastKnown;
      const sorted = bots.slice().sort((a, b) => {
        const aDist = sharedLK ? Math.max(Math.abs(a.gx - sharedLK.gx), Math.abs(a.gy - sharedLK.gy)) : 0;
        const bDist = sharedLK ? Math.max(Math.abs(b.gx - sharedLK.gx), Math.abs(b.gy - sharedLK.gy)) : 0;
        return aDist - bDist;
      });
      let flankCount = 0;
      let suppressCount = 0;
      for (const bot of sorted) {
        const p = bot.botBrain.personality;
        const weapon = bot.getActiveWeapon();
        const weaponId = weapon ? weapon.id : "";
        const inCover = !!bot.botBrain.coverPosition;
        let role = GROUP_ROLE.ANCHOR;
        const suppressScore = p.aggression * 1 + (weaponId === "pkm" ? 1.5 : 0) + (weaponId === "ak47" ? 0.8 : 0) + (weaponId === "ppsh41" ? 0.5 : 0) + (inCover ? 0.5 : 0);
        const flankScore = p.aggression * 0.8 + (weaponId === "saiga12" ? 1.2 : 0) + (weaponId === "ppsh41" ? 0.8 : 0) + (p.caution < 0.4 ? 0.5 : 0);
        const anchorScore = p.discipline * 1.2 + (weaponId === "svd" ? 1.2 : 0) + (inCover ? 1 : 0);
        if (suppressScore >= flankScore && suppressScore >= anchorScore && suppressCount < GROUP_CONFIG.MAX_SUPPRESSORS) {
          role = GROUP_ROLE.SUPPRESS;
          suppressCount++;
        } else if (flankScore > anchorScore && flankCount < GROUP_CONFIG.MAX_FLANKERS) {
          role = GROUP_ROLE.FLANK;
          flankCount++;
        } else {
          role = GROUP_ROLE.ANCHOR;
        }
        group.roles.set(bot.id, role);
      }
    }
    updateSharedLastKnown(group, pos) {
      if (!pos) return;
      if (pos.gx === void 0) return;
      if (pos.conf !== void 0 && pos.conf < GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) return;
      const current = group.sharedLastKnown;
      if (!current) {
        group.sharedLastKnown = { gx: pos.gx, gy: pos.gy, time: pos.time || performance.now(), conf: pos.conf || 0.85 };
        return;
      }
      if ((pos.time || 0) > current.time) {
        group.sharedLastKnown = { gx: pos.gx, gy: pos.gy, time: pos.time || performance.now(), conf: pos.conf || 0.85 };
      }
    }
    getSharedLastKnown(bot) {
      const group = this.getGroupForBot(bot);
      if (!group) return null;
      return group.sharedLastKnown;
    }
    logGroupAction(bot, type, data) {
      const group = this.getGroupForBot(bot);
      if (!group) return;
      const now = performance.now();
      group.actionLog.push({
        botId: bot.id,
        type,
        data: data || {},
        time: now
      });
      if (group.actionLog.length > GROUP_CONFIG.GROUP_ACTION_LOG_MAX) {
        group.actionLog.shift();
      }
    }
    getGroupActions(bot) {
      const group = this.getGroupForBot(bot);
      if (!group) return [];
      const now = performance.now();
      return group.actionLog.filter((e) => now - e.time < GROUP_CONFIG.GROUP_ACTION_TTL);
    }
    reserve(cell, botId, now) {
      const group = this.getGroupForBot({ id: botId });
      if (!group) return true;
      const key = cell.gx + "," + cell.gy;
      const existing = group.reservations.get(key);
      if (existing && existing.until > now && existing.botId !== botId) return false;
      group.reservations.set(key, { botId, until: now + GROUP_CONFIG.RESERVATION_DURATION_MS });
      return true;
    }
    isReserved(cell, botId, now) {
      const group = this.getGroupForBot({ id: botId });
      if (!group) return false;
      const key = cell.gx + "," + cell.gy;
      const existing = group.reservations.get(key);
      if (!existing) return false;
      if (existing.until < now) return false;
      if (existing.botId === botId) return false;
      return true;
    }
    countRecentShooters(bot, targetGx, targetGy, now) {
      const group = this.getGroupForBot(bot);
      if (!group) return 0;
      let count = 0;
      for (const memberId of group.members) {
        if (memberId === bot.id) continue;
        const member = this.world.entities.get(memberId);
        if (!member || !member.isAlive || !member.botBrain) continue;
        if (!member.lastShotTime) continue;
        if (now - member.lastShotTime > GROUP_CONFIG.SHOOTER_WINDOW_MS) continue;
        const d = Math.max(Math.abs(member.gx - targetGx), Math.abs(member.gy - targetGy));
        if (d <= 3) count++;
      }
      return count;
    }
    canShoot(bot, targetGx, targetGy, now) {
      const role = this.getRole(bot);
      const recent = this.countRecentShooters(bot, targetGx, targetGy, now);
      if (role === GROUP_ROLE.SUPPRESS) {
        return recent < GROUP_CONFIG.MAX_SUPPRESSORS;
      }
      return recent < GROUP_CONFIG.MAX_SHOOTERS_PER_TARGET;
    }
  }
  const CONSUMABLE_ITEMS = {
    medkit: {
      id: "medkit",
      nameKey: "item.medkit",
      type: "heal",
      healAmount: 30,
      useTime: 0,
      weight: 0.5,
      invSize: [1, 1],
      spriteKey: "medkit"
    },
    grenade_smoke: {
      id: "grenade_smoke",
      nameKey: "item.grenade_smoke",
      type: "grenade",
      grenadeKind: "smoke",
      radius: 3,
      duration: 5e3,
      weight: 0.4,
      invSize: [1, 1],
      spriteKey: "grenade_smoke"
    },
    grenade_frag: {
      id: "grenade_frag",
      nameKey: "item.grenade_frag",
      type: "grenade",
      grenadeKind: "frag",
      radius: 2,
      explosionDamage: 30,
      weight: 0.4,
      invSize: [1, 1],
      spriteKey: "grenade_frag"
    }
  };
  const BOT_GRENADE_RANGE = 5;
  const BOT_MEDKIT_THRESHOLD = 0.35;
  const BOT_GRENADE_COOLDOWN_MS = 8e3;
  const LOST_TARGET_SEARCH_RADIUS = 3;
  const ROCKET_TRAJECTORY_CHECK_CELLS = 3;
  const ROCKET_OBSTACLE_THRESHOLD = 0.3;
  const SHORT_PATH_CELLS = 6;
  const PATH_EXPIRY_SHORT_MIN = 1200;
  const PATH_EXPIRY_SHORT_MAX = 1800;
  const PATH_EXPIRY_LONG_MIN = 2500;
  const PATH_EXPIRY_LONG_MAX = 3500;
  const SUPPRESSIVE_FIRE_COOLDOWN_MS = 2e3;
  const SUPPRESSIVE_FIRE_SPREAD = 0.35;
  const AWARENESS_MAX = 100;
  const AWARENESS_ALERT_THRESHOLD = 25;
  const AWARENESS_COMBAT_THRESHOLD = 55;
  const AWARENESS_PATROL_DECAY = 6.5;
  const AWARENESS_ALERT_DECAY = 4;
  const AWARENESS_COMBAT_DECAY = 1.5;
  const SOUND_ERROR_TYPE_MULT = {
    gunshot: 1,
    explosion: 1.6,
    footstep: 0.7,
    other: 1.2
  };
  const MEMORY_LOG_MAX = 12;
  const MEMORY_TTL = {
    intent_changed: 12e3,
    intent_started: 12e3,
    target_acquired: 1e4,
    target_lost: 1e4,
    path_planned: 8e3,
    path_abandoned: 8e3,
    position_reached: 8e3,
    shot_fired: 8e3,
    burst_finished: 8e3,
    damage_taken: 2e4,
    cover_failed: 25e3,
    ally_action: 6e3,
    decision_blocked: 1e4
  };
  class BotBrain {
    constructor(entity, world, profile) {
      this.entity = entity;
      this.world = world;
      this.profile = profile;
      this.personality = profile.personality || {
        aggression: 0.5,
        caution: 0.5,
        discipline: 0.5,
        accuracySkill: 0.5,
        enduranceSkill: 0.5
      };
      this.state = AI_STATE.PATROL;
      this.stateEntryTime = performance.now();
      this.currentIntent = INTENT.PATROL;
      this.intentExpiry = 0;
      this.intentStartTime = 0;
      this.intentTarget = null;
      this.lastIntentChange = 0;
      this.awareness = 0;
      this.memoryLog = [];
      this.lastLogPrune = 0;
      this.patrolRoute = [];
      this.patrolIndex = 0;
      this.patrolPauseUntil = 0;
      this.lastSeenPlayerPos = null;
      this.alertPosition = null;
      this.alertStartTime = 0;
      this.coverPosition = null;
      this.firingPosition = null;
      this.searchPhase = null;
      this.searchPhaseStart = 0;
      this.interest = 0;
      this.lastInterestDecay = performance.now();
      this.lastThinkTime = 0;
      this.lastMoveTime = 0;
      this.lastStrafeTime = 0;
      this.lastShotTime = 0;
      this.lastBurstEndTime = 0;
      this.lastGrenadeTime = 0;
      this.lastMedkitTime = 0;
      this.holdFireUntil = 0;
      this.lastSuppressiveFireTime = 0;
      this.isAiming = false;
      this.aimStartTime = 0;
      this.tempMoveTarget = null;
      this.tempMoveExpiry = 0;
      this.pendingMoveRequest = null;
      this.lastMoveRequestTime = 0;
      this.lastSentSpottedTime = 0;
      this.lastSentPlayerPos = null;
      this.lastReceivedMsgIds = /* @__PURE__ */ new Set();
      this.radioQueue = [];
      this.lastRadioMessage = null;
      this.lastRadioMessageTime = 0;
      this.currentPath = null;
      this.pathIndex = 0;
      this.pathExpiry = 0;
      this.lostTargetTime = 0;
      this.searchTargetPos = null;
      this.wasInCombat = false;
      this.wasPlayerVisible = false;
      this.generatePatrolRoute();
    }
    logEvent(type, data, customTtl) {
      const now = performance.now();
      const ttl = customTtl !== void 0 ? customTtl : MEMORY_TTL[type] || 8e3;
      this.memoryLog.push({
        type,
        time: now,
        data: data || {},
        ttl
      });
      if (this.memoryLog.length > MEMORY_LOG_MAX) {
        this.memoryLog.shift();
      }
      if (now - this.lastLogPrune > 2e3) {
        this.pruneMemoryLog(now);
        this.lastLogPrune = now;
      }
    }
    pruneMemoryLog(now) {
      this.memoryLog = this.memoryLog.filter((e) => now - e.time < e.ttl);
    }
    publishAllyAction(type, data) {
      this.logEvent("ally_action", { type, data });
      const gm = this.getGroupManager();
      if (gm) {
        gm.logGroupAction(this.entity, type, data);
      }
    }
    readContext() {
      const now = performance.now();
      this.pruneMemoryLog(now);
      const ctx = {
        intentChangesRecent: 0,
        recentDamageFrom: null,
        recentShotFrom: [],
        recentCoverFailed: [],
        recentPathPlanned: null,
        recentAllyAction: null,
        recentDecisionBlocked: 0
      };
      for (const e of this.memoryLog) {
        const age = now - e.time;
        if (e.type === "intent_changed" && age < 1e4) {
          ctx.intentChangesRecent++;
        } else if (e.type === "damage_taken" && age < 2e4 && !ctx.recentDamageFrom) {
          ctx.recentDamageFrom = e.data;
        } else if (e.type === "shot_fired" && age < 8e3) {
          ctx.recentShotFrom.push(e.data);
        } else if (e.type === "cover_failed" && age < 25e3) {
          ctx.recentCoverFailed.push(e.data);
        } else if (e.type === "path_planned" && age < 8e3) {
          ctx.recentPathPlanned = e.data;
        } else if (e.type === "ally_action" && age < 6e3) {
          ctx.recentAllyAction = e.data;
        } else if (e.type === "decision_blocked" && age < 1e4) {
          ctx.recentDecisionBlocked++;
        }
      }
      const gm = this.getGroupManager();
      if (gm) {
        const groupActions = gm.getGroupActions(this.entity);
        if (groupActions.length > 0) {
          const recent = groupActions[groupActions.length - 1];
          if (recent && recent.botId !== this.entity.id) {
            ctx.recentAllyAction = { type: recent.type, data: recent.data, fromBotId: recent.botId };
          }
        }
      }
      return ctx;
    }
    serializeState() {
      return {
        state: this.state,
        currentIntent: this.currentIntent,
        intentStartTime: this.intentStartTime,
        intentExpiry: this.intentExpiry,
        lastIntentChange: this.lastIntentChange,
        interest: this.interest,
        awareness: this.awareness,
        lastSeenPlayerPos: this.lastSeenPlayerPos ? {
          gx: this.lastSeenPlayerPos.gx,
          gy: this.lastSeenPlayerPos.gy,
          time: this.lastSeenPlayerPos.time,
          conf: this.lastSeenPlayerPos.conf || 0.9
        } : null,
        alertPosition: this.alertPosition,
        coverPosition: this.coverPosition,
        firingPosition: this.firingPosition,
        patrolRoute: this.patrolRoute ? this.patrolRoute.map((p) => ({ gx: p.gx, gy: p.gy })) : [],
        patrolIndex: this.patrolIndex,
        lastShotTime: this.lastShotTime,
        lastBurstEndTime: this.lastBurstEndTime,
        lastGrenadeTime: this.lastGrenadeTime,
        lastMedkitTime: this.lastMedkitTime,
        memoryLog: this.memoryLog.slice(-8)
      };
    }
    deserializeState(data) {
      if (!data) return;
      if (data.state) this.state = data.state;
      if (data.currentIntent) this.currentIntent = data.currentIntent;
      if (data.intentStartTime !== void 0) this.intentStartTime = data.intentStartTime;
      if (data.intentExpiry !== void 0) this.intentExpiry = data.intentExpiry;
      if (data.lastIntentChange !== void 0) this.lastIntentChange = data.lastIntentChange;
      if (data.interest !== void 0) this.interest = data.interest;
      if (data.awareness !== void 0) this.awareness = data.awareness;
      if (data.lastSeenPlayerPos) this.lastSeenPlayerPos = data.lastSeenPlayerPos;
      if (data.alertPosition) this.alertPosition = data.alertPosition;
      if (data.coverPosition) this.coverPosition = data.coverPosition;
      if (data.firingPosition) this.firingPosition = data.firingPosition;
      if (Array.isArray(data.patrolRoute) && data.patrolRoute.length > 0) {
        this.patrolRoute = data.patrolRoute;
      }
      if (data.patrolIndex !== void 0) this.patrolIndex = data.patrolIndex;
      if (data.lastShotTime !== void 0) this.lastShotTime = data.lastShotTime;
      if (data.lastBurstEndTime !== void 0) this.lastBurstEndTime = data.lastBurstEndTime;
      if (data.lastGrenadeTime !== void 0) this.lastGrenadeTime = data.lastGrenadeTime;
      if (data.lastMedkitTime !== void 0) this.lastMedkitTime = data.lastMedkitTime;
      if (Array.isArray(data.memoryLog)) this.memoryLog = data.memoryLog;
    }
    getThinkInterval() {
      if (this.state === AI_STATE.COMBAT) {
        return 300 + (1 - this.personality.aggression) * 150;
      }
      if (this.state === AI_STATE.ALERT) {
        return 500 + this.personality.caution * 200;
      }
      return AI_CONFIG.THINK_INTERVAL;
    }
    getMoveDelay() {
      return AI_CONFIG.MOVE_DELAY;
    }
    getAimDelay() {
      const weapon = this.entity.getActiveWeapon();
      const weaponAimTime = weapon ? weapon.aimTime || 250 : 250;
      const discipline = this.personality.discipline || 0.5;
      const accuracySkill = this.personality.accuracySkill || 0.5;
      let delay = weaponAimTime + 200 - discipline * 100 - accuracySkill * 100;
      delay = Math.max(AI_CONFIG.AIMING_DELAY_MIN_MS, Math.min(AI_CONFIG.AIMING_DELAY_MAX_MS, delay));
      return delay;
    }
    forceThink() {
      this.lastThinkTime = 0;
    }
    computePathExpiry(pathLength) {
      if (!pathLength || pathLength < SHORT_PATH_CELLS) {
        return performance.now() + PATH_EXPIRY_SHORT_MIN + Math.random() * (PATH_EXPIRY_SHORT_MAX - PATH_EXPIRY_SHORT_MIN);
      }
      return performance.now() + PATH_EXPIRY_LONG_MIN + Math.random() * (PATH_EXPIRY_LONG_MAX - PATH_EXPIRY_LONG_MIN);
    }
    getGroupManager() {
      return this.world.groupManager || null;
    }
    getGroupRole() {
      const gm = this.getGroupManager();
      if (!gm) return GROUP_ROLE.ANCHOR;
      return gm.getRole(this.entity) || GROUP_ROLE.ANCHOR;
    }
    getGroupSharedLastKnown() {
      const gm = this.getGroupManager();
      if (!gm) return null;
      return gm.getSharedLastKnown(this.entity);
    }
    publishSharedLastKnown(pos) {
      const gm = this.getGroupManager();
      if (!gm) return;
      const group = gm.getGroupForBot(this.entity);
      if (!group) return;
      gm.updateSharedLastKnown(group, pos);
    }
    getLeadTarget(player) {
      if (!player || !player.isAlive) return null;
      const weapon = this.entity.getActiveWeapon();
      if (!weapon) return null;
      if (weapon.ammoId === "pellet" || weapon.ammoId === "rocket") {
        return { gx: player.gx, gy: player.gy };
      }
      const dx = player.gx - this.entity.gx;
      const dy = player.gy - this.entity.gy;
      const distance = Math.hypot(dx, dy);
      if (distance < 2) return { gx: player.gx, gy: player.gy };
      let vx = 0, vy = 0;
      if (player.moveDirection) {
        vx = player.moveDirection.dx;
        vy = player.moveDirection.dy;
      }
      if (vx === 0 && vy === 0) return { gx: player.gx, gy: player.gy };
      const bulletSpeedCellsPerSec = weapon.bulletSpeedPx / CELL_SIZE;
      if (bulletSpeedCellsPerSec <= 0) return { gx: player.gx, gy: player.gy };
      const timeToHit = distance / bulletSpeedCellsPerSec;
      let predGx = player.gx + vx * timeToHit;
      let predGy = player.gy + vy * timeToHit;
      const sector = this.world.grid.sector;
      if (sector) {
        predGx = Math.max(0, Math.min(sector.width - 1, Math.round(predGx)));
        predGy = Math.max(0, Math.min(sector.height - 1, Math.round(predGy)));
      }
      const maxLead = 3;
      const leadDx = predGx - player.gx;
      const leadDy = predGy - player.gy;
      const leadDist = Math.max(Math.abs(leadDx), Math.abs(leadDy));
      if (leadDist > maxLead) {
        const k = maxLead / leadDist;
        predGx = player.gx + Math.round(leadDx * k);
        predGy = player.gy + Math.round(leadDy * k);
      }
      return { gx: predGx, gy: predGy };
    }
    updateAwareness(now) {
      const player = this.world.player;
      let gain = 0;
      const playerVisible = this.canSeePlayer();
      if (playerVisible && player && player.isAlive) {
        const detection = this.getDetectionChance();
        const baseGain = 4 + detection * 18;
        let fovMult = 1;
        if (detection < 0.3) fovMult = 0.5;
        else if (detection < 0.6) fovMult = 0.8;
        let moveMult = 1;
        const isMoving = player.moveCooldown > 0 || player.isMoving;
        if (isMoving) moveMult = 1.35;
        let shotBonus = 0;
        if (player.lastShotTime && now - player.lastShotTime < 400) {
          shotBonus = 12;
        }
        gain = baseGain * fovMult * moveMult + shotBonus;
        this.lastSeenPlayerPos = { gx: player.gx, gy: player.gy, time: now, conf: 0.9 };
        this.publishSharedLastKnown({ gx: player.gx, gy: player.gy, time: now, conf: 0.9 });
      }
      const sound = this.hearSound();
      if (sound.heard) {
        gain += sound.awarenessGain;
        if (!this.lastSeenPlayerPos || sound.conf > (this.lastSeenPlayerPos.conf || 0.9) * 0.9) {
          this.lastSeenPlayerPos = { gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf };
          if (sound.conf >= GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) {
            this.publishSharedLastKnown({ gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf });
          }
        }
      }
      const shared = this.getGroupSharedLastKnown();
      if (shared && (!this.lastSeenPlayerPos || shared.time > this.lastSeenPlayerPos.time)) {
        if (shared.conf >= GROUP_CONFIG.SHARED_LAST_SEEN_CONF_THRESHOLD) {
          this.lastSeenPlayerPos = { gx: shared.gx, gy: shared.gy, time: shared.time, conf: shared.conf };
          this.awareness = Math.min(AWARENESS_MAX, this.awareness + 4);
        }
      }
      if (gain > 0) {
        this.awareness = Math.min(AWARENESS_MAX, this.awareness + gain);
      }
      let decay = AWARENESS_PATROL_DECAY;
      if (this.state === AI_STATE.COMBAT) decay = AWARENESS_COMBAT_DECAY;
      else if (this.state === AI_STATE.ALERT) decay = AWARENESS_ALERT_DECAY;
      const dt = Math.min(0.5, (now - this.lastInterestDecay) / 1e3);
      this.awareness = Math.max(0, this.awareness - decay * dt);
    }
    getAwarenessState() {
      if (this.awareness >= AWARENESS_COMBAT_THRESHOLD && (this.hasLineOfSightTo(this.lastSeenPlayerPos?.gx ?? -1, this.lastSeenPlayerPos?.gy ?? -1) || this.lastSeenPlayerPos && performance.now() - this.lastSeenPlayerPos.time < 3e3)) {
        return "combat";
      }
      if (this.awareness >= AWARENESS_ALERT_THRESHOLD) {
        return "alert";
      }
      return "patrol";
    }
    assessSituation(now) {
      const player = this.world.player;
      const playerAlive = player && player.isAlive;
      const playerVisible = playerAlive && this.canSeePlayer();
      const lastSeenFresh = this.lastSeenPlayerPos && now - this.lastSeenPlayerPos.time < 3e3;
      const lastSeenAge = this.lastSeenPlayerPos ? now - this.lastSeenPlayerPos.time : Infinity;
      const distance = playerAlive ? this.entity.getDistanceTo(player.gx, player.gy, "euclidean") : Infinity;
      const hpPercent = this.entity.hp / this.entity.maxHp;
      const suppression = this.entity.suppression;
      const weapon = this.entity.getActiveWeapon();
      const preferred = weapon ? weapon.preferredDistance : 8;
      const weaponRange = weapon ? weapon.range : 8;
      return {
        playerAlive,
        playerVisible,
        lastSeenFresh,
        lastSeenAge,
        distance,
        hpPercent,
        suppression,
        weapon,
        preferred,
        weaponRange,
        awareness: this.awareness,
        awarenessState: this.getAwarenessState(),
        role: this.getGroupRole(),
        sharedLastKnown: this.getGroupSharedLastKnown(),
        context: this.readContext()
      };
    }
    chooseIntent(situation, now) {
      const p = this.personality;
      const role = situation.role;
      const ctx = situation.context;
      const scores = {};
      scores[INTENT.HOLD] = 0;
      scores[INTENT.PUSH] = 0;
      scores[INTENT.FALL_BACK] = 0;
      scores[INTENT.SEARCH] = 0;
      scores[INTENT.PATROL] = 0;
      const hasLOS = situation.playerVisible;
      const dist = situation.distance;
      if (hasLOS && dist < situation.weaponRange) {
        scores[INTENT.HOLD] += 40 + p.discipline * 25;
        scores[INTENT.PUSH] += 25 + p.aggression * 30 - p.caution * 15;
      }
      if (situation.suppression > 0.55 || situation.hpPercent < 0.35) {
        scores[INTENT.FALL_BACK] += 50 + p.caution * 40;
      }
      if (situation.lastSeenAge < 3 && !hasLOS) {
        scores[INTENT.SEARCH] += 35 + p.aggression * 15;
        scores[INTENT.HOLD] += 10 * p.discipline;
      }
      if (situation.lastSeenAge > 8) {
        scores[INTENT.PATROL] += 30;
      }
      if (situation.awarenessState === "patrol") {
        scores[INTENT.PATROL] += 20;
      }
      if (situation.awarenessState === "alert") {
        scores[INTENT.SEARCH] += 25;
      }
      if (situation.awarenessState === "combat") {
        scores[INTENT.HOLD] += 15;
        scores[INTENT.PUSH] += 10;
      }
      if (role === GROUP_ROLE.SUPPRESS) {
        scores[INTENT.HOLD] += 30;
        scores[INTENT.PUSH] -= 10;
      } else if (role === GROUP_ROLE.FLANK) {
        scores[INTENT.PUSH] += 35;
        scores[INTENT.HOLD] -= 10;
      } else if (role === GROUP_ROLE.ANCHOR) {
        scores[INTENT.HOLD] += 20;
      }
      if (ctx.intentChangesRecent >= 3) {
        scores[INTENT.PUSH] *= 0.5;
        scores[INTENT.FALL_BACK] *= 0.6;
        scores[INTENT.HOLD] *= 1.2;
      }
      if (ctx.recentDamageFrom && now - (ctx.recentDamageFrom.time || 0) < 3e3) {
        scores[INTENT.FALL_BACK] += 15;
        scores[INTENT.PUSH] -= 10;
      }
      if (ctx.recentCoverFailed.length > 0) {
        scores[INTENT.HOLD] -= 10;
      }
      if (ctx.recentAllyAction && ctx.recentAllyAction.type === GROUP_ACTION_TYPE.MOVING_FLANK) {
        scores[INTENT.HOLD] += 15;
        scores[INTENT.PUSH] -= 5;
      }
      const jitter = 0.1;
      for (const k in scores) {
        scores[k] += Math.random() * jitter * Math.max(1, Math.abs(scores[k]));
      }
      let best = INTENT.PATROL;
      let bestScore = -Infinity;
      for (const k in scores) {
        if (scores[k] > bestScore) {
          bestScore = scores[k];
          best = k;
        }
      }
      return best;
    }
    canChangeIntent(newIntent, now) {
      const currentMin = MIN_INTENT_TIME[this.currentIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
      if (now - this.intentStartTime < currentMin) return false;
      if (this.lastIntentChange && now - this.lastIntentChange < AI_CONFIG.INTENT_CHANGE_COOLDOWN_MS) {
        if (newIntent !== INTENT.FALL_BACK) return false;
      }
      return true;
    }
    setIntent(newIntent, now) {
      if (newIntent === this.currentIntent) return;
      if (!this.canChangeIntent(newIntent, now)) {
        this.logEvent("decision_blocked", { intent: newIntent, reason: "canChangeIntent" });
        return;
      }
      const oldFamily = INTENT_FAMILY[this.currentIntent];
      const newFamily = INTENT_FAMILY[newIntent];
      const keepPath = oldFamily === newFamily && (newFamily === "engage" || newFamily === "evade" || newFamily === "search");
      this.logEvent("intent_changed", { from: this.currentIntent, to: newIntent });
      this.currentIntent = newIntent;
      this.intentStartTime = now;
      this.lastIntentChange = now;
      const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
      const minDur = MIN_INTENT_TIME[newIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
      this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
      this.intentTarget = null;
      if (!keepPath) {
        this.currentPath = null;
        this.pathIndex = 0;
        this.pathExpiry = 0;
      }
      if (newIntent === INTENT.SEARCH) {
        this.searchPhase = null;
        this.searchPhaseStart = 0;
      }
      this.isAiming = false;
      this.aimStartTime = 0;
    }
    forceIntent(newIntent, now) {
      if (newIntent === this.currentIntent) return;
      this.logEvent("intent_changed", { from: this.currentIntent, to: newIntent, forced: true });
      this.currentIntent = newIntent;
      this.intentStartTime = now;
      this.lastIntentChange = now;
      const minDur = MIN_INTENT_TIME[newIntent] || AI_CONFIG.INTENT_MIN_DURATION_MS;
      const maxDur = AI_CONFIG.INTENT_MAX_DURATION_MS;
      this.intentExpiry = now + minDur + Math.random() * (maxDur - minDur);
      this.intentTarget = null;
      this.currentPath = null;
      this.pathIndex = 0;
      this.pathExpiry = 0;
      if (newIntent === INTENT.SEARCH) {
        this.searchPhase = null;
        this.searchPhaseStart = 0;
      }
      this.isAiming = false;
      this.aimStartTime = 0;
    }
    generatePatrolRoute() {
      const { gx, gy } = this.entity;
      const sector = this.world.grid.sector;
      if (!sector) return;
      this.patrolRoute = [{ gx, gy }];
      for (let i = 0; i < AI_CONFIG.PATROL_POINTS; i++) {
        let attempts = 0;
        while (attempts < 30) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 3 + Math.floor(Math.random() * (AI_CONFIG.PATROL_RADIUS - 3));
          const dx = Math.round(Math.cos(angle) * radius);
          const dy = Math.round(Math.sin(angle) * radius);
          const nx = Math.max(0, Math.min(sector.width - 1, gx + dx));
          const ny = Math.max(0, Math.min(sector.height - 1, gy + dy));
          if (this.world.grid.isWalkable(nx, ny, this.entity)) {
            this.patrolRoute.push({ gx: nx, gy: ny });
            break;
          }
          attempts++;
        }
      }
      this.patrolIndex = 0;
    }
    hasLineOfSightTo(tx, ty) {
      return this.world.losCache.hasLineOfSight(
        this.world.grid,
        this.entity.gx,
        this.entity.gy,
        tx,
        ty,
        performance.now()
      );
    }
    getDetectionChance() {
      const player = this.world.player;
      if (!player || !player.isAlive) return 0;
      const dx = player.gx - this.entity.gx;
      const dy = player.gy - this.entity.gy;
      const distance = Math.hypot(dx, dy);
      if (distance > AI_CONFIG.VISION_RANGE) return 0;
      if (!this.hasLineOfSightTo(player.gx, player.gy)) return 0;
      const botAngle = this.entity.facingAngle;
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(targetAngle - botAngle);
      angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      let visibility = 0;
      if (angleDiff < AI_CONFIG.CENTRAL_FOV / 2) visibility = 1;
      else if (angleDiff < AI_CONFIG.PERIPHERAL_FOV / 2) {
        const t2 = (angleDiff - AI_CONFIG.CENTRAL_FOV / 2) / ((AI_CONFIG.PERIPHERAL_FOV - AI_CONFIG.CENTRAL_FOV) / 2);
        visibility = AI_CONFIG.PERIPHERAL_FACTOR * (1 - t2);
      } else return 0;
      let distanceFactor = AI_CONFIG.NEAR_FACTOR;
      if (distance > AI_CONFIG.VISION_MID) distanceFactor = AI_CONFIG.FAR_FACTOR;
      else if (distance > AI_CONFIG.VISION_NEAR) distanceFactor = AI_CONFIG.MID_FACTOR;
      return Math.min(1, visibility * distanceFactor);
    }
    canSeePlayer() {
      return Math.random() < this.getDetectionChance();
    }
    soundErrorRadius(loudness, distance, type) {
      const typeMult = SOUND_ERROR_TYPE_MULT[type] ?? 1.2;
      const base = 1.8 + distance * 0.22;
      const loudnessFactor = 1.4 - loudness * 0.9;
      return Math.max(0.8, Math.min(9, base * loudnessFactor * typeMult));
    }
    hearSound() {
      const now = performance.now();
      const sound = this.world.soundManager.getSoundAt(
        this.entity.gx,
        this.entity.gy,
        now
      );
      if (!sound || sound.heardLoudness < 0.05) {
        return { heard: false, interestGain: 0, awarenessGain: 0 };
      }
      const dx = sound.gx - this.entity.gx;
      const dy = sound.gy - this.entity.gy;
      const distance = Math.hypot(dx, dy);
      const err = this.soundErrorRadius(sound.loudness, distance, sound.type);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * err;
      const estGx = Math.round(sound.gx + Math.cos(angle) * r);
      const estGy = Math.round(sound.gy + Math.sin(angle) * r);
      const attenuation = sound.heardLoudness / Math.max(0.01, sound.loudness);
      let conf = Math.min(0.95, Math.max(0.05, sound.loudness * (1 - distance / SOUND_MAX_RANGE) * attenuation));
      const age = now - (sound.time || now);
      conf *= Math.exp(-age / 2500);
      conf = Math.max(0.05, Math.min(0.95, conf));
      let awarenessGain = 6;
      if (sound.type === "explosion") awarenessGain = 18;
      else if (sound.type === "gunshot") awarenessGain = 12;
      else if (sound.type === "footstep") awarenessGain = 5;
      awarenessGain *= conf;
      let interestGain = INTEREST_FACTORS.SOUND_GUNSHOT * sound.heardLoudness;
      if (sound.type === "explosion") interestGain = INTEREST_FACTORS.SOUND_EXPLOSION * sound.heardLoudness;
      return {
        heard: true,
        gx: sound.gx,
        gy: sound.gy,
        estGx,
        estGy,
        conf,
        type: sound.type,
        intensity: sound.heardLoudness,
        interestGain,
        awarenessGain
      };
    }
    sendRadioMessage(type, data, targetBot = null) {
      this.world.radioManager.send(this, type, data, targetBot);
    }
    receiveRadioMessage(msg) {
      if (this.lastReceivedMsgIds.has(msg.id)) return;
      if (this.radioQueue.length >= AI_CONFIG.RADIO_MAX_QUEUE) {
        let idx = -1;
        for (let i = 0; i < this.radioQueue.length; i++) {
          if (this.radioQueue[i].type === RADIO_MSG_TYPE.MOVING_TO || this.radioQueue[i].type === RADIO_MSG_TYPE.HEARD_SHOT) {
            idx = i;
            break;
          }
        }
        if (idx === -1) return;
        this.radioQueue.splice(idx, 1);
      }
      this.lastReceivedMsgIds.add(msg.id);
      this.radioQueue.push(msg);
      this.processRadioQueue();
    }
    processRadioQueue() {
      while (this.radioQueue.length > 0) {
        const msg = this.radioQueue.shift();
        this.handleRadioMessage(msg);
      }
    }
    handleRadioMessage(msg) {
      const now = performance.now();
      switch (msg.type) {
        case RADIO_MSG_TYPE.SPOTTED_PLAYER:
          if (!this.lastSeenPlayerPos || msg.time > this.lastSeenPlayerPos.time) {
            this.lastSeenPlayerPos = { gx: msg.data.gx, gy: msg.data.gy, time: msg.time, conf: 0.85 };
            this.interest = Math.min(100, this.interest + INTEREST_FACTORS.ALLY_INFO);
            this.awareness = Math.min(AWARENESS_MAX, this.awareness + 8);
            this.forceThink();
          }
          break;
        case RADIO_MSG_TYPE.UNDER_FIRE:
          if (!this.lastSeenPlayerPos || msg.time > this.lastSeenPlayerPos.time - 1e3) {
            this.lastSeenPlayerPos = { gx: msg.data.fromGx, gy: msg.data.fromGy, time: msg.time, conf: 0.85 };
            this.interest = Math.min(100, this.interest + INTEREST_FACTORS.ALLY_INFO * 1.5);
            this.awareness = Math.min(AWARENESS_MAX, this.awareness + 12);
            this.forceThink();
          }
          break;
        case RADIO_MSG_TYPE.MOVE_ASIDE:
          if (this.tempMoveTarget && now - this.lastMoveRequestTime < 2e3) return;
          this.lastMoveRequestTime = now;
          if (msg.data.freePos) {
            this.tempMoveTarget = msg.data.freePos;
            this.tempMoveExpiry = now + 1500;
            this.sendRadioMessage(RADIO_MSG_TYPE.ACKNOWLEDGE, { originalMsgId: msg.id }, msg.sender);
          }
          break;
        case RADIO_MSG_TYPE.ACKNOWLEDGE:
          if (this.pendingMoveRequest && this.pendingMoveRequest.id === msg.data.originalMsgId) {
            this.pendingMoveRequest = null;
          }
          break;
      }
    }
    requestAllyToMove(ally) {
      const now = performance.now();
      if (this.lastMoveRequestTime && now - this.lastMoveRequestTime < 2e3) return;
      this.lastMoveRequestTime = now;
      let freePos = null;
      for (const dir of DIRECTIONS) {
        const nx = ally.gx + dir.dx;
        const ny = ally.gy + dir.dy;
        if (this.world.grid.isWalkable(nx, ny, ally) && !(nx === this.entity.gx && ny === this.entity.gy)) {
          freePos = { gx: nx, gy: ny };
          break;
        }
      }
      if (freePos) {
        this.pendingMoveRequest = { id: Date.now() + "_" + Math.random(), target: ally };
        this.sendRadioMessage(RADIO_MSG_TYPE.MOVE_ASIDE, { freePos }, ally);
      }
    }
    isFriendlyInLine(tx, ty) {
      const cells = this.world.grid.getLineCells(this.entity.gx, this.entity.gy, tx, ty);
      for (let i = 1; i < cells.length - 1; i++) {
        const cell = cells[i];
        for (const ally of this.world.entities.values()) {
          if (ally === this.entity || ally.isPlayer) continue;
          if (!ally.isAlive) continue;
          if (ally.gx === cell.x && ally.gy === cell.y) return ally;
        }
      }
      return null;
    }
    isFriendlyInBlastRadius(tx, ty, radius, excludeTarget = null) {
      for (const ally of this.world.entities.values()) {
        if (ally === this.entity || ally.isPlayer) continue;
        if (ally === excludeTarget) continue;
        if (!ally.isAlive) continue;
        const dist = Math.max(Math.abs(ally.gx - tx), Math.abs(ally.gy - ty));
        if (dist <= radius) return ally;
      }
      return null;
    }
    isRocketTrajectoryBlocked(targetGx, targetGy) {
      const dx = targetGx - this.entity.gx;
      const dy = targetGy - this.entity.gy;
      const len = Math.hypot(dx, dy);
      if (len < 1) return false;
      const dirX = dx / len;
      const dirY = dy / len;
      const check = Math.min(ROCKET_TRAJECTORY_CHECK_CELLS, Math.floor(len));
      for (let i = 1; i <= check; i++) {
        const gx = Math.floor(this.entity.gx + dirX * i);
        const gy = Math.floor(this.entity.gy + dirY * i);
        const obs = this.world.grid.getObstacleAtCell(gx, gy);
        if (obs && obs.obstacleResistance >= ROCKET_OBSTACLE_THRESHOLD) return true;
      }
      return false;
    }
    isSelfInBlastRadius(targetGx, targetGy, radius) {
      const dist = Math.max(Math.abs(this.entity.gx - targetGx), Math.abs(this.entity.gy - targetGy));
      return dist <= radius;
    }
    onTakeDamage(damage, source) {
      this.interest = Math.min(100, this.interest + INTEREST_FACTORS.TAKING_DAMAGE);
      this.awareness = Math.min(AWARENESS_MAX, this.awareness + 25);
      if (source && source.gx !== void 0) {
        this.lastSeenPlayerPos = { gx: source.gx, gy: source.gy, time: performance.now(), conf: 0.9 };
        this.publishSharedLastKnown({ gx: source.gx, gy: source.gy, time: performance.now(), conf: 0.9 });
        this.logEvent("damage_taken", {
          fromGx: source.gx,
          fromGy: source.gy,
          damage,
          time: performance.now()
        });
      }
      this.sendRadioMessage(RADIO_MSG_TYPE.UNDER_FIRE, {
        fromGx: source?.gx ?? this.entity.gx,
        fromGy: source?.gy ?? this.entity.gy
      });
      if (this.state !== AI_STATE.COMBAT) {
        this.state = AI_STATE.COMBAT;
        this.stateEntryTime = performance.now();
      }
      this.lostTargetTime = 0;
      this.isAiming = false;
      this.aimStartTime = 0;
      this.forceThink();
    }
    updateInterest(now) {
      const playerVisible = this.canSeePlayer();
      const sound = this.hearSound();
      let delta = 0;
      let lostSight = false;
      const wasVisible = this.lastSeenPlayerPos && now - this.lastSeenPlayerPos.time < 2e3;
      if (playerVisible) {
        delta += INTEREST_FACTORS.VISUAL_CONTACT * 0.5;
        this.lastSeenPlayerPos = { gx: this.world.player.gx, gy: this.world.player.gy, time: now, conf: 0.9 };
        this.publishSharedLastKnown({ gx: this.world.player.gx, gy: this.world.player.gy, time: now, conf: 0.9 });
        this.lostTargetTime = 0;
        this.searchTargetPos = null;
        if (now - this.lastSentSpottedTime > AI_CONFIG.RADIO_THROTTLE_MS) {
          const lp = this.lastSentPlayerPos;
          if (!lp || lp.gx !== this.world.player.gx || lp.gy !== this.world.player.gy) {
            this.sendRadioMessage(RADIO_MSG_TYPE.SPOTTED_PLAYER, {
              gx: this.world.player.gx,
              gy: this.world.player.gy
            });
            this.lastSentSpottedTime = now;
            this.lastSentPlayerPos = { gx: this.world.player.gx, gy: this.world.player.gy };
          }
        }
      } else if (wasVisible && !this.lostTargetTime) {
        lostSight = true;
        this.lostTargetTime = now;
      }
      if (sound.heard) {
        delta += sound.interestGain * 0.5;
        if (!this.lastSeenPlayerPos) {
          this.lastSeenPlayerPos = { gx: sound.estGx, gy: sound.estGy, time: now, conf: sound.conf };
          if (sound.type === "gunshot") {
            this.sendRadioMessage(RADIO_MSG_TYPE.HEARD_SHOT, { gx: sound.estGx, gy: sound.estGy });
          }
        }
      }
      if (lostSight) {
        this.isAiming = false;
        this.aimStartTime = 0;
        this.forceThink();
      }
      const decay = this.state === AI_STATE.COMBAT ? INTEREST_FACTORS.DECAY_COMBAT : this.state === AI_STATE.ALERT ? INTEREST_FACTORS.DECAY_ALERT : INTEREST_FACTORS.DECAY_PATROL;
      const dt = Math.min(0.5, (now - this.lastInterestDecay) / 1e3);
      this.lastInterestDecay = now;
      this.interest = Math.max(0, Math.min(100, this.interest + delta - decay * dt));
      if (now - this.stateEntryTime < AI_CONFIG.MIN_STATE_DURATION) return;
      const oldState = this.state;
      if (this.state === AI_STATE.PATROL && this.interest > INTEREST_THRESHOLDS.PATROL_TO_ALERT) {
        this.state = AI_STATE.ALERT;
        this.stateEntryTime = now;
        this.forceThink();
      } else if (this.state === AI_STATE.ALERT) {
        if (this.interest > INTEREST_THRESHOLDS.ALERT_TO_COMBAT) {
          this.state = AI_STATE.COMBAT;
          this.stateEntryTime = now;
          this.forceThink();
        } else if (this.interest < INTEREST_THRESHOLDS.ALERT_TO_PATROL) {
          this.state = AI_STATE.PATROL;
          this.stateEntryTime = now;
          this.alertPosition = null;
          this.lastSeenPlayerPos = null;
          this.forceThink();
        }
      } else if (this.state === AI_STATE.COMBAT && this.interest < INTEREST_THRESHOLDS.COMBAT_TO_ALERT) {
        this.state = AI_STATE.ALERT;
        this.stateEntryTime = now;
        this.coverPosition = null;
        this.forceThink();
      }
      if (oldState !== this.state) {
        this.sendRadioMessage(RADIO_MSG_TYPE.MOVING_TO, { state: this.state });
      }
    }
    canMoveTo(gx, gy) {
      if (!this.world.grid.isWalkable(gx, gy, this.entity)) return false;
      if (this.world.player && this.world.player.isAlive && this.world.player.gx === gx && this.world.player.gy === gy) return false;
      return true;
    }
    moveTo(gx, gy) {
      const now = performance.now();
      if (now - this.lastMoveTime < this.getMoveDelay()) return false;
      if (!this.canMoveTo(gx, gy)) return false;
      const dx = Math.sign(gx - this.entity.gx);
      const dy = Math.sign(gy - this.entity.gy);
      this.entity.gx = gx;
      this.entity.gy = gy;
      this.entity.moveDirection = { dx, dy };
      this.entity.faceMovementDirection();
      this.entity.updateSpriteRotation();
      this.world.soundManager.emitSound(gx, gy, SOUND_LOUDNESS.footstep, "footstep", this.entity);
      this.lastMoveTime = now;
      return true;
    }
    moveToward(tx, ty) {
      const pathfinder = this.world.pathfinding;
      if (this.currentPath && this.pathExpiry > performance.now() && this.pathIndex < this.currentPath.length) {
        const next = this.currentPath[this.pathIndex];
        if (this.entity.gx === next.gx && this.entity.gy === next.gy) {
          this.pathIndex++;
        }
        if (this.pathIndex < this.currentPath.length) {
          const step2 = this.currentPath[this.pathIndex];
          this.moveTo(step2.gx, step2.gy);
        }
        return;
      }
      const ctx = {
        targetGx: tx,
        targetGy: ty,
        caution: this.personality.caution
      };
      const path = pathfinder.findPath(this.entity.gx, this.entity.gy, tx, ty, this.entity, 30, ctx);
      if (path && path.length > 0) {
        this.currentPath = path;
        this.pathIndex = 0;
        this.pathExpiry = this.computePathExpiry(path.length);
        this.logEvent("path_planned", { tx, ty, length: path.length });
        const step2 = path[0];
        this.moveTo(step2.gx, step2.gy);
        return;
      }
      const step = pathfinder.stepToward(this.entity.gx, this.entity.gy, tx, ty, this.entity);
      if (step) this.moveTo(step.gx, step.gy);
    }
    moveAwayFrom(tx, ty) {
      const dx = Math.sign(this.entity.gx - tx);
      const dy = Math.sign(this.entity.gy - ty);
      if (dx !== 0 && this.canMoveTo(this.entity.gx + dx, this.entity.gy)) {
        this.moveTo(this.entity.gx + dx, this.entity.gy);
      } else if (dy !== 0 && this.canMoveTo(this.entity.gx, this.entity.gy + dy)) {
        this.moveTo(this.entity.gx, this.entity.gy + dy);
      }
    }
    strafe(now) {
      const intensity = this.personality.aggression + 0.3;
      if (now - this.lastStrafeTime < 1200 / Math.max(0.2, intensity)) return;
      const options = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
      const dir = options[Math.floor(Math.random() * options.length)];
      if (this.canMoveTo(this.entity.gx + dir.dx, this.entity.gy + dir.dy)) {
        this.moveTo(this.entity.gx + dir.dx, this.entity.gy + dir.dy);
        this.lastStrafeTime = now;
      }
    }
    findSearchPosition() {
      if (!this.lastSeenPlayerPos) return null;
      const sector = this.world.grid.sector;
      if (!sector) return null;
      const baseGx = this.lastSeenPlayerPos.gx;
      const baseGy = this.lastSeenPlayerPos.gy;
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 1 + Math.floor(Math.random() * LOST_TARGET_SEARCH_RADIUS);
        const gx = Math.max(0, Math.min(sector.width - 1, baseGx + Math.round(Math.cos(angle) * radius)));
        const gy = Math.max(0, Math.min(sector.height - 1, baseGy + Math.round(Math.sin(angle) * radius)));
        if (this.canMoveTo(gx, gy)) return { gx, gy };
      }
      return null;
    }
    isBadCover(gx, gy) {
      const ctx = this.readContext();
      for (const f of ctx.recentCoverFailed) {
        if (Math.abs(f.gx - gx) <= 1 && Math.abs(f.gy - gy) <= 1) return true;
      }
      return false;
    }
    findBestCover() {
      const player = this.world.player;
      let best = null;
      let bestScore = -1;
      const R = AI_CONFIG.COVER_SEARCH_RADIUS;
      const gm = this.getGroupManager();
      const now = performance.now();
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const gx = this.entity.gx + dx;
          const gy = this.entity.gy + dy;
          if (!this.world.grid.isWalkable(gx, gy, this.entity)) continue;
          const obs = this.world.grid.getObstacleAtCell(gx, gy);
          const cover = obs ? obs.coverValue : 0;
          if (cover < 0.2) continue;
          if (gm && gm.isReserved({ gx, gy }, this.entity.id, now)) continue;
          if (this.isBadCover(gx, gy)) continue;
          const pathLen = this.findPathLength(gx, gy);
          if (pathLen === -1) continue;
          let score = cover / (pathLen + 1);
          if (player && player.isAlive && !this.hasLineOfSightTo(gx, gy)) {
            score *= 1.5;
          }
          if (score > bestScore) {
            bestScore = score;
            best = { gx, gy };
          }
        }
      }
      if (best && gm) {
        gm.reserve(best, this.entity.id, now);
      }
      return best;
    }
    findBestFiringPos(targetGx, targetGy) {
      if (targetGx === void 0 || targetGy === void 0) return null;
      let best = null;
      let bestScore = -1;
      const R = AI_CONFIG.COVER_SEARCH_RADIUS;
      const weapon = this.entity.getActiveWeapon();
      const preferred = weapon ? weapon.preferredDistance : 8;
      const gm = this.getGroupManager();
      const now = performance.now();
      const ctx = this.readContext();
      const avoid = ctx.recentDamageFrom ? ctx.recentDamageFrom : null;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const gx = this.entity.gx + dx;
          const gy = this.entity.gy + dy;
          if (!this.world.grid.isWalkable(gx, gy, this.entity)) continue;
          const obs = this.world.grid.getObstacleAtCell(gx, gy);
          const cover = obs ? obs.coverValue : 0;
          if (cover < 0.25) continue;
          if (gm && gm.isReserved({ gx, gy }, this.entity.id, now)) continue;
          if (this.isBadCover(gx, gy)) continue;
          const hasLOS = this.hasLineOfSightTo(targetGx, targetGy);
          const dist = Math.max(Math.abs(gx - targetGx), Math.abs(gy - targetGy));
          const distScore = Math.max(0, 1 - Math.abs(dist - preferred) / Math.max(1, preferred));
          const pathLen = this.findPathLength(gx, gy);
          if (pathLen === -1) continue;
          let score = (hasLOS ? 1.2 : 0.4) * cover * distScore / (pathLen + 1);
          if (avoid && Math.abs(gx - avoid.fromGx) <= 2 && Math.abs(gy - avoid.fromGy) <= 2) {
            score *= 0.5;
          }
          if (score > bestScore) {
            bestScore = score;
            best = { gx, gy };
          }
        }
      }
      if (best && gm) {
        gm.reserve(best, this.entity.id, now);
      }
      return best;
    }
    findPathLength(tx, ty) {
      const path = this.world.pathfinding.findPath(this.entity.gx, this.entity.gy, tx, ty, this.entity, 20);
      return path ? path.length : -1;
    }
    tryUseMedkit(now) {
      if (now - this.lastMedkitTime < 3e3) return false;
      if (this.entity.hp >= this.entity.maxHp * BOT_MEDKIT_THRESHOLD) return false;
      const belt = this.entity.inventory.belt;
      let idx = -1;
      for (let i = 0; i < belt.length; i++) {
        if (belt[i] && belt[i].id === "medkit") {
          idx = i;
          break;
        }
      }
      if (idx === -1) return false;
      const item = this.entity.inventory.useBelt(idx);
      if (!item) return false;
      const def = CONSUMABLE_ITEMS[item.id];
      if (!def) return false;
      this.entity.hp = Math.min(this.entity.maxHp, this.entity.hp + def.healAmount);
      this.lastMedkitTime = now;
      return true;
    }
    tryThrowGrenade(now) {
      if (now - this.lastGrenadeTime < BOT_GRENADE_COOLDOWN_MS) return false;
      const player = this.world.player;
      if (!player || !player.isAlive) return false;
      const distance = this.entity.getDistanceTo(player.gx, player.gy, "euclidean");
      if (distance < 2 || distance > BOT_GRENADE_RANGE + 2) return false;
      const hpPercent = this.entity.hp / this.entity.maxHp;
      const suppression = this.entity.suppression;
      const retreating = hpPercent < 0.5 || suppression > 0.6;
      const belt = this.entity.inventory.belt;
      let smokeIdx = -1;
      let fragIdx = -1;
      for (let i = 0; i < belt.length; i++) {
        if (!belt[i]) continue;
        if (belt[i].id === "grenade_smoke" && smokeIdx === -1) smokeIdx = i;
        if (belt[i].id === "grenade_frag" && fragIdx === -1) fragIdx = i;
      }
      const FRAG_EXPLOSION_RADIUS = 2;
      const FF_BUFFER = AI_CONFIG.GRENADE_FF_BUFFER_CELLS;
      const fragFFRadius = FRAG_EXPLOSION_RADIUS + FF_BUFFER;
      if (retreating && smokeIdx !== -1) {
        const tx = Math.round(this.entity.gx + (player.gx - this.entity.gx) * 0.4);
        const ty = Math.round(this.entity.gy + (player.gy - this.entity.gy) * 0.4);
        const allyInSmoke = this.isFriendlyInBlastRadius(tx, ty, 1);
        if (!allyInSmoke) {
          const ok = this.entity.throwGrenade(tx, ty, "grenade_smoke");
          if (ok) {
            this.lastGrenadeTime = now;
            return true;
          }
        }
      }
      if (!retreating && fragIdx !== -1 && distance <= BOT_GRENADE_RANGE) {
        if (this.isSelfInBlastRadius(player.gx, player.gy, fragFFRadius)) return false;
        const ally = this.isFriendlyInBlastRadius(player.gx, player.gy, fragFFRadius, player);
        if (ally) return false;
        const ok = this.entity.throwGrenade(player.gx, player.gy, "grenade_frag");
        if (ok) {
          this.lastGrenadeTime = now;
          return true;
        }
      }
      return false;
    }
    shootAtPlayer(now) {
      if (now < this.holdFireUntil) return;
      const weapon = this.entity.getActiveWeapon();
      if (!weapon) return;
      const player = this.world.player;
      if (!player || !player.isAlive) return;
      if (player.invulnerableUntil && now < player.invulnerableUntil) return;
      if (this.lastBurstEndTime && now - this.lastBurstEndTime < AI_CONFIG.BURST_COOLDOWN) return;
      if (now - this.lastShotTime < weapon.fireRate) return;
      const distance = this.entity.getDistanceTo(player.gx, player.gy, "euclidean");
      if (distance > weapon.range) return;
      if (this.getDetectionChance() < SHOOTING_THRESHOLD) return;
      const friendly = this.isFriendlyInLine(player.gx, player.gy);
      if (friendly) {
        this.requestAllyToMove(friendly);
        this.holdFireUntil = now + AI_CONFIG.INTENT_HOLD_FIRE_AFTER_ALLY_MS;
        return;
      }
      if (weapon.ammoId === "rocket") {
        const rocketFFRadius = 3;
        if (this.isSelfInBlastRadius(player.gx, player.gy, rocketFFRadius)) return;
        const near = this.isFriendlyInBlastRadius(player.gx, player.gy, rocketFFRadius);
        if (near) return;
        if (this.isRocketTrajectoryBlocked(player.gx, player.gy)) return;
      }
      if (!this.hasLineOfSightTo(player.gx, player.gy)) return;
      let resistance = 0;
      const processed = /* @__PURE__ */ new Set();
      const cells = this.world.grid.getLineCells(this.entity.gx, this.entity.gy, player.gx, player.gy);
      for (const cell of cells) {
        const obs = this.world.grid.getObstacleAtCell(cell.x, cell.y);
        if (obs && !processed.has(obs.id)) {
          processed.add(obs.id);
          resistance += obs.obstacleResistance;
          if (resistance >= 1) return;
        }
      }
      const gm = this.getGroupManager();
      if (gm && !gm.canShoot(this.entity, player.gx, player.gy, now)) {
        return;
      }
      this.lastShotTime = now;
      const lead = this.getLeadTarget(player);
      const targetGx = lead ? lead.gx : player.gx;
      const targetGy = lead ? lead.gy : player.gy;
      this.logEvent("shot_fired", { fromGx: this.entity.gx, fromGy: this.entity.gy, tx: targetGx, ty: targetGy });
      this.entity.shoot(targetGx, targetGy);
    }
    trySuppressiveFire(now) {
      if (now - this.lastSuppressiveFireTime < SUPPRESSIVE_FIRE_COOLDOWN_MS) return false;
      if (!this.lastSeenPlayerPos) return false;
      if (now - this.lastSeenPlayerPos.time > 2e3) return false;
      const weapon = this.entity.getActiveWeapon();
      if (!weapon) return false;
      if (weapon.ammoId === "rocket" || weapon.ammoId === "pellet") return false;
      if (this.entity.currentAmmo < weapon.magazineSize * 0.3) return false;
      if (this.entity.suppression > 0.5) return false;
      if (this.entity.isReloading) return false;
      if (now - this.lastShotTime < weapon.fireRate) return false;
      const friendly = this.isFriendlyInLine(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
      if (friendly) return false;
      this.lastSuppressiveFireTime = now;
      this.lastShotTime = now;
      const offsetX = Math.round((Math.random() - 0.5) * SUPPRESSIVE_FIRE_SPREAD * 4);
      const offsetY = Math.round((Math.random() - 0.5) * SUPPRESSIVE_FIRE_SPREAD * 4);
      const targetGx = this.lastSeenPlayerPos.gx + offsetX;
      const targetGy = this.lastSeenPlayerPos.gy + offsetY;
      this.entity.faceTarget(targetGx, targetGy);
      this.entity.updateSpriteRotation();
      this.entity.shoot(targetGx, targetGy);
      return true;
    }
    findBestPOI() {
      const sectorId = this.world.currentSectorId;
      const pois = this.world.poiManager.getActiveForSector(sectorId);
      if (pois.length === 0) return null;
      let best = null;
      let bestScore = -Infinity;
      for (const poi of pois) {
        if (poi.type === POI_TYPE.LOOT) {
          const dist = this.entity.getDistanceTo(poi.gx, poi.gy, "chebyshev");
          const score = 50 / (dist + 1) * (1 + this.personality.discipline * 0.2);
          if (score > bestScore) {
            bestScore = score;
            best = poi;
          }
        } else if (poi.type === POI_TYPE.ALERT) {
          const dist = this.entity.getDistanceTo(poi.gx, poi.gy, "chebyshev");
          const score = 70 / (dist + 1) * (1 + this.personality.aggression);
          if (score > bestScore) {
            bestScore = score;
            best = poi;
          }
        }
      }
      return best;
    }
    update(now) {
      if (now - this.lastThinkTime < this.getThinkInterval()) return;
      this.lastThinkTime = now;
      this.updateInterest(now);
      this.updateAwareness(now);
      const situation = this.assessSituation(now);
      const criticalChange = this.state === AI_STATE.COMBAT && !this.wasInCombat || situation.hpPercent < 0.2 || situation.playerVisible && !this.wasPlayerVisible;
      this.wasInCombat = this.state === AI_STATE.COMBAT;
      this.wasPlayerVisible = situation.playerVisible;
      const newIntent = this.chooseIntent(situation, now);
      if (criticalChange) {
        this.forceIntent(newIntent, now);
      } else {
        this.setIntent(newIntent, now);
      }
      this.executeIntent(now, situation);
    }
    executeIntent(now, situation) {
      if (this.currentIntent === INTENT.FALL_BACK) {
        this.executeFallBack(now, situation);
      } else if (this.currentIntent === INTENT.PUSH) {
        this.executePush(now, situation);
      } else if (this.currentIntent === INTENT.HOLD) {
        this.executeHold(now, situation);
      } else if (this.currentIntent === INTENT.SEARCH) {
        this.executeSearch(now, situation);
      } else {
        this.executePatrol(now, situation);
      }
    }
    executeFallBack(now, situation) {
      this.publishAllyAction(GROUP_ACTION_TYPE.FALLING_BACK, { gx: this.entity.gx, gy: this.entity.gy });
      this.tryUseMedkit(now);
      if (!this.coverPosition || this.isCoverInvalid()) {
        this.coverPosition = this.findBestCover();
      }
      if (this.coverPosition) {
        const d = this.entity.getDistanceTo(this.coverPosition.gx, this.coverPosition.gy, "chebyshev");
        if (d > 1) {
          this.moveToward(this.coverPosition.gx, this.coverPosition.gy);
          return;
        }
      }
      if (situation.playerAlive) {
        this.moveAwayFrom(this.world.player.gx, this.world.player.gy);
      }
    }
    executePush(now, situation) {
      this.tryUseMedkit(now);
      if (!situation.playerAlive) {
        this.executeSearch(now, situation);
        return;
      }
      const player = this.world.player;
      if (situation.role === GROUP_ROLE.FLANK) {
        this.publishAllyAction(GROUP_ACTION_TYPE.MOVING_FLANK, { gx: player.gx, gy: player.gy });
      }
      if (this.tryThrowGrenade(now)) return;
      if (situation.playerVisible) {
        this.entity.smoothFaceTarget(player.gx, player.gy, now);
        this.entity.updateSpriteRotation();
        this.tryShoot(now, situation);
      }
      if (situation.distance > situation.preferred) {
        if (!this.firingPosition || this.isFiringPosInvalid(player.gx, player.gy)) {
          this.firingPosition = this.findBestFiringPos(player.gx, player.gy);
        }
        if (this.firingPosition) {
          const d = this.entity.getDistanceTo(this.firingPosition.gx, this.firingPosition.gy, "chebyshev");
          if (d > 1 && d < 6) {
            this.moveToward(this.firingPosition.gx, this.firingPosition.gy);
            return;
          }
        }
        this.moveToward(player.gx, player.gy);
      } else {
        this.executeHold(now, situation);
      }
    }
    executeHold(now, situation) {
      this.tryUseMedkit(now);
      const player = this.world.player;
      const role = situation.role;
      const ctx = situation.context;
      if (role === GROUP_ROLE.SUPPRESS) {
        this.publishAllyAction(GROUP_ACTION_TYPE.SUPPRESSING, { gx: this.entity.gx, gy: this.entity.gy });
      } else if (role === GROUP_ROLE.ANCHOR) {
        this.publishAllyAction(GROUP_ACTION_TYPE.HOLDING, { gx: this.entity.gx, gy: this.entity.gy });
      }
      if (situation.playerVisible && player) {
        this.entity.smoothFaceTarget(player.gx, player.gy, now);
        this.entity.updateSpriteRotation();
        this.tryShoot(now, situation);
        if (this.tryThrowGrenade(now)) return;
        if (now - this.lastStrafeTime > 1500 && Math.random() < this.personality.aggression) {
          this.strafe(now);
        }
        return;
      }
      if (situation.lastSeenFresh) {
        if (ctx && ctx.recentAllyAction && ctx.recentAllyAction.type === GROUP_ACTION_TYPE.MOVING_FLANK) {
          if (this.trySuppressiveFire(now)) return;
        } else {
          if (this.trySuppressiveFire(now)) return;
        }
        if (this.lastSeenPlayerPos) {
          this.entity.faceTarget(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
          this.entity.updateSpriteRotation();
        }
      }
    }
    executeSearch(now, situation) {
      this.tryUseMedkit(now);
      if (!this.lastSeenPlayerPos) {
        this.executePatrol(now, situation);
        return;
      }
      if (!this.searchPhase) {
        this.searchPhase = "listen";
        this.searchPhaseStart = now;
      }
      const phaseElapsed = now - this.searchPhaseStart;
      if (this.searchPhase === "listen") {
        const listenDur = AI_CONFIG.LISTEN_DURATION_MIN_MS + Math.random() * (AI_CONFIG.LISTEN_DURATION_MAX_MS - AI_CONFIG.LISTEN_DURATION_MIN_MS);
        this.entity.faceTarget(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
        this.entity.updateSpriteRotation();
        if (phaseElapsed >= listenDur) {
          this.searchPhase = "investigate";
          this.searchPhaseStart = now;
          const invMin = AI_CONFIG.INVESTIGATE_DURATION_MIN_MS;
          const invMax = AI_CONFIG.INVESTIGATE_DURATION_MAX_MS;
          this.intentExpiry = Math.max(this.intentExpiry, now + invMin + Math.random() * (invMax - invMin));
        }
        return;
      }
      const d = this.entity.getDistanceTo(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy, "chebyshev");
      if (d > 1.5) {
        this.moveToward(this.lastSeenPlayerPos.gx, this.lastSeenPlayerPos.gy);
      } else {
        if (!this.searchTargetPos) {
          this.searchTargetPos = this.findSearchPosition();
        }
        if (this.searchTargetPos) {
          const sd = this.entity.getDistanceTo(this.searchTargetPos.gx, this.searchTargetPos.gy, "chebyshev");
          if (sd > 1) {
            this.moveToward(this.searchTargetPos.gx, this.searchTargetPos.gy);
          } else {
            this.searchTargetPos = this.findSearchPosition();
          }
        }
      }
    }
    executePatrol(now, situation) {
      if (this.tempMoveTarget && now < this.tempMoveExpiry) {
        const dist2 = this.entity.getDistanceTo(this.tempMoveTarget.gx, this.tempMoveTarget.gy, "chebyshev");
        if (dist2 > 1) {
          this.moveToward(this.tempMoveTarget.gx, this.tempMoveTarget.gy);
          return;
        }
        this.tempMoveTarget = null;
      }
      this.tryUseMedkit(now);
      const poi = this.findBestPOI();
      if (poi) {
        const dist2 = this.entity.getDistanceTo(poi.gx, poi.gy, "chebyshev");
        if (dist2 > 1) {
          this.moveToward(poi.gx, poi.gy);
          return;
        }
        if (poi.type === POI_TYPE.LOOT) {
          this.world.collectPOILoot(poi, this.entity);
        } else if (poi.type === POI_TYPE.ALERT) {
          this.world.poiManager.expire(poi);
        }
        return;
      }
      if (this.patrolRoute.length === 0) {
        this.generatePatrolRoute();
        return;
      }
      const target = this.patrolRoute[this.patrolIndex];
      if (!target) {
        this.patrolIndex = 0;
        return;
      }
      const dist = this.entity.getDistanceTo(target.gx, target.gy, "chebyshev");
      if (dist <= 1) {
        if (now > this.patrolPauseUntil) {
          this.patrolPauseUntil = now + AI_CONFIG.PATROL_PAUSE_MIN + Math.random() * (AI_CONFIG.PATROL_PAUSE_MAX - AI_CONFIG.PATROL_PAUSE_MIN);
          this.patrolIndex = (this.patrolIndex + 1) % this.patrolRoute.length;
        }
        return;
      }
      this.moveToward(target.gx, target.gy);
    }
    isCoverInvalid() {
      if (!this.coverPosition) return true;
      const obs = this.world.grid.getObstacleAtCell(this.coverPosition.gx, this.coverPosition.gy);
      return !obs || obs.coverValue < 0.2;
    }
    isFiringPosInvalid(targetGx, targetGy) {
      if (!this.firingPosition) return true;
      const obs = this.world.grid.getObstacleAtCell(this.firingPosition.gx, this.firingPosition.gy);
      if (!obs || obs.coverValue < 0.25) return true;
      if (!this.hasLineOfSightTo(targetGx, targetGy)) return true;
      return false;
    }
    tryShoot(now, situation) {
      const player = this.world.player;
      if (!player) return;
      const dx = player.gx - this.entity.gx;
      const dy = player.gy - this.entity.gy;
      const angle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(angle - this.entity.facingAngle);
      angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      if (angleDiff < 0.2) {
        if (!this.isAiming) {
          this.isAiming = true;
          this.aimStartTime = now;
        }
        if (now - this.aimStartTime >= this.getAimDelay()) {
          this.shootAtPlayer(now);
          this.isAiming = false;
        }
      } else {
        this.isAiming = false;
      }
    }
  }
  class Stats {
    constructor(health = 10, strength = 10, accuracy = 10, endurance = 10) {
      this.health = health;
      this.strength = strength;
      this.accuracy = accuracy;
      this.endurance = endurance;
    }
    get maxHp() {
      return this.health * 6;
    }
    get carryCapacityKg() {
      return this.strength * 3;
    }
    canAddStat(stat) {
      return this[stat] !== void 0 && this[stat] < STATS_CAP;
    }
    addStat(stat, amount = 1) {
      if (!this.canAddStat(stat)) return false;
      this[stat] = Math.min(STATS_CAP, this[stat] + amount);
      return true;
    }
    clone() {
      return new Stats(this.health, this.strength, this.accuracy, this.endurance);
    }
    serialize() {
      return {
        health: this.health,
        strength: this.strength,
        accuracy: this.accuracy,
        endurance: this.endurance
      };
    }
    static deserialize(data) {
      return new Stats(data.health, data.strength, data.accuracy, data.endurance);
    }
  }
  const ARMOR_ITEMS = {
    helmet_light: {
      id: "helmet_light",
      nameKey: "armor.helmet_light",
      slot: "head",
      armorClass_mm: 2,
      coverage: ["head"],
      weight: 5,
      spriteKey: "helmet_1",
      invSize: [1, 1]
    },
    helmet_medium: {
      id: "helmet_medium",
      nameKey: "armor.helmet_medium",
      slot: "head",
      armorClass_mm: 4,
      coverage: ["head"],
      weight: 8,
      spriteKey: "helmet_2",
      invSize: [1, 1]
    },
    helmet_heavy: {
      id: "helmet_heavy",
      nameKey: "armor.helmet_heavy",
      slot: "head",
      armorClass_mm: 6,
      coverage: ["head"],
      weight: 12,
      spriteKey: "helmet_3",
      invSize: [1, 1]
    },
    vest_light: {
      id: "vest_light",
      nameKey: "armor.vest_light",
      slot: "body",
      armorClass_mm: 3,
      coverage: ["torso", "arms"],
      weight: 10,
      spriteKey: "vest_1",
      invSize: [2, 2]
    },
    vest_medium: {
      id: "vest_medium",
      nameKey: "armor.vest_medium",
      slot: "body",
      armorClass_mm: 5,
      coverage: ["torso", "arms"],
      weight: 15,
      spriteKey: "vest_2",
      invSize: [2, 2]
    },
    vest_heavy: {
      id: "vest_heavy",
      nameKey: "armor.vest_heavy",
      slot: "body",
      armorClass_mm: 7,
      coverage: ["torso", "arms"],
      weight: 20,
      spriteKey: "vest_3",
      invSize: [2, 2]
    },
    pants_light: {
      id: "pants_light",
      nameKey: "armor.pants_light",
      slot: "legs",
      armorClass_mm: 2,
      coverage: ["legs"],
      weight: 6,
      spriteKey: "pants_1",
      invSize: [2, 1]
    },
    pants_heavy: {
      id: "pants_heavy",
      nameKey: "armor.pants_heavy",
      slot: "legs",
      armorClass_mm: 4,
      coverage: ["legs"],
      weight: 9,
      spriteKey: "pants_2",
      invSize: [2, 1]
    },
    boots: {
      id: "boots",
      nameKey: "armor.boots",
      slot: "foot",
      armorClass_mm: 1.5,
      coverage: ["feet"],
      weight: 3,
      spriteKey: "boots_1",
      invSize: [1, 1]
    }
  };
  const HIT_ZONES = {
    head: { id: "head", nameKey: "zone.head", chance: 0.08, multiplier: 3, armorSlot: "head" },
    torso: { id: "torso", nameKey: "zone.torso", chance: 0.45, multiplier: 1, armorSlot: "body" },
    arms: { id: "arms", nameKey: "zone.arms", chance: 0.17, multiplier: 0.7, armorSlot: "body" },
    legs: { id: "legs", nameKey: "zone.legs", chance: 0.2, multiplier: 0.6, armorSlot: "legs" },
    feet: { id: "feet", nameKey: "zone.feet", chance: 0.1, multiplier: 0.4, armorSlot: "foot" }
  };
  function rollHitZone() {
    const roll = Math.random();
    let cumulative = 0;
    for (const zone of Object.values(HIT_ZONES)) {
      cumulative += zone.chance;
      if (roll < cumulative) return zone;
    }
    return HIT_ZONES.torso;
  }
  const GRID_W = 10;
  const GRID_H = 4;
  const BELT_SLOTS = 4;
  class Inventory {
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
    getWeapon() {
      return this.slots.weapon;
    }
    getSecondary() {
      return this.slots.secondary;
    }
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
        if (this.belt[i] && this.belt[i].id === id) {
          this.belt[i] = null;
          removed++;
        }
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
        if (slot && slot.weight !== void 0) w += slot.weight;
      }
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const e = this.grid[y][x];
          if (e && e.gx === x && e.gy === y && e.item.weight !== void 0) w += e.item.weight;
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
  class Entity {
    constructor({ id, type, gx, gy, profile, world }) {
      this.id = id;
      this.type = type;
      this.gx = gx;
      this.gy = gy;
      this.world = world;
      this.isPlayer = type === "player";
      this.profile = profile || null;
      this.stats = new Stats();
      this.hp = this.stats.maxHp;
      this.inventory = new Inventory();
      this.moveCooldown = 0;
      this.moveDirection = { dx: 0, dy: 0 };
      this.isMoving = false;
      this.spriteElement = null;
      this.hpBarElement = null;
      this.facingAngle = 0;
      this.lastTurnTime = 0;
      this.lastMoveOrTurn = 0;
      this.activeWeaponSlot = "primary";
      this.currentWeaponId = null;
      this.currentAmmo = 0;
      this.isReloading = false;
      this.reloadEndTime = 0;
      this.lastShotTime = 0;
      this.recoil = 0;
      this.suppression = 0;
      this.currentBurstId = null;
      this.bloom = 0;
      this.botBrain = null;
      this.xp = 0;
      this.level = 1;
      this.pointsAvailable = 0;
      this.invulnerableUntil = 0;
    }
    get maxHp() {
      return this.stats.maxHp;
    }
    get isAlive() {
      return this.hp > 0;
    }
    getActiveWeapon() {
      return WEAPONS[this.currentWeaponId] || null;
    }
    equipWeapon(weaponId) {
      const weapon = WEAPONS[weaponId];
      if (!weapon) return false;
      this.currentWeaponId = weaponId;
      this.inventory.equip(weapon.slot, { id: weaponId, weight: weapon.weight });
      this.currentAmmo = weapon.magazineSize;
      return true;
    }
    switchWeaponSlot() {
      const targetSlot = this.activeWeaponSlot === "primary" ? "secondary" : "primary";
      const invSlot = targetSlot === "primary" ? "weapon" : "secondary";
      const item = this.inventory.slots[invSlot];
      if (!item) return false;
      const weapon = WEAPONS[item.id];
      if (!weapon) return false;
      this.activeWeaponSlot = targetSlot;
      this.currentWeaponId = item.id;
      this.currentAmmo = weapon.magazineSize;
      this.isReloading = false;
      this.currentBurstId = null;
      this.bloom = 0;
      return true;
    }
    getDistanceTo(targetGx, targetGy, metric = "chebyshev") {
      const dx = Math.abs(targetGx - this.gx);
      const dy = Math.abs(targetGy - this.gy);
      return metric === "euclidean" ? Math.hypot(dx, dy) : Math.max(dx, dy);
    }
    faceMovementDirection() {
      if (this.moveDirection.dx !== 0 || this.moveDirection.dy !== 0) {
        this.facingAngle = Math.atan2(this.moveDirection.dy, this.moveDirection.dx);
        this.lastMoveOrTurn = performance.now();
      }
    }
    faceTarget(targetGx, targetGy) {
      const dx = targetGx - this.gx;
      const dy = targetGy - this.gy;
      if (dx !== 0 || dy !== 0) {
        this.facingAngle = Math.atan2(dy, dx);
        this.lastMoveOrTurn = performance.now();
      }
    }
    smoothFaceTarget(targetGx, targetGy, now) {
      if (now - this.lastTurnTime < BOT_TURN_DELAY_MS) return;
      this.faceTarget(targetGx, targetGy);
      this.lastTurnTime = now;
    }
    updateSpriteRotation() {
      if (this.spriteElement) {
        this.spriteElement.style.transform = "rotate(" + (this.facingAngle + SPRITE_ANGLE_OFFSET) + "rad)";
        this.spriteElement.style.transformOrigin = CELL_SIZE / 2 + "px " + CELL_SIZE / 2 + "px";
      }
    }
    calculateAccuracy(weapon) {
      const now = performance.now();
      let acc = weapon.accuracy;
      acc *= 1 - this.suppression * 0.5;
      if (this.isMoving) acc *= 1 - weapon.movementPenalty;
      const aimTime = weapon.aimTime || 250;
      const aimProgress = Math.max(0, Math.min(1, (now - this.lastMoveOrTurn) / aimTime));
      acc *= 0.55 + 0.45 * aimProgress;
      if (now - this.lastShotTime > 600) {
        acc *= weapon.firstShotMultiplier || 1;
      }
      acc += (this.stats.endurance - 10) * 0.02;
      acc -= this.bloom;
      return Math.max(0.08, Math.min(0.97, acc));
    }
    shoot(targetGx, targetGy) {
      const weapon = this.getActiveWeapon();
      if (!weapon) return false;
      const now = performance.now();
      if (now - this.lastShotTime < weapon.fireRate) return false;
      if (this.currentAmmo <= 0) {
        this.reload();
        return false;
      }
      if (this.getDistanceTo(targetGx, targetGy, "euclidean") > weapon.range) return false;
      const visible = this.world.losCache.hasLineOfSight(
        this.world.grid,
        this.gx,
        this.gy,
        targetGx,
        targetGy,
        now
      );
      if (!visible) return false;
      this.lastShotTime = now;
      this.faceTarget(targetGx, targetGy);
      this.updateSpriteRotation();
      const loudness = SOUND_LOUDNESS[weapon.ammoId] || 0.5;
      this.world.soundManager.emitSound(this.gx, this.gy, loudness, "gunshot", this);
      this.world.createAlertPOI(this.gx, this.gy);
      const burst = weapon.burstCount > 1;
      const actualBurst = burst ? weapon.burstCount > 2 ? weapon.burstCount + Math.floor(Math.random() * 3) - 1 : weapon.burstCount : 1;
      if (burst) {
        this.fireBurst(targetGx, targetGy, weapon, actualBurst);
      } else {
        this.fireSingle(targetGx, targetGy, weapon);
      }
      return true;
    }
    fireBurst(targetGx, targetGy, weapon, burstCount) {
      const burstId = Date.now() + "_" + Math.random();
      this.currentBurstId = burstId;
      let fired = 0;
      const self = this;
      const fireNext = () => {
        if (self.currentBurstId !== burstId) return;
        if (self.currentAmmo <= 0) return;
        if (self.hp <= 0) return;
        self.fireSingle(targetGx, targetGy, weapon);
        fired++;
        if (fired < burstCount) {
          self.world.taskQueue.schedule(weapon.burstInterval, fireNext);
        } else if (self.botBrain) {
          self.botBrain.lastBurstEndTime = performance.now();
        }
      };
      fireNext();
    }
    fireSingle(targetGx, targetGy, weapon) {
      if (this.currentAmmo <= 0) {
        this.reload();
        return;
      }
      performance.now();
      const finalAccuracy = this.calculateAccuracy(weapon);
      const startGx = this.gx;
      const startGy = this.gy;
      const targetX = targetGx + 0.5;
      const targetY = targetGy + 0.5;
      const startX = startGx + 0.5;
      const startY = startGy + 0.5;
      const dx = targetX - startX;
      const dy = targetY - startY;
      const len = Math.hypot(dx, dy) || 1;
      const dirX = dx / len;
      const dirY = dy / len;
      const spreadAngle = (1 - finalAccuracy) * 0.75 + this.bloom;
      const angleOffset = (Math.random() - 0.5) * spreadAngle;
      const cos = Math.cos(angleOffset);
      const sin = Math.sin(angleOffset);
      const finalDirX = dirX * cos - dirY * sin;
      const finalDirY = dirX * sin + dirY * cos;
      const ammo = AMMUNITION_TYPES[weapon.ammoId];
      const pellets = ammo.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        let pdx = finalDirX;
        let pdy = finalDirY;
        if (pellets > 1) {
          const pAngle = (Math.random() - 0.5) * (1 - weapon.accuracy) * 0.3;
          pdx = finalDirX * Math.cos(pAngle) - finalDirY * Math.sin(pAngle);
          pdy = finalDirX * Math.sin(pAngle) + finalDirY * Math.cos(pAngle);
        }
        const proj = new ProjectileLazy({
          weapon,
          ammo,
          startGx,
          startGy,
          dirX: pdx,
          dirY: pdy,
          owner: this,
          world: this.world
        });
        this.world.addProjectile(proj);
      }
      this.currentAmmo--;
      this.recoil = Math.min(weapon.maxRecoil, this.recoil + weapon.recoilPerShot);
      this.bloom = Math.min(weapon.bloomMax, this.bloom + weapon.bloomPerShot);
    }
    throwGrenade(targetGx, targetGy, itemId) {
      const now = performance.now();
      if (now - this.lastShotTime < 500) return false;
      if (!targetGx && targetGx !== 0) return false;
      if (!targetGy && targetGy !== 0) return false;
      const beltItem = this.inventory.belt.find((b) => b && b.id === itemId);
      if (!beltItem) return false;
      const idx = this.inventory.belt.findIndex((b) => b && b.id === itemId);
      this.inventory.belt[idx] = null;
      this.lastShotTime = now;
      this.faceTarget(targetGx, targetGy);
      this.updateSpriteRotation();
      const grenade = {
        itemId,
        targetGx,
        targetGy,
        fuseTime: 1500,
        throwTime: now,
        startGx: this.gx,
        startGy: this.gy
      };
      const proj = new ProjectileLazy({
        weapon: null,
        ammo: null,
        startGx: this.gx,
        startGy: this.gy,
        dirX: 0,
        dirY: 0,
        owner: this,
        world: this.world,
        grenade
      });
      this.world.addProjectile(proj);
      this.world.soundManager.emitSound(this.gx, this.gy, 0.3, "gunshot", this);
      return true;
    }
    reload() {
      if (this.isReloading) return;
      const weapon = this.getActiveWeapon();
      if (!weapon) return;
      if (this.currentAmmo === weapon.magazineSize) return;
      this.currentBurstId = null;
      this.isReloading = true;
      this.reloadEndTime = performance.now() + weapon.reloadTime;
      const self = this;
      this.world.taskQueue.schedule(weapon.reloadTime, () => {
        if (!self.isAlive) return;
        self.currentAmmo = weapon.magazineSize;
        self.isReloading = false;
        self.reloadEndTime = 0;
      });
    }
    updateRecovery(dt) {
      const now = performance.now();
      const weapon = this.getActiveWeapon();
      if (this.recoil > 0) {
        if (weapon) {
          const recovery = weapon.recoilRecovery * dt * 60;
          this.recoil = Math.max(0, this.recoil - recovery);
        }
      }
      if (this.bloom > 0) {
        const recoveryDelay = weapon ? weapon.recoveryDelay || 180 : 180;
        if (now - this.lastShotTime > recoveryDelay) {
          const bloomRecovery = weapon ? weapon.bloomRecovery || 0.5 : 0.5;
          this.bloom = Math.max(0, this.bloom - bloomRecovery * dt);
        }
      }
      if (this.suppression > 0) {
        const recoveryRate = 0.1 * (1 + (this.stats.endurance - 10) * 0.05);
        this.suppression = Math.max(0, this.suppression - recoveryRate * dt);
      }
      if (this.isReloading && now >= this.reloadEndTime) {
        this.isReloading = false;
        this.reloadEndTime = 0;
      }
    }
    applyDamage(damage, source, zone) {
      if (!this.isAlive) return;
      this.hp -= damage;
      const endurance = this.stats.endurance;
      const supResist = endurance / 20;
      this.suppression = Math.min(1, this.suppression + SUPPRESSION_GAIN * (1 - supResist));
      if (this.botBrain && source) {
        this.botBrain.onTakeDamage(damage, source);
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.world.removeEntity(this);
      }
    }
    getArmorForZone(zone) {
      const slot = zone.armorSlot;
      const item = this.inventory.slots[slot];
      if (!item) return null;
      const def = ARMOR_ITEMS[item.id];
      if (!def) return null;
      if (!def.coverage.includes(zone.id)) return null;
      return def;
    }
    gainXP(amount) {
      this.xp += amount;
    }
    serialize() {
      return {
        id: this.id,
        type: this.type,
        gx: this.gx,
        gy: this.gy,
        hp: this.hp,
        stats: this.stats.serialize(),
        inventory: this.inventory.serialize(),
        activeWeaponSlot: this.activeWeaponSlot,
        currentWeaponId: this.currentWeaponId,
        currentAmmo: this.currentAmmo,
        facingAngle: this.facingAngle,
        xp: this.xp,
        level: this.level,
        pointsAvailable: this.pointsAvailable
      };
    }
  }
  let ProjectileLazy = null;
  function setProjectileClass(cls) {
    ProjectileLazy = cls;
  }
  class Projectile {
    constructor({ weapon, ammo, startGx, startGy, dirX, dirY, owner, world, grenade = null }) {
      this.weapon = weapon;
      this.ammo = ammo;
      this.owner = owner;
      this.world = world;
      this.wx = startGx + 0.5;
      this.wy = startGy + 0.5;
      this.dirX = dirX;
      this.dirY = dirY;
      this.isGrenade = !!grenade;
      this.grenade = grenade;
      if (this.isGrenade) {
        this.massKg = 0.4;
        this.E = 0;
        this.E0 = 0;
        this.velocityPx = 0;
        this.physicalSpeedPx = 0;
        this.traveledCells = 0;
        this.maxCells = 0;
        this.maxDistance = 0;
        this.isRocket = false;
        this.startGx = Math.floor(startGx);
        this.startGy = Math.floor(startGy);
        this.createdAt = performance.now();
        this.alive = true;
        this.element = null;
        this.suppressedCells = /* @__PURE__ */ new Set();
        this.ricochetCount = 0;
        return;
      }
      this.massKg = ammo.mass_g / 1e3;
      this.v0 = ammo.v0_mps * weapon.v0_scale;
      this.E = 0.5 * this.massKg * this.v0 * this.v0;
      this.E0 = this.E;
      const physicalSpeedPx = this.v0 * CELL_SIZE;
      const maxVisualSpeedPx = BALLISTICS.VISUAL_SPEED_CELLS_PER_FRAME * CELL_SIZE * 60;
      this.velocityPx = Math.min(physicalSpeedPx, maxVisualSpeedPx);
      this.physicalSpeedPx = physicalSpeedPx;
      this.traveledCells = 0;
      this.maxCells = weapon.range;
      this.isRocket = !!ammo.isRocket;
      this.startGx = Math.floor(startGx);
      this.startGy = Math.floor(startGy);
      this.createdAt = performance.now();
      this.alive = true;
      this.element = null;
      this.suppressedCells = /* @__PURE__ */ new Set();
      this.ricochetCount = 0;
    }
    penetrationMm() {
      if (this.isGrenade) return 0;
      return this.ammo.penetrationBase_mm * (this.E / this.E0);
    }
    physicalVelocityMps() {
      if (this.isGrenade) return 0;
      return Math.sqrt(2 * this.E / this.massKg);
    }
    update(dt) {
      if (this.isGrenade) return this.updateGrenade(dt);
      const vPhysical = this.physicalVelocityMps();
      if (this.E < BALLISTICS.MIN_ENERGY_J || vPhysical < BALLISTICS.MIN_VELOCITY_MPS) {
        if (this.isRocket) this.detonate(this.wx, this.wy);
        return false;
      }
      const stepCells = this.velocityPx * dt / CELL_SIZE;
      const nx = this.wx + this.dirX * stepCells;
      const ny = this.wy + this.dirY * stepCells;
      this.E *= 1 - this.ammo.dragPerCell * stepCells;
      const cellX = Math.floor(nx);
      const cellY = Math.floor(ny);
      const grid = this.world.grid;
      const obs = grid.getObstacleAtCell(cellX, cellY);
      if (obs && obs.obstacleResistance > 0) {
        if (this.isRocket) {
          this.detonate(nx, ny);
          return false;
        }
        const ricochetResult = this.tryRicochet(obs);
        if (ricochetResult === "ricochet") {
          this.wx = nx;
          this.wy = ny;
          this.traveledCells += stepCells;
          return true;
        }
        if (ricochetResult === "absorbed") {
          return false;
        }
        const resMm = obs.obstacleResistance * BALLISTICS.OBSTACLE_MM_SCALE;
        const penMm = this.penetrationMm();
        if (penMm < resMm) {
          this.E *= 1 - resMm / Math.max(penMm, 0.01);
        } else {
          this.E *= 1 - resMm / penMm * 0.3;
        }
        if (this.E < BALLISTICS.MIN_ENERGY_J) return false;
      }
      const target = this.world.checkHit(cellX, cellY, this.owner);
      if (target) {
        if (this.isRocket) this.detonate(nx, ny, target);
        else this.applyDamage(target);
        return false;
      }
      this.applyFlybySuppression(cellX, cellY);
      if (this.traveledCells >= this.maxCells) {
        if (this.isRocket) this.detonate(nx, ny);
        return false;
      }
      this.wx = nx;
      this.wy = ny;
      this.traveledCells += stepCells;
      return true;
    }
    tryRicochet(obs) {
      if (!obs.material) return "none";
      if (this.ricochetCount >= 2) return "none";
      const material = obs.material;
      -(this.dirX * -this.dirX + this.dirY * -this.dirY);
      const normalX = -this.dirX;
      const normalY = -this.dirY;
      const cosAngle = Math.max(-1, Math.min(1, -(this.dirX * normalX + this.dirY * normalY)));
      const angleRad = Math.acos(cosAngle);
      const maxAngleRad = BALLISTICS.RICOCHET_MAX_ANGLE_DEG * Math.PI / 180;
      if (angleRad > maxAngleRad) return "none";
      const chance = material.ricochetChance * (1 - angleRad / maxAngleRad);
      if (Math.random() >= chance) return "none";
      const energyLoss = BALLISTICS.RICOCHET_ENERGY_LOSS_BASE + material.ricochetEnergyLoss;
      this.E *= Math.max(0.1, 1 - energyLoss);
      if (this.E < BALLISTICS.MIN_ENERGY_J) return "absorbed";
      const dotDirNormal = this.dirX * normalX + this.dirY * normalY;
      let rx = this.dirX - 2 * dotDirNormal * normalX;
      let ry = this.dirY - 2 * dotDirNormal * normalY;
      const randomRad = (Math.random() - 0.5) * 2 * (BALLISTICS.RICOCHET_ANGLE_RANDOM_DEG * Math.PI / 180);
      const cosR = Math.cos(randomRad);
      const sinR = Math.sin(randomRad);
      const finalX = rx * cosR - ry * sinR;
      const finalY = rx * sinR + ry * cosR;
      const len = Math.hypot(finalX, finalY) || 1;
      this.dirX = finalX / len;
      this.dirY = finalY / len;
      this.ricochetCount++;
      this.velocityPx *= Math.sqrt(Math.max(0, this.E / this.E0)) / Math.max(0.01, this.velocityPx / (this.v0 * CELL_SIZE));
      const physicalSpeedPx = Math.sqrt(2 * this.E / this.massKg) * CELL_SIZE;
      const maxVisualSpeedPx = BALLISTICS.VISUAL_SPEED_CELLS_PER_FRAME * CELL_SIZE * 60;
      this.velocityPx = Math.min(physicalSpeedPx, maxVisualSpeedPx);
      return "ricochet";
    }
    applyFlybySuppression(cellX, cellY) {
      const key = cellX + "," + cellY;
      if (this.suppressedCells.has(key)) return;
      this.suppressedCells.add(key);
      for (const e of this.world.entities.values()) {
        if (e === this.owner) continue;
        if (!e.isAlive) continue;
        if (e.isPlayer && this.owner === this.world.player) continue;
        if (!e.isPlayer && this.owner !== this.world.player) continue;
        const dist = Math.max(Math.abs(e.gx - cellX), Math.abs(e.gy - cellY));
        if (dist > SUPPRESSION_NEAR_RADIUS) continue;
        if (dist === 0) continue;
        const supResist = e.stats.endurance / 20;
        const gain = SUPPRESSION_GAIN * 0.3 * (1 - supResist) * (1 - dist / (SUPPRESSION_NEAR_RADIUS + 1));
        e.suppression = Math.min(1, e.suppression + gain);
      }
    }
    updateGrenade(dt) {
      const g = this.grenade;
      const now = performance.now();
      const elapsed = now - g.throwTime;
      if (elapsed >= g.fuseTime) {
        this.grenadeExplode();
        return false;
      }
      const t2 = Math.min(1, elapsed / g.fuseTime);
      this.wx = g.startGx + 0.5 + (g.targetGx - g.startGx) * t2;
      this.wy = g.startGy + 0.5 + (g.targetGy - g.startGy) * t2;
      return true;
    }
    grenadeExplode() {
      const g = this.grenade;
      const itemId = g.itemId;
      if (itemId === "grenade_frag") {
        this.world.explodeAt(g.targetGx, g.targetGy, {
          explosiveMass_g: 300,
          radiusCells: 2,
          shrapnelCount: 6,
          shrapnelRange: 3,
          owner: this.owner
        });
      } else if (itemId === "grenade_smoke") {
        this.world.createSmokeCloud({
          sectorId: this.world.currentSectorId,
          gx: Math.floor(g.targetGx),
          gy: Math.floor(g.targetGy),
          radius: 3,
          duration: 5e3,
          owner: this.owner
        });
      }
    }
    applyDamage(target) {
      const zone = rollHitZone();
      const armor = target.getArmorForZone(zone);
      const armorMm = armor ? armor.armorClass_mm : 0;
      const penMm = this.penetrationMm();
      const E = this.E;
      let damage;
      if (penMm >= armorMm) {
        damage = E * BALLISTICS.K_PEN;
      } else {
        damage = E * BALLISTICS.K_NONPEN * (1 - armorMm / Math.max(penMm, 0.01));
      }
      const finalDamage = Math.max(0, damage * zone.multiplier);
      target.applyDamage(finalDamage, this.owner, zone);
      this.world.hitEffect(target, zone);
      this.world.emitSuppressionNear(target.gx, target.gy, target);
    }
    detonate(x, y, directTarget = null) {
      if (directTarget) {
        const cumPen = this.penetrationMm();
        if (cumPen >= BALLISTICS.CUML_THRESHOLD_MM) {
          const cumDamage = this.ammo.explosiveMass_g * BALLISTICS.CUML_DAMAGE_MULT;
          directTarget.applyDamage(cumDamage, this.owner, null);
        }
      }
      this.world.explodeAt(x, y, {
        explosiveMass_g: this.ammo.explosiveMass_g,
        radiusCells: this.ammo.explosionRadius || 0,
        shrapnelCount: this.ammo.shrapnelCount || 0,
        shrapnelRange: this.ammo.shrapnelRange || 0,
        owner: this.owner,
        weapon: this.weapon
      });
    }
    serialize() {
      if (this.isGrenade) {
        return { isGrenade: true, grenade: this.grenade, owner: this.owner };
      }
      return {
        weaponId: this.weapon.id,
        owner: this.owner,
        wx: this.wx,
        wy: this.wy,
        dirX: this.dirX,
        dirY: this.dirY,
        E: this.E,
        E0: this.E0,
        traveledCells: this.traveledCells
      };
    }
    destroy() {
      if (this.element && this.element.parentNode) {
        this.element.remove();
      }
    }
  }
  const GLOBAL_LAYOUT = {
    size: [7, 7],
    sectors: {
      1001: { gx: 3, gy: 0, name: "West Cape" },
      1002: { gx: 4, gy: 0, name: "North Beach" },
      1003: { gx: 5, gy: 0, name: "Abbey road" },
      1004: { gx: 6, gy: 0, name: "Threeforce" },
      1005: { gx: 2, gy: 1, name: "Sector SA98" },
      1006: { gx: 3, gy: 1, name: "Raged Land" },
      1007: { gx: 4, gy: 1, name: "Alpha Three" },
      1008: { gx: 5, gy: 1, name: "Army Base" },
      1009: { gx: 6, gy: 1, name: "Overlord Point" },
      1010: { gx: 2, gy: 2, name: "Ejection Point" },
      1011: { gx: 3, gy: 2, name: "Spherix point" },
      1012: { gx: 4, gy: 2, name: "Aikon" },
      1013: { gx: 5, gy: 2, name: "South Normand" },
      1014: { gx: 6, gy: 2, name: "East Cape" },
      1015: { gx: 1, gy: 3, name: "Nou Lake" },
      1016: { gx: 2, gy: 3, name: "Dangerous Xith" },
      1017: { gx: 3, gy: 3, name: "Eye of Glory" },
      1018: { gx: 4, gy: 3, name: "Thordendal" },
      1019: { gx: 5, gy: 3, name: "Por Eso One" },
      1020: { gx: 1, gy: 4, name: "Shoretale" },
      1021: { gx: 2, gy: 4, name: "Second Path" },
      1022: { gx: 3, gy: 4, name: "Chelby" },
      1023: { gx: 4, gy: 4, name: "Tracid Line" },
      1024: { gx: 5, gy: 4, name: "Freestates" },
      1025: { gx: 3, gy: 5, name: "Tiger Lairs" },
      1026: { gx: 4, gy: 5, name: "Hypercube" },
      1027: { gx: 5, gy: 5, name: "World's Corner" },
      1028: { gx: 3, gy: 6, name: "South Tibet" }
    }
  };
  const STRINGS = {
    "common.ok": "ОК",
    "common.cancel": "Отмена",
    "common.confirm": "Подтвердить",
    "common.delete": "Удалить",
    "common.close": "Закрыть",
    "common.loading": "Загрузка…",
    "common.ready": "Готов",
    "common.yes": "Да",
    "common.no": "Нет",
    "menu.title": "Subgraphs",
    "menu.newGame": "Новая игра",
    "menu.continue": "Продолжить",
    "menu.settings": "Настройки",
    "menu.loadManual": "Загрузить сохранение",
    "menu.loadAuto": "Загрузить автосейв",
    "menu.quit": "Сохранить и выйти",
    "menu.data": "Данные игры",
    "menu.save": "Сохранить",
    "menu.load": "Загрузить",
    "hud.sector": "Сектор",
    "hud.coords": "Коорд",
    "hud.enemies": "Врагов",
    "hud.hp": "HP",
    "hud.weapon": "ОРУЖИЕ",
    "hud.noWeapon": "Нет оружия",
    "hud.ammo": "ПАТРОНЫ",
    "hud.reloading": "ПЕРЕЗАРЯДКА…",
    "hud.recoil": "ОТДАЧА",
    "hud.suppression": "ПОДАВЛЕНИЕ",
    "hud.strength": "С",
    "hud.accuracy": "М",
    "hud.endurance": "В",
    "hud.health": "З",
    "hud.level": "Уровень",
    "hud.xp": "XP",
    "hud.points": "Очки",
    "hud.belt": "Пояс",
    "hud.emptySlot": "—",
    "msg.reloading": "Перезарядка…",
    "msg.reloaded": "Перезаряжено",
    "msg.noWeaponInSlot": "Нет оружия в этом слоте",
    "msg.switchedTo": "Переключено на: {name}",
    "msg.inventoryFull": "Инвентарь полон",
    "msg.pickedUp": "Подобрано: {name} ({count})",
    "msg.died": "Вы погибли! Респавн…",
    "msg.respawned": "Респавн в Ejection Point",
    "msg.entered": "Вошли: {name}",
    "msg.noAmmo": "Нет патронов",
    "msg.healed": "Вылечено: {hp} HP",
    "msg.slotEmpty": "Слот пуст",
    "msg.itemSelected": "Выбран: {name}",
    "msg.itemDeselected": "Выбор отменён",
    "msg.itemUsed": "Использовано: {name}",
    "msg.itemUseFailed": "Не удалось использовать предмет",
    "msg.noTargetToHeal": "Некого лечить",
    "msg.grenadeThrown": "Граната брошена",
    "msg.grenadeCanceled": "Бросок отменён",
    "msg.grenadeOutOfRange": "Слишком далеко",
    "msg.smokeCreated": "Дымовая завеса",
    "msg.xpGained": "+{xp} XP",
    "msg.levelUp": "Уровень повышен: {level}",
    "msg.pointSpent": "Очко вложено: {stat}",
    "msg.statCapReached": "Потолок стата достигнут",
    "msg.deathPenalty": "Потеряно: {xp} XP, {ammo} патронов, {heals} аптечек",
    "msg.mapDisabledInSettings": "Карта отключена в настройках",
    "settings.title": "Настройки",
    "settings.minimap": "Миникарта",
    "settings.globalMap": "Глобальная карта",
    "settings.debug": "Режим отладки",
    "settings.keys": "Управление",
    "settings.key.moveUp": "Движение вверх",
    "settings.key.moveDown": "Движение вниз",
    "settings.key.moveLeft": "Движение влево",
    "settings.key.moveRight": "Движение вправо",
    "settings.key.reload": "Перезарядка",
    "settings.key.swapWeapon": "Смена оружия",
    "settings.key.inventory": "Инвентарь",
    "settings.key.minimap": "Миникарта",
    "settings.key.globalMap": "Глобальная карта",
    "settings.key.escape": "Меню",
    "settings.key.slot1": "Слот 1",
    "settings.key.slot2": "Слот 2",
    "settings.key.slot3": "Слот 3",
    "settings.key.slot4": "Слот 4",
    "settings.resetKeys": "Сбросить клавиши",
    "settings.save": "Сохранить",
    "settings.back": "Назад",
    "data.title": "Данные игры",
    "data.version": "Версия",
    "data.contents": "Содержимое",
    "data.maps": "Карты",
    "data.transitions": "Переходы",
    "data.sprites": "Спрайты",
    "data.sounds": "Звуки",
    "data.spawnPoints": "Точки спавна",
    "data.caches": "Тайники",
    "data.import": "Загрузить ZIP",
    "data.deleteAll": "Удалить все данные",
    "data.importConfirm": "Заменить данные? Текущие сохранения могут быть несовместимы.",
    "data.importFull": "Полная замена (удалить старые сохранения)",
    "data.importPartial": "Частичная замена (сохранить совместимые сохранения)",
    "data.deleteConfirm": "Удалить ВСЕ данные игры? Это необратимо.",
    "data.noData": "Данные не загружены. Загрузите ZIP.",
    "data.imported": "Импорт завершён",
    "inv.title": "Инвентарь",
    "inv.equip": "Надеть",
    "inv.unequip": "Снять",
    "inv.use": "Использовать",
    "inv.drop": "Выбросить",
    "inv.slot.weapon": "Основное",
    "inv.slot.secondary": "Пистолет",
    "inv.slot.head": "Голова",
    "inv.slot.body": "Тело",
    "inv.slot.legs": "Ноги",
    "inv.slot.foot": "Стопы",
    "inv.belt": "Пояс",
    "save.title": "Сохранения",
    "save.auto": "Автосохранение",
    "save.manual": "Ручное",
    "save.empty": "Пусто",
    "save.deleteConfirm": "Удалить сохранение?",
    "save.saved": "Сохранено",
    "save.loaded": "Загружено",
    "save.corrupt": "Сохранение повреждено",
    "ammo.pistol": "9×18",
    "ammo.rifle": "5.45×39",
    "ammo.heavy": "7.62×54",
    "ammo.pellet": "12×70",
    "ammo.rocket": "ОГ-7В",
    "weapon.tt33": "ТТ-33",
    "weapon.ppsh41": "ППШ-41",
    "weapon.ak47": "АК-47",
    "weapon.pkm": "ПКМ",
    "weapon.svd": "СВД",
    "weapon.saiga12": "Сайга-12",
    "weapon.rocket_launcher": "РПГ-7",
    "armor.helmet_light": "Лёгкий шлем",
    "armor.helmet_medium": "Шлем",
    "armor.helmet_heavy": "Боевой шлем",
    "armor.vest_light": "Бронежилет 1 класса",
    "armor.vest_medium": "Бронежилет 2 класса",
    "armor.vest_heavy": "Бронежилет 3 класса",
    "armor.pants_light": "Бронештаны",
    "armor.pants_heavy": "Бронештаны v2",
    "armor.boots": "Ботинки",
    "item.medkit": "Аптечка",
    "item.grenade_smoke": "Дымовая граната",
    "item.grenade_frag": "Фугасная граната",
    "zone.head": "Голова",
    "zone.torso": "Торс",
    "zone.arms": "Руки",
    "zone.legs": "Ноги",
    "zone.feet": "Стопы",
    "poi.loot": "Лут",
    "poi.alert": "Тревога",
    "poi.patrol_route": "Патруль",
    "poi.spawn_point": "Точка спавна",
    "debug.title": "ОТЛАДКА",
    "debug.los": "LOS",
    "debug.botStates": "Состояния ботов",
    "debug.radio": "Рация",
    "debug.lookDirection": "Направление взгляда",
    "debug.poi": "POI",
    "debug.path": "Путь",
    "debug.zones": "Зоны попадания",
    "debug.fps": "FPS",
    "debug.entities": "Сущности",
    "debug.projectiles": "Снаряды"
  };
  function t(key, vars) {
    let str = STRINGS[key] || key;
    if (vars) {
      for (const k in vars) {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      }
    }
    return str;
  }
  const GRENADE_THROW_RANGE = 5;
  const SAVE_VERSION$1 = 2;
  class World {
    constructor(db, assets) {
      this.db = db;
      this.assets = assets;
      this.game = null;
      this.eventBus = new EventBus();
      this.taskQueue = new TaskQueue();
      this.entities = /* @__PURE__ */ new Map();
      this.projectiles = [];
      this.smokeClouds = [];
      this.player = null;
      this.selectedBeltSlot = null;
      this.currentSectorId = SAFE_ZONE.sectorId;
      this.grid = new GridSystem(db, this);
      this.camera = new CameraSystem();
      this.losCache = new LOSCache();
      this.poiManager = new POIManager(this);
      this.transitionManager = new TransitionManager(db, this);
      this.spawnManager = new SpawnManager(this);
      this.soundManager = new SoundManager(this);
      this.radioManager = new RadioManager(this);
      this.groupManager = new GroupManager(this);
      this.pathfinding = new Pathfinding(this);
      this.ui = null;
      this.inactiveSectors = /* @__PURE__ */ new Map();
      this.sectorStates = /* @__PURE__ */ new Map();
      this.lastNeighborTick = 0;
      this.lastRemoteTick = 0;
      this.lastSpawnCheck = 0;
      this._nextEntityId = 1;
    }
    async init() {
      setProjectileClass(Projectile);
      await this.grid.loadSector(this.currentSectorId);
      await this.assets.preloadLevel(this.grid.sector);
      await this.assets.loadGlobalMap();
      await this.transitionManager.loadAll();
      await this.spawnManager.loadAllSpawnPoints();
      await this.loadCaches(this.currentSectorId);
      this.spawnPlayer();
      this.spawnInitialBots();
      this.camera.snapTo(this.player.gx, this.player.gy, this.grid.sector.width, this.grid.sector.height);
    }
    async loadCaches(sectorId) {
      const data = await this.db.get("caches", sectorId);
      if (!data) return;
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.caches)) list = data.caches;
      for (const cache of list) {
        if (cache.gx === void 0 || cache.gy === void 0) continue;
        if (!this.grid.isWalkable(cache.gx, cache.gy, null)) continue;
        const items = (cache.items || []).map((it) => {
          if (typeof it === "string") return { id: it };
          if (it && it.id) return { id: it.id };
          return null;
        }).filter(Boolean);
        if (items.length === 0) continue;
        this.poiManager.createLoot({
          sectorId,
          gx: cache.gx,
          gy: cache.gy,
          items
        });
      }
      console.log("[World] caches loaded for sector", sectorId, ":", list.length);
    }
    selectBeltSlot(index) {
      if (!this.player) return;
      if (index < 0 || index >= BELT_SLOTS) return;
      const item = this.player.inventory.getBelt(index);
      if (this.selectedBeltSlot === index) {
        this.selectedBeltSlot = null;
        this.eventBus.emit("hud:message", t("msg.itemDeselected"));
        this.eventBus.emit("belt:selection", null);
        return;
      }
      if (!item) {
        this.eventBus.emit("hud:message", t("msg.slotEmpty"));
        return;
      }
      this.selectedBeltSlot = index;
      const def = CONSUMABLE_ITEMS[item.id];
      const name = def ? t(def.nameKey) : item.id;
      this.eventBus.emit("hud:message", t("msg.itemSelected", { name }));
      this.eventBus.emit("belt:selection", index);
    }
    cancelSelection() {
      if (this.selectedBeltSlot === null) return;
      this.selectedBeltSlot = null;
      this.eventBus.emit("hud:message", t("msg.itemDeselected"));
      this.eventBus.emit("belt:selection", null);
    }
    useSelectedItemOnCell(gx, gy) {
      if (this.selectedBeltSlot === null) return false;
      const index = this.selectedBeltSlot;
      const item = this.player.inventory.getBelt(index);
      if (!item) {
        this.selectedBeltSlot = null;
        this.eventBus.emit("belt:selection", null);
        this.eventBus.emit("hud:message", t("msg.slotEmpty"));
        return false;
      }
      const def = CONSUMABLE_ITEMS[item.id];
      if (!def) return false;
      if (def.type === "heal") {
        if (gx !== this.player.gx || gy !== this.player.gy) {
          this.selectedBeltSlot = null;
          this.eventBus.emit("belt:selection", null);
          this.eventBus.emit("hud:message", t("msg.noTargetToHeal"));
          return false;
        }
        const before = this.player.hp;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.healAmount);
        const healed = this.player.hp - before;
        this.player.inventory.useBelt(index);
        this.selectedBeltSlot = null;
        this.eventBus.emit("belt:selection", null);
        this.eventBus.emit("hud:message", t("msg.healed", { hp: healed }));
        return true;
      }
      if (def.type === "grenade") {
        const dist = Math.max(Math.abs(gx - this.player.gx), Math.abs(gy - this.player.gy));
        if (dist > GRENADE_THROW_RANGE) {
          this.selectedBeltSlot = null;
          this.eventBus.emit("belt:selection", null);
          this.eventBus.emit("hud:message", t("msg.grenadeOutOfRange"));
          return false;
        }
        const ok = this.player.throwGrenade(gx, gy, item.id);
        if (ok) {
          this.selectedBeltSlot = null;
          this.eventBus.emit("belt:selection", null);
          this.eventBus.emit("hud:message", t("msg.grenadeThrown"));
          return true;
        } else {
          this.eventBus.emit("hud:message", t("msg.itemUseFailed"));
          return false;
        }
      }
      this.selectedBeltSlot = null;
      this.eventBus.emit("belt:selection", null);
      return false;
    }
    spawnPlayer() {
      const player = new Entity({
        id: "player",
        type: "player",
        gx: SAFE_ZONE.gx,
        gy: SAFE_ZONE.gy,
        profile: null,
        world: this
      });
      this.player = player;
      this.entities.set(player.id, player);
      return player;
    }
    spawnInitialBots() {
      const total = SPAWN.WORLD_BOTS;
      const allSectors = Object.keys(GLOBAL_LAYOUT.sectors).map(Number);
      let placed = 0;
      for (let i = 0; i < total; i++) {
        const sectorId = allSectors[Math.floor(Math.random() * allSectors.length)];
        if (sectorId === SAFE_ZONE.sectorId) continue;
        if (sectorId !== this.currentSectorId) {
          this.deferBotSpawn(sectorId);
          continue;
        }
        const profile = this.spawnManager.pickProfile(BOT_PROFILE_WEIGHTS);
        const pos = this.findFreeSpawnCell(sectorId);
        if (pos) {
          this.spawnBot(sectorId, pos.gx, pos.gy, profile);
          placed++;
        }
      }
      console.log("[World] initial bots placed in current sector:", placed);
    }
    deferBotSpawn(sectorId) {
      if (!this.sectorStates.has(sectorId)) {
        this.sectorStates.set(sectorId, { bots: [], pois: [] });
      }
      this.sectorStates.get(sectorId).bots.push({
        id: "bot_" + this._nextEntityId++,
        gx: null,
        gy: null,
        profileId: this.randomProfileId()
      });
    }
    randomProfileId() {
      const ids = Object.keys(BOT_PROFILES);
      return ids[Math.floor(Math.random() * ids.length)];
    }
    spawnBot(sectorId, gx, gy, profile) {
      if (sectorId === this.currentSectorId) {
        if (!this.grid.isWalkable(gx, gy, null)) {
          console.warn("[World] spawnBot rejected (not walkable):", { sectorId, gx, gy, obstacle: this.grid.getObstacleAtCell(gx, gy) });
          return null;
        }
      }
      const id = "bot_" + this._nextEntityId++;
      const bot = new Entity({ id, type: "bot", gx, gy, profile, world: this });
      this.setupBot(bot, profile);
      this.entities.set(id, bot);
      this.eventBus.emit("entity:spawned", bot);
      return bot;
    }
    _profileId(profile) {
      for (const k in BOT_PROFILES) {
        if (BOT_PROFILES[k] === profile) return k;
      }
      return "assault";
    }
    setupBot(bot, profile) {
      bot.stats = new Stats(
        profile.stats.health,
        profile.stats.strength,
        profile.stats.accuracy,
        profile.stats.endurance
      );
      bot.hp = bot.stats.maxHp;
      bot.equipWeapon(profile.primaryWeapon);
      if (profile.secondaryWeapon) {
        bot.inventory.equip("secondary", {
          id: profile.secondaryWeapon,
          weight: WEAPONS[profile.secondaryWeapon].weight
        });
      }
      if (profile.armor.head) {
        bot.inventory.equip("head", { id: profile.armor.head, weight: ARMOR_ITEMS[profile.armor.head].weight });
      }
      if (profile.armor.body) {
        bot.inventory.equip("body", { id: profile.armor.body, weight: ARMOR_ITEMS[profile.armor.body].weight });
      }
      if (profile.armor.legs) {
        bot.inventory.equip("legs", { id: profile.armor.legs, weight: ARMOR_ITEMS[profile.armor.legs].weight });
      }
      if (profile.armor.foot) {
        bot.inventory.equip("foot", { id: profile.armor.foot, weight: ARMOR_ITEMS[profile.armor.foot].weight });
      }
      bot.inventory.setBelt(0, { ...CONSUMABLE_ITEMS.medkit });
      const grenade = Math.random() < 0.5 ? "grenade_frag" : "grenade_smoke";
      bot.inventory.setBelt(1, { ...CONSUMABLE_ITEMS[grenade] });
      if (Math.random() < 0.4) {
        bot.inventory.addToGrid({ id: "medkit", weight: CONSUMABLE_ITEMS.medkit.weight });
      }
      if (Math.random() < 0.3) {
        const extraGrenade = Math.random() < 0.5 ? "grenade_frag" : "grenade_smoke";
        bot.inventory.addToGrid({ id: extraGrenade, weight: CONSUMABLE_ITEMS[extraGrenade].weight });
      }
      bot.botBrain = new BotBrain(bot, this, profile);
    }
    findFreeSpawnCell(sectorId) {
      const sector = this.grid.sector;
      if (!sector) return null;
      if (sectorId !== void 0 && sector.id !== sectorId) {
        console.warn("[World] findFreeSpawnCell: sector mismatch", { requested: sectorId, current: sector.id });
      }
      for (let attempts = 0; attempts < 50; attempts++) {
        const gx = Math.floor(Math.random() * sector.width);
        const gy = Math.floor(Math.random() * sector.height);
        if (this.grid.isWalkable(gx, gy, null) && !this.isInSafeZone(gx, gy)) {
          if (this.grid.getObstacleAtCell(gx, gy)) continue;
          return { gx, gy };
        }
      }
      return null;
    }
    isInSafeZone(gx, gy) {
      if (this.currentSectorId !== SAFE_ZONE.sectorId) return false;
      return Math.max(Math.abs(gx - SAFE_ZONE.gx), Math.abs(gy - SAFE_ZONE.gy)) <= SAFE_ZONE.radius;
    }
    createSmokeCloud({ sectorId, gx, gy, radius, duration, owner }) {
      this.smokeClouds.push({
        sectorId,
        gx,
        gy,
        radius,
        duration,
        owner,
        createdAt: performance.now()
      });
      this.eventBus.emit("fx:smoke", { gx, gy, radius });
    }
    isSmokeAt(gx, gy) {
      const now = performance.now();
      for (const smoke of this.smokeClouds) {
        if (smoke.sectorId !== this.currentSectorId) continue;
        if (now - smoke.createdAt > smoke.duration) continue;
        const dist = Math.max(Math.abs(smoke.gx - gx), Math.abs(smoke.gy - gy));
        if (dist <= smoke.radius) return true;
      }
      return false;
    }
    updateSmoke(now) {
      this.smokeClouds = this.smokeClouds.filter((s) => now - s.createdAt < s.duration);
    }
    addProjectile(proj) {
      this.projectiles.push(proj);
      if (this.projectiles.length > MAX_PROJECTILES) {
        const oldest = this.projectiles.shift();
        if (oldest && oldest.destroy) oldest.destroy();
      }
    }
    checkHit(gx, gy, owner) {
      if (owner !== this.player) {
        if (this.player.isAlive && this.player.gx === gx && this.player.gy === gy) {
          if (this.player.invulnerableUntil && performance.now() < this.player.invulnerableUntil) return null;
          return this.player;
        }
      }
      for (const bot of this.entities.values()) {
        if (bot === owner) continue;
        if (bot.isPlayer) continue;
        if (!bot.isAlive) continue;
        if (bot.gx === gx && bot.gy === gy) return bot;
      }
      return null;
    }
    hitEffect(target, zone) {
      this.eventBus.emit("fx:hit", { gx: target.gx, gy: target.gy, zone });
    }
    emitSuppressionNear(gx, gy, target) {
      for (const e of this.entities.values()) {
        if (e === target) continue;
        if (!e.isAlive) continue;
        const d = Math.max(Math.abs(e.gx - gx), Math.abs(e.gy - gy));
        if (d <= SUPPRESSION_NEAR_RADIUS) {
          const supResist = e.stats.endurance / 20;
          e.suppression = Math.min(1, e.suppression + SUPPRESSION_GAIN * 0.5 * (1 - supResist));
        }
      }
    }
    explodeAt(x, y, { explosiveMass_g, radiusCells, shrapnelCount, shrapnelRange, owner }) {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      this.eventBus.emit("fx:explosion", { gx: cx, gy: cy, radius: radiusCells });
      this.soundManager.emitSound(cx, cy, SOUND_LOUDNESS.explosion, "explosion", owner);
      const damageBase = (explosiveMass_g || 0) * 0.05;
      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        for (let dx = -radiusCells; dx <= radiusCells; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > radiusCells) continue;
          const gx = cx + dx;
          const gy = cy + dy;
          const dmg = damageBase * (1 - dist / (radiusCells + 1));
          for (const e of this.entities.values()) {
            if (e === owner) continue;
            if (!e.isAlive) continue;
            if (e.gx !== gx || e.gy !== gy) continue;
            if (e.isPlayer && owner === this.player) continue;
            if (!e.isPlayer && owner !== this.player) continue;
            e.applyDamage(dmg, owner, null);
          }
        }
      }
      if (shrapnelCount > 0) {
        for (let i = 0; i < shrapnelCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 1 + Math.random() * shrapnelRange;
          const tx = Math.floor(cx + Math.cos(angle) * dist);
          const ty = Math.floor(cy + Math.sin(angle) * dist);
          for (const e of this.entities.values()) {
            if (e === owner) continue;
            if (!e.isAlive) continue;
            if (Math.abs(e.gx - tx) > 1 || Math.abs(e.gy - ty) > 1) continue;
            if (e.isPlayer && owner === this.player) continue;
            if (!e.isPlayer && owner !== this.player) continue;
            e.applyDamage(damageBase * 0.3 * (0.5 + Math.random() * 0.5), owner, null);
          }
        }
      }
    }
    removeEntity(entity) {
      this.entities.delete(entity.id);
      if (entity.isPlayer) {
        this.onPlayerDeath();
      } else {
        this.dropBotLoot(entity);
      }
      this.eventBus.emit("entity:removed", entity);
    }
    onPlayerDeath() {
      this.selectedBeltSlot = null;
      this.eventBus.emit("belt:selection", null);
      this.eventBus.emit("player:died");
      setTimeout(() => this.respawnPlayer(), 3e3);
    }
    async respawnPlayer() {
      if (this.currentSectorId !== SAFE_ZONE.sectorId) {
        await this.transitionToSector(SAFE_ZONE.sectorId, SAFE_ZONE.gx, SAFE_ZONE.gy);
      }
      const player = this.player;
      player.hp = player.maxHp;
      player.suppression = 0;
      player.recoil = 0;
      player.isReloading = false;
      player.currentBurstId = null;
      player.gx = SAFE_ZONE.gx;
      player.gy = SAFE_ZONE.gy;
      player.invulnerableUntil = performance.now() + 1500;
      this.selectedBeltSlot = null;
      this.eventBus.emit("belt:selection", null);
      this.entities.set(player.id, player);
      if (this.grid.sector) {
        this.camera.snapTo(player.gx, player.gy, this.grid.sector.width, this.grid.sector.height);
      }
      this.resetAllBotsAI();
      this.eventBus.emit("hud:message", t("msg.respawned"));
      this.eventBus.emit("player:respawned");
    }
    resetAllBotsAI() {
      for (const bot of this.entities.values()) {
        if (bot.isPlayer || !bot.botBrain) continue;
        bot.botBrain.state = "patrol";
        bot.botBrain.stateEntryTime = performance.now();
        bot.botBrain.currentIntent = "patrol";
        bot.botBrain.interest = 0;
        bot.botBrain.awareness = 0;
        bot.botBrain.lastSeenPlayerPos = null;
        bot.botBrain.alertPosition = null;
        bot.botBrain.coverPosition = null;
        bot.botBrain.firingPosition = null;
        bot.botBrain.tempMoveTarget = null;
        bot.botBrain.isAiming = false;
        bot.botBrain.lastBurstEndTime = 0;
        bot.currentBurstId = null;
        bot.isReloading = false;
        bot.recoil = 0;
        bot.suppression = 0;
        bot.lastShotTime = 0;
      }
      if (this.groupManager) {
        this.groupManager.groups.clear();
        this.groupManager.botToGroup.clear();
      }
    }
    dropBotLoot(bot) {
      const items = [];
      for (const slot of Object.values(bot.inventory.slots)) {
        if (slot && slot.id) items.push({ id: slot.id });
      }
      for (let y = 0; y < bot.inventory.grid.length; y++) {
        for (let x = 0; x < bot.inventory.grid[y].length; x++) {
          const e = bot.inventory.grid[y][x];
          if (e && e.gx === x && e.gy === y) items.push({ id: e.item.id });
        }
      }
      for (const b of bot.inventory.belt) {
        if (b) items.push({ id: b.id });
      }
      if (items.length > 0) {
        this.poiManager.createLoot({
          sectorId: this.currentSectorId,
          gx: bot.gx,
          gy: bot.gy,
          items
        });
      }
    }
    collectPOILoot(poi, entity) {
      if (!entity.isPlayer) return;
      const items = poi.data.items || [];
      for (const item of items) {
        const def = CONSUMABLE_ITEMS[item.id] || WEAPONS[item.id] || ARMOR_ITEMS[item.id];
        if (!def) continue;
        const ok = entity.inventory.addToGrid({ id: item.id, weight: def.weight || 0.5 });
        if (ok) {
          this.eventBus.emit("hud:message", t("msg.pickedUp", { name: t(def.nameKey), count: 1 }));
        } else {
          this.eventBus.emit("hud:message", t("msg.inventoryFull"));
        }
      }
      this.poiManager.markDepleted(poi);
    }
    handleClick(gx, gy) {
      if (!this.player || this.player.hp <= 0) return;
      if (this.selectedBeltSlot !== null) {
        this.useSelectedItemOnCell(gx, gy);
        return;
      }
      let targetBot = null;
      for (const e of this.entities.values()) {
        if (e.isPlayer || !e.isAlive) continue;
        if (e.gx === gx && e.gy === gy) {
          targetBot = e;
          break;
        }
      }
      if (targetBot) {
        this.player.shoot(gx, gy);
        return;
      }
      const dx = Math.abs(gx - this.player.gx);
      const dy = Math.abs(gy - this.player.gy);
      if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0)) {
        if (this.grid.isWalkable(gx, gy, this.player)) {
          this.tryPlayerMove(gx - this.player.gx, gy - this.player.gy);
        }
      }
    }
    tryPlayerMove(dx, dy) {
      if (!this.player || !this.grid.sector) return;
      if (this.player.moveCooldown > 0) return;
      const nx = this.player.gx + dx;
      const ny = this.player.gy + dy;
      if (!this.grid.isWalkable(nx, ny, this.player)) return;
      this.player.moveDirection = { dx, dy };
      this.player.faceMovementDirection();
      this.player.gx = nx;
      this.player.gy = ny;
      this.player.moveCooldown = 0.15;
      this.soundManager.emitSound(nx, ny, SOUND_LOUDNESS.footstep, "footstep", this.player);
      const tr = this.grid.getTransitionAt(nx, ny);
      if (tr) {
        this.handleTransition(tr);
        return;
      }
      this.camera.update(this.player.gx, this.player.gy, this.grid.sector.width, this.grid.sector.height);
    }
    createAlertPOI(gx, gy) {
      this.poiManager.createAlert({ sectorId: this.currentSectorId, gx, gy });
    }
    handleTransition(tr) {
      this.transitionToSector(tr.to.sectorId, tr.to.gx, tr.to.gy);
    }
    async transitionToSector(targetSectorId, entryGx, entryGy) {
      this.saveSectorState(this.currentSectorId);
      for (const [id, e] of Array.from(this.entities)) {
        if (e.isPlayer) continue;
        this.entities.delete(id);
        this.eventBus.emit("entity:removed", e);
      }
      this.projectiles.forEach((p) => p.destroy && p.destroy());
      this.projectiles = [];
      this.smokeClouds = this.smokeClouds.filter((s) => s.sectorId === targetSectorId);
      this.currentSectorId = targetSectorId;
      await this.grid.loadSector(targetSectorId);
      await this.assets.preloadLevel(this.grid.sector);
      this.player.gx = entryGx;
      this.player.gy = entryGy;
      this.player.moveCooldown = 0.15;
      this.selectedBeltSlot = null;
      this.eventBus.emit("belt:selection", null);
      this.restoreSectorState(targetSectorId);
      if (this.aliveBotCount() === 0) this.spawnInitialBotsForSector(targetSectorId);
      await this.loadCaches(targetSectorId);
      if (this.groupManager) {
        this.groupManager.groups.clear();
        this.groupManager.botToGroup.clear();
      }
      this.camera.snapTo(this.player.gx, this.player.gy, this.grid.sector.width, this.grid.sector.height);
      this.eventBus.emit("hud:message", t("msg.entered", { name: this.grid.sector.name || targetSectorId }));
      this.eventBus.emit("sector:changed", targetSectorId);
    }
    spawnInitialBotsForSector(sectorId) {
      if (sectorId === SAFE_ZONE.sectorId) return;
      const count = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const profile = this.spawnManager.pickProfile(BOT_PROFILE_WEIGHTS);
        const pos = this.findFreeSpawnCell(sectorId);
        if (pos) this.spawnBot(sectorId, pos.gx, pos.gy, profile);
      }
    }
    aliveBotCount() {
      let n = 0;
      for (const e of this.entities.values()) if (!e.isPlayer && e.isAlive) n++;
      return n;
    }
    saveSectorState(sectorId) {
      const bots = [];
      for (const e of this.entities.values()) {
        if (e.isPlayer) continue;
        bots.push({
          id: e.id,
          gx: e.gx,
          gy: e.gy,
          hp: e.hp,
          profileId: this._profileId(e.profile),
          brainState: e.botBrain ? e.botBrain.serializeState() : null,
          inventory: e.inventory.serialize(),
          currentWeaponId: e.currentWeaponId,
          currentAmmo: e.currentAmmo,
          facingAngle: e.facingAngle,
          activeWeaponSlot: e.activeWeaponSlot
        });
      }
      const pois = this.poiManager.getForSector(sectorId).map((p) => ({ ...p }));
      this.sectorStates.set(sectorId, { bots, pois });
    }
    restoreSectorState(sectorId) {
      const saved = this.sectorStates.get(sectorId);
      if (!saved) return;
      this.poiManager.deserialize(saved.pois.filter((p) => p.sectorId === sectorId));
      for (const b of saved.bots) {
        const profile = BOT_PROFILES[b.profileId] || BOT_PROFILES.assault;
        let spawnPos;
        if (b.gx !== null && b.gy !== null && this.grid.isWalkable(b.gx, b.gy, null)) {
          spawnPos = { gx: b.gx, gy: b.gy };
        } else {
          spawnPos = this.findFreeSpawnCell(sectorId);
        }
        if (!spawnPos) {
          console.warn("[World] restoreSectorState: no free spawn for bot", b.id);
          continue;
        }
        const bot = new Entity({ id: b.id, type: "bot", gx: spawnPos.gx, gy: spawnPos.gy, profile, world: this });
        this.setupBot(bot, profile);
        if (b.hp !== void 0) bot.hp = b.hp;
        if (b.inventory) bot.inventory = Inventory.deserialize(b.inventory);
        if (b.currentWeaponId) bot.currentWeaponId = b.currentWeaponId;
        if (b.currentAmmo !== void 0) bot.currentAmmo = b.currentAmmo;
        if (b.facingAngle !== void 0) bot.facingAngle = b.facingAngle;
        if (b.activeWeaponSlot) bot.activeWeaponSlot = b.activeWeaponSlot;
        if (bot.botBrain && b.brainState) {
          bot.botBrain.deserializeState(b.brainState);
        }
        this.entities.set(bot.id, bot);
        this.eventBus.emit("entity:spawned", bot);
      }
      this.sectorStates.delete(sectorId);
    }
    update(dt, now) {
      if (!this.player || !this.grid.sector) return;
      this.taskQueue.update(now);
      this.poiManager.update(now);
      this.spawnManager.update(now);
      this.updateSmoke(now);
      if (this.groupManager) {
        this.groupManager.updateGroups(now);
      }
      this.player.moveCooldown = Math.max(0, this.player.moveCooldown - dt);
      this.player.updateRecovery(dt);
      for (const e of this.entities.values()) {
        if (e.isPlayer) continue;
        if (!e.isAlive) continue;
        e.updateRecovery(dt);
        if (e.botBrain) e.botBrain.update(now);
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        const alive = p.update(dt);
        if (!alive) {
          if (p.destroy) p.destroy();
          this.projectiles.splice(i, 1);
        }
      }
      this.updateNeighborSectors(now);
      this.updateRemoteSectors(now);
    }
    updateNeighborSectors(now) {
      if (now - this.lastNeighborTick < WORLD_SIM.NEIGHBOR_INTERVAL_MS) return;
      this.lastNeighborTick = now;
    }
    updateRemoteSectors(now) {
      if (now - this.lastRemoteTick < WORLD_SIM.REMOTE_INTERVAL_MS) return;
      this.lastRemoteTick = now;
    }
    serialize() {
      const sectorStates = [];
      for (const [sectorId, s] of this.sectorStates.entries()) {
        sectorStates.push({
          sectorId,
          bots: s.bots.map((b) => ({ ...b })),
          pois: s.pois.map((p) => ({ ...p }))
        });
      }
      const currentBots = [];
      for (const e of this.entities.values()) {
        if (e.isPlayer) continue;
        currentBots.push({
          id: e.id,
          gx: e.gx,
          gy: e.gy,
          hp: e.hp,
          profileId: this._profileId(e.profile),
          brainState: e.botBrain ? e.botBrain.serializeState() : null,
          inventory: e.inventory.serialize(),
          currentWeaponId: e.currentWeaponId,
          currentAmmo: e.currentAmmo,
          facingAngle: e.facingAngle,
          activeWeaponSlot: e.activeWeaponSlot
        });
      }
      const currentPois = this.poiManager.getForSector(this.currentSectorId).map((p) => ({ ...p }));
      const currentSectorState = {
        sectorId: this.currentSectorId,
        bots: currentBots,
        pois: currentPois
      };
      return {
        version: SAVE_VERSION$1,
        savedAt: Date.now(),
        currentSectorId: this.currentSectorId,
        player: this.player ? this.player.serialize() : null,
        selectedBeltSlot: this.selectedBeltSlot,
        sectorStates,
        currentSectorState,
        allPois: this.poiManager.serialize(),
        smokeClouds: this.smokeClouds.map((s) => ({ ...s })),
        nextEntityId: this._nextEntityId
      };
    }
    async deserialize(data) {
      if (!data) return;
      this._nextEntityId = data.nextEntityId || 1;
      this.currentSectorId = data.currentSectorId || SAFE_ZONE.sectorId;
      await this.grid.loadSector(this.currentSectorId);
      await this.assets.preloadLevel(this.grid.sector);
      const p = data.player;
      if (p && this.player) {
        this.player.hp = p.hp;
        this.player.stats = Stats.deserialize(p.stats);
        this.player.inventory = Inventory.deserialize(p.inventory);
        this.player.gx = p.gx;
        this.player.gy = p.gy;
        this.player.activeWeaponSlot = p.activeWeaponSlot;
        this.player.currentWeaponId = p.currentWeaponId;
        this.player.currentAmmo = p.currentAmmo;
        this.player.facingAngle = p.facingAngle;
        this.player.xp = p.xp;
        this.player.level = p.level;
        this.player.pointsAvailable = p.pointsAvailable;
      }
      this.selectedBeltSlot = data.selectedBeltSlot || null;
      this.entities.clear();
      if (this.player) this.entities.set(this.player.id, this.player);
      this.sectorStates.clear();
      for (const s of data.sectorStates || []) {
        this.sectorStates.set(s.sectorId, { bots: s.bots, pois: s.pois });
      }
      if (data.currentSectorState) {
        const cs = data.currentSectorState;
        this.sectorStates.set(cs.sectorId, { bots: cs.bots, pois: cs.pois });
      }
      this.poiManager.deserialize(data.allPois || []);
      this.smokeClouds = (data.smokeClouds || []).map((s) => ({
        ...s,
        createdAt: performance.now()
      }));
      this.restoreSectorState(this.currentSectorId);
      if (this.groupManager) {
        this.groupManager.groups.clear();
        this.groupManager.botToGroup.clear();
      }
      if (this.grid.sector) {
        this.camera.snapTo(this.player.gx, this.player.gy, this.grid.sector.width, this.grid.sector.height);
      }
    }
  }
  class InputSystem {
    constructor(world) {
      this.world = world;
      this.keys = {};
      this.keyBindings = { ...GAME_KEYS };
      this.canvas = null;
      this.listeners = [];
    }
    init(canvas) {
      this.canvas = canvas;
      this.bind();
    }
    bind() {
      const onKeyDown = (e) => {
        this.keys[e.code] = true;
        this.handleKeyDown(e);
      };
      const onKeyUp = (e) => {
        this.keys[e.code] = false;
      };
      const onMouseDown = (e) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { gx, gy } = this.world.camera.screenToGrid(sx, sy);
        this.world.handleClick(gx, gy);
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      if (this.canvas) this.canvas.addEventListener("mousedown", onMouseDown);
      this.listeners.push(
        () => window.removeEventListener("keydown", onKeyDown),
        () => window.removeEventListener("keyup", onKeyUp),
        () => {
          if (this.canvas) this.canvas.removeEventListener("mousedown", onMouseDown);
        }
      );
    }
    handleKeyDown(e) {
      const k = this.keyBindings;
      if (e.code === k.ESCAPE) {
        if (this.world.selectedBeltSlot !== null) {
          this.world.cancelSelection();
          return;
        }
        this.world.ui.menu.toggle();
        return;
      }
      if (e.code === k.RELOAD) {
        this.world.player.reload();
        return;
      }
      if (e.code === k.SWAP_WEAPON) {
        const ok = this.world.player.switchWeaponSlot();
        this.world.eventBus.emit("hud:message", ok ? "Переключено" : "Нет оружия");
        return;
      }
      if (e.code === k.INVENTORY) {
        this.world.ui.inventory.toggle();
        return;
      }
      if (e.code === k.MINIMAP) {
        this.toggleMinimap();
        return;
      }
      if (e.code === k.GLOBAL_MAP) {
        this.toggleGlobalMap();
        return;
      }
      if (e.code === k.USE_SLOT_1) {
        this.world.selectBeltSlot(0);
        return;
      }
      if (e.code === k.USE_SLOT_2) {
        this.world.selectBeltSlot(1);
        return;
      }
      if (e.code === k.USE_SLOT_3) {
        this.world.selectBeltSlot(2);
        return;
      }
      if (e.code === k.USE_SLOT_4) {
        this.world.selectBeltSlot(3);
        return;
      }
    }
    toggleMinimap() {
      const settings = this.world.game && this.world.game.settings;
      if (!settings) {
        this.world.ui.minimap.toggle();
        return;
      }
      if (!settings.get("showMinimap")) {
        this.world.eventBus.emit("hud:message", t("msg.mapDisabledInSettings"));
        return;
      }
      this.world.ui.minimap.toggle();
    }
    toggleGlobalMap() {
      const settings = this.world.game && this.world.game.settings;
      if (!settings) {
        this.world.ui.globalMap.toggle();
        return;
      }
      if (!settings.get("showGlobalMap")) {
        this.world.eventBus.emit("hud:message", t("msg.mapDisabledInSettings"));
        return;
      }
      this.world.ui.globalMap.toggle();
    }
    getMoveDir() {
      const k = this.keyBindings;
      let dx = 0, dy = 0;
      if (this.keys[k.MOVE_UP]) dy = -1;
      if (this.keys[k.MOVE_DOWN]) dy = 1;
      if (this.keys[k.MOVE_LEFT]) dx = -1;
      if (this.keys[k.MOVE_RIGHT]) dx = 1;
      return { dx, dy };
    }
    rebind(action, code) {
      if (Object.prototype.hasOwnProperty.call(this.keyBindings, action)) {
        this.keyBindings[action] = code;
      }
    }
    resetKeys() {
      this.keyBindings = { ...GAME_KEYS };
    }
    destroy() {
      for (const off of this.listeners) off();
      this.listeners = [];
    }
  }
  class HUD {
    constructor(world) {
      this.world = world;
      this.container = null;
      this.elements = {};
      this.lastUpdate = 0;
      this.beltSlots = [];
      this.messages = [];
    }
    mount(parent) {
      this.container = document.createElement("div");
      this.container.id = "hud-container";
      this.container.style.cssText = "display:flex;flex-direction:column;gap:8px;font-family:monospace;font-size:12px;color:#eee;";
      parent.appendChild(this.container);
      this.build();
      this.world.eventBus.on("belt:selection", (index) => this.updateBeltSelection(index));
    }
    build() {
      this.container.innerHTML = `
      <div style="background:rgba(0,0,0,0.85);border-radius:8px;padding:12px;min-width:240px;">
        <div style="border-bottom:1px solid #555;padding-bottom:6px;margin-bottom:6px;">
          <div>${t("hud.sector")}: <span id="hud-sector">-</span></div>
          <div>${t("hud.coords")}: <span id="hud-coords">-, -</span></div>
          <div>${t("hud.enemies")}: <span id="hud-enemies">0</span></div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t("hud.hp")}</span><span id="hud-hp-value">0/0</span></div>
          <div style="background:#333;height:6px;border-radius:3px;overflow:hidden;">
            <div id="hud-hp-bar" style="width:0%;height:100%;background:#4caf50;"></div>
          </div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t("hud.weapon")}</span><span id="hud-weapon-name">-</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>${t("hud.ammo")}</span><span id="hud-ammo">0/0</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;margin-top:2px;">
            <div id="hud-ammo-bar" style="width:0%;height:100%;background:#ff9800;"></div>
          </div>
        </div>
        <div id="hud-reload" style="display:none;color:#ff9800;margin-bottom:6px;">${t("hud.reloading")}</div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t("hud.recoil")}</span><span id="hud-recoil">0%</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;">
            <div id="hud-recoil-bar" style="width:0%;height:100%;background:#f44336;"></div>
          </div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;"><span>${t("hud.suppression")}</span><span id="hud-suppression">0%</span></div>
          <div style="background:#333;height:4px;border-radius:2px;overflow:hidden;">
            <div id="hud-suppression-bar" style="width:0%;height:100%;background:#9c27b0;"></div>
          </div>
        </div>
        <div style="border-top:1px solid #555;padding-top:6px;margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <span>${t("hud.strength")}: <span id="hud-str">10</span></span>
          <span>${t("hud.accuracy")}: <span id="hud-acc">10</span></span>
          <span>${t("hud.endurance")}: <span id="hud-end">10</span></span>
          <span>${t("hud.health")}: <span id="hud-health">10</span></span>
        </div>
        <div style="border-top:1px solid #555;padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;">
          <span>${t("hud.level")}: <span id="hud-level">1</span></span>
          <span>${t("hud.xp")}: <span id="hud-xp">0</span></span>
          <span>${t("hud.points")}: <span id="hud-points">0</span></span>
        </div>
        <div id="hud-belt" style="border-top:1px solid #555;padding-top:6px;margin-top:4px;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">${t("hud.belt")}</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:4px;" id="hud-belt-slots"></div>
        </div>
        <div id="hud-message" style="border-top:1px solid #555;margin-top:6px;padding-top:6px;color:#aaa;font-size:10px;min-height:14px;">${t("common.ready")}</div>
      </div>
    `;
      this.refreshElements();
      this.buildBeltSlots();
      this.world.eventBus.on("hud:message", (msg) => this.setMessage(msg));
    }
    buildBeltSlots() {
      const container = this.container.querySelector("#hud-belt-slots");
      if (!container) return;
      container.innerHTML = "";
      this.beltSlots = [];
      for (let i = 0; i < 4; i++) {
        const slot = document.createElement("div");
        slot.dataset.index = i;
        slot.style.cssText = `
        padding:4px;background:#222;border:1px solid #444;border-radius:3px;
        text-align:center;cursor:pointer;min-height:28px;font-size:10px;color:#aaa;
        transition:border-color 0.15s, background 0.15s;
      `;
        slot.onclick = () => {
          if (this.world) this.world.selectBeltSlot(i);
        };
        container.appendChild(slot);
        this.beltSlots.push(slot);
      }
    }
    updateBeltSlots() {
      if (!this.world || !this.world.player) return;
      const belt = this.world.player.inventory.belt;
      const selected = this.world.selectedBeltSlot;
      for (let i = 0; i < 4; i++) {
        const el = this.beltSlots[i];
        if (!el) continue;
        const item = belt[i];
        if (item) {
          const def = CONSUMABLE_ITEMS[item.id];
          const name = def ? t(def.nameKey) : item.id;
          el.textContent = `${i + 1}: ${name}`;
          el.style.color = "#eee";
          el.style.background = "#2a2a2a";
        } else {
          el.textContent = `${i + 1}: ${t("hud.emptySlot")}`;
          el.style.color = "#555";
          el.style.background = "#111";
        }
        if (selected === i) {
          el.style.borderColor = "#4caf50";
          el.style.background = "#1e3a1e";
        } else {
          el.style.borderColor = "#444";
        }
      }
    }
    updateBeltSelection() {
      this.updateBeltSlots();
    }
    refreshElements() {
      const q = (id) => this.container.querySelector("#" + id);
      this.elements = {
        sector: q("hud-sector"),
        coords: q("hud-coords"),
        enemies: q("hud-enemies"),
        hpValue: q("hud-hp-value"),
        hpBar: q("hud-hp-bar"),
        weaponName: q("hud-weapon-name"),
        ammo: q("hud-ammo"),
        ammoBar: q("hud-ammo-bar"),
        reload: q("hud-reload"),
        recoil: q("hud-recoil"),
        recoilBar: q("hud-recoil-bar"),
        suppression: q("hud-suppression"),
        suppressionBar: q("hud-suppression-bar"),
        str: q("hud-str"),
        acc: q("hud-acc"),
        end: q("hud-end"),
        health: q("hud-health"),
        level: q("hud-level"),
        xp: q("hud-xp"),
        points: q("hud-points"),
        belt: q("hud-belt"),
        beltSlots: q("hud-belt-slots"),
        message: q("hud-message")
      };
    }
    update(player, sectorId, enemyCount) {
      const now = performance.now();
      if (now - this.lastUpdate < 100) return;
      this.lastUpdate = now;
      if (!player) return;
      const e = this.elements;
      const sector = GLOBAL_LAYOUT.sectors[sectorId];
      if (e.sector) e.sector.textContent = sector ? sector.name : sectorId;
      if (e.coords) e.coords.textContent = player.gx + ", " + player.gy;
      if (e.enemies) e.enemies.textContent = String(enemyCount);
      const hpPercent = Math.max(0, player.hp / player.maxHp * 100);
      if (e.hpValue) e.hpValue.textContent = Math.max(0, Math.floor(player.hp)) + "/" + player.maxHp;
      if (e.hpBar) {
        e.hpBar.style.width = hpPercent + "%";
        e.hpBar.style.background = hpPercent > 60 ? "#4caf50" : hpPercent > 30 ? "#ff9800" : "#f44336";
      }
      const weapon = player.getActiveWeapon();
      if (weapon) {
        if (e.weaponName) e.weaponName.textContent = t(weapon.nameKey);
        const ammoPercent = player.currentAmmo / weapon.magazineSize * 100;
        if (e.ammo) e.ammo.textContent = player.currentAmmo + "/" + weapon.magazineSize;
        if (e.ammoBar) {
          e.ammoBar.style.width = ammoPercent + "%";
          e.ammoBar.style.background = player.currentAmmo < weapon.magazineSize * 0.3 ? "#f44336" : "#ff9800";
        }
      } else {
        if (e.weaponName) e.weaponName.textContent = t("hud.noWeapon");
        if (e.ammo) e.ammo.textContent = "0/0";
        if (e.ammoBar) e.ammoBar.style.width = "0%";
      }
      if (e.reload) e.reload.style.display = player.isReloading ? "block" : "none";
      const maxRecoil = weapon ? weapon.maxRecoil : 1;
      const recoilPercent = player.recoil / maxRecoil * 100;
      if (e.recoil) e.recoil.textContent = recoilPercent.toFixed(0) + "%";
      if (e.recoilBar) e.recoilBar.style.width = recoilPercent + "%";
      const suppPercent = player.suppression * 100;
      if (e.suppression) e.suppression.textContent = suppPercent.toFixed(0) + "%";
      if (e.suppressionBar) e.suppressionBar.style.width = suppPercent + "%";
      if (e.str) e.str.textContent = String(player.stats.strength);
      if (e.acc) e.acc.textContent = String(player.stats.accuracy);
      if (e.end) e.end.textContent = String(player.stats.endurance);
      if (e.health) e.health.textContent = String(player.stats.health);
      if (e.level) e.level.textContent = String(player.level);
      if (e.xp) e.xp.textContent = String(player.xp);
      if (e.points) e.points.textContent = String(player.pointsAvailable);
      this.updateBeltSlots();
    }
    setMessage(msg) {
      if (!this.elements.message) return;
      this.elements.message.textContent = msg;
      clearTimeout(this._msgTimer);
      this._msgTimer = setTimeout(() => {
        if (this.elements.message) this.elements.message.textContent = t("common.ready");
      }, 3e3);
    }
  }
  class InventoryUI {
    constructor(world) {
      this.world = world;
      this.container = null;
      this.visible = false;
    }
    mount() {
      this.container = document.createElement("div");
      this.container.id = "inventory-panel";
      this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:16px;z-index:1000;display:none;color:#eee;font-family:monospace;font-size:12px;
      max-height:80vh;overflow-y:auto;
    `;
      document.body.appendChild(this.container);
      this.world.eventBus.on("belt:selection", () => {
        if (this.visible) this.render();
      });
    }
    toggle() {
      this.visible = !this.visible;
      this.container.style.display = this.visible ? "block" : "none";
      if (this.visible) this.render();
    }
    render() {
      const inv = this.world.player.inventory;
      const selected = this.world.selectedBeltSlot;
      const slotsHtml = Object.entries(inv.slots).map(([slot, item]) => {
        if (!item) return `<div style="padding:4px;border:1px solid #333;">${t("inv.slot." + slot)}: —</div>`;
        const def = WEAPONS[item.id] || ARMOR_ITEMS[item.id];
        const name = def ? t(def.nameKey) : item.id;
        return `<div style="padding:4px;border:1px solid #333;">${t("inv.slot." + slot)}: ${name}</div>`;
      }).join("");
      const gridCells = [];
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const e = inv.grid[y][x];
          if (e && e.gx === x && e.gy === y) {
            const def = CONSUMABLE_ITEMS[e.item.id] || WEAPONS[e.item.id] || ARMOR_ITEMS[e.item.id];
            const name = def ? t(def.nameKey) : e.item.id;
            gridCells.push(`<div style="grid-column:span ${e.w};grid-row:span ${e.h};background:#2a2a2a;border:1px solid #555;padding:2px;font-size:10px;">${name}</div>`);
          } else if (!e) {
            gridCells.push(`<div style="background:#1a1a1a;border:1px solid #333;min-height:24px;"></div>`);
          }
        }
      }
      const beltHtml = inv.belt.map((item, i) => {
        const isSelected = selected === i;
        const border = isSelected ? "#4caf50" : "#555";
        const bg = isSelected ? "#1e3a1e" : item ? "#2a2a2a" : "#1a1a1a";
        if (!item) {
          return `<div data-belt="${i}" style="padding:4px;border:1px solid ${border};background:${bg};text-align:center;cursor:pointer;color:#555;">${i + 1}: ${t("hud.emptySlot")}</div>`;
        }
        const def = CONSUMABLE_ITEMS[item.id];
        const name = def ? t(def.nameKey) : item.id;
        return `<div data-belt="${i}" style="padding:4px;border:1px solid ${border};background:${bg};text-align:center;cursor:pointer;color:#eee;">${i + 1}: ${name}</div>`;
      }).join("");
      this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;">${t("inv.title")}</h3>
        <button id="inv-close" style="background:#555;color:#fff;border:none;padding:4px 8px;cursor:pointer;">${t("common.close")}</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        ${slotsHtml}
      </div>
      <div style="margin-bottom:12px;">
        <div style="margin-bottom:4px;">${t("inv.belt")}</div>
        <div style="display:grid;grid-template-columns:repeat(${BELT_SLOTS}, 1fr);gap:4px;">${beltHtml}</div>
      </div>
      <div>
        <div style="margin-bottom:4px;">${t("inv.title")} ${GRID_W}×${GRID_H}</div>
        <div style="display:grid;grid-template-columns:repeat(${GRID_W}, 1fr);gap:2px;">${gridCells.join("")}</div>
      </div>
    `;
      const closeBtn = this.container.querySelector("#inv-close");
      if (closeBtn) closeBtn.onclick = () => this.toggle();
      this.container.querySelectorAll("[data-belt]").forEach((el) => {
        el.onclick = () => {
          const idx = Number(el.dataset.belt);
          this.world.selectBeltSlot(idx);
        };
      });
    }
  }
  class Minimap {
    constructor(world) {
      this.world = world;
      this.container = null;
      this.canvas = null;
      this.visible = true;
    }
    mount(parent) {
      this.container = document.createElement("div");
      this.container.id = "minimap-container";
      this.container.style.cssText = `position:relative;width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;border:2px solid #555;background:#222;display:inline-block;vertical-align:top;`;
      parent.appendChild(this.container);
      this.canvas = document.createElement("canvas");
      this.canvas.id = "minimap-canvas";
      this.canvas.width = MINIMAP_SIZE;
      this.canvas.height = MINIMAP_SIZE;
      this.canvas.style.cssText = `width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;image-rendering:pixelated;display:block;`;
      this.container.appendChild(this.canvas);
    }
    setVisible(visible) {
      this.visible = !!visible;
      if (this.container) {
        this.container.style.display = this.visible ? "inline-block" : "none";
      }
    }
    toggle() {
      this.setVisible(!this.visible);
    }
    draw() {
      if (!this.visible || !this.canvas) return;
      const grid = this.world.grid;
      if (!grid || !grid.sector) return;
      const ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      ctx.fillStyle = "#CC9966";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      for (const obs of grid.obstacleList) {
        const def = OBSTACLE_TYPES[obs.logicType];
        if (!def) continue;
        ctx.fillStyle = obs.logicType === "water" ? "#336699" : "#336600";
        ctx.fillRect(
          obs.anchorGx * MINIMAP_PX_PER_CELL,
          obs.anchorGy * MINIMAP_PX_PER_CELL,
          def.size[0] * MINIMAP_PX_PER_CELL,
          def.size[1] * MINIMAP_PX_PER_CELL
        );
      }
      ctx.fillStyle = "#FFFF00";
      for (const tr of grid.transitions) {
        ctx.fillRect(tr.from.gx * MINIMAP_PX_PER_CELL, tr.from.gy * MINIMAP_PX_PER_CELL, 4, 4);
      }
      const player = this.world.player;
      if (player) {
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(
          player.gx * MINIMAP_PX_PER_CELL - 1,
          player.gy * MINIMAP_PX_PER_CELL - 1,
          4,
          4
        );
      }
      for (const e of this.world.entities.values()) {
        if (e.isPlayer || !e.isAlive) continue;
        if (e.gx === void 0) continue;
        ctx.fillStyle = "#FF3333";
        ctx.fillRect(
          e.gx * MINIMAP_PX_PER_CELL,
          e.gy * MINIMAP_PX_PER_CELL,
          2,
          2
        );
      }
    }
  }
  const CELL_PX = MINIMAP_SIZE / GLOBAL_LAYOUT.size[0];
  class GlobalMap {
    constructor(world) {
      this.world = world;
      this.container = null;
      this.canvas = null;
      this.visible = true;
    }
    mount(parent) {
      this.container = document.createElement("div");
      this.container.id = "global-map-container";
      this.container.style.cssText = `position:relative;width:${MINIMAP_SIZE}px;height:${MINIMAP_SIZE}px;border:2px solid #555;background:#222;display:inline-block;vertical-align:top;`;
      parent.appendChild(this.container);
      this.canvas = document.createElement("canvas");
      this.canvas.width = MINIMAP_SIZE;
      this.canvas.height = MINIMAP_SIZE;
      this.canvas.style.cssText = "image-rendering:pixelated;display:block;width:100%;height:100%;";
      this.container.appendChild(this.canvas);
    }
    setVisible(visible) {
      this.visible = !!visible;
      if (this.container) {
        this.container.style.display = this.visible ? "inline-block" : "none";
      }
    }
    toggle() {
      this.setVisible(!this.visible);
    }
    draw() {
      if (!this.visible || !this.canvas) return;
      const ctx = this.canvas.getContext("2d");
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, w, h);
      const bg = this.world.assets.getImage("global_map");
      if (bg) {
        ctx.drawImage(bg, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= GLOBAL_LAYOUT.size[0]; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_PX, 0);
        ctx.lineTo(i * CELL_PX, h);
        ctx.stroke();
      }
      for (let i = 0; i <= GLOBAL_LAYOUT.size[1]; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_PX);
        ctx.lineTo(w, i * CELL_PX);
        ctx.stroke();
      }
      const current = GLOBAL_LAYOUT.sectors[this.world.currentSectorId];
      if (current) {
        ctx.fillStyle = "rgba(0,255,0,0.25)";
        ctx.fillRect(current.gx * CELL_PX, current.gy * CELL_PX, CELL_PX, CELL_PX);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.strokeRect(current.gx * CELL_PX, current.gy * CELL_PX, CELL_PX, CELL_PX);
      }
      const player = this.world.player;
      const sector = this.world.grid && this.world.grid.sector;
      if (player && current && sector) {
        const px = current.gx * CELL_PX + player.gx / sector.width * CELL_PX;
        const py = current.gy * CELL_PX + player.gy / sector.height * CELL_PX;
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  class Menu {
    constructor(world, saveManager) {
      this.world = world;
      this.saveManager = saveManager;
      this.container = null;
      this.visible = false;
    }
    mount() {
      this.container = document.createElement("div");
      this.container.id = "menu-screen";
      this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:24px;z-index:1002;display:none;color:#eee;font-family:monospace;
      min-width:360px;
    `;
      document.body.appendChild(this.container);
    }
    toggle() {
      this.visible = !this.visible;
      this.container.style.display = this.visible ? "block" : "none";
      if (this.visible) this.render();
    }
    async render() {
      const saves = await this.saveManager.listSaves();
      const saveRow = (label, data, key) => {
        const when = data ? new Date(data.savedAt).toLocaleString() : "—";
        return `
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
          <span style="flex:1;">${label}</span>
          <span style="font-size:10px;color:#888;min-width:120px;text-align:right;">${when}</span>
          ${data ? `<button data-load="${key}" style="padding:2px 6px;background:#2e7d32;color:#fff;border:none;cursor:pointer;">${t("menu.load")}</button>` : ""}
          ${data ? `<button data-del="${key}" style="padding:2px 6px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">${t("common.delete")}</button>` : ""}
        </div>
      `;
      };
      const manualRows = saves.manual.map((m) => {
        const key = "manual_save_" + m.slot;
        const row = saveRow("Ручное " + m.slot, m.data, key);
        const saveBtn = `<button data-save="${m.slot}" style="padding:2px 6px;background:#1565c0;color:#fff;border:none;cursor:pointer;margin-left:4px;">${t("menu.save")}</button>`;
        return row.replace("</div>", saveBtn + "</div>");
      }).join("");
      this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;">${t("menu.title")}</h2>
        <button id="menu-data" title="${t("menu.data")}" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;">ⓘ</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        <button data-action="resume" style="padding:8px;background:#2e7d32;color:#fff;border:none;cursor:pointer;">${t("common.close")}</button>
        <button data-action="settings" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">${t("menu.settings")}</button>
        <button data-action="saves" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">${t("save.title")}</button>
        <button data-action="quit" style="padding:8px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">${t("menu.quit")}</button>
      </div>
      <div id="menu-saves" style="display:none;border-top:1px solid #555;padding-top:12px;">
        <h4 style="margin-top:0;">${t("save.title")}</h4>
        ${saves.auto ? saveRow(t("save.auto"), saves.auto, "auto_save") : `<div style="color:#888;margin-bottom:4px;">${t("save.auto")}: ${t("save.empty")}</div>`}
        ${saves.autoBackup ? saveRow(t("save.auto") + " (резерв)", saves.autoBackup, "auto_save_backup") : ""}
        ${manualRows}
      </div>
    `;
      this.container.querySelector("#menu-data").onclick = () => {
        this.toggle();
        this.world.ui.dataScreen.toggle();
      };
      this.container.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.onclick = () => this.handle(btn.dataset.action);
      });
      this.container.querySelectorAll("button[data-save]").forEach((btn) => {
        btn.onclick = async () => {
          await this.saveManager.saveManual(Number(btn.dataset.save));
          await this.render();
        };
      });
      this.container.querySelectorAll("button[data-load]").forEach((btn) => {
        btn.onclick = async () => {
          const key = btn.dataset.load;
          if (key === "auto_save") await this.saveManager.loadAuto();
          else if (key === "auto_save_backup") await this.saveManager.loadAutoBackup();
          else if (key.startsWith("manual_save_")) await this.saveManager.loadManual(Number(key.split("_").pop()));
          this.toggle();
          this.world.eventBus.emit("hud:message", t("save.loaded"));
        };
      });
      this.container.querySelectorAll("button[data-del]").forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm(t("save.deleteConfirm"))) return;
          await this.saveManager.deleteSave(btn.dataset.del);
          await this.render();
        };
      });
    }
    async handle(action) {
      if (action === "resume") this.toggle();
      else if (action === "quit") {
        await this.saveManager.saveManual(1);
        this.world.eventBus.emit("hud:message", t("save.saved"));
      } else if (action === "settings") {
        this.toggle();
        this.world.ui.settings.toggle();
      } else if (action === "saves") {
        const el = this.container.querySelector("#menu-saves");
        el.style.display = el.style.display === "none" ? "block" : "none";
      }
    }
  }
  const KEY_LABEL_MAP = {
    MOVE_UP: "moveUp",
    MOVE_DOWN: "moveDown",
    MOVE_LEFT: "moveLeft",
    MOVE_RIGHT: "moveRight",
    RELOAD: "reload",
    SWAP_WEAPON: "swapWeapon",
    INVENTORY: "inventory",
    MINIMAP: "minimap",
    GLOBAL_MAP: "globalMap",
    ESCAPE: "escape",
    USE_SLOT_1: "slot1",
    USE_SLOT_2: "slot2",
    USE_SLOT_3: "slot3",
    USE_SLOT_4: "slot4"
  };
  class SettingsScreen {
    constructor(world, input, settingsStore, debugOverlay) {
      this.world = world;
      this.input = input;
      this.settings = settingsStore;
      this.debugOverlay = debugOverlay;
      this.container = null;
      this.visible = false;
      this.rebindingAction = null;
    }
    mount() {
      this.container = document.createElement("div");
      this.container.id = "settings-screen";
      this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:20px;z-index:1003;display:none;color:#eee;font-family:monospace;font-size:13px;
      max-height:80vh;overflow-y:auto;min-width:400px;
    `;
      document.body.appendChild(this.container);
    }
    toggle() {
      this.visible = !this.visible;
      this.container.style.display = this.visible ? "block" : "none";
      if (this.visible) this.render();
    }
    render() {
      const s = this.settings;
      const keysHtml = Object.keys(GAME_KEYS).map((action) => {
        const code = this.input.keyBindings[action] || GAME_KEYS[action];
        const labelKey = KEY_LABEL_MAP[action] || action.toLowerCase();
        const label = t("settings.key." + labelKey);
        return `
        <div style="display:flex;justify-content:space-between;padding:4px;border-bottom:1px solid #333;">
          <span>${label}</span>
          <button data-action="${action}" style="background:#444;color:#fff;border:none;padding:2px 8px;cursor:pointer;min-width:80px;">
            ${this.rebindingAction === action ? "…" : code}
          </button>
        </div>
      `;
      }).join("");
      this.container.innerHTML = `
      <h3 style="margin-top:0;">${t("settings.title")}</h3>
      <div style="margin-bottom:12px;">
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t("settings.minimap")}</span>
          <input type="checkbox" id="set-minimap" ${s.get("showMinimap") ? "checked" : ""}>
        </label>
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t("settings.globalMap")}</span>
          <input type="checkbox" id="set-global-map" ${s.get("showGlobalMap") ? "checked" : ""}>
        </label>
        <label style="display:flex;justify-content:space-between;padding:4px;">
          <span>${t("settings.debug")}</span>
          <input type="checkbox" id="set-debug" ${s.get("debug") ? "checked" : ""}>
        </label>
      </div>
      <div style="margin-bottom:12px;">
        <h4>${t("settings.keys")}</h4>
        ${keysHtml}
        <button id="set-reset-keys" style="margin-top:8px;background:#555;color:#fff;border:none;padding:4px 12px;cursor:pointer;">
          ${t("settings.resetKeys")}
        </button>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="set-back" style="background:#555;color:#fff;border:none;padding:6px 12px;cursor:pointer;">
          ${t("settings.back")}
        </button>
        <button id="set-save" style="background:#2e7d32;color:#fff;border:none;padding:6px 12px;cursor:pointer;">
          ${t("settings.save")}
        </button>
      </div>
    `;
      this.container.querySelector("#set-back").onclick = () => {
        this.toggle();
        if (this.world.ui.menu && !this.world.ui.menu.visible) this.world.ui.menu.toggle();
      };
      this.container.querySelector("#set-save").onclick = () => this.saveAndClose();
      this.container.querySelector("#set-reset-keys").onclick = () => {
        this.input.resetKeys();
        this.render();
      };
      this.container.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.onclick = () => this.startRebind(btn.dataset.action);
      });
    }
    startRebind(action) {
      this.rebindingAction = action;
      this.render();
      const handler = (e) => {
        e.preventDefault();
        this.input.rebind(action, e.code);
        this.rebindingAction = null;
        window.removeEventListener("keydown", handler, true);
        this.render();
      };
      window.addEventListener("keydown", handler, true);
    }
    saveAndClose() {
      const showMinimap = this.container.querySelector("#set-minimap").checked;
      const showGlobalMap = this.container.querySelector("#set-global-map").checked;
      const debug = this.container.querySelector("#set-debug").checked;
      const prevMinimap = this.settings.get("showMinimap");
      const prevGlobalMap = this.settings.get("showGlobalMap");
      const prevDebug = this.settings.get("debug");
      this.settings.set("showMinimap", showMinimap);
      this.settings.set("showGlobalMap", showGlobalMap);
      this.settings.set("debug", debug);
      this.settings.set("keyBindings", { ...this.input.keyBindings });
      this.settings.save();
      if (prevDebug !== debug) {
        this.world.eventBus.emit("settings:debug-changed", debug);
      }
      if (prevMinimap !== showMinimap || prevGlobalMap !== showGlobalMap) {
        this.world.eventBus.emit("settings:maps-changed", { showMinimap, showGlobalMap });
      }
      this.toggle();
      if (this.world.ui.menu && !this.world.ui.menu.visible) this.world.ui.menu.toggle();
    }
  }
  class SettingsStore {
    constructor() {
      this.data = {
        showMinimap: true,
        showGlobalMap: true,
        debug: false,
        keyBindings: { ...GAME_KEYS }
      };
      this._load();
    }
    get(key) {
      return this.data[key];
    }
    set(key, value) {
      this.data[key] = value;
    }
    _load() {
      try {
        const raw = localStorage.getItem("subgraphs_settings");
        if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      } catch {
      }
    }
    save() {
      try {
        localStorage.setItem("subgraphs_settings", JSON.stringify(this.data));
      } catch {
      }
    }
  }
  class DataScreen {
    constructor(world, db, saveManager) {
      this.world = world;
      this.db = db;
      this.saveManager = saveManager;
      this.container = null;
      this.visible = false;
      this.stats = null;
      this.onAfterImport = null;
    }
    mount() {
      this.container = document.createElement("div");
      this.container.id = "data-screen";
      this.container.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #555;border-radius:8px;
      padding:20px;z-index:1003;display:none;color:#eee;font-family:monospace;
      font-size:13px;max-width:500px;width:100%;
    `;
      document.body.appendChild(this.container);
    }
    async toggle() {
      this.visible = !this.visible;
      this.container.style.display = this.visible ? "block" : "none";
      if (this.visible) await this.render();
    }
    async collectStats() {
      return {
        maps: (await this.db.getAllKeys("maps")).length,
        transitions: (await this.db.getAllKeys("transitions")).length,
        sprites: (await this.db.getAllKeys("sprites")).length,
        sounds: (await this.db.getAllKeys("sounds")).length,
        spawnPoints: (await this.db.getAllKeys("spawn_points")).length,
        caches: (await this.db.getAllKeys("caches")).length,
        saves: (await this.db.getAllKeys("saves")).length
      };
    }
    async render() {
      this.stats = await this.collectStats();
      const s = this.stats;
      const hasData = s.maps > 0 && s.sprites > 0;
      this.container.innerHTML = `
      <h3 style="margin-top:0;">${t("data.title")}</h3>
      <div style="margin-bottom:12px;padding:8px;background:#1a1a1a;border-radius:4px;">
        <div>${t("data.maps")}: ${s.maps}</div>
        <div>${t("data.transitions")}: ${s.transitions}</div>
        <div>${t("data.sprites")}: ${s.sprites}</div>
        <div>${t("data.sounds")}: ${s.sounds}</div>
        <div>${t("data.spawnPoints")}: ${s.spawnPoints}</div>
        <div>${t("data.caches")}: ${s.caches}</div>
        <div>${t("save.title")}: ${s.saves}</div>
      </div>
      ${!hasData ? `<div style="color:#ff9800;margin-bottom:12px;">${t("data.noData")}</div>` : ""}
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button id="data-import" style="padding:8px;background:#1565c0;color:#fff;border:none;cursor:pointer;">
          ${t("data.import")}
        </button>
        <button id="data-delete" style="padding:8px;background:#b71c1c;color:#fff;border:none;cursor:pointer;">
          ${t("data.deleteAll")}
        </button>
        <button id="data-back" style="padding:8px;background:#555;color:#fff;border:none;cursor:pointer;">
          ${t("settings.back")}
        </button>
      </div>
    `;
      this.container.querySelector("#data-back").onclick = () => this.toggle();
      this.container.querySelector("#data-import").onclick = () => this.openImportDialog();
      this.container.querySelector("#data-delete").onclick = () => this.handleDeleteAll();
    }
    openImportDialog() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await this.importZip(file);
        input.remove();
      };
      input.click();
    }
    async importZip(file) {
      const hasData = this.stats && this.stats.maps > 0;
      if (hasData) {
        const ok = confirm(t("data.importConfirm"));
        if (!ok) return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      await new Promise((resolve) => {
        if (window.JSZip) return resolve();
        script.onload = resolve;
        document.head.appendChild(script);
      });
      const JSZip = window.JSZip;
      const zip = await JSZip.loadAsync(file);
      if (hasData) {
        await this.db.clearAll();
      }
      await this.importMaps(zip);
      await this.importTransitions(zip);
      await this.importSprites(zip);
      await this.importSounds(zip);
      await this.importSpawnPoints(zip);
      await this.importCaches(zip);
      await this.importGlobalLayout(zip);
      alert(t("data.imported"));
      await this.render();
      this.world.eventBus.emit("hud:message", t("data.imported"));
      if (typeof this.onAfterImport === "function") this.onAfterImport();
    }
    async importMaps(zip) {
      const f = Object.values(zip.files).find((x) => x.name.endsWith("sector_maps.json"));
      if (!f) return;
      const json = JSON.parse(await f.async("string"));
      const maps = json.sector_maps || json;
      for (const id in maps) await this.db.put("maps", Number(id), maps[id]);
    }
    async importTransitions(zip) {
      const f = Object.values(zip.files).find((x) => x.name.endsWith("transitions.json"));
      if (!f) return;
      const json = JSON.parse(await f.async("string"));
      const list = json.transitions || [];
      for (const tr of list) {
        const key = `${tr.from.sectorId}|${tr.from.gx}|${tr.from.gy}`;
        await this.db.put("transitions", key, tr);
      }
    }
    async importSprites(zip) {
      for (const file of Object.values(zip.files)) {
        if (file.dir || !file.name.includes("/sprites/")) continue;
        const blob = await file.async("blob");
        const name = file.name.split("/").pop().split(".")[0];
        await this.db.put("sprites", name, blob);
      }
    }
    async importSounds(zip) {
      for (const file of Object.values(zip.files)) {
        if (file.dir || !file.name.includes("/sounds/")) continue;
        const blob = await file.async("blob");
        const name = file.name.split("/").pop().split(".")[0];
        await this.db.put("sounds", name, blob);
      }
    }
    async importSpawnPoints(zip) {
      const f = Object.values(zip.files).find((x) => x.name.endsWith("spawn_points.json"));
      if (!f) return;
      const json = JSON.parse(await f.async("string"));
      const list = json.spawn_points || json;
      if (Array.isArray(list)) {
        for (const p of list) {
          if (p.sectorId !== void 0) await this.db.put("spawn_points", p.sectorId, { points: [p] });
        }
      } else {
        for (const id in list) await this.db.put("spawn_points", Number(id), list[id]);
      }
    }
    async importCaches(zip) {
      const f = Object.values(zip.files).find((x) => x.name.endsWith("caches.json"));
      if (!f) return;
      const json = JSON.parse(await f.async("string"));
      const list = json.caches || json;
      if (Array.isArray(list)) {
        for (const c of list) {
          if (c.sectorId !== void 0) await this.db.put("caches", c.sectorId, c);
        }
      } else {
        for (const id in list) await this.db.put("caches", Number(id), list[id]);
      }
    }
    async importGlobalLayout(zip) {
      const f = Object.values(zip.files).find((x) => x.name.endsWith("global_layout.json"));
      if (!f) return;
      const json = JSON.parse(await f.async("string"));
      await this.db.put("global_layout", "layout", json);
    }
    async handleDeleteAll() {
      const ok = confirm(t("data.deleteConfirm"));
      if (!ok) return;
      await this.saveManager.deleteAllGameData();
      alert(t("common.ok"));
      await this.render();
    }
  }
  const INTENT_COLORS = {
    [INTENT.PATROL]: "#888888",
    [INTENT.HOLD]: "#00ccff",
    [INTENT.PUSH]: "#ff6600",
    [INTENT.FALL_BACK]: "#ff3333",
    [INTENT.SEARCH]: "#ffcc00",
    [INTENT.LOOT]: "#66ff66"
  };
  class DebugOverlay {
    constructor(world, container) {
      this.world = world;
      this.container = container;
      this.enabled = false;
      this.canvas = null;
      this.ctx = null;
      this.panel = null;
      this.mouseX = 0;
      this.mouseY = 0;
      this.lastRedraw = 0;
      this.lastFrameTime = performance.now();
      this.fps = 60;
      this.radioLog = [];
      this.mount();
    }
    mount() {
      this.canvas = document.createElement("canvas");
      this.canvas.width = VIEW_W * CELL_SIZE;
      this.canvas.height = VIEW_H * CELL_SIZE;
      this.canvas.style.cssText = "position:absolute;top:0;left:0;z-index:99;pointer-events:none;display:none;";
      this.ctx = this.canvas.getContext("2d");
      this.container.appendChild(this.canvas);
      this.panel = document.createElement("div");
      this.panel.style.cssText = `
      position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.9);color:#0f0;
      padding:10px;font-family:monospace;font-size:11px;z-index:200;border-radius:5px;
      max-width:320px;display:none;
    `;
      this.panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">${t("debug.title")}</div>
      <div id="debug-coords">—</div>
      <div id="debug-fps">FPS: —</div>
      <div id="debug-entities">${t("debug.entities")}: —</div>
      <div id="debug-projectiles">${t("debug.projectiles")}: —</div>
      <hr style="margin:4px 0;border-color:#333;">
      <div id="debug-radio-log" style="font-size:10px;color:#aaa;max-height:100px;overflow-y:auto;"></div>
    `;
      document.body.appendChild(this.panel);
      this.container.addEventListener("mousemove", (e) => {
        if (!this.enabled) return;
        const rect = this.container.getBoundingClientRect();
        this.mouseX = Math.floor((e.clientX - rect.left) / CELL_SIZE + this.world.camera.x);
        this.mouseY = Math.floor((e.clientY - rect.top) / CELL_SIZE + this.world.camera.y);
      });
      this.world.eventBus.on("bot:radio", (msg) => this.logRadio(msg));
    }
    logRadio(msg) {
      const time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      this.radioLog.unshift(`[${time}] ${msg.name}: ${msg.type}`);
      if (this.radioLog.length > 10) this.radioLog.pop();
      const el = document.getElementById("debug-radio-log");
      if (el) el.innerHTML = this.radioLog.join("<br>");
    }
    setEnabled(on) {
      this.enabled = on;
      this.canvas.style.display = on ? "block" : "none";
      this.panel.style.display = on ? "block" : "none";
      if (!on) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    toggle() {
      this.setEnabled(!this.enabled);
      return this.enabled;
    }
    redraw() {
      if (!this.enabled) return;
      const now = performance.now();
      if (now - this.lastRedraw < 100) return;
      this.lastRedraw = now;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawLOS();
      this.drawBotStates();
      this.drawPOIs();
      this.drawPath();
      this.updateStats(now);
    }
    drawLOS() {
      const cam = this.world.camera;
      const from = cam.toScreen(this.world.player.gx, this.world.player.gy);
      const to = cam.toScreen(this.mouseX, this.mouseY);
      const cells = this.world.grid.getLineCells(
        this.world.player.gx,
        this.world.player.gy,
        this.mouseX,
        this.mouseY
      );
      let totalBlock = 0;
      const seen = /* @__PURE__ */ new Set();
      for (let i = 1; i < cells.length - 1; i++) {
        const obs = this.world.grid.getObstacleAtCell(cells[i].x, cells[i].y);
        if (obs && !seen.has(obs.id)) {
          seen.add(obs.id);
          totalBlock += obs.visionBlock;
          if (totalBlock >= 1) break;
        }
      }
      const color = totalBlock >= 1 ? "#ff0000" : totalBlock > 0.5 ? "#ff6600" : totalBlock > 0 ? "#ffff00" : "#00ff00";
      this.ctx.beginPath();
      this.ctx.moveTo(from.x + CELL_SIZE / 2, from.y + CELL_SIZE / 2);
      this.ctx.lineTo(to.x + CELL_SIZE / 2, to.y + CELL_SIZE / 2);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
    drawBotStates() {
      const cam = this.world.camera;
      for (const bot of this.world.entities.values()) {
        if (bot.isPlayer || !bot.isAlive || !bot.botBrain) continue;
        const pos = cam.toScreen(bot.gx, bot.gy);
        const brain = bot.botBrain;
        const stateColor = brain.state === AI_STATE.PATROL ? "#00ff00" : brain.state === AI_STATE.ALERT ? "#ffff00" : "#ff0000";
        this.ctx.fillStyle = stateColor;
        this.ctx.font = "bold 10px monospace";
        this.ctx.fillText(brain.state, pos.x + 2, pos.y - 5);
        const intent = brain.currentIntent || "?";
        const intentColor = INTENT_COLORS[intent] || "#ffffff";
        this.ctx.fillStyle = intentColor;
        this.ctx.font = "bold 9px monospace";
        this.ctx.fillText(intent.toUpperCase(), pos.x + 2, pos.y + 26);
        if (brain.intentTarget) {
          const tp = cam.toScreen(brain.intentTarget.gx, brain.intentTarget.gy);
          this.ctx.beginPath();
          this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
          this.ctx.lineTo(tp.x + CELL_SIZE / 2, tp.y + CELL_SIZE / 2);
          this.ctx.strokeStyle = intentColor + "99";
          this.ctx.setLineDash([3, 3]);
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
        this.ctx.font = "8px monospace";
        this.ctx.fillStyle = "#aaaaaa";
        this.ctx.fillText(`I:${brain.interest.toFixed(0)} S:${((bot.suppression || 0) * 100).toFixed(0)}%`, pos.x + 2, pos.y + 15);
        this.drawLookDirection(bot, pos);
        if (brain.lastSeenPlayerPos) {
          const tp = cam.toScreen(brain.lastSeenPlayerPos.gx, brain.lastSeenPlayerPos.gy);
          this.ctx.beginPath();
          this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
          this.ctx.lineTo(tp.x + CELL_SIZE / 2, tp.y + CELL_SIZE / 2);
          this.ctx.strokeStyle = "rgba(0,255,255,0.4)";
          this.ctx.setLineDash([5, 5]);
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
      }
    }
    drawLookDirection(bot, pos) {
      const len = CELL_SIZE * 0.8;
      const ex = pos.x + CELL_SIZE / 2 + Math.cos(bot.facingAngle) * len;
      const ey = pos.y + CELL_SIZE / 2 + Math.sin(bot.facingAngle) * len;
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
      this.ctx.lineTo(ex, ey);
      this.ctx.strokeStyle = "#00ffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }
    drawPOIs() {
      const cam = this.world.camera;
      const pois = this.world.poiManager.getActiveForSector(this.world.currentSectorId);
      for (const poi of pois) {
        const pos = cam.toScreen(poi.gx, poi.gy);
        const color = poi.type === POI_TYPE.LOOT ? "#ffcc00" : poi.type === POI_TYPE.ALERT ? "#ff4444" : "#44ff44";
        this.ctx.beginPath();
        this.ctx.arc(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2, poi.radius * CELL_SIZE, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.fillStyle = color;
        this.ctx.font = "8px monospace";
        this.ctx.fillText(poi.type, pos.x + 2, pos.y - 2);
      }
    }
    drawPath() {
      const cam = this.world.camera;
      for (const bot of this.world.entities.values()) {
        if (bot.isPlayer || !bot.botBrain || !bot.botBrain.currentPath) continue;
        const path = bot.botBrain.currentPath;
        if (path.length === 0) continue;
        this.ctx.beginPath();
        let started = false;
        for (const p of path) {
          const pos = cam.toScreen(p.gx, p.gy);
          if (!started) {
            this.ctx.moveTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
            started = true;
          } else {
            this.ctx.lineTo(pos.x + CELL_SIZE / 2, pos.y + CELL_SIZE / 2);
          }
        }
        this.ctx.strokeStyle = "rgba(255,255,0,0.4)";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }
    updateStats(now) {
      const dt = now - this.lastFrameTime;
      if (dt > 0) this.fps = this.fps * 0.9 + 1e3 / dt * 0.1;
      this.lastFrameTime = now;
      const q = (id) => document.getElementById(id);
      const coordsEl = q("debug-coords");
      if (coordsEl) coordsEl.textContent = `x: ${this.mouseX}, y: ${this.mouseY}`;
      const fpsEl = q("debug-fps");
      if (fpsEl) fpsEl.textContent = `FPS: ${Math.round(this.fps)}`;
      const entEl = q("debug-entities");
      if (entEl) entEl.textContent = `${t("debug.entities")}: ${this.world.entities.size}`;
      const projEl = q("debug-projectiles");
      if (projEl) projEl.textContent = `${t("debug.projectiles")}: ${this.world.projectiles.length}`;
    }
  }
  class Renderer {
    constructor(world, canvas, obstacleCanvas, entityLayer) {
      this.world = world;
      this.canvas = canvas;
      this.obstacleCanvas = obstacleCanvas;
      this.entityLayer = entityLayer;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
      this.obstacleCtx = obstacleCanvas.getContext("2d");
      this.obstacleCtx.imageSmoothingEnabled = false;
      this.sprites = /* @__PURE__ */ new Map();
      this.projectileSprites = /* @__PURE__ */ new Map();
      this.smokeElements = /* @__PURE__ */ new Map();
      this.world.eventBus.on("entity:spawned", (e) => this.createEntitySprite(e));
      this.world.eventBus.on("entity:removed", (e) => this.destroyEntitySprite(e));
      this.world.eventBus.on("fx:hit", (fx) => this.spawnHitFx(fx));
      this.world.eventBus.on("fx:explosion", (fx) => this.spawnExplosionFx(fx));
    }
    createEntitySprite(entity) {
      if (this.sprites.has(entity.id)) return;
      const el = document.createElement("img");
      el.style.cssText = `position:absolute;width:${CELL_SIZE}px;height:${CELL_SIZE}px;image-rendering:pixelated;pointer-events:none;z-index:${entity.isPlayer ? 20 : 15};will-change:transform;`;
      const img = entity.isPlayer ? this.world.assets.getCharSprite(entity.currentWeaponId || "tt33") : this.world.assets.getCharSprite(entity.profile?.primaryWeapon || "ak47");
      if (img) el.src = img.src;
      this.entityLayer.appendChild(el);
      const hpBar = document.createElement("div");
      hpBar.style.cssText = `position:absolute;width:${CELL_SIZE}px;height:4px;background:#333;z-index:${entity.isPlayer ? 21 : 16};pointer-events:none;display:none;`;
      const hpFill = document.createElement("div");
      hpFill.style.cssText = "height:100%;background:#4caf50;width:100%;";
      hpBar.appendChild(hpFill);
      this.entityLayer.appendChild(hpBar);
      this.sprites.set(entity.id, {
        element: el,
        hpBar,
        hpFill,
        lastWeaponId: entity.currentWeaponId,
        lastHp: entity.hp
      });
    }
    destroyEntitySprite(entity) {
      const s = this.sprites.get(entity.id);
      if (!s) return;
      if (s.element.parentNode) s.element.remove();
      if (s.hpBar.parentNode) s.hpBar.remove();
      this.sprites.delete(entity.id);
    }
    updateEntitySprites() {
      const cam = this.world.camera;
      for (const entity of this.world.entities.values()) {
        const s = this.sprites.get(entity.id);
        if (!s) {
          this.createEntitySprite(entity);
          continue;
        }
        if (!entity.isAlive) continue;
        const screen = cam.toScreen(entity.gx, entity.gy);
        s.element.style.left = screen.x + "px";
        s.element.style.top = screen.y + "px";
        s.element.style.transform = `rotate(${entity.facingAngle}rad)`;
        s.element.style.transformOrigin = CELL_SIZE / 2 + "px " + CELL_SIZE / 2 + "px";
        s.element.style.display = "block";
        const weaponId = entity.currentWeaponId;
        if (weaponId !== s.lastWeaponId) {
          const img = this.world.assets.getCharSprite(weaponId || (entity.isPlayer ? "tt33" : "ak47"));
          if (img) s.element.src = img.src;
          s.lastWeaponId = weaponId;
        }
        if (entity.hp < entity.maxHp) {
          s.hpBar.style.display = "block";
          s.hpBar.style.left = screen.x + "px";
          s.hpBar.style.top = screen.y - 6 + "px";
          const pct = Math.max(0, entity.hp / entity.maxHp * 100);
          s.hpFill.style.width = pct + "%";
          s.hpFill.style.background = pct > 60 ? "#4caf50" : pct > 30 ? "#ff9800" : "#f44336";
        } else {
          s.hpBar.style.display = "none";
        }
        s.lastHp = entity.hp;
      }
    }
    drawGround() {
      const cam = this.world.camera;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const terrain = this.world.assets.getImage(TERRAIN_SPRITE_KEY);
      if (!terrain) {
        ctx.fillStyle = "#8B7355";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      const startGx = Math.floor(cam.x) - 1;
      const startGy = Math.floor(cam.y) - 1;
      const endGx = startGx + VIEW_W + 1;
      const endGy = startGy + VIEW_H + 1;
      for (let gy = startGy; gy <= endGy; gy++) {
        for (let gx = startGx; gx <= endGx; gx++) {
          const scr = cam.toScreen(gx, gy);
          ctx.drawImage(terrain, scr.x, scr.y, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    drawObstacles() {
      const grid = this.world.grid;
      const cam = this.world.camera;
      const ctx = this.obstacleCtx;
      ctx.clearRect(0, 0, this.obstacleCanvas.width, this.obstacleCanvas.height);
      if (!grid.sector) return;
      const pad = 2;
      const startGx = Math.floor(cam.x) - pad;
      const startGy = Math.floor(cam.y) - pad;
      const endGx = Math.ceil(cam.x + VIEW_W) + pad;
      const endGy = Math.ceil(cam.y + VIEW_H) + pad;
      for (let gy = startGy; gy <= endGy; gy++) {
        for (let gx = startGx; gx <= endGx; gx++) {
          const obs = grid.getObstacleAtCell(gx, gy);
          if (!obs) continue;
          if (obs.anchorGx !== gx || obs.anchorGy !== gy) continue;
          const def = OBSTACLE_TYPES[obs.logicType];
          if (!def) continue;
          const scr = cam.toScreen(gx, gy);
          const w = def.size[0] * CELL_SIZE;
          const h = def.size[1] * CELL_SIZE;
          if (scr.x + w < 0 || scr.x > VIEW_W * CELL_SIZE) continue;
          if (scr.y + h < 0 || scr.y > VIEW_H * CELL_SIZE) continue;
          const img = this.world.assets.getImage(obs.rawKey);
          if (img) {
            ctx.drawImage(img, scr.x, scr.y, w, h);
          } else {
            ctx.fillStyle = obs.logicType === "water" ? "rgba(70,130,180,0.4)" : "rgba(85,107,47,0.4)";
            ctx.fillRect(scr.x, scr.y, w, h);
          }
        }
      }
    }
    updateProjectiles() {
      const cam = this.world.camera;
      const active = /* @__PURE__ */ new Set();
      for (const proj of this.world.projectiles) {
        active.add(proj);
        let el = this.projectileSprites.get(proj);
        if (!el) {
          el = document.createElement("div");
          el.style.cssText = "position:absolute;pointer-events:none;z-index:100;border-radius:40%;";
          if (proj.isGrenade) {
            el.style.width = "8px";
            el.style.height = "8px";
            el.style.borderRadius = "50%";
            el.style.backgroundColor = proj.grenade.itemId === "grenade_smoke" ? "#888" : "#c44";
            el.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";
          } else {
            const ammo = proj.ammo;
            if (ammo.shape === "circle") {
              el.style.width = ammo.size + "px";
              el.style.height = ammo.size + "px";
              el.style.borderRadius = "50%";
            } else {
              el.style.width = ammo.size[0] + "px";
              el.style.height = ammo.size[1] + "px";
            }
            el.style.backgroundColor = ammo.color;
            el.style.boxShadow = proj.owner === this.world.player ? "0 0 6px rgba(255,220,80,0.9)" : "0 0 6px rgba(255,120,120,0.9)";
          }
          this.entityLayer.appendChild(el);
          this.projectileSprites.set(proj, el);
        }
        const screen = cam.toScreen(proj.wx - 0.5, proj.wy - 0.5);
        el.style.left = screen.x + CELL_SIZE / 2 - 4 + "px";
        el.style.top = screen.y + CELL_SIZE / 2 - 4 + "px";
        if (!proj.isGrenade) {
          const angle = Math.atan2(proj.dirY, proj.dirX) * 180 / Math.PI;
          el.style.transform = `rotate(${angle}deg)`;
        }
      }
      for (const [proj, el] of this.projectileSprites) {
        if (!active.has(proj)) {
          if (el.parentNode) el.remove();
          this.projectileSprites.delete(proj);
        }
      }
    }
    updateSmoke() {
      const cam = this.world.camera;
      const active = /* @__PURE__ */ new Set();
      for (const smoke of this.world.smokeClouds) {
        if (smoke.sectorId !== this.world.currentSectorId) continue;
        const elapsed = performance.now() - smoke.createdAt;
        if (elapsed > smoke.duration) continue;
        active.add(smoke);
        let el = this.smokeElements.get(smoke);
        if (!el) {
          el = document.createElement("div");
          el.style.cssText = "position:absolute;pointer-events:none;z-index:11;background:radial-gradient(circle, rgba(150,150,150,0.8), rgba(100,100,100,0.4), transparent);border-radius:50%;";
          this.entityLayer.appendChild(el);
          this.smokeElements.set(smoke, el);
        }
        const radiusPx = smoke.radius * CELL_SIZE;
        const scr = cam.toScreen(smoke.gx - smoke.radius, smoke.gy - smoke.radius);
        el.style.left = scr.x + "px";
        el.style.top = scr.y + "px";
        el.style.width = radiusPx * 2 + "px";
        el.style.height = radiusPx * 2 + "px";
        const lifeRatio = 1 - elapsed / smoke.duration;
        el.style.opacity = (0.7 * lifeRatio).toFixed(2);
      }
      for (const [smoke, el] of this.smokeElements) {
        if (!active.has(smoke)) {
          if (el.parentNode) el.remove();
          this.smokeElements.delete(smoke);
        }
      }
    }
    spawnHitFx(fx) {
      const cam = this.world.camera;
      const scr = cam.toScreen(fx.gx, fx.gy);
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;left:${scr.x + CELL_SIZE / 2 - 10}px;top:${scr.y + CELL_SIZE / 2 - 10}px;width:20px;height:20px;background:radial-gradient(circle,#ff6600,#ff0000);border-radius:50%;opacity:0.8;pointer-events:none;z-index:101;animation:hitFlash 0.2s ease-out forwards;`;
      this.entityLayer.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 200);
    }
    spawnExplosionFx(fx) {
      const cam = this.world.camera;
      const scr = cam.toScreen(fx.gx, fx.gy);
      const radius = (fx.radius || 2) * CELL_SIZE;
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;left:${scr.x + CELL_SIZE / 2 - radius}px;top:${scr.y + CELL_SIZE / 2 - radius}px;width:${radius * 2}px;height:${radius * 2}px;background:radial-gradient(circle,rgba(255,200,50,0.9),rgba(255,100,0,0.7),transparent);border-radius:50%;pointer-events:none;z-index:101;animation:explode 0.35s ease-out forwards;`;
      this.entityLayer.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 350);
    }
    draw() {
      if (!this.world.grid || !this.world.grid.sector) return;
      this.drawGround();
      this.drawObstacles();
      this.updateEntitySprites();
      this.updateProjectiles();
      this.updateSmoke();
    }
  }
  function injectRendererStyles() {
    const style = document.createElement("style");
    style.textContent = `
    @keyframes explode { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
    @keyframes hitFlash { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
  `;
    document.head.appendChild(style);
  }
  const AUTO_KEY = "auto_save";
  const AUTO_BACKUP_KEY = "auto_save_backup";
  const MANUAL_KEY_PREFIX = "manual_save_";
  const MANUAL_MAX = 3;
  const SAVE_VERSION = 2;
  const MIGRATORS = {
    1: (data) => {
      if (!data.currentSectorState) {
        data.currentSectorState = {
          sectorId: data.currentSectorId,
          bots: [],
          pois: []
        };
      }
      if (!data.allPois) {
        data.allPois = data.pois || [];
      }
      if (!data.nextEntityId) {
        data.nextEntityId = 1;
      }
      for (const s of data.sectorStates || []) {
        for (const b of s.bots || []) {
          if (!b.brainState && b.state) {
            b.brainState = { state: b.state, interest: b.interest || 0 };
          }
          if (!b.activeWeaponSlot) b.activeWeaponSlot = "primary";
        }
      }
      data.version = 2;
      return data;
    }
  };
  class SaveManager {
    constructor(db, world) {
      this.db = db;
      this.world = world;
    }
    migrate(data) {
      if (!data) return data;
      let version = data.version || 1;
      while (version < SAVE_VERSION) {
        const migrator = MIGRATORS[version];
        if (!migrator) {
          console.warn("[SaveManager] No migrator for version", version);
          break;
        }
        try {
          data = migrator(data);
        } catch (err) {
          console.error("[SaveManager] Migrator error for version", version, err);
          return null;
        }
        version = data.version || version + 1;
      }
      return data;
    }
    async saveAuto() {
      const data = this.world.serialize();
      data.version = SAVE_VERSION;
      const prev = await this.db.get("saves", AUTO_KEY);
      if (prev) await this.db.put("saves", AUTO_BACKUP_KEY, prev);
      await this.db.put("saves", AUTO_KEY, { ...data, savedAt: Date.now() });
      return true;
    }
    async saveManual(slot) {
      if (slot < 1 || slot > MANUAL_MAX) return false;
      const key = MANUAL_KEY_PREFIX + slot;
      const data = this.world.serialize();
      data.version = SAVE_VERSION;
      await this.db.put("saves", key, { ...data, savedAt: Date.now() });
      return true;
    }
    async load(key) {
      const raw = await this.db.get("saves", key);
      if (!raw) return false;
      const version = raw.version || 1;
      if (version > SAVE_VERSION) {
        console.error("[SaveManager] Save version", version, "is newer than current", SAVE_VERSION);
        return false;
      }
      const data = this.migrate(raw);
      if (!data) {
        console.error("[SaveManager] Migration failed for", key);
        return false;
      }
      try {
        await this.world.deserialize(data);
        return true;
      } catch (err) {
        console.error("[SaveManager] Deserialize failed:", err);
        return false;
      }
    }
    async loadAuto() {
      return this.load(AUTO_KEY);
    }
    async loadAutoBackup() {
      return this.load(AUTO_BACKUP_KEY);
    }
    async loadManual(slot) {
      return this.load(MANUAL_KEY_PREFIX + slot);
    }
    async listSaves() {
      const out = { auto: null, autoBackup: null, manual: [] };
      out.auto = await this.db.get("saves", AUTO_KEY);
      out.autoBackup = await this.db.get("saves", AUTO_BACKUP_KEY);
      for (let i = 1; i <= MANUAL_MAX; i++) {
        const d = await this.db.get("saves", MANUAL_KEY_PREFIX + i);
        out.manual.push({ slot: i, data: d || null });
      }
      return out;
    }
    async deleteSave(key) {
      await this.db.delete("saves", key);
    }
    async deleteAllSaves() {
      await this.db.deleteAllSaves();
    }
    async deleteAllGameData() {
      await this.db.clearAll();
      await this.db.deleteAllSaves();
    }
  }
  function applyPlayerLoadout(entity) {
    entity.stats = new Stats(10, 10, 10, 10);
    entity.hp = entity.stats.maxHp;
    entity.inventory = new Inventory();
    entity.equipWeapon("tt33");
    entity.inventory.equip("secondary", { id: "tt33", weight: WEAPONS.tt33.weight });
    entity.inventory.setBelt(0, { ...CONSUMABLE_ITEMS.medkit });
    entity.inventory.setBelt(1, { ...CONSUMABLE_ITEMS.grenade_frag });
    entity.inventory.setBelt(2, { ...CONSUMABLE_ITEMS.grenade_smoke });
    entity.activeWeaponSlot = "secondary";
    entity.currentWeaponId = "tt33";
    entity.currentAmmo = WEAPONS.tt33.magazineSize;
    entity.isReloading = false;
    entity.reloadEndTime = 0;
    entity.recoil = 0;
    entity.suppression = 0;
    entity.currentBurstId = null;
  }
  class GameEngine {
    constructor(db, assets) {
      this.db = db;
      this.assets = assets;
      this.world = new World(db, assets);
      this.world.game = this;
      this.saveManager = new SaveManager(db, this.world);
      this.settings = new SettingsStore();
      this.lastTime = 0;
      this.running = false;
      this.autoSaveTimer = 0;
      this.worldDataMissing = false;
      this.dom = null;
      this.renderer = null;
      this.debug = null;
      this.input = null;
    }
    async init() {
      injectRendererStyles();
      this.createDOM();
      this.bindUI();
      this.world.eventBus.on("player:died", () => this.onPlayerDied());
      this.world.eventBus.on("player:respawned", () => this.onPlayerRespawned());
      try {
        await this.world.init();
        applyPlayerLoadout(this.world.player);
      } catch (err) {
        console.warn("[Subgraphs] World init failed (data missing?):", err.message);
        this.worldDataMissing = true;
        this.world.eventBus.emit("hud:message", "Данные не загружены. Меню → Данные игры → Загрузить ZIP.");
        this.showDataPrompt();
      }
    }
    showDataPrompt() {
      const overlay = document.createElement("div");
      overlay.id = "data-missing-prompt";
      overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid #ff9800;border-radius:8px;
      padding:24px;z-index:1500;color:#eee;font-family:monospace;text-align:center;
      max-width:420px;
    `;
      overlay.innerHTML = `
      <h3 style="margin-top:0;color:#ff9800;">Данные игры не загружены</h3>
      <p>Чтобы начать играть, загрузите ZIP с данными игры.</p>
      <button id="open-data-screen" style="padding:8px 16px;background:#1565c0;color:#fff;border:none;cursor:pointer;margin-right:8px;">
        Открыть «Данные игры»
      </button>
      <button id="open-menu" style="padding:8px 16px;background:#555;color:#fff;border:none;cursor:pointer;">
        Меню
      </button>
    `;
      document.body.appendChild(overlay);
      overlay.querySelector("#open-data-screen").onclick = () => {
        overlay.remove();
        this.world.ui.dataScreen.toggle();
      };
      overlay.querySelector("#open-menu").onclick = () => {
        overlay.remove();
        this.world.ui.menu.toggle();
      };
    }
    async reloadWorld() {
      this.worldDataMissing = false;
      try {
        await this.world.init();
        applyPlayerLoadout(this.world.player);
        this.world.eventBus.emit("hud:message", "Мир загружен");
      } catch (err) {
        console.warn("[Subgraphs] Reload failed:", err.message);
        this.worldDataMissing = true;
        this.showDataPrompt();
      }
    }
    createDOM() {
      const root = document.createElement("div");
      root.id = "subgraphs-root";
      root.style.cssText = "display:flex;flex-direction:row;gap:16px;margin:20px auto;user-select:none;width:auto;";
      document.body.appendChild(root);
      const viewport = document.createElement("div");
      viewport.id = "viewport-container";
      viewport.style.cssText = `position:relative;width:${VIEW_W * CELL_SIZE}px;height:${VIEW_H * CELL_SIZE}px;overflow:hidden;flex-shrink:0;background:#000;`;
      root.appendChild(viewport);
      const gameCanvas = document.createElement("canvas");
      gameCanvas.width = VIEW_W * CELL_SIZE;
      gameCanvas.height = VIEW_H * CELL_SIZE;
      gameCanvas.style.cssText = "position:absolute;top:0;left:0;z-index:1;cursor:crosshair;";
      viewport.appendChild(gameCanvas);
      const obstacleCanvas = document.createElement("canvas");
      obstacleCanvas.width = VIEW_W * CELL_SIZE;
      obstacleCanvas.height = VIEW_H * CELL_SIZE;
      obstacleCanvas.style.cssText = "position:absolute;top:0;left:0;z-index:2;pointer-events:none;";
      viewport.appendChild(obstacleCanvas);
      const entityLayer = document.createElement("div");
      entityLayer.id = "entity-layer";
      entityLayer.style.cssText = "position:absolute;top:0;left:0;z-index:12;pointer-events:none;width:100%;height:100%;";
      viewport.appendChild(entityLayer);
      const sidebar = document.createElement("div");
      sidebar.style.cssText = "display:flex;flex-direction:column;gap:12px;flex-shrink:0;";
      root.appendChild(sidebar);
      this.dom = { root, viewport, gameCanvas, obstacleCanvas, entityLayer, sidebar };
    }
    bindUI() {
      this.renderer = new Renderer(
        this.world,
        this.dom.gameCanvas,
        this.dom.obstacleCanvas,
        this.dom.entityLayer
      );
      this.input = new InputSystem(this.world);
      this.input.init(this.dom.gameCanvas);
      this.input.keyBindings = { ...this.settings.get("keyBindings") };
      const hud = new HUD(this.world);
      hud.mount(this.dom.sidebar);
      const minimap = new Minimap(this.world);
      minimap.mount(this.dom.sidebar);
      minimap.setVisible(this.settings.get("showMinimap"));
      const globalMap = new GlobalMap(this.world);
      globalMap.mount(this.dom.sidebar);
      globalMap.setVisible(this.settings.get("showGlobalMap"));
      const inventory = new InventoryUI(this.world);
      inventory.mount();
      this.debug = new DebugOverlay(this.world, this.dom.viewport);
      this.debug.setEnabled(!!this.settings.get("debug"));
      const settingsScreen = new SettingsScreen(this.world, this.input, this.settings, this.debug);
      settingsScreen.mount();
      const menu = new Menu(this.world, this.saveManager);
      menu.mount();
      const dataScreen = new DataScreen(this.world, this.db, this.saveManager);
      dataScreen.mount();
      dataScreen.onAfterImport = () => {
        if (this.worldDataMissing) this.reloadWorld();
      };
      this.world.ui = { hud, inventory, minimap, globalMap, menu, settings: settingsScreen, dataScreen };
      this.world.eventBus.on("sector:changed", () => {
        if (this.renderer) this.renderer.draw();
      });
      this.world.eventBus.on("settings:debug-changed", (enabled) => {
        this.debug.setEnabled(!!enabled);
      });
      this.world.eventBus.on("settings:maps-changed", ({ showMinimap, showGlobalMap }) => {
        this.world.ui.minimap.setVisible(showMinimap);
        this.world.ui.globalMap.setVisible(showGlobalMap);
      });
    }
    onPlayerDied() {
      this.world.eventBus.emit("hud:message", "Вы погибли…");
    }
    onPlayerRespawned() {
      this.world.eventBus.emit("hud:message", "Респавн");
    }
    start() {
      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t2) => this.loop(t2));
    }
    loop(now) {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1e3, 0.1);
      this.lastTime = now;
      if (!this.worldDataMissing && this.world.player && this.world.grid.sector) {
        if (this.world.player.isAlive) {
          const move = this.input.getMoveDir();
          if (move.dx !== 0 || move.dy !== 0) {
            this.world.tryPlayerMove(move.dx, move.dy);
          }
        }
        this.world.update(dt, now);
        this.world.ui.hud.update(this.world.player, this.world.currentSectorId, this.world.aliveBotCount());
        this.world.ui.minimap.draw();
        this.world.ui.globalMap.draw();
        if (this.debug.enabled) this.debug.redraw();
        this.renderer.draw();
        if (now - this.autoSaveTimer > 5 * 60 * 1e3) {
          this.autoSaveTimer = now;
          this.saveManager.saveAuto().catch((e) => console.error("[AutoSave]", e));
        }
      }
      requestAnimationFrame((t2) => this.loop(t2));
    }
    stop() {
      this.running = false;
    }
  }
  (async function main() {
    const db = new DBManager();
    await db.init();
    const assets = new AssetManager(db);
    const game = new GameEngine(db, assets);
    try {
      await game.init();
      game.start();
      console.log("[Subgraphs] Ready");
    } catch (err) {
      console.error("[Subgraphs] Init failed:", err);
      alert("Ошибка инициализации. Проверьте консоль.");
    }
    window.__subgraphs = { game, db, assets };
  })();
})();
