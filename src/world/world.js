// src/world/world.js

import { GridSystem } from './grid.js';
import { CameraSystem } from './camera.js';
import { TransitionManager } from './transitions.js';
import { LOSCache } from './los-cache.js';
import { POIManager } from './poi.js';
import { SpawnManager } from './spawn-manager.js';
import { SoundManager } from '../core/sound.js';
import { TaskQueue } from '../core/task-queue.js';
import { EventBus } from '../core/event-bus.js';
import { Pathfinding } from '../ai/pathfinding.js';
import { RadioManager } from '../ai/communication.js';
import { GroupManager } from '../ai/group-manager.js';
import { BotBrain } from '../ai/bot-brain.js';
import { Entity, setProjectileClass } from '../entities/entity.js';
import { Projectile } from '../entities/projectile.js';
import { Inventory } from '../entities/inventory.js';
import { Stats } from '../entities/stats.js';
import {
  MAX_PROJECTILES, SAFE_ZONE, SOUND_LOUDNESS,
  SUPPRESSION_GAIN, SUPPRESSION_NEAR_RADIUS, WORLD_SIM, SPAWN
} from '../core/constants.js';
import { BELT_SLOTS } from '../entities/inventory.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR_ITEMS } from '../data/armor.js';
import { BOT_PROFILES, BOT_PROFILE_WEIGHTS } from '../data/bots.js';
import { CONSUMABLE_ITEMS } from '../data/items.js';
import { GLOBAL_LAYOUT } from '../data/global-layout.js';
import { t } from '../core/strings.js';

const GRENADE_THROW_RANGE = 5;
const SAVE_VERSION = 2;

export class World {
  constructor(db, assets) {
    this.db = db;
    this.assets = assets;
    this.game = null;
    this.eventBus = new EventBus();
    this.taskQueue = new TaskQueue();

    this.entities = new Map();
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
    this.inactiveSectors = new Map();
    this.sectorStates = new Map();
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
    const data = await this.db.get('caches', sectorId);
    if (!data) return;

    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.caches)) list = data.caches;

    for (const cache of list) {
      if (cache.gx === undefined || cache.gy === undefined) continue;
      if (!this.grid.isWalkable(cache.gx, cache.gy, null)) continue;

      const items = (cache.items || []).map((it) => {
        if (typeof it === 'string') return { id: it };
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
    console.log('[World] caches loaded for sector', sectorId, ':', list.length);
  }

  selectBeltSlot(index) {
    if (!this.player) return;
    if (index < 0 || index >= BELT_SLOTS) return;

    const item = this.player.inventory.getBelt(index);

    if (this.selectedBeltSlot === index) {
      this.selectedBeltSlot = null;
      this.eventBus.emit('hud:message', t('msg.itemDeselected'));
      this.eventBus.emit('belt:selection', null);
      return;
    }

    if (!item) {
      this.eventBus.emit('hud:message', t('msg.slotEmpty'));
      return;
    }

    this.selectedBeltSlot = index;
    const def = CONSUMABLE_ITEMS[item.id];
    const name = def ? t(def.nameKey) : item.id;
    this.eventBus.emit('hud:message', t('msg.itemSelected', { name }));
    this.eventBus.emit('belt:selection', index);
  }

  cancelSelection() {
    if (this.selectedBeltSlot === null) return;
    this.selectedBeltSlot = null;
    this.eventBus.emit('hud:message', t('msg.itemDeselected'));
    this.eventBus.emit('belt:selection', null);
  }

  useSelectedItemOnCell(gx, gy) {
    if (this.selectedBeltSlot === null) return false;
    const index = this.selectedBeltSlot;
    const item = this.player.inventory.getBelt(index);
    if (!item) {
      this.selectedBeltSlot = null;
      this.eventBus.emit('belt:selection', null);
      this.eventBus.emit('hud:message', t('msg.slotEmpty'));
      return false;
    }
    const def = CONSUMABLE_ITEMS[item.id];
    if (!def) return false;

    if (def.type === 'heal') {
      if (gx !== this.player.gx || gy !== this.player.gy) {
        this.selectedBeltSlot = null;
        this.eventBus.emit('belt:selection', null);
        this.eventBus.emit('hud:message', t('msg.noTargetToHeal'));
        return false;
      }
      const before = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.healAmount);
      const healed = this.player.hp - before;
      this.player.inventory.useBelt(index);
      this.selectedBeltSlot = null;
      this.eventBus.emit('belt:selection', null);
      this.eventBus.emit('hud:message', t('msg.healed', { hp: healed }));
      return true;
    }

    if (def.type === 'grenade') {
      const dist = Math.max(Math.abs(gx - this.player.gx), Math.abs(gy - this.player.gy));
      if (dist > GRENADE_THROW_RANGE) {
        this.selectedBeltSlot = null;
        this.eventBus.emit('belt:selection', null);
        this.eventBus.emit('hud:message', t('msg.grenadeOutOfRange'));
        return false;
      }
      const ok = this.player.throwGrenade(gx, gy, item.id);
      if (ok) {
        this.selectedBeltSlot = null;
        this.eventBus.emit('belt:selection', null);
        this.eventBus.emit('hud:message', t('msg.grenadeThrown'));
        return true;
      } else {
        this.eventBus.emit('hud:message', t('msg.itemUseFailed'));
        return false;
      }
    }

    this.selectedBeltSlot = null;
    this.eventBus.emit('belt:selection', null);
    return false;
  }

  spawnPlayer() {
    const player = new Entity({
      id: 'player',
      type: 'player',
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
    console.log('[World] initial bots placed in current sector:', placed);
  }

  deferBotSpawn(sectorId) {
    if (!this.sectorStates.has(sectorId)) {
      this.sectorStates.set(sectorId, { bots: [], pois: [] });
    }
    this.sectorStates.get(sectorId).bots.push({
      id: 'bot_' + (this._nextEntityId++),
      gx: null, gy: null,
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
        console.warn('[World] spawnBot rejected (not walkable):', { sectorId, gx, gy, obstacle: this.grid.getObstacleAtCell(gx, gy) });
        return null;
      }
    }

    const id = 'bot_' + (this._nextEntityId++);
    const bot = new Entity({ id, type: 'bot', gx, gy, profile, world: this });
    this.setupBot(bot, profile);
    this.entities.set(id, bot);
    this.eventBus.emit('entity:spawned', bot);
    return bot;
  }

  _profileId(profile) {
    for (const k in BOT_PROFILES) {
      if (BOT_PROFILES[k] === profile) return k;
    }
    return 'assault';
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
      bot.inventory.equip('secondary', {
        id: profile.secondaryWeapon,
        weight: WEAPONS[profile.secondaryWeapon].weight
      });
    }
    if (profile.armor.head) {
      bot.inventory.equip('head', { id: profile.armor.head, weight: ARMOR_ITEMS[profile.armor.head].weight });
    }
    if (profile.armor.body) {
      bot.inventory.equip('body', { id: profile.armor.body, weight: ARMOR_ITEMS[profile.armor.body].weight });
    }
    if (profile.armor.legs) {
      bot.inventory.equip('legs', { id: profile.armor.legs, weight: ARMOR_ITEMS[profile.armor.legs].weight });
    }
    if (profile.armor.foot) {
      bot.inventory.equip('foot', { id: profile.armor.foot, weight: ARMOR_ITEMS[profile.armor.foot].weight });
    }

    bot.inventory.setBelt(0, { ...CONSUMABLE_ITEMS.medkit });
    const grenade = Math.random() < 0.5 ? 'grenade_frag' : 'grenade_smoke';
    bot.inventory.setBelt(1, { ...CONSUMABLE_ITEMS[grenade] });

    if (Math.random() < 0.4) {
      bot.inventory.addToGrid({ id: 'medkit', weight: CONSUMABLE_ITEMS.medkit.weight });
    }
    if (Math.random() < 0.3) {
      const extraGrenade = Math.random() < 0.5 ? 'grenade_frag' : 'grenade_smoke';
      bot.inventory.addToGrid({ id: extraGrenade, weight: CONSUMABLE_ITEMS[extraGrenade].weight });
    }

    bot.botBrain = new BotBrain(bot, this, profile);
  }

  findFreeSpawnCell(sectorId) {
    const sector = this.grid.sector;
    if (!sector) return null;
    if (sectorId !== undefined && sector.id !== sectorId) {
      console.warn('[World] findFreeSpawnCell: sector mismatch', { requested: sectorId, current: sector.id });
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
      sectorId, gx, gy, radius, duration,
      owner,
      createdAt: performance.now()
    });
    this.eventBus.emit('fx:smoke', { gx, gy, radius });
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
    this.eventBus.emit('fx:hit', { gx: target.gx, gy: target.gy, zone });
  }

  emitSuppressionNear(gx, gy, target) {
    for (const e of this.entities.values()) {
      if (e === target) continue;
      if (!e.isAlive) continue;
      const d = Math.max(Math.abs(e.gx - gx), Math.abs(e.gy - gy));
      if (d <= SUPPRESSION_NEAR_RADIUS) {
        const supResist = e.stats.endurance / 20;
        e.suppression = Math.min(1.0, e.suppression + SUPPRESSION_GAIN * 0.5 * (1 - supResist));
      }
    }
  }

  explodeAt(x, y, { explosiveMass_g, radiusCells, shrapnelCount, shrapnelRange, owner }) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    this.eventBus.emit('fx:explosion', { gx: cx, gy: cy, radius: radiusCells });
    this.soundManager.emitSound(cx, cy, SOUND_LOUDNESS.explosion, 'explosion', owner);

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
    this.eventBus.emit('entity:removed', entity);
  }

  onPlayerDeath() {
    this.selectedBeltSlot = null;
    this.eventBus.emit('belt:selection', null);
    this.eventBus.emit('player:died');
    setTimeout(() => this.respawnPlayer(), 3000);
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
    this.eventBus.emit('belt:selection', null);

    this.entities.set(player.id, player);
    if (this.grid.sector) {
      this.camera.snapTo(player.gx, player.gy, this.grid.sector.width, this.grid.sector.height);
    }
    this.resetAllBotsAI();
    this.eventBus.emit('hud:message', t('msg.respawned'));
    this.eventBus.emit('player:respawned');
  }

  resetAllBotsAI() {
    for (const bot of this.entities.values()) {
      if (bot.isPlayer || !bot.botBrain) continue;
      bot.botBrain.state = 'patrol';
      bot.botBrain.stateEntryTime = performance.now();
      bot.botBrain.currentIntent = 'patrol';
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
        this.eventBus.emit('hud:message', t('msg.pickedUp', { name: t(def.nameKey), count: 1 }));
      } else {
        this.eventBus.emit('hud:message', t('msg.inventoryFull'));
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
      if (e.gx === gx && e.gy === gy) { targetBot = e; break; }
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
    this.soundManager.emitSound(nx, ny, SOUND_LOUDNESS.footstep, 'footstep', this.player);

    const tr = this.grid.getTransitionAt(nx, ny);
    if (tr) { this.handleTransition(tr); return; }

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
      this.eventBus.emit('entity:removed', e);
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
    this.eventBus.emit('belt:selection', null);

    this.restoreSectorState(targetSectorId);
    if (this.aliveBotCount() === 0) this.spawnInitialBotsForSector(targetSectorId);

    await this.loadCaches(targetSectorId);

    if (this.groupManager) {
      this.groupManager.groups.clear();
      this.groupManager.botToGroup.clear();
    }

    this.camera.snapTo(this.player.gx, this.player.gy, this.grid.sector.width, this.grid.sector.height);
    this.eventBus.emit('hud:message', t('msg.entered', { name: this.grid.sector.name || targetSectorId }));
    this.eventBus.emit('sector:changed', targetSectorId);
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
        gx: e.gx, gy: e.gy, hp: e.hp,
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
        console.warn('[World] restoreSectorState: no free spawn for bot', b.id);
        continue;
      }

      const bot = new Entity({ id: b.id, type: 'bot', gx: spawnPos.gx, gy: spawnPos.gy, profile, world: this });
      this.setupBot(bot, profile);
      if (b.hp !== undefined) bot.hp = b.hp;
      if (b.inventory) bot.inventory = Inventory.deserialize(b.inventory);
      if (b.currentWeaponId) bot.currentWeaponId = b.currentWeaponId;
      if (b.currentAmmo !== undefined) bot.currentAmmo = b.currentAmmo;
      if (b.facingAngle !== undefined) bot.facingAngle = b.facingAngle;
      if (b.activeWeaponSlot) bot.activeWeaponSlot = b.activeWeaponSlot;

      if (bot.botBrain && b.brainState) {
        bot.botBrain.deserializeState(b.brainState);
      }

      this.entities.set(bot.id, bot);
      this.eventBus.emit('entity:spawned', bot);
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
        gx: e.gx, gy: e.gy, hp: e.hp,
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
      version: SAVE_VERSION,
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